# 技能市场：Linux 服务器部署说明

## 一、为什么服务器上「没有技能市场」

市场入口（输入框旁的 `#` 技能市场按钮）**不是默认显示的**，它由服务端配置驱动：

1. 插件读配置 `hub.indexUrl`；
2. `GET /app/skills/hub` 返回 `{ configured, skills }`；
3. 前端 `refreshHubButton()`：**只有 `configured === true` 才显示按钮**；
4. 且只要 `/app/skills/hub` 请求失败（502 `hub_unreachable`，比如索引地址拉不通），前端
   也会 catch 掉并隐藏按钮。

所以「没市场」只有三种可能（服务器通常是第 1 种）：

| # | 原因 | 现象 |
|---|---|---|
| 1 | `hub.indexUrl` 为空 | `configured:false` → 入口隐藏 |
| 2 | `indexUrl` 配了，但地址拉不通（桥没跑 / 端口不对 / 跨机访问 127.0.0.1） | 接口 502 → 入口隐藏 |
| 3 | 插件本身没装上 | `/app` 整页 404 |

### 根因：`indexUrl` 来自环境变量，默认空

插件仓库 `cordis.patch.yml` 里是这样写的：

```yaml
hub:
  indexUrl: !!js process.env.DSH_HUB_INDEX ?? ''   # 默认空 → 市场隐藏
  timeoutMs: 15000
  maxBytes: 20971520
```

**这就是关键**：全新部署时，profile 的 patch 来自仓库这份文件，`indexUrl` 取环境变量
`DSH_HUB_INDEX`；在旧版本里它默认是空字符串 → 市场入口自动隐藏。

> 现已修好默认值：仓库 patch 改成
> `!!js process.env.DSH_HUB_INDEX ?? 'http://127.0.0.1:8099/index.json'`。
> 也就是「服务器上把桥跑起来就有市场」；桥没跑时接口 502，前端照样隐藏入口，不会显示空白面板。
> 如果你部署的是改动之前那份 patch，就按下面第 3 步显式设 `DSH_HUB_INDEX`。

开发机上之所以能看到市场，是因为本机 `~/.dsh/profiles/web/cordis.patch.yml` 被手动改成了
硬编码值（`http://127.0.0.1:8099/index.json`）；这个值不会被同步到服务器。

---

## 二、部署步骤

### 1. 装插件（若 `/app` 还 404，先做这步）

```bash
cd dsh-plugin-auth
npm install && npm run build
# 装进目标 profile（默认 ~/.dsh/profiles/web；可 DSH_HOME=/www/dsh-home 指定）
DSH_HOME=/www/dsh-home node scripts/reinstall-local.mjs --profile web
```

### 2. 启云目录桥（市场的数据源）

桥是一个独立 Node 进程，负责把 SkillHub 云 API 转成 dsh 市场格式（zip→tgz 重打包 +
frontmatter 清洗）。**必须在服务器上也跑起来**，否则即使配了 `indexUrl` 也会 502。

```bash
# 依赖（Linux 最小镜像常缺 unzip）
# Debian/Ubuntu: apt-get install -y curl unzip tar
# CentOS/RHEL:   yum install -y curl unzip tar
# 桥会按 unzip → bsdtar → python3 顺序自动选一个解包器，curl → wget 选下载器
```

前台试跑：

```bash
cd dsh-plugin-auth/skillhub-bridge
node server.mjs
# 看到: [skillhub-bridge] SkillHub cloud proxy on http://127.0.0.1:8099 -> https://api.skillhub.cn
#       [skillhub-bridge] deps: curl=y wget=n unzip=y ...
```

生产用 systemd 常驻（`/etc/systemd/system/dsh-skillhub-bridge.service`）：

```ini
[Unit]
Description=SkillHub bridge for dsh skill market
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dsh-plugin-auth/skillhub-bridge
Environment=HUB_PORT=8099
Environment=HUB_HOST=127.0.0.1
Environment=SKILLHUB_API=https://api.skillhub.cn
ExecStart=/usr/bin/node server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now dsh-skillhub-bridge
systemctl status dsh-skillhub-bridge
```

