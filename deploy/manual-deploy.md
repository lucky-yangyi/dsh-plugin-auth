# 宝塔 Linux 服务器手动部署（不用任何脚本）

适用：`@my/dsh-plugin-auth` + DeepSeek Harness `dsh web`，跑在宝塔面板的 Linux（CentOS / Ubuntu / Debian）上。
全文只用人手执行命令和面板点击，不执行 `deploy/install.sh`、`update-server.sh`。

> 与脚本版唯一的差别：脚本帮你做的 6 件事（预检、打包接入、写覆盖层、建库、冒烟、装 systemd）
> 全部由你手动完成，步骤顺序一致。

---

## 0. 先确认三件事

| 项目 | 要求 | 宝塔里怎么弄 |
|---|---|---|
| Node.js | `^22.19.0` 或 `>=24` | 软件商店 →「Node.js 版本管理器」装 22.19+ / 24；或服务器装 nvm |
| MySQL | 5.7 / 8.0 / MariaDB 均可 | 软件商店 → MySQL，记住 root 密码 |
| Nginx | 任意新版 | 软件商店 → Nginx |

Node 版本是硬要求，低了直接起不来：

```bash
node -v
```

顺手把 pnpm 打开（dsh 首次脚手架 profile 要用，由 `packageManager` 钉在 11.7.0）：

```bash
corepack enable && pnpm -v
```

---

## 1. 建专用低权用户和数据目录

不要用 root 跑服务。

```bash
useradd -r -m -d /var/lib/dsh -s /bin/bash dsh
mkdir -p /var/lib/dsh
chown -R dsh:dsh /var/lib/dsh
```

`/var/lib/dsh` 里会放 profiles、会话 JSONL、附件、`.credentials.yaml`（**这个文件权限必须是 600**，否则启动报 `readable beyond its owner`）。

---

## 2. 安装 dsh 本体

```bash
npm install -g @deepseek-ai/dsh
which dsh          # 记下这个路径，第 7 步要用
```

装不上就换 `npx -y @deepseek-ai/dsh@latest`，但 systemd 单元需要绝对路径，建议全局装。

---

## 3. MySQL 建库 + 专用账号

命令行（用宝塔面板里的 root 密码）：

```bash
mysql -u root -p
```

粘进去执行（把 `这里换成强密码` 改掉，密码别带引号和反斜杠）：

```sql
CREATE DATABASE IF NOT EXISTS dsh_auth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'dsh'@'localhost' IDENTIFIED BY '这里换成强密码';
CREATE USER IF NOT EXISTS 'dsh'@'127.0.0.1' IDENTIFIED BY '这里换成强密码';
GRANT ALL PRIVILEGES ON dsh_auth.* TO 'dsh'@'localhost';
GRANT ALL PRIVILEGES ON dsh_auth.* TO 'dsh'@'127.0.0.1';
FLUSH PRIVILEGES;
```

也可以宝塔面板 → 数据库 →「添加数据库」建 `dsh_auth`，再用 phpMyAdmin 执行授权语句。

**不需要导入 `schema.sql`** —— 插件启动时自己 `CREATE TABLE IF NOT EXISTS`（`users` + `session_owners`），见 `src/index.ts` 的 `init()`。

---

## 4. 打包插件并传到服务器

本地（macOS / 开发机）执行：

```bash
cd ~/dsh-plugins/dsh-plugin-auth
npm pack
```

得到 `my-dsh-plugin-auth-0.1.0.tgz`，用宝塔文件管理器或 scp 传到服务器，例如 `/root/my-dsh-plugin-auth-0.1.0.tgz`。

---

## 5. 把插件接入 web profile

切到服务用户执行（**必须带 DSH_HOME**）：

```bash
su - dsh
export DSH_HOME=/var/lib/dsh
dsh plugin --profile web add /root/my-dsh-plugin-auth-0.1.0.tgz
```

第一次会顺带脚手架化 `/var/lib/dsh/profiles/web` 并拉官方 bundle，要几分钟，别中断。
升级时重复这一步即可（同一条命令，会替换 bundle 层）。

---

## 6. 改 profile 覆盖层（生产配置）

文件：`/var/lib/dsh/profiles/web/cordis.patch.yml`

**先看第一行**：如果文件里只有一行 `[]` 占位（新 profile 是这样），**必须先把这行删掉**，再粘贴下面内容，否则 YAML 解析成 `[...] + []` 会报错。

```yaml
- id: dsh-plugin-auth
  config:
    secureCookie: true
    mysql:
      user: dsh
      password: !!js process.env.MYSQL_PASSWORD ?? ''
```

说明：

- `secureCookie: true` **只在 HTTPS 下能用**。如果你先用 `http://服务器IP` 访问，一定要写成 `false`，否则浏览器直接丢弃带 `Secure` 的 cookie，表现为"登录成功又立刻跳回登录页"——这是最常见的坑。等配好 HTTPS 再改回 `true`。
- `!!js` 是 cordis 的 JS 表达式标记，**不能写成 `!js`**，否则按字面字符串处理。
- 未列出的键沿用插件默认值：host `127.0.0.1`、database `dsh_auth`、`connectionLimit: 20`、`previewConcurrency: 2`。

随时可用这条命令看最终生效值：

```bash
DSH_HOME=/var/lib/dsh dsh --profile web --dump-config
```

---

## 7. 环境变量 + systemd 服务

### 7.1 环境变量文件

```bash
mkdir -p /etc/dsh-web
cat > /etc/dsh-web/env <<'EOF'
DSH_HOME=/var/lib/dsh
DSH_AUTH_SECRET=这里填openssl生成的64位hex
MYSQL_PASSWORD=这里填第3步的密码
EOF
chown root:root /etc/dsh-web/env
chmod 600 /etc/dsh-web/env
```

