#!/usr/bin/env bash
# ============================================================================
# @my/dsh-plugin-auth —— Linux 服务器增量更新脚本
#
# 用法（root 或有 dsh 安装目录写权限的用户）：
#   bash update-server.sh                      # 默认找 /root 下的 tgz
#   bash update-server.sh /path/to/x.tgz       # 指定 tgz
#   DSH_HOME=/www/dsh-home bash update-server.sh
#
# 做的四件事：
#   1. 解压 tgz 到临时目录
#   2. 自动探测插件安装目录（兼容标准布局 @my/dsh-plugin-auth
#      和服务器上那种目录名带 .tgz 的非标准布局）
#   3. 备份旧 lib -> lib.bak.<时间戳>，再覆盖 index.js / ui.js
#   4. 校验关键改动是否落盘，并提示如何重启
#
# 注意：不要用 `dsh plugin add` 更新，会把同一插件注册两次，
#       触发 "duplicate loader entry id: dsh-plugin-auth"。
# ============================================================================
set -euo pipefail

info() { printf '\033[36m[步骤]\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m[完成]\033[0m %s\n' "$*"; }
err()  { printf '\033[31m[错误]\033[0m %s\n' "$*" >&2; }

TGZ="${1:-}"
HOME_DIR="${DSH_HOME:-$HOME/.dsh}"

# 1. 定位 tgz
if [ -z "$TGZ" ]; then
  for p in /root/my-dsh-plugin-auth-0.1.0.tgz "$HOME/my-dsh-plugin-auth-0.1.0.tgz" \
           ./my-dsh-plugin-auth-0.1.0.tgz /tmp/my-dsh-plugin-auth-0.1.0.tgz; do
    [ -f "$p" ] && TGZ="$p" && break
  done
fi
if [ -z "$TGZ" ] || [ ! -f "$TGZ" ]; then
  err "找不到 my-dsh-plugin-auth-0.1.0.tgz。用法: bash update-server.sh /path/to/my-dsh-plugin-auth-0.1.0.tgz"
  exit 1
fi
info "使用安装包: $TGZ"

# 2. 解压
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
tar -xzf "$TGZ" -C "$STAGE"
if [ ! -f "$STAGE/package/lib/index.js" ] || [ ! -f "$STAGE/package/lib/ui.js" ]; then
  err "包结构不对，缺少 package/lib/index.js 或 ui.js"
  exit 1
fi
ok "解压完成"

# 3. 探测插件安装目录：优先 lib/index.js 里含 'dsh-plugin-auth' 的目录
info "探测插件安装目录（DSH_HOME=$HOME_DIR）…"
TARGET=""
while IFS= read -r dir; do
  [ -f "$dir/lib/index.js" ] || continue
  TARGET="$dir"
  break
done < <(find "$HOME_DIR" -maxdepth 6 -type d -name "*dsh-plugin-auth*" 2>/dev/null | sort)

if [ -z "$TARGET" ]; then
  err "没找到已安装的插件目录。若 DSH_HOME 不是 $HOME_DIR，请这样跑："
  err "  DSH_HOME=/www/dsh-home bash update-server.sh $TGZ"
  exit 1
fi
info "插件目录: $TARGET"

# 4. 备份 + 覆盖
BAK="$TARGET/lib.bak.$(date +%Y%m%d_%H%M%S)"
cp -a "$TARGET/lib" "$BAK"
ok "已备份旧 lib -> $BAK"

cp -f "$STAGE/package/lib/index.js" "$TARGET/lib/index.js"
cp -f "$STAGE/package/lib/ui.js"   "$TARGET/lib/ui.js"
ok "已覆盖 index.js / ui.js"

# 5. 校验
echo "--- 改动校验（应全部 > 0）---"
check() {
  local n
  n="$(grep -c "$1" "$TARGET/lib/index.js" "$TARGET/lib/ui.js" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')"
  printf '  %-14s %s\n' "$1" "$n"
}
check keepInbox      # 深度停止：清队列
check projTitle      # 侧栏标题读持久投影
check stopBtn        # 停止按钮
check collectTools   # 执行过程渲染
check isAbortMsg     # 中断类报错静默

echo
ok "文件已就位，接下来【必须重启 dsh 才会生效】："
echo "  pm2 restart all              # 如果你用 pm2 管理"
echo "  systemctl restart dsh-web    # 如果装了 systemd 单元"
echo "  ps aux | grep -i dsh         # 不确定就先看进程怎么起的"
echo
echo "重启后验证："
echo "  curl -s http://127.0.0.1:3080/app | grep -c stopBtn        # 期望 >= 1"
echo "  然后浏览器硬刷新 Cmd/Ctrl+Shift+R"