### 3. 给 dsh web 注入 `DSH_HUB_INDEX`

桥和 dsh web 在同一台机器：

```bash
export DSH_HUB_INDEX=http://127.0.0.1:8099/index.json
```

若 dsh web 也用 systemd 管，在它的 service 里加一行：

```ini
Environment=DSH_HUB_INDEX=http://127.0.0.1:8099/index.json
```

然后重启 dsh web（`!!js` 在加载时求值，必须重启才生效）：

```bash
systemctl restart dsh-web
```

> 跨机/容器部署：桥要监听对外地址（`HUB_HOST=0.0.0.0`），`DSH_HUB_INDEX` 填桥的
> **对外可达**地址（如 `http://10.0.0.5:8099/index.json`），不要填 127.0.0.1。

### 4.（可选）改成硬编码，不依赖环境变量

直接编辑服务器的 `~/.dsh/profiles/web/cordis.patch.yml`，把

```yaml
indexUrl: !!js process.env.DSH_HUB_INDEX ?? ''
```

改成

```yaml
indexUrl: 'http://127.0.0.1:8099/index.json'
```

profile 的 `patchReload: live` 会让 patch 改动热生效（进程会被替换）。

---

## 三、验收

```bash
# 1) 桥活着，且能拿到云目录
curl -s http://127.0.0.1:8099/health
# {"ok":true,"skills":56,...,"deps":{"curl":true,"unzip":true,...}}

curl -s 'http://127.0.0.1:8099/index.json' | head -c 200

# 2) dsh 侧市场已启用（需登录 cookie）
curl -s -b cookie.txt http://127.0.0.1:3080/app/skills/hub | head -c 200
# {"configured":true,"skills":[...]}   ← configured:true 才会显示按钮

# 3) 服务端搜索
curl -s -b cookie.txt 'http://127.0.0.1:3080/app/skills/hub/search?q=%E8%AE%BA%E6%96%87'
```

若第 2 步返回 `{"configured":false,"skills":[]}` → `DSH_HUB_INDEX` 没设或没重启；
若返回 502 `hub_unreachable` → 桥没跑或地址不可达/填错主机。

---

## 四、常见问题

| 症状 | 排查 |
|---|---|
| 按钮完全不见 | 第 2 步 `configured` 一定为 false 或 502，按上面三步查 |
| 面板打开但列表为空 | 桥起来了但连不上 `api.skillhub.cn`（服务器出网/防火墙），看桥日志 |
| 安装失败 `install_failed` | 多半是服务器缺 `unzip`；`apt-get install unzip` 后重试 |
| 装完在 `/` 菜单看不到 | 检查 `~/.dsh/skills/<slug>__hub/SKILL.md` 是否存在；frontmatter 重复键会被严格 YAML 解析器忽略（桥已自动清洗，若仍不见可手动查） |
| 服务器在国内访问慢 | 桥已走 `api.skillhub.cn`（腾讯云），国内直连即可；必要时给服务器配代理 |

---

## 六、宝塔面板（BT Panel）专项

宝塔下「没有技能市场」的原因和裸机一样（`indexUrl` 为空 / 桥没跑），但宝塔有三个额外坑：

1. **环境变量不好设**：宝塔的 PM2 管理器 / Node 项目面板里没有顺手的 env 输入框，
   所以推荐**直接把地址写死在 profile patch 里**，别依赖 `DSH_HUB_INDEX`。
2. **运行用户 / HOME 不确定**：插件按 `~/.dsh` 找 profile；宝塔可能以 `root` 或 `www`
   跑 dsh，两边 `~/.dsh` 不是同一份，插件装错地方就白装。**显式设 `DSH_HOME`** 最稳。
3. **Node 版本**：dsh 要 Node ≥ 22；宝塔自带/PM2 可能默认是低版本，需在面板里切。

### 步骤 0（最重要）：手动部署时，patch 条目要自己写
`scripts/reinstall-local.mjs` 脚本干两件事：① 把插件拷进 profile 的 `node_modules`
② **把 insert 条目写回 `cordis.patch.yml`**。手动部署如果只做了 ①，会出现两种症状：

