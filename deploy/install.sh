#!/usr/bin/env bash
# ============================================================================
# DeepSeek Harness (dsh web) + @my/dsh-plugin-auth — Linux 一键部署脚本
#
# 用法（在插件仓库根目录执行）:
#   MYSQL_PASSWORD=xxx bash deploy/install.sh           # 应用层安装 + 冒烟测试
#   sudo MYSQL_PASSWORD=xxx MYSQL_ROOT_PASSWORD=yyy \
#        bash deploy/install.sh                          # 额外初始化 MySQL + 装 systemd
#
# 可选环境变量:
#   DSH_AUTH_SECRET    cookie HMAC 密钥（>=32 字符；未设置则自动生成）
#   MYSQL_ROOT_PASSWORD 提供后才自动建库授权；否则打印 SQL 让你手动执行
#   DSH_HOME           数据根目录（默认 ~/.dsh）
#   DSH_VERSION        harness 版本（默认 latest）
#   SMOKE_TIMEOUT      冒烟测试等待秒数（默认 300，首次启动装依赖较慢）
#   SKIP_SMOKE=1       跳过冒烟测试
#
# 脚本做的事（全部对照真实代码验证过）:
#   1. 预检 Node(^22.19||>=24)/pnpm(11.7.0) 版本与密钥
#   2. npm pack 插件 -> dsh plugin --profile web add <tgz>
#      （首次会自动脚手架化 $DSH_HOME/profiles/web 并安装官方 bundle）
#   3. 把生产覆盖层（secureCookie/mysql 专用账号）合入 profile 的 cordis.patch.yml
#   4. 初始化 MySQL dsh_auth 库 + dsh 低权用户（需 MYSQL_ROOT_PASSWORD）
#   5. 冒烟测试: 起 dsh web --no-open，curl 127.0.0.1:3080/app 期待 200
#      （/app 是插件路由，200 = harness 与插件都活了）
#   6. root 身份时安装 systemd 单元 + /etc/dsh-web/env
# ============================================================================
set -euo pipefail

err()  { printf '\033[31m[错误]\033[0m %s\n' "$*" >&2; }
info() { printf '\033[36m[步骤]\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m[完成]\033[0m %s\n' "$*"; }

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/web"
DSH_VERSION="${DSH_VERSION:-latest}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-300}"
EUID_VAL="$(id -u)"

cd "$PLUGIN_DIR"

# ---------- 1/6 预检 ----------
info "1/6 预检运行环境"

command -v node >/dev/null 2>&1 || { err "缺少 Node.js（engines 要求 ^22.19.0 || >=24.0.0）"; exit 1; }
NODE_VER="$(node -p process.versions.node)"
node -e 'const[m,i]=process.versions.node.split(".").map(Number);process.exit((m===22&&i<19)||m<22?1:0)' \
  || { err "Node 版本过低: $NODE_VER（要求 ^22.19.0 || >=24.0.0）"; exit 1; }
ok "Node $NODE_VER"

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi
fi
if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm $(pnpm --version)（profile 由 packageManager 钉在 11.7.0）"
else
  info "pnpm 不在 PATH：dsh plugin add 步骤可能失败，可先 corepack enable"
fi

if [[ -z "${DSH_AUTH_SECRET:-}" ]]; then
  command -v openssl >/dev/null 2>&1 || { err "未设 DSH_AUTH_SECRET 且无 openssl 可自动生成"; exit 1; }
  DSH_AUTH_SECRET="$(openssl rand -hex 32)"
  info "已自动生成 DSH_AUTH_SECRET（请抄录到 /etc/dsh-web/env）: $DSH_AUTH_SECRET"
