/**
 * 用户使用手册网页版（单文件 HTML，由公开路由 /app/manual 返回，免登录）。
 * 内容尽量简单清晰：快速上手三步 → 常用功能 → 上传限制 → 常见问题 → 注意事项。
 * 视觉对齐 ui.ts 的品牌色（deepseek-500 rgb(65,118,230)）与圆角/阴影规范。
 * 注意：本模板字符串内不能出现反引号 `（会提前终止模板）；如需拼接请用普通字符串。
 */
export const MANUAL_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>操作手册 · 恩施州城乡规划设计研究院智能工作台</title>
<style>
  :root{
    --brand:#4172e6; --brand-hover:#3560c9; --brand-50:#eef3fe;
    --bg:#f5f7fb; --panel:#ffffff; --line:#e5e9f0;
    --ink:#1f2329; --ink-2:#4a5160; --ink-3:#8a93a6;
    --shadow:0 6px 24px rgba(27,35,60,.06);
    --ease:cubic-bezier(.4,0,.2,1);
  }
  *{box-sizing:border-box}
  body{
    margin:0; font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans SC",sans-serif;
    background:var(--bg); color:var(--ink); line-height:1.7; font-size:15px;
    -webkit-font-smoothing:antialiased;
  }
  a{color:var(--brand); text-decoration:none}
  .wrap{max-width:860px; margin:0 auto; padding:28px 18px 60px;}
  /* 顶栏 */
  .top{display:flex; align-items:center; gap:12px; margin-bottom:8px;}
  .logo{width:40px;height:40px;border-radius:10px;background:var(--brand);display:flex;align-items:center;justify-content:center;color:#fff;flex:none}
  .logo svg{width:22px;height:22px}
  .top h1{font-size:20px;margin:0;font-weight:600;letter-spacing:.2px}
  .top .sub{color:var(--ink-3);font-size:13px;margin-top:2px}
  .back{margin-left:auto;flex:none;background:var(--panel);border:1px solid var(--line);color:var(--ink-2);
    padding:7px 14px;border-radius:10px;font-size:13.5px;transition:all .15s var(--ease)}
  .back:hover{border-color:var(--brand);color:var(--brand)}
  .lead{color:var(--ink-2);margin:14px 0 26px;}
  /* 分节 */
  section{margin:26px 0}
  h2{font-size:17px;margin:0 0 14px;display:flex;align-items:center;gap:8px;font-weight:600}
  h2 .dot{width:6px;height:20px;border-radius:3px;background:var(--brand);flex:none}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:18px;}
  /* 快速上手 */
  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .step{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 16px;box-shadow:var(--shadow)}
  .step .num{width:30px;height:30px;border-radius:50%;background:var(--brand-50);color:var(--brand);
    font-weight:700;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
  .step b{display:block;font-size:15px;margin-bottom:4px}
  .step p{margin:0;color:var(--ink-2);font-size:13.5px}
  /* 常用功能 */
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  .feat{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:var(--shadow)}
  .feat .ic{font-size:18px;margin-bottom:6px}
  .feat b{display:block;font-size:15px;margin-bottom:4px}
  .feat p{margin:0;color:var(--ink-2);font-size:13.5px}
  /* 表格 */
  table{width:100%;border-collapse:collapse;background:var(--panel);border-radius:14px;overflow:hidden;box-shadow:var(--shadow)}
  th,td{text-align:left;padding:11px 14px;font-size:14px;border-bottom:1px solid var(--line)}
  th{background:var(--brand-50);color:var(--ink-2);font-weight:600}
  tr:last-child td{border-bottom:none}
  /* 常见问题 */
  details{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:10px;box-shadow:var(--shadow);overflow:hidden}
  summary{padding:13px 16px;cursor:pointer;font-weight:600;font-size:14.5px;list-style:none;display:flex;align-items:center;justify-content:space-between}
  summary::-webkit-details-marker{display:none}
  summary::after{content:"+";color:var(--ink-3);font-weight:400;font-size:18px}
  details[open] summary::after{content:"−"}
  details .ans{padding:0 16px 14px;color:var(--ink-2);font-size:14px}
  /* 注意事项 */
  .notes li{margin:8px 0;color:var(--ink-2)}
  .notes b{color:var(--ink)}
  .foot{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);color:var(--ink-3);font-size:12.5px;text-align:center}
  @media (max-width:720px){ .steps,.grid{grid-template-columns:1fr} .top h1{font-size:18px} }
