# dsh-plugin-auth

deepseek-harness 的多用户注册登录 + 按 `user_id` 会话隔离插件。
**零 harness 源码修改**：独立 Cordis 插件，通过 profile 装载。

## 工作原理

| 关注点 | 做法 |
|---|---|
| 注册/登录路由 | `ctx.webServer.register` 挂 `/app/*` 精确路由，不经过官方 `/api` 的鉴权闸门 |
| 注册信息 | MySQL `users` 表（username + scrypt 密码哈希） |
| 登录态 | 自有 HMAC-SHA256 签名 cookie（HttpOnly + SameSite=Strict），与官方 cookie 无关 |
| 用户提问内容 | 不动：仍在官方 `~/.dsh/sessions/.../session.v2.jsonl.zstd` |
| 会话归属 | MySQL `session_owners` 表（session_id → user_id） |
| A/B 隔离 | 服务端强制：未登录 401；列表按 user_id SQL 过滤；单条访问归属不符 404 |
| 官方入口 | 用户拿不到官方 `?token=`，官方 `/api` 与官方 Web UI 对其天然 401 |

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/app/auth/register` | `{username, password}`，用户名 3-32 位 `[a-zA-Z0-9_-]`，密码 ≥8 位；成功即登录 |
| POST | `/app/auth/login` | `{username, password}`，失败统一 401 并延迟 400ms 防爆破 |
| POST | `/app/auth/logout` | 清除 cookie |
| GET | `/app/auth/me` | 当前用户信息 |
| GET | `/app` | **多用户前端页面**（登录/注册 + 会话列表 + 聊天 + 附件上传，单文件无构建；支持 📎 多文件选择、📁 文件夹选择（webkitdirectory，保留相对路径）、拖拽文件与整个文件夹到聊天区） |
| GET | `/app/sessions` | 本会话列表（只含本人） |
| POST | `/app/sessions` | `{cwd?, agentPreset?}` 创建会话并记录归属 |
| GET | `/app/sessions/history?id=<sessionId>` | 读取会话内容（提问+回答 events），归属不符 404 |
| POST | `/app/sessions/prompt` | `{sessionId, text, attachments?: [receiptId], mode?}` 发送消息（可带附件） |
| POST | `/app/upload?id=<sessionId>` | 上传文件：请求体为原始字节，头 `x-file-name` 传 URL 编码文件名，上限 50MB；返回 `{receiptId}` 供 prompt 引用；归属不符 404 |

上传与附件隔离（已实测）：上传必须指定本人拥有的 sessionId；receipt 绑定该会话
（官方 `ctx.fileUploads.uploadStream`），引用时服务端校验"必须是本会话上传的"，
A 无法把文件传进或引用进 B 的会话。

curl 快速验证：

```sh
curl -c jar.txt -X POST localhost:PORT/app/auth/register \
  -H 'content-type: application/json' -d '{"username":"alice","password":"secret123"}'
curl -b jar.txt -X POST localhost:PORT/app/sessions \
  -H 'content-type: application/json' -d '{}'
curl -b jar.txt localhost:PORT/app/sessions
curl -b jar.txt -X POST localhost:PORT/app/sessions/prompt \
  -H 'content-type: application/json' -d '{"sessionId":"<id>","text":"你好"}'
curl -b jar.txt 'localhost:PORT/app/sessions/history?id=<id>'
```

## 构建

```sh
npm install
npm run build     # 产出 lib/
```

## 装载到 harness（已在 macOS + Node 24 + MySQL 8.0 实测验证）

```sh
# 0. 前置：Node 必须与仓库 pnpm install 时用的同一个大版本（原生模块 fs-ext 匹配）
#    本地开发时插件 cordis.patch.yml 已内置 MySQL root/123456 + dsh_auth 配置

# 1. 给 profile 的 package.json 加 "packageManager": "pnpm@11.7.0"
#    （否则 corepack 会交互式询问下载哪个 pnpm 版本，脚本化环境直接卡死）