- `/app` 直接 404 → 说明**根本没有 insert 条目**；
- `/app` 正常但没市场 → 说明条目在，但你那份**精简版里没有 `hub:` 配置块**。

先判断自己在哪种情况：

```bash
grep -n "dsh-plugin-auth" /root/.dsh/profiles/web/cordis.patch.yml   # 有没有条目
grep -n -A3 "hub:"       /root/.dsh/profiles/web/cordis.patch.yml   # 条目里有没有 hub 块
```

**情况 A（条目在、缺 hub 块）**——只补这三行即可，注意缩进必须和 `mysql:` 对齐（8 个空格）：

```bash
vi /root/.dsh/profiles/web/cordis.patch.yml
```

在插件 `config:` 下面（`mysql:` / `previewConcurrency:` 同级）插入：

```yaml
        hub:
          indexUrl: 'http://127.0.0.1:8099/index.json'
          timeoutMs: 15000
          maxBytes: 20971520
```

**情况 B（完全没有条目）**——把下面整段追加进 `cordis.patch.yml`（MySQL 密码按实际改）：

```yaml
- insert:
    - id: dsh-plugin-auth
      name: '@my/dsh-plugin-auth'
      config:
        secret: 'local-dev-secret-0123456789abcdef0123456789abcdef'
        secureCookie: false
        cookieMaxAgeDays: 7
        mysql:
          host: 127.0.0.1
          user: root
          password: '你的MySQL密码'
          database: dsh_auth
          connectionLimit: 20
        filesCacheTtlMs: 1000
        previewConcurrency: 2
        hub:
          indexUrl: 'http://127.0.0.1:8099/index.json'
          timeoutMs: 15000
          maxBytes: 20971520
```

同时确认插件产物在位（手动拷也行）：

```bash
ls /root/.dsh/profiles/web/node_modules/@my/dsh-plugin-auth/lib/index.js
ls /root/.dsh/profiles/web/node_modules/@my/dsh-plugin-auth/node_modules/mysql2
```

> 改完 patch：`patchReload: live` 的 profile 会热生效（进程被替换）；不放心就在宝塔里重启 dsh 项目。

### 步骤 1：确认 dsh 跑在哪、用的是哪份 dsh home

```bash
# 看进程与运行用户
ps -ef | grep -E "bin.ts|dsh" | grep -v grep

# 按上面看到的用户查 home（root 一般是 /root/.dsh）
ls -d /root/.dsh/profiles/web 2>/dev/null
ls -d /home/www/.dsh/profiles/web 2>/dev/null
```

插件装进去的那份 profile 里必须同时有这两样，缺一即 `/app` 404：

```bash
ls /root/.dsh/profiles/web/node_modules/@my/dsh-plugin-auth
grep -n "dsh-plugin-auth" /root/.dsh/profiles/web/cordis.patch.yml
```

### 步骤 2：装插件（指定 DSH_HOME，别让它猜）

```bash
cd /www/wwwroot/dsh-plugin-auth     # 你的源码目录
npm install && npm run build
DSH_HOME=/root/.dsh node scripts/reinstall-local.mjs --profile web
```

### 步骤 3：把市场地址写死在 patch 里（宝塔推荐做法）

编辑 `/root/.dsh/profiles/web/cordis.patch.yml`，把 hub 块改成：

```yaml
        hub:
          indexUrl: 'http://127.0.0.1:8099/index.json'
          timeoutMs: 15000
          maxBytes: 20971520
```

（新版本仓库默认已经是这个值，只要 patch 是最新的就不用改；老 patch 里是
`!!js process.env.DSH_HUB_INDEX ?? ''`，必须改。）

`patchReload: live` 会让 patch 改动热生效，否则在宝塔面板里重启 dsh 项目。

### 步骤 4：用 PM2 常驻桥

宝塔软件商店装 **PM2管理器**，或直接在终端：