fi
[[ ${#DSH_AUTH_SECRET} -ge 32 ]] || { err "DSH_AUTH_SECRET 至少 32 字符（插件启动强校验）"; exit 1; }
[[ -n "${MYSQL_PASSWORD:-}" ]] || { err "必须设置 MYSQL_PASSWORD"; exit 1; }

# ---------- 解析 dsh 可执行入口 ----------
DSH_CMD=(npx -y "@deepseek-ai/dsh@$DSH_VERSION")
if command -v dsh >/dev/null 2>&1; then
  DSH_CMD=(dsh)
fi
if [[ $EUID_VAL -eq 0 ]] && [[ ${DSH_CMD[0]} == "npx" ]]; then
  info "root 环境：全局安装 @deepseek-ai/dsh@$DSH_VERSION ..."
  npm install -g "@deepseek-ai/dsh@$DSH_VERSION" >/dev/null
  DSH_CMD=(dsh)
fi

# ---------- 2/6 打包并接入插件 ----------
info "2/6 打包插件并接入 web profile"

TGZ="$(npm pack --pack-destination /tmp 2>/dev/null | tail -n 1)"
[[ -n "$TGZ" ]] || { err "npm pack 失败"; exit 1; }
TGZ="$(cd /tmp && pwd)/$(basename "$TGZ")"
ok "插件已打包: $TGZ"

"${DSH_CMD[@]}" plugin --profile web add "$TGZ"
ok "插件已安装进 $PROFILE_DIR（bundle 层已 reconcile）"

# ---------- 3/6 合入生产覆盖层 ----------
info "3/6 合入生产配置覆盖（secureCookie / MySQL 专用账号）"

mkdir -p "$PROFILE_DIR"
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
if grep -q 'id: dsh-plugin-auth' "$PATCH_FILE" 2>/dev/null; then
  info "覆盖层已存在，跳过（如需重装请手工编辑 $PATCH_FILE）"
else
  # 初始 patch 文件是注释 + 独立一行的 `[]` 占位，追加块式条目前必须去掉它
  grep -v '^\[\]$' "$PATCH_FILE" 2>/dev/null > "$PATCH_FILE.tmp" || true
  cat >> "$PATCH_FILE.tmp" <<'YAML'

# ---- dsh-plugin-auth 生产覆盖（deploy/install.sh 追加，勿重复）----
- id: dsh-plugin-auth
  config:
    secureCookie: true
    mysql:
      user: dsh
      password: !!js process.env.MYSQL_PASSWORD ?? ''
YAML
  mv "$PATCH_FILE.tmp" "$PATCH_FILE"
  ok "已写入 $PATCH_FILE"
fi

# ---------- 4/6 MySQL 初始化 ----------
info "4/6 初始化 MySQL（库 dsh_auth + 专用用户 dsh）"

# 注意：密码按字面量拼进 SQL，请使用不含引号/反斜杠的密码
MYSQL_SQL="CREATE DATABASE IF NOT EXISTS dsh_auth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'dsh'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD}';
CREATE USER IF NOT EXISTS 'dsh'@'127.0.0.1' IDENTIFIED BY '${MYSQL_PASSWORD}';
GRANT ALL PRIVILEGES ON dsh_auth.* TO 'dsh'@'localhost';
GRANT ALL PRIVILEGES ON dsh_auth.* TO 'dsh'@'127.0.0.1';
FLUSH PRIVILEGES;"

if command -v mysql >/dev/null 2>&1 && [[ -n "${MYSQL_ROOT_PASSWORD:-}" ]]; then
  mysql -h 127.0.0.1 -u root -p"$MYSQL_ROOT_PASSWORD" -e "$MYSQL_SQL"
  ok "MySQL dsh_auth 库与 dsh 用户已就绪"
else
  info "未自动执行（缺 mysql 客户端或 MYSQL_ROOT_PASSWORD）。请手动执行以下 SQL："
  printf '%s\n' "$MYSQL_SQL" | sed 's/^/    /'
fi

# ---------- 5/6 冒烟测试 ----------
if [[ "${SKIP_SMOKE:-0}" == "1" ]]; then
  info "5/6 跳过冒烟测试（SKIP_SMOKE=1）"
else
  info "5/6 冒烟测试（首次启动会安装官方 bundle，最长等 ${SMOKE_TIMEOUT}s）"
  SMOKE_LOG="$(mktemp /tmp/dsh-smoke.XXXXXX.log)"
  ( DSH_AUTH_SECRET="$DSH_AUTH_SECRET" MYSQL_PASSWORD="$MYSQL_PASSWORD" \
      timeout "$SMOKE_TIMEOUT" "${DSH_CMD[@]}" web --no-open >"$SMOKE_LOG" 2>&1 ) &
  SMOKE_PID=$!
  UP=0
  for _ in $(seq 1 "$SMOKE_TIMEOUT"); do
    if curl -fsS -o /dev/null http://127.0.0.1:3080/app 2>/dev/null; then UP=1; break; fi
    sleep 1
  done
  wait "$SMOKE_PID" 2>/dev/null || true
  if [[ $UP -eq 1 ]]; then
    ok "http://127.0.0.1:3080/app 返回 200 — harness 与插件均已就绪"
  else
    err "冒烟测试未通过（/app 未在 ${SMOKE_TIMEOUT}s 内就绪），日志尾部："
    tail -n 30 "$SMOKE_LOG" >&2 || true
    exit 1
  fi
fi

# ---------- 6/6 systemd ----------
info "6/6 systemd 服务"
if [[ $EUID_VAL -ne 0 ]]; then
  cat <<MANUAL
非 root，跳过自动安装。手动步骤：
  1. sudo mkdir -p /etc/dsh-web && sudo cp deploy/env.example /etc/dsh-web/env
     编辑 /etc/dsh-web/env 填入 DSH_HOME / DSH_AUTH_SECRET / MYSQL_PASSWORD
  2. sudo sed -e "s|__SERVICE_USER__|$USER|g" \\
       -e "s|__DSH_BIN__|$(command -v dsh || echo /usr/bin/dsh)|g" \\
       -e "s|__DSH_HOME__|$DSH_HOME|g" \\
       deploy/dsh-web.service | sudo tee /etc/systemd/system/dsh-web.service >/dev/null
  3. sudo systemctl daemon-reload && sudo systemctl enable --now dsh-web
  4. nginx 反代：参考 deploy/nginx-dsh.conf（替换域名与证书路径）
MANUAL
else
  SVC_USER="${SVC_USER:-${SUDO_USER:-dsh}}"
  mkdir -p /etc/dsh-web
  if [[ ! -f /etc/dsh-web/env ]]; then
    cp deploy/env.example /etc/dsh-web/env
    sed -i "s|^DSH_HOME=.*|DSH_HOME=$DSH_HOME|" /etc/dsh-web/env
    chmod 600 /etc/dsh-web/env
  fi
  DSH_BIN_ABS="$(command -v dsh || true)"
  [[ -n "$DSH_BIN_ABS" ]] || { err "未找到全局 dsh（unit 需要）；先 npm i -g @deepseek-ai/dsh 再重跑"; exit 1; }
  sed -e "s|__SERVICE_USER__|$SVC_USER|g" \
      -e "s|__DSH_BIN__|$DSH_BIN_ABS|g" \
      -e "s|__DSH_HOME__|$DSH_HOME|g" \
      deploy/dsh-web.service > /etc/systemd/system/dsh-web.service
  chown -R "$SVC_USER:" "$DSH_HOME" 2>/dev/null || true
  systemctl daemon-reload
  systemctl enable dsh-web.service >/dev/null 2>&1
  ok "已安装并 enable dsh-web.service"
  cat <<NEXT
后续步骤：
  1. 编辑 /etc/dsh-web/env 填入 DSH_AUTH_SECRET 与 MYSQL_PASSWORD（已预填 DSH_HOME=$DSH_HOME）
  2. systemctl start dsh-web && journalctl -u dsh-web -f
  3. nginx 反代：cp deploy/nginx-dsh.conf /etc/nginx/conf.d/dsh.conf（改域名/证书）
NEXT
fi

ok "部署流程结束。验证配置合成结果可随时运行: dsh --profile web --dump-config"