</style>
</head>
<body>
<div class="wrap">

  <div class="top">
    <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>
    <div>
      <h1>操作手册</h1>
      <div class="sub">恩施州城乡规划设计研究院智能工作台</div>
    </div>
    <a class="back" href="/app">返回登录</a>
  </div>

  <p class="lead">工作台是一个网页里的 AI 助手：你可以像聊天一样提需求，也可以把 Word、Excel、PPT、PDF、图片等资料交给它处理。下面用最短的路径教你上手。</p>

  <section>
    <h2><span class="dot"></span>快速上手（3 步）</h2>
    <div class="steps">
      <div class="step"><div class="num">1</div><b>登录</b><p>用管理员给的<strong>手机号</strong>和密码登录（不支持自助注册）。</p></div>
      <div class="step"><div class="num">2</div><b>新建会话</b><p>点左栏「新建会话」，开始一个新话题。</p></div>
      <div class="step"><div class="num">3</div><b>提问 / 传资料</b><p>在输入框描述需求，或把文件拖进来，点发送。</p></div>
    </div>
  </section>

  <section>
    <h2><span class="dot"></span>常用功能</h2>
    <div class="grid">
      <div class="feat"><div class="ic">💬</div><b>会话</b><p>左栏是全部会话。点它切换回看；不需要的可删除（删除后不可恢复）。</p></div>
      <div class="feat"><div class="ic">📎</div><b>上传资料</b><p>支持拖拽、选文件、传整个文件夹，或传 ZIP 压缩包（自动解压）。</p></div>
      <div class="feat"><div class="ic">🖼️</div><b>在线预览</b><p>点文件面板里的文件，Word / Excel / PPT / PDF / 图片直接预览，不用先下载。</p></div>
      <div class="feat"><div class="ic">⏹️</div><b>停止回答</b><p>AI 正在回答时会出现「停止」按钮，点它可中断当前这一轮。</p></div>
      <div class="feat"><div class="ic">🤖</div><b>选择模型</b><p>顶栏默认「自动」，按任务难度智能选择；也可以手动指定某个模型。</p></div>
      <div class="feat"><div class="ic">🧩</div><b>技能</b><p>输入框打「/」可调技能；打开「技能中心」可上传自己的技能包，或从技能市场安装 / 卸载。</p></div>
      <div class="feat"><div class="ic">🛡️</div><b>卡住自动停</b><p>任务长时间没进展会被自动停止，并在会话里说明原因 —— 不用干等。</p></div>
    </div>
  </section>

  <section>
    <h2><span class="dot"></span>上传自己的技能包</h2>
    <p>顶栏打开「<strong>技能中心</strong>」，把技能包（.zip）拖进上传区即可，装完立刻生效，<strong>不用重启服务，也只有你自己可见</strong>。</p>
    <table>
      <tr><th>项目</th><th>限制 / 说明</th></tr>
      <tr><td>包格式</td><td>仅 .zip（tgz / 7z / rar 请先转成 zip）；单包 ≤ 64MB</td></tr>
      <tr><td>目录结构</td><td>顶层需含 <code>SKILL.md</code>；把整个技能文件夹打成包（外层套一层目录）也能自动识别</td></tr>
      <tr><td>SKILL.md</td><td>文件头要有 frontmatter（<code>---</code> 包裹），至少含 <code>name</code> 与 <code>description</code>；<code>name</code> 用小写字母+连字符</td></tr>
      <tr><td>同名冲突</td><td>再传同名包＝覆盖更新；若与系统内置技能同名会提示「同名被遮蔽」，建议改个名字</td></tr>
      <tr><td>卸载</td><td>技能中心里点该技能的「卸载」，只删你自己那份，不影响其他人</td></tr>
    </table>
  </section>

  <section>
    <h2><span class="dot"></span>任务卡住会自动停止</h2>
    <p>如果某一轮任务长时间没有任何进展，系统会替你按下停止键，并在会话顶部显示一条<strong>橙色提示条</strong>，写清楚「因为什么停的、停在哪一步」，你可以直接继续发指令，不用手动刷新或重开会话。</p>
    <table>
      <tr><th>停止原因</th><th>触发条件</th><th>通常怎么办</th></tr>
      <tr><td>等待回答超时</td><td>AI 向你提问后 2 分钟没收到回复（提问卡片没渲染出来 / 浏览器断连时最常见）</td><td>直接把答案打给它，或重新发一句指令</td></tr>
      <tr><td>工具长时间无输出</td><td>某个命令连续 5 分钟没有任何输出</td><td>命令可能卡在等待输入或被网络挂起 —— 换个写法、或先自己跑一遍确认</td></tr>
      <tr><td>模型响应中断</td><td>AI 回复流停了 3 分钟没有继续</td><td>多为网络或供应商抖动，重试一般就好</td></tr>
      <tr><td>单轮运行时长超限</td><td>一轮任务跑了 20 分钟还没结束</td><td>把任务拆成更小的步骤分步做</td></tr>
    </table>
    <p class="muted">正常执行的任务（含几分钟的长命令）不会触发；如果你确实需要更长的等待时间，可以让管理员调整配置。</p>
  </section>

  <section>
    <h2><span class="dot"></span>上传限制</h2>
    <table>
      <tr><th>项目</th><th>限制 / 说明</th></tr>
      <tr><td>压缩包（ZIP）</td><td>单文件 ≤ 50MB、解压后总量 ≤ 200MB、条目 ≤ 2000 个；<strong>不支持加密压缩包</strong></td></tr>
      <tr><td>预览转换</td><td>Office 转预览需要时间（单个约 60 秒内），同时转换数量有限，批量预览请稍候</td></tr>
      <tr><td>手机微信内</td><td>微信内置浏览器不能选文件夹 —— 请点右上角「在浏览器打开」（推荐 Chrome），或改传 ZIP</td></tr>
      <tr><td>同时使用</td><td>人多时会排队（每人默认同时 2 个任务），稍等重试即可</td></tr>
    </table>
  </section>

  <section>
    <h2><span class="dot"></span>常见问题</h2>
    <details><summary>提示「账号必须是 11 位手机号」</summary><div class="ans">账号应填手机号。如果粘贴时带了空格或符号，重新手动输入一遍即可。</div></details>
    <details><summary>想自己注册账号？</summary><div class="ans">账号由管理员统一开通，不支持自助注册。需要开通请联系管理员。</div></details>
    <details><summary>提示「排队中」</summary><div class="ans">同时使用的人较多，系统在按上限排队。这是保护机制，稍等后重试即可，不是故障。</div></details>
    <details><summary>Office 文件预览不出来</summary><div class="ans">转换需要时间，稍等或重试。若一直失败，文件可能过大或格式特殊，可先转成 PDF 再上传。</div></details>
    <details><summary>选某个模型后调用报错（如缺少密钥）</summary><div class="ans">该模型尚未配置可用密钥。请改用其他模型，或联系管理员配置。</div></details>
    <details><summary>为什么看不到别人的会话</summary><div class="ans">这是正常的。每个账号只能访问自己的数据，互相隔离。</div></details>
    <details><summary>忘记密码怎么办</summary><div class="ans">目前没有自助找回，请联系管理员重置。</div></details>
  </section>

  <section>
    <h2><span class="dot"></span>使用须知</h2>
    <div class="card">
      <ul class="notes" style="margin:0;padding-left:20px">
        <li><b>不要上传涉密或敏感个人信息</b>；AI 生成内容对外使用前请人工复核。</li>
        <li>在<b>公用电脑</b>上用完后，记得点「退出登录」。</li>
        <li>会话与文件<b>删除后不可恢复</b>，重要内容请先下载留存。</li>
        <li>遇到异常：把页面截图和红色错误提示一并发给管理员，便于快速定位。</li>
      </ul>
    </div>
  </section>

  <div class="foot">Built on DeepSeek Harness · 遇到问题请联系管理员</div>
</div>
</body>
</html>
`