`DSH_AUTH_SECRET` 生成（**至少 32 字符，插件启动强校验**）：

```bash
openssl rand -hex 32
```

### 7.2 systemd 单元

把下面三个占位符替换掉后写入 `/etc/systemd/system/dsh-web.service`：

- `__SERVICE_USER__` → `dsh`
- `__DSH_BIN__` → 第 2 步 `which dsh` 的结果，如 `/usr/local/bin/dsh`
- `__DSH_HOME__` → `/var/lib/dsh`

```ini
[Unit]
Description=DeepSeek Harness web UI (dsh-plugin-auth multi-user)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=dsh
Group=dsh
EnvironmentFile=/etc/dsh-web/env
WorkingDirectory=/var/lib/dsh
ExecStart=/usr/local/bin/dsh web --no-open

Restart=on-failure
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=20

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

启动：

```bash
systemctl daemon-reload
systemctl enable --now dsh-web
journalctl -u dsh-web -f
```

冒烟验证（**这个 200 代表 harness 和插件都活了**，因为 `/app` 是插件自己注册的路由）：

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/app
# 期望 200
```

### 7.3 想用宝塔 PM2 管理器代替 systemd

也行：新建项目时启动文件填 `dsh` 的绝对路径，参数填 `web --no-open`，项目目录填 `/var/lib/dsh`，运行用户选 `dsh`，环境变量手工加 `DSH_HOME` / `DSH_AUTH_SECRET` / `MYSQL_PASSWORD`。
但 systemd 更稳（服务崩溃自动拉起、日志进 journald），推荐 7.2。

---

## 8. Nginx 反向代理

`dsh web` 默认只监听 `127.0.0.1:3080`，外部访问必须反代。**宝塔安全组/防火墙不用放行 3080**。

宝塔面板 → 网站 → 添加站点 → 配好 SSL（Let's Encrypt）→「反向代理」里填 `http://127.0.0.1:3080` 后，
再点「配置文件」手动补上 SSE 与上传相关指令（宝塔默认模板不含这些，不补会导致流式输出卡住、大附件 413）：

```nginx
client_max_body_size 60m;          # 插件单文件上限 50MB，留余量

location / {
    proxy_pass http://127.0.0.1:3080;
    proxy_http_version 1.1;

    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        "upgrade";

    proxy_buffering    off;            # SSE（/app/sessions/follow）必须关缓冲
    proxy_cache        off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

改完 `nginx -t && systemctl reload nginx`（宝塔里点「重载配置」也行）。

CentOS 若反代返回 502，多半是 SELinux 拦了本机回连：

```bash
setsebool -P httpd_can_network_connect 1
```

---

## 9. 可选：装 LibreOffice（Office 文档预览）

不装也能用，只是 docx/xlsx/pptx 点击时降级为下载。要右栏内联预览就得装：

```bash
# CentOS / Rocky / Alma
yum install -y libreoffice-writer libreoffice-calc libreoffice-impress
# Ubuntu / Debian
apt install -y libreoffice-writer libreoffice-calc libreoffice-impress fonts-wqy-zenhei fonts-wqy-microhei
```

中文字体一定要装，否则转出的 PDF 里中文是方块或空白。装完确认：

```bash
which soffice
```

若不在 PATH，在覆盖层里显式指路：

```yaml
libreOfficePath: /usr/bin/soffice
```

---

## 10. 收尾验证

```bash
# 1. 服务活着
systemctl status dsh-web
# 2. 插件路由 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/app
# 3. 配置合成正确（重点看 secret/mysql.user/secureCookie）
DSH_HOME=/var/lib/dsh dsh --profile web --dump-config | grep -A 15 dsh-plugin-auth
# 4. 建表成功
mysql -u dsh -p -e 'USE dsh_auth; SHOW TABLES;'
```

然后浏览器打开你的域名 `/app`，注册第一个账号（用户名 `[a-zA-Z0-9_-]` 3–32 位，密码 ≥8 位）。

---

## 以后怎么更新插件

```bash
# 开发机
cd ~/dsh-plugins/dsh-plugin-auth && npm run build && npm pack
# 服务器
su - dsh -c 'DSH_HOME=/var/lib/dsh dsh plugin --profile web add /root/my-dsh-plugin-auth-0.1.0.tgz'
systemctl restart dsh-web
```

**注意**：`dsh plugin add` 只替换插件 bundle 层，不会动你手写的 `cordis.patch.yml` 覆盖层。

---

## 常见故障对照表

| 现象 | 原因 | 处理 |
|---|---|---|
| 启动即退，日志 `readable beyond its owner` | `$DSH_HOME/.credentials.yaml` 权限太松 | `chmod 600 $DSH_HOME/.credentials.yaml` |
| 登录成功立刻跳回登录页 | HTTP 访问但 `secureCookie: true` | 改 `false`，或先配 HTTPS |
| 启动报 secret 太短 | `DSH_AUTH_SECRET` < 32 字符 | `openssl rand -hex 32` 重填 |
| 启动报 MySQL 连不上 | 插件**不降级**，连不上就 fail-fast | 检查账号密码、用户是否授权 `127.0.0.1` |
| 页面能开但流式回答卡住 | 反代缓冲没关 | `proxy_buffering off` |
| 上传大附件 413 | nginx 默认 1m | `client_max_body_size 60m` |
| 反代 502（CentOS） | SELinux | `setsebool -P httpd_can_network_connect 1` |
| Word 预览中文是方块 | 缺中文字体 | 装 `fonts-wqy-*` |
| 官方 `/` 页面能看到别人会话 | 官方 UI 不受插件隔离约束 | 别把 `/` 暴露到公网，或反代只放行 `/app` |