```bash
cd /www/wwwroot/dsh-plugin-auth/skillhub-bridge
pm2 start server.mjs --name skillhub-bridge --time
pm2 save && pm2 startup     # 开机自启
pm2 logs skillhub-bridge
```

依赖先装（宝塔最小化镜像常缺）：

```bash
# Debian/Ubuntu
apt-get install -y unzip curl
# CentOS/RHEL
yum install -y unzip curl
```

### 步骤 5：验收

```bash
curl -s http://127.0.0.1:8099/health
# {"ok":true,"skills":56,"api":"https://api.skillhub.cn","deps":{"curl":true,"unzip":true,...}}
```

重点看 `deps.unzip` 是否为 `true`——为 `false` 就装 `unzip`，否则能浏览但装不上。

然后登录 dsh 网页确认按钮出现；或用接口确认（带登录 cookie）：

```bash
curl -s -b cookie.txt http://127.0.0.1:3080/app/skills/hub | head -c 120
# 必须看到 "configured":true
```

### 宝塔常见坑速查

| 现象 | 原因 / 处理 |
|---|---|
| `/app` 打不开 | 插件没装进「dsh 实际使用的那份」`~/.dsh`，用 `DSH_HOME` 显式指定重装 |
| 面板能开但按钮没有 | patch 里 `indexUrl` 还是旧的空默认 → 按步骤 3 改 |
| 按钮有，列表空 / 502 | 桥没跑或 8099 不通：`pm2 list`、`curl 127.0.0.1:8099/health` |
| 能浏览，安装报 `install_failed` | 缺 `unzip`（`/health` 里 `deps.unzip:false`） |
| 服务器在国内拉不到目录 | 防火墙出网限制；桥走 `api.skillhub.cn`（腾讯云），放行即可 |
| 重启服务器后市场又没了 | 桥没设开机自启：`pm2 save && pm2 startup` |

### 用 start.sh 启动 dsh 的（宝塔「Node 项目」模式）

典型 start.sh：

```bash
#!/bin/bash
export DSH_HOME=/root/.dsh
export MYSQL_PASSWORD='...'
export DSH_AUTH_SECRET='...'
export DEEPSEEK_API_KEY='...'
cd /www/dsh-home
exec dsh web --no-open
```

这种模式下没有市场，是因为 start.sh 里缺两样：`DSH_HUB_INDEX` 和桥进程。改成：

```bash
#!/bin/bash
export DSH_HOME=/root/.dsh
export MYSQL_PASSWORD='...'
export DSH_AUTH_SECRET='...'
export DEEPSEEK_API_KEY='...'
# 技能市场索引地址（新旧版 patch 都覆盖：新版有默认值时这个 env 也能覆盖）
export DSH_HUB_INDEX='http://127.0.0.1:8099/index.json'

# 桥没在跑就拉起（插件源码在 /www/dsh-plugin-auth；路径不同自行调整）
if [ -d /www/dsh-plugin-auth/skillhub-bridge ]; then
  if ! curl -s -m 2 http://127.0.0.1:8099/health >/dev/null 2>&1; then
    (cd /www/dsh-plugin-auth/skillhub-bridge && nohup node server.mjs >/var/log/skillhub-bridge.log 2>&1 &)
  fi
fi

cd /www/dsh-home
exec dsh web --no-open
```

注意：`export DSH_HUB_INDEX` 只解决「索引地址」，**插件本体仍必须装进 `/root/.dsh/profiles/web`**
（`DSH_HOME` 已由 start.sh 指定，安装脚本用同一个值即可）。如果 `/app` 本身 404，
先按上面「步骤 0 / 步骤 2」把插件装上，再谈市场。

---

## 五、环境变量一览

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_HUB_INDEX` | 空 | **dsh web 侧**：市场索引地址，空则隐藏市场入口 |
| `HUB_PORT` | 8099 | 桥监听端口 |
| `HUB_HOST` | 127.0.0.1 | 桥监听地址，跨机改 `0.0.0.0` |
| `SKILLHUB_API` | https://api.skillhub.cn | 云 API 底座 |
| `HUB_DEFAULT_LIMIT` | 60 | 默认目录条数上限 |