# 2. 安装插件依赖（等效于 dsh plugin --profile web add <path>）
cd ~/.dsh/profiles/web
pnpm add file:/Users/shuaiyi/dsh-plugins/dsh-plugin-auth

# 3. 把 "@my/dsh-plugin-auth" 加进 profile package.json 的
#    dsh.profile.bundles 数组（插件已声明 dsh.bundle.patch，符合 bundle 规范）

# 4. 启动
cd <deepseek-harness 仓库> && pnpm dsh web
# 输出类似: dsh web: http://127.0.0.1:3080/?token=...
```

已实测通过的完整链路（15 项断言全过）：
注册 A/B → 各自建会话 → 列表只见自己的 → B 读/写 A 的会话一律 404 →
登出 401 → 重登恢复 → 错误密码 401 → 重复用户名 409 → 发消息 → LLM 回答 → 读历史。

### 踩坑记录（重装/换环境时必读）

| 坑 | 现象 | 解法 |
|---|---|---|
| `files` 白名单 | 装进 profile 后缺 `cordis.patch.yml`，启动报 ENOENT | package.json `files` 必须含 `cordis.patch.yml`（已修） |
| patch 格式 | `must be a top-level YAML array` | bundle 的 patch 文件是 `- insert:` 开头的**数组**，不是对象（已修） |
| 服务声明字段 | `cannot get property "webServer" without inject` | Cordis 用 `inject`（不是 `using`）声明服务依赖（已修） |
| Node 版本 | `fs-ext NODE_MODULE_VERSION 137 vs 127` | 启动用的 Node 大版本必须和 `pnpm install` 时一致（如都走 nvm 的 v24） |
| 残留锁 | `timed out waiting for the writer lock .credentials.yaml.lock` | 上次进程被强杀会留锁，确认无 dsh 进程后 `rm` 掉该 .lock 文件 |
| 系统注入消息 | 聊天窗出现大段 AGENTS.md/技能清单"代码" | `user/message` 事件分真实消息（`source.kind === 'user'`）与系统注入（`agent-instructions`/`skill-catalog`/`plugin`），**渲染前必须按 source.kind 过滤**（已修） |
| 模板字符串转义 | `src/ui.ts` 的 UI_HTML 是模板字面量，内嵌 JS 里的 `` ` ``、`\n`、`\s`、`\*` 会被吃掉导致前端语法错误 | 内嵌脚本中一律写 `` \` ``、`\\n`、`\\s`、`\\*`（双反斜杠 + 转义反引号），改完必须重跑渲染回归测试 |
| 重连基线压缩记录 | `follow` 快照里 `assistantStream.activeAttempt.stream` 是压缩记录（`{type:'text-chunks',texts}` / `{type:'chunk',chunk}`），不是裸分片 | `chunkText` 需同时识别三种形态，且只取 `text-delta`（`reasoning-delta` 走独立思考块） |

## 安全清单（上线前）

- [ ] `secret` 用 `openssl rand -hex 32` 生成，走环境变量，不进仓库
- [ ] HTTPS 部署时 `secureCookie: true`，且只经 nginx(443) 暴露
- [ ] 官方 `?token=` 一次性令牌只给运维，绝不发给用户
- [ ] MySQL 账号最小权限（只对 `dsh_auth` 库授权）
- [ ] MySQL 不可用时插件启动 fail-fast（已实现，不会降级为不过滤）
- [ ] 备份两份数据：`$DSH_HOME`（会话 JSONL）+ MySQL

## 升级 harness 时

插件不 import harness 包的类型（只用最小结构声明），升级后跑一次
`npm run typecheck`；若官方 `sessionController` 的 list/create/inspect/prompt
签名变化，会在 `src/index.ts` 的 `SessionControllerLike` 处暴露。

详细设计与部署架构见仓库内 `.workbuddy/multi-user-auth-plan.md`。
