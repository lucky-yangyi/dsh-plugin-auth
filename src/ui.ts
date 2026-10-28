/** 多用户前端页面（单文件 HTML，由 /app 路由直接返回）。
 *
 * 视觉规范对齐 DeepSeek Harness 官方 design tokens
 * （packages/client/ui-theme/src/styles/）：
 * - 品牌色 deepseek-500 rgb(65,118,230)，浅底 deepseek-50
 * - 中性色 neutral-bluish 系；动效 cubic-bezier(0.4,0,0.2,1)
 * - 字体 -apple-system 栈 + SF Mono 代码栈
 * - 命名遵循 BRAND_GUIDELINES：社区项目用 "DSH" 缩写，标注 built on DeepSeek Harness
 */

export const UI_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>恩施州城乡规划设计研究院智能工作台</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234176e6'/%3E%3Ctext x='16' y='22' font-size='16' font-family='-apple-system,Helvetica' font-weight='700' fill='white' text-anchor='middle'%3ED%3C/text%3E%3C/svg%3E">
<style>
  :root {
    --brand: rgb(65, 118, 230);          /* deepseek-500 */
    --brand-hover: rgb(55, 103, 214);
    --brand-50: rgb(237, 243, 254);      /* deepseek-50 */
    --brand-100: rgb(228, 237, 253);     /* deepseek-100 */
    --bg: rgb(249, 250, 251);            /* neutral-bluish-50 */
    --bg-2: rgb(233, 236, 242);          /* neutral-bluish-150 */
    --panel: #fff;
    --line: rgb(225, 229, 238);          /* neutral-bluish-200 */
    --line-strong: rgb(207, 211, 214);   /* neutral-bluish-300 */
    --ink: rgb(27, 27, 28);              /* neutral-bluish-900 */
    --ink-2: rgb(97, 102, 107);          /* neutral-bluish-700 */
    --ink-3: rgb(151, 157, 166);         /* neutral-bluish-500 */
    --code-bg: rgb(33, 33, 35);
    --code-ink: rgb(233, 236, 242);
    --err: rgb(239, 68, 68);
    --ease: cubic-bezier(0.4, 0, 0.2, 1);
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
            'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    --mono: 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono',
            Menlo, Courier, 'PingFang SC', 'Microsoft YaHei';
    --shadow-card: 0 1px 2px rgba(27,27,28,.04), 0 8px 24px rgba(27,27,28,.06);
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body { font: 14px/1.65 var(--font); color: var(--ink); background: var(--bg); }
  button { font: inherit; cursor: pointer; }
  .muted { color: var(--ink-3); font-size: 12px; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }
  ::-webkit-scrollbar-track { background: transparent; }

  /* ============ 登录 / 注册 ============ */
  #auth {
    height: 100vh; display: flex; align-items: center; justify-content: center;
    background:
      radial-gradient(1100px 560px at 12% -8%, rgba(65,118,230,.075), transparent 60%),
      radial-gradient(900px 520px at 108% 112%, rgba(65,118,230,.055), transparent 55%),
      var(--bg);
  }
  .authCard {
    width: 400px; background: var(--panel); border: 1px solid var(--line);
    border-radius: 16px; padding: 36px 36px 28px; box-shadow: var(--shadow-card);
  }
  .brandRow { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 26px; }
  .brandRow svg { width: 44px; height: auto; color: var(--brand); }
  .brandName { font-size: 18px; font-weight: 600; letter-spacing: .2px; white-space: nowrap; }
  .brandSub { color: var(--ink-3); font-size: 13px; }
  .seg { display: flex; background: var(--bg-2); border-radius: 10px; padding: 3px; margin-bottom: 20px; }
  .seg button {
    flex: 1; border: none; background: transparent; color: var(--ink-2);
    padding: 7px 0; border-radius: 8px; font-weight: 500; transition: all .15s var(--ease);
  }
  .seg button.on { background: var(--panel); color: var(--ink); box-shadow: 0 1px 3px rgba(27,27,28,.10); }
  #auth form { display: flex; flex-direction: column; gap: 12px; }
  #auth input {
    font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px;
    width: 100%; background: var(--panel); color: var(--ink); outline: none;
    transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
  }
  #auth input::placeholder { color: var(--ink-3); }
  #auth input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(65,118,230,.13); }
  .primary {
    background: var(--brand); border: none; color: #fff; font-weight: 500;
    border-radius: 10px; padding: 10px 0; transition: background .15s var(--ease), transform .1s var(--ease);
  }
  .primary:hover { background: var(--brand-hover); }
  .primary:active { transform: scale(.98); }
  #authMsg { min-height: 18px; font-size: 12.5px; color: var(--err); }
  .authFoot {
    margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line);
    text-align: center; color: var(--ink-3); font-size: 12px;
  }
  .authFoot b { color: var(--ink-2); font-weight: 500; }
  .authDivider { margin: 16px 0 10px; border-top: 1px dashed var(--line); }
  .manualBtn {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    background: transparent; color: var(--ink-2); border: 1px solid var(--line);
    border-radius: 10px; padding: 10px 0; font-weight: 500; text-decoration: none;
    font-size: 15px; transition: border-color .15s var(--ease), color .15s var(--ease), transform .1s var(--ease);
  }
  .manualBtn:hover { border-color: var(--brand); color: var(--brand); }
  .manualBtn:active { transform: scale(.98); }

  /* ============ 主界面 ============ */
  #app { display: none; width: 100%; height: 100vh; }

  /* 侧栏 */
  #side { width: 264px; flex: none; border-right: 1px solid var(--line); background: var(--panel); display: flex; flex-direction: column; }
  .sideBrand { padding: 16px 18px; display: flex; align-items: center; gap: 9px; border-bottom: 1px solid var(--line); }
  .sideBrand svg { width: 24px; height: auto; color: var(--brand); }
  .sideBrand b { font-size: 14.5px; font-weight: 600; }
  .brandText { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
  .brandOrg { font-size: 10.5px; color: var(--ink-3); letter-spacing: .3px; white-space: nowrap; }
  #newBtn {
    margin: 14px 14px 8px; background: var(--brand); border: none; color: #fff; font-weight: 500;
    border-radius: 10px; padding: 9px 0; display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: background .15s var(--ease), transform .1s var(--ease);
  }
  #newBtn:hover { background: var(--brand-hover); }
  #newBtn:active { transform: scale(.98); }
  #sessions { flex: 1; overflow-y: auto; padding: 4px 10px 10px; }

  /* 右侧文件面板（对话区右侧，可折叠收起） */
  #filesPanel {
    width: 300px; flex: none; border-left: 1px solid var(--line); background: var(--panel);
    display: flex; flex-direction: column; overflow: hidden; position: relative;
  }
  #filesPanel.off { display: none; }
  .fpHead {
    height: 54px; flex: none; display: flex; align-items: center; gap: 6px;
    padding: 0 10px 0 16px; border-bottom: 1px solid var(--line);
  }
  .fpHead b { flex: 1; font-size: 13.5px; font-weight: 600; }
  .fpHead button {
    border: none; background: transparent; color: var(--ink-3); width: 26px; height: 26px; flex: none;
    border-radius: 6px; display: flex; align-items: center; justify-content: center;
    transition: background .12s var(--ease), color .12s var(--ease);
  }
  .fpHead button:hover { background: var(--bg-2); color: var(--ink); }
  .fpHead button svg { width: 15px; height: 15px; }
  #files { flex: 1; overflow-y: auto; padding: 8px 10px 14px; }
  #files.off { display: none; }
  /* 预览态：右栏变宽，文件树让位给内嵌预览 */
  #filesPanel.wide { width: clamp(360px, 42vw, 760px); }
  #fpGrip { position: absolute; left: -3px; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 6; }
  #fpGrip:hover, #fpGrip.on { background: rgba(65,118,230,.28); }
  #fpv { display: none; flex: 1; flex-direction: column; overflow: hidden; }
  #fpv.on { display: flex; }
  #fpvHead {
    height: 46px; flex: none; display: flex; align-items: center; gap: 4px;
    padding: 0 8px 0 10px; border-bottom: 1px solid var(--line);
  }
  #fpvHead b {
    flex: 1; min-width: 0; font-size: 13px; font-weight: 600;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  #fpvHead button {
    border: none; background: transparent; color: var(--ink-3); width: 26px; height: 26px; flex: none;
    border-radius: 6px; display: flex; align-items: center; justify-content: center;
    transition: background .12s var(--ease), color .12s var(--ease);
  }
  #fpvHead button:hover { background: var(--bg-2); color: var(--ink); }
  #fpvHead button svg { width: 15px; height: 15px; }
  #fpvBody { flex: 1; overflow: auto; background: var(--bg); display: flex; align-items: center; justify-content: center; }
  #fpvBody img { max-width: 100%; max-height: 100%; object-fit: contain; }
  #fpvBody iframe { width: 100%; height: 100%; border: none; }
  #fpvBody pre {
    align-self: stretch; margin: 0; padding: 14px; white-space: pre-wrap; word-break: break-word;
    font: 12.5px/1.6 var(--mono); color: var(--ink);
  }
  .fSec {
    margin: 12px 4px 4px; padding: 0 2px; display: flex; align-items: center; gap: 6px;
    font-size: 11.5px; color: var(--ink-3); letter-spacing: .02em; user-select: none;
  }
  .fSec .cnt { margin-left: auto; }
  .fSec.ws { font-size: 12.5px; color: var(--ink); font-weight: 500; margin: 4px 4px 2px; }
  .fSub {
    margin: 8px 4px 2px; padding: 0 2px 0 8px; display: flex; align-items: center; gap: 6px;
    font-size: 11.5px; color: var(--ink-3); letter-spacing: .02em; user-select: none;
    border-left: 2px solid var(--line);
  }
  .fSub .cnt { margin-left: auto; }
  .fRow {
    display: flex; align-items: center; gap: 6px; padding: 5px 6px 5px 8px;
    border-radius: 8px; cursor: pointer; font-size: 13px; color: var(--ink-2);
    transition: background .12s var(--ease), color .12s var(--ease);
  }
  .fRow:hover { background: var(--bg-2); color: var(--ink); }
  .fRow .fIco { flex: none; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; color: var(--ink-3); }
  .fRow .fIco svg { width: 14px; height: 14px; }
  .fRow .fNm { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fRow .fSz { flex: none; font-size: 11px; color: var(--ink-3); }
  .fDl {
    flex: none; width: 20px; height: 20px; border: none; background: transparent;
    color: var(--ink-3); border-radius: 5px; display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity .12s var(--ease), background .12s var(--ease), color .12s var(--ease);
  }
  .fRow:hover .fDl { opacity: 1; }
  .fDl:hover { background: rgba(65,118,230,.12); color: var(--brand); }
  .fDl svg { width: 13px; height: 13px; }
  .fKids { margin-left: 12px; border-left: 1px solid var(--line); padding-left: 2px; }
  .fEmpty { color: var(--ink-3); font-size: 12px; padding: 4px 8px; line-height: 1.6; }
  .pvChip { cursor: pointer; }

  /* 文件预览弹层（绝对定位于 #chat 内，不遮侧栏） */
  #pv { display: none; position: absolute; inset: 0; z-index: 50; background: rgba(27,27,28,.5); align-items: center; justify-content: center; }
  #pv.on { display: flex; }
  #pvCard {
    background: var(--panel); border-radius: 14px; width: min(860px, 92vw); height: min(88vh, 700px);
    display: flex; flex-direction: column; overflow: hidden;
  }
  #pvHead { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line); flex: none; }
  #pvHead b { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #pvBody { flex: 1; overflow: auto; background: var(--bg); display: flex; align-items: center; justify-content: center; }
  #pvBody img { max-width: 100%; max-height: 100%; object-fit: contain; }
  #pvBody iframe { width: 100%; height: 100%; border: none; }
  #pvBody pre {
    align-self: stretch; margin: 0; padding: 16px; white-space: pre-wrap; word-break: break-word;
    font: 12.5px/1.6 var(--mono); color: var(--ink);
  }
  #pvBtns { display: flex; gap: 8px; }
  #pvBtns button {
    border: 1px solid var(--line); background: var(--panel); color: var(--ink-2);
    border-radius: 8px; padding: 5px 12px; font-size: 12.5px; transition: all .15s var(--ease);
  }
  #pvBtns button:hover { border-color: var(--brand); color: var(--brand); }
  #pvMsgBox {
    align-self: stretch; margin: auto; max-width: 460px; padding: 22px 24px; text-align: center;
    display: flex; flex-direction: column; gap: 10px; align-items: center;
  }
  #pvMsgBox b { font-size: 14px; font-weight: 600; color: var(--ink); }
  #pvMsgBox p {
    margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--ink-3); word-break: break-word;
  }
  #pvMsgBox code {
    font: 12px var(--mono); background: var(--bg-2); padding: 1px 5px; border-radius: 4px; color: var(--ink-2);
  }
  #pvMsgBox button {
    margin-top: 4px; border: 1px solid var(--line); background: var(--panel); color: var(--ink-2);
    border-radius: 8px; padding: 6px 14px; font-size: 12.5px;
  }
  #pvMsgBox button:hover { border-color: var(--brand); color: var(--brand); }

  /* 对话区头部右侧的「右栏」开关（WorkBuddy 同款：面板图标 + 状态 tooltip） */
  .headIconBtn {
    margin-left: auto; flex: none; width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    border: none; background: transparent; color: var(--ink-2); border-radius: 8px;
    transition: background .12s var(--ease), color .12s var(--ease);
  }
  .headIconBtn:hover { background: var(--bg-2); color: var(--ink); }
  .headIconBtn.on { color: var(--brand); background: var(--brand-50); }
  .headIconBtn svg { width: 17px; height: 17px; }
  /* 顶栏模型选择器：自动（按难度路由）+ 手动指定 */
  #modelSel {
    margin-left: auto; flex: none; max-width: 180px;
    font: inherit; font-size: 12.5px; color: var(--ink-2);
    border: 1px solid var(--line); border-radius: 8px; background: var(--panel);
    padding: 4px 6px; outline: none; cursor: pointer;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  #modelSel:focus { border-color: var(--brand); }
  #modelNow { flex: none; font-size: 11.5px; color: var(--ink-3); white-space: nowrap; }

  .sess {
    display: flex; align-items: center; gap: 4px;
    padding: 7px 6px 7px 11px; border-radius: 9px; cursor: pointer; font-size: 13px; color: var(--ink-2);
    transition: background .12s var(--ease), color .12s var(--ease);
  }
  .sessTitle { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sess:hover { background: var(--bg-2); color: var(--ink); }
  .sess.on { background: var(--brand-50); color: var(--ink); font-weight: 500; }
  .delBtn {
    flex: none; width: 22px; height: 22px; border: none; background: transparent;
    color: var(--ink-3); border-radius: 6px; font-size: 16px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity .12s var(--ease), background .12s var(--ease), color .12s var(--ease);
  }
  .sess:hover .delBtn { opacity: 1; }
  .delBtn:hover { background: rgba(239,68,68,.12); color: var(--err); }
  .sess.on .delBtn { opacity: .55; }
  .userBar {
    border-top: 1px solid var(--line); padding: 12px 14px;
    display: flex; align-items: center; gap: 10px;
  }
  .ava {
    width: 30px; height: 30px; flex: none; border-radius: 50%;
    background: var(--brand-100); color: var(--brand);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 600; text-transform: uppercase;
  }
  .userBar #whoami { flex: 1; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #logoutBtn {
    border: 1px solid var(--line); background: var(--panel); color: var(--ink-2);
    border-radius: 8px; padding: 5px 11px; font-size: 12px; transition: all .15s var(--ease);
  }
  #logoutBtn:hover { border-color: var(--err); color: var(--err); }
  #pwBtn {
    border: 1px solid var(--line); background: var(--panel); color: var(--ink-2);
    border-radius: 8px; padding: 5px 11px; font-size: 12px; transition: all .15s var(--ease);
  }
  #pwBtn:hover { border-color: var(--brand); color: var(--brand); }

  /* 修改密码弹层 */
  #pwModal { display: none; position: fixed; inset: 0; z-index: 95; background: rgba(27,27,28,.5); align-items: center; justify-content: center; }
  #pwModal.on { display: flex; }
  #pwCard {
    background: var(--panel); border-radius: 14px; width: min(360px, 92vw);
    padding: 22px 22px 18px; display: flex; flex-direction: column; gap: 12px;
  }
  #pwCard h3 { margin: 0; font-size: 14.5px; font-weight: 600; }
  #pwCard .pwHint { font-size: 11.5px; color: var(--ink-3); margin: -6px 0 0; line-height: 1.5; }
  #pwCard input {
    width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 8px;
    background: var(--bg); color: var(--ink); padding: 9px 11px; font-size: 13px; outline: none;
  }
  #pwCard input:focus { border-color: var(--brand); }
  #pwCard .pwRow { display: flex; gap: 8px; justify-content: flex-end; }
  #pwCard button.pwCancel {
    border: 1px solid var(--line); background: var(--panel); color: var(--ink-2);
    border-radius: 8px; padding: 7px 14px; font-size: 12.5px;
  }
  #pwCard button.pwOk {
    border: none; background: var(--brand); color: #fff;
    border-radius: 8px; padding: 7px 14px; font-size: 12.5px; font-weight: 500;
  }
  #pwCard button.pwOk:disabled { opacity: .6; cursor: default; }
  #pwErrMsg { font-size: 12px; color: var(--err, #d33); min-height: 16px; }

  /* 聊天区 */
  #chat { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; background: var(--bg); }
  #chatHead {
    padding: 0 24px; height: 54px; flex: none; display: flex; align-items: center; gap: 10px;
    background: var(--panel); border-bottom: 1px solid var(--line);
  }
  #chatHead b { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  /* 本轮计时状态：进行中用品牌色 + 呼吸点，结束后回落灰色 */
  #curState { font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  /* 本轮执行失败（turn/end reason.kind === 'error'）：红卡片直接进聊天流，
     之前这类错误（如 MISSING_CREDENTIAL）完全静默，用户只看到"没反应"。 */
  .turnErr {
    align-self: stretch; border: 1px solid rgba(239,68,68,.4); background: rgba(239,68,68,.06);
    color: var(--err); border-radius: 10px; padding: 8px 12px;
    font-size: 12.5px; line-height: 1.6; word-break: break-word;
  }
  .turnErr b { display: block; font-weight: 600; margin-bottom: 2px; }
  .turnErr .tip { color: var(--ink-3); font-size: 11.5px; margin-top: 4px; }
  /* 每轮结束插在聊天流里的用时记录 */
  .turnMeta {
    display: flex; align-items: center; gap: 6px; padding: 0 2px;
    font-size: 11.5px; color: var(--ink-3); font-variant-numeric: tabular-nums;
  }
  .turnMeta svg { width: 13px; height: 13px; flex: none; }
  .turnMeta .note { color: var(--ink-3); opacity: .85; }
  #curState.live { color: var(--brand); }
  #curState.live::before {
    content: ''; display: inline-block; width: 6px; height: 6px; margin-right: 6px;
    border-radius: 50%; background: var(--brand); vertical-align: 1px;
    animation: statePulse 1.2s var(--ease) infinite;
  }
  @keyframes statePulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
  #msgs { flex: 1; overflow-y: auto; padding: 24px 28px 12px; display: flex; flex-direction: column; gap: 18px; }
  #msgs .empty { margin: auto; text-align: center; color: var(--ink-3); font-size: 13.5px; }
  #msgs .empty svg { width: 52px; height: auto; color: var(--line-strong); display: block; margin: 0 auto 10px; }
  /* 移动端空态：直接给「新建/查看历史」两个大按钮，不再把入口藏进汉堡抽屉 */
  .emptyTitle { font-size: 15px; font-weight: 500; color: var(--ink-2); margin-bottom: 2px; }
  .emptyActions { display: flex; gap: 10px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }
  .emptyBtn {
    padding: 11px 22px; border-radius: 12px; font-size: 15px; font-weight: 500;
    border: 1px solid var(--line); background: var(--panel); color: var(--ink-2); cursor: pointer;
    transition: transform .1s var(--ease), border-color .15s var(--ease);
  }
  .emptyBtn:active { transform: scale(.97); }
  .emptyBtn.primary { background: var(--brand); color: #fff; border-color: var(--brand); }
  .emptyBtn.primary:active { background: var(--brand-hover); }
  .emptyHint { margin-top: 14px; font-size: 12.5px; color: var(--ink-3); }

  /* 消息：用户右侧浅蓝气泡；AI 左侧头像 + 全宽正文 */
  .msg { max-width: 100%; word-break: break-word; }
  .msg.u {
    position: relative; align-self: flex-end; max-width: 72%; background: var(--brand-50);
    border: 1px solid var(--brand-100); border-radius: 14px 14px 4px 14px;
    padding: 9px 14px 28px 14px; white-space: pre-wrap; color: var(--ink);
  }
  .msg.u.edit { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; background: #fff; border-color: var(--brand-100); }
  .msg.u.edit .editText {
    width: 100%; border: none; outline: none; background: transparent; resize: none;
    font: inherit; color: var(--ink); min-height: 60px; max-height: 240px; line-height: 1.5;
    padding: 0; margin: 0;
  }
  .msg.u.edit .editNote { font-size: 12px; color: var(--ink-3); line-height: 1.4; }
  .msg.u.edit .editBtns { display: flex; justify-content: flex-end; gap: 8px; }
  .msg.u.edit .editBtns button {
    border: none; border-radius: 8px; padding: 6px 14px; cursor: pointer; font-size: 13px;
    transition: opacity .12s, background .12s;
  }
  .msg.u.edit .editCancel { background: var(--bg-2); color: var(--ink-2); }
  .msg.u.edit .editCancel:hover { background: var(--bg-3); color: var(--ink); }
  .msg.u.edit .editSend { background: var(--brand); color: #fff; }
  .msg.u.edit .editSend:hover { opacity: .92; }
  .msg.u .u-actions {
    position: absolute; right: 6px; bottom: 5px; display: flex; gap: 4px;
    opacity: 0; transition: opacity .12s;
  }
  .msg.u:hover .u-actions { opacity: 1; }
  .u-actions .uact {
    background: transparent; border: none; border-radius: 6px; padding: 4px; cursor: pointer;
    color: var(--ink-3); display: flex; align-items: center; justify-content: center;
    transition: color .12s, background .12s;
  }
  .u-actions .uact:hover { color: var(--brand); background: var(--panel); }
  .u-actions .uact svg { width: 14px; height: 14px; }
  .msg.a { align-self: stretch; display: flex; gap: 11px; }
  .msg.a .ava { width: 28px; height: 28px; margin-top: 1px; }
  .msg.a .ava svg { width: 16px; height: auto; }
  .msg.a .body { flex: 1; min-width: 0; white-space: pre-wrap; }
  .msg.streaming .body::after { content: '▍'; color: var(--brand); animation: blink 1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0 } }

  /* 附件：对齐官方 ui-attachment FileCard / MessageItem.fileCard */
  .fileCard {
    position: relative; display: inline-flex; align-items: center; gap: 10px;
    width: 240px; max-width: 100%; height: 64px; padding: 0 12px; box-sizing: border-box;
    border: 0.5px solid var(--line); border-radius: 16px; background: var(--panel);
    vertical-align: top;
  }
  .fileCard .ficon { width: 28px; height: 28px; flex: none; color: var(--ink-2); }
  .fileCard .spin {
    width: 22px; height: 22px; flex: none; border: 2px solid var(--line-strong);
    border-top-color: var(--brand); border-radius: 50%; animation: spin .7s linear infinite;
  }
  .fileCard .fmain { flex: 1; min-width: 0; }
  .fileCard .fname {
    display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
    font-size: 14px; font-weight: 500; line-height: 22px; color: var(--ink);
  }
  .fileCard .fmeta { display: block; font-size: 12px; line-height: 15px; color: var(--ink-3); }
  .fileCard.failed { border-color: #e5484d; }
  .fileCard.failed .fmeta { color: #e5484d; }
  /* 目录上传：一张卡代表整棵目录，不逐个文件铺卡片 */
  .dirCard {
    display: inline-flex; align-items: center; gap: 8px; max-width: 100%;
    padding: 6px 10px 6px 8px; border: 1px solid var(--line); border-radius: 10px;
    background: var(--bg-2); font-size: 12.5px; color: var(--ink-2);
  }
  .dirCard .ficon { width: 26px; height: 26px; flex: none; color: var(--brand); }
  .dirCard .ficon svg { width: 26px; height: 26px; }
  .dirCard .fmain { flex: 1; min-width: 0; }
  .dirCard .fname { display: block; max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
  .dirCard .fmeta { display: block; font-size: 12px; line-height: 15px; color: var(--ink-3); }
  /* 目录卡展开后的结构预览（只读，不逐文件出卡） */
  .dirKids {
    max-height: 168px; overflow-y: auto; margin: 2px 0 6px 0; padding: 4px 8px 4px 10px;
    border-left: 2px solid var(--line); font: 12px/1.7 var(--mono); color: var(--ink-3);
  }
  .dirKid { display: flex; gap: 8px; white-space: nowrap; }
  .dirKid .sz { margin-left: auto; opacity: .8; }
  .fremove {
    position: absolute; top: 6px; right: 6px; width: 18px; height: 18px; border: none; border-radius: 50%;
    background: rgba(97,102,107,.85); color: #fff; cursor: pointer; padding: 0;
    display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .15s var(--ease);
  }
  .fileCard:hover .fremove, .imgThumb:hover .fremove, .fremove:focus { opacity: 1; }
  .imgThumb {
    position: relative; display: inline-block; width: 64px; height: 64px; flex: none; vertical-align: top;
    border: 0.5px solid var(--line); border-radius: 16px; overflow: hidden; background: var(--bg-2);
  }
  .imgThumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .imgThumb.failed { border-color: #e5484d; }
  .msgAttach { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  @keyframes spin { to { transform: rotate(360deg) } }

  /* markdown 渲染 */
  .msg pre {
    background: var(--code-bg); color: var(--code-ink); border: none;
    border-radius: 10px; padding: 12px 14px; overflow-x: auto; margin: 8px 0;
    white-space: pre; font: 12.5px/1.6 var(--mono);
  }
  .msg code {
    background: var(--bg-2); border-radius: 5px; padding: 1px 5px;
    font: 12.5px var(--mono); color: var(--ink);
  }
  .msg pre code { background: none; padding: 0; color: inherit; font: inherit; }
  .msg .think { border-left: 2px solid var(--line-strong); padding: 2px 0 2px 12px; font-size: 13px; color: var(--ink-2); white-space: pre-wrap; margin-bottom: 8px; }
  .msg .think summary { cursor: pointer; color: var(--ink-3); user-select: none; font-size: 12.5px; }
  .msg .think summary:hover { color: var(--ink-2); }

  /* 执行过程：tool/call + tool/result 归并成可展开步骤 */
  .step { margin: 2px 0 8px 40px; }
  .step[open] summary .st-arrow { transform: rotate(90deg); }
  .step summary {
    cursor: pointer; user-select: none; list-style: none;
    display: flex; align-items: center; gap: 7px;
    font-size: 12.5px; color: var(--ink-3);
    padding: 3px 0;
  }
  .step summary::-webkit-details-marker { display: none; }
  .step summary:hover { color: var(--ink-2); }
  .st-arrow {
    display: inline-block; width: 9px; flex: none; color: var(--ink-3);
    transition: transform .12s var(--ease);
  }
  .st-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand); flex: none; }
  .st-dot.err { background: #e5484d; }
  .st-dot.wait { background: var(--ink-3); opacity: .5; }
  .st-dot.think { background: #8b7cf6; }
  .st-sum {
    flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--ink-2); font-size: 12.5px;
  }
  .st-args.think { color: var(--ink-2); }
  .st-name { color: var(--ink-2); font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .st-body { margin: 4px 0 2px 16px; font-size: 12.5px; }
  .st-label { color: var(--ink-3); font-size: 11.5px; margin: 5px 0 2px; letter-spacing: .02em; }
  .st-args, .st-out {
    margin: 0; padding: 7px 10px; border-radius: 8px; background: var(--bg-2);
    border: 1px solid var(--line); color: var(--ink-2);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.55;
    white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow: auto;
  }
  .st-out.err { border-color: #e5484d55; color: #e5484d; }
  .st-trunc { color: var(--ink-3); font-size: 11.5px; margin-top: 3px; }

  /* 输入区 */
  #composerWrap { position: relative; flex: none; padding: 10px 20px 18px; background: var(--bg); }
  #pending { padding: 0 4px 8px; max-height: 110px; overflow-y: auto; }
  #inputBar {
    background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
    box-shadow: 0 1px 2px rgba(27,27,28,.04);
    transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
  }
  #inputBar:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(65,118,230,.12); }
  #text {
    width: 100%; border: none; outline: none; background: transparent; resize: none;
    font: inherit; color: var(--ink); padding: 12px 14px 6px; min-height: 46px; max-height: 180px;
  }
  #text::placeholder { color: var(--ink-3); }
  .barRow { display: flex; align-items: center; gap: 6px; padding: 6px 8px 8px; }
  .iconBtn {
    position: relative; overflow: hidden; width: 32px; height: 32px; flex: none;
    display: flex; align-items: center; justify-content: center;
    border: none; background: transparent; border-radius: 8px; color: var(--ink-2);
    transition: background .12s var(--ease), color .12s var(--ease);
  }
  .iconBtn:hover { background: var(--bg-2); color: var(--ink); }
  .iconBtn svg { width: 17px; height: 17px; }
  .pickInput { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  /* 技能菜单：浮在输入栏上方 */
  .skillMenu {
    position: absolute; left: 12px; right: 12px; bottom: 100%; margin-bottom: 8px; z-index: 40;
    max-height: 320px; overflow-y: auto; background: var(--panel);
    border: 1px solid var(--line); border-radius: 12px;
    box-shadow: 0 8px 28px rgba(27,27,28,.14); padding: 6px;
  }
  .skillMenu .skEmpty { padding: 16px; text-align: center; color: var(--ink-3); font-size: 13px; }
  .skillMenu .skHead {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 10px 8px; font-size: 12px; color: var(--ink-3);
  }
  .skillMenu .skItem {
    display: block; width: 100%; text-align: left; border: none; background: transparent;
    border-radius: 8px; padding: 8px 10px; cursor: pointer; color: var(--ink); font: inherit;
  }
  .skillMenu .skItem:hover, .skillMenu .skItem.sel { background: var(--bg); }
  .skillMenu .skName { font-size: 13.5px; font-weight: 600; }
  .skillMenu .skName .skSlash { color: var(--brand); margin-right: 2px; }
  .skillMenu .skDesc {
    font-size: 12px; color: var(--ink-3); line-height: 1.45; margin-top: 2px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  /* 技能条目的市场徽标：版本 / 作者 / 命名空间 */
  .skillMenu .skTop { display: flex; align-items: baseline; gap: 6px; }
  .skillMenu .skBadge {
    flex: none; font-size: 10.5px; line-height: 1.5; padding: 0 5px; border-radius: 4px;
    background: var(--brand-50); color: var(--brand); border: 1px solid var(--brand-100);
  }
  .skillMenu .skAuthor { font-size: 11px; color: var(--ink-3); }
  /* 技能市场弹层 */
  #hubPanel {
    display: none; position: fixed; inset: 0; z-index: 90;
    background: rgba(20,21,23,.42); align-items: center; justify-content: center; padding: 24px;
  }
  #hubPanel.on { display: flex; }
  #hubCard {
    width: min(760px, 100%); max-height: 84vh; display: flex; flex-direction: column;
    background: var(--panel); border-radius: 14px; box-shadow: 0 16px 48px rgba(27,27,28,.24); overflow: hidden;
  }
  #hubHead {
    display: flex; align-items: center; gap: 10px; padding: 14px 16px;
    border-bottom: 1px solid var(--line);
  }
  #hubHead b { font-size: 14px; flex: none; }
  #hubSearch {
    flex: 1; min-width: 0; font: inherit; font-size: 13px; padding: 6px 10px;
    border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); outline: none;
  }
  #hubSearch:focus { border-color: var(--brand); }
  #hubHead button {
    flex: none; font: inherit; font-size: 12px; padding: 5px 12px; cursor: pointer;
    border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink-2);
  }
  #hubHead button:hover { background: var(--bg-2); color: var(--ink); }
  #hubBody { padding: 10px 12px 16px; overflow-y: auto; }
  #hubBody .hubEmpty { padding: 40px 0; text-align: center; color: var(--ink-3); font-size: 13px; }
  .hubItem {
    display: flex; gap: 12px; align-items: flex-start; padding: 12px;
    border: 1px solid var(--line); border-radius: 10px; margin-bottom: 8px; background: var(--panel);
  }
  .hubIcon {
    flex: none; width: 40px; height: 40px; border-radius: 9px; background: var(--brand-50);
    display: flex; align-items: center; justify-content: center; font-size: 17px; color: var(--brand); overflow: hidden;
  }
  .hubIcon img { width: 100%; height: 100%; object-fit: cover; }
  .hubMain { flex: 1; min-width: 0; }
  .hubTitle { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .hubTitle b { font-size: 13.5px; font-weight: 600; }
  .hubNs { font-size: 11.5px; color: var(--ink-3); }
  .hubVer {
    font-size: 10.5px; padding: 0 5px; border-radius: 4px;
    background: var(--brand-50); color: var(--brand); border: 1px solid var(--brand-100);
  }
  .hubDesc {
    font-size: 12px; color: var(--ink-2); line-height: 1.5; margin-top: 3px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .hubMeta { font-size: 11.5px; color: var(--ink-3); margin-top: 4px; }
  .hubAct { flex: none; display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
  .hubAct button {
    font: inherit; font-size: 12px; padding: 5px 12px; border-radius: 8px; cursor: pointer; white-space: nowrap;
    border: 1px solid var(--brand); background: var(--brand); color: #fff;
  }
  .hubAct button.ghost { background: transparent; color: var(--ink-2); border-color: var(--line); }
  .hubAct button.ghost:hover { background: var(--bg-2); color: var(--ink); }
  .hubAct button[disabled] { opacity: .55; cursor: default; }
  /* 本地技能包上传区 */
  .locUp {
    border: 1px dashed var(--line); border-radius: 10px; padding: 12px 12px 10px;
    background: var(--bg); margin-bottom: 10px; transition: border-color .15s, background .15s;
  }
  .locUp.over { border-color: var(--brand); background: var(--bg-2); }
  .locUpHead { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .locUpHead b { font-size: 13.5px; font-weight: 600; }
  .locUpHead .muted { font-size: 11.5px; }
  .locUpBody { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .locUpBody button {
    font: inherit; font-size: 12px; padding: 6px 14px; border-radius: 8px; cursor: pointer;
    border: 1px solid var(--brand); background: var(--brand); color: #fff;
  }
  .locUpBody .muted { font-size: 11.5px; }
  .locHint {
    font-size: 11.5px; margin-top: 8px; color: var(--brand); word-break: break-all;
    min-height: 0;
  }
  .locHint:empty { display: none; }
  .hubSplit {
    font-size: 11.5px; color: var(--ink-3); margin: 14px 0 8px;
    border-top: 1px solid var(--line); padding-top: 10px;
  }
  .locWarn {
    font-size: 11px; color: #b45309; background: #fff7ed;
    border: 1px solid #fed7aa; border-radius: 6px; padding: 0 6px;
  }
  #dirBtn.named { width: auto; max-width: 220px; padding: 0 10px 0 8px; gap: 5px; background: var(--bg-2); }
  .dirBtnLabel {
    font-size: 12px; color: var(--ink-2); max-width: 170px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .spacer { flex: 1; }
  /* 已上传目录的路径：显示在输入框上方、按钮上方一行 */
  .dirPath {
    display: flex; align-items: center; gap: 5px; padding: 0 4px 6px;
    font-size: 12px; color: var(--ink-3); white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; user-select: none;
  }
  .dirPath .ico { width: 14px; height: 14px; flex: none; color: var(--brand); }
  .dirPath .ico svg { width: 14px; height: 14px; }
  .dirPath b { font-weight: 500; color: var(--ink-2); }
  .sendBtn {
    width: 32px; height: 32px; flex: none; display: flex; align-items: center; justify-content: center;
    border: none; background: var(--brand); color: #fff; border-radius: 9px;
    transition: background .15s var(--ease), transform .1s var(--ease);
  }
  .sendBtn:hover { background: var(--brand-hover); }
  .sendBtn:active { transform: scale(.94); }
  .sendBtn svg { width: 16px; height: 16px; }
  /* 停止按钮：仅在 running 时显示，与发送按钮互斥占位 */
  .stopBtn {
    width: 32px; height: 32px; flex: none; display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--line); background: var(--bg-2); color: var(--ink); border-radius: 9px;
    transition: background .15s var(--ease), transform .1s var(--ease), opacity .15s var(--ease);
  }
  .stopBtn:hover { background: var(--bg-3, var(--bg-2)); color: var(--ink); }
  .stopBtn:active { transform: scale(.94); }
  .stopBtn[disabled] { opacity: .55; cursor: default; }
  .stopBtn svg { width: 14px; height: 14px; }
  #hint { padding: 6px 6px 0; font-size: 12px; color: var(--ink-3); min-height: 22px; }

  /* 拖拽层 */
  #dropZone {
    display: none; position: absolute; inset: 12px; z-index: 10;
    border: 2px dashed var(--brand); border-radius: 16px;
    background: rgba(249,250,251,.82); backdrop-filter: blur(2px);
    align-items: center; justify-content: center; flex-direction: column; gap: 6px; pointer-events: none;
  }
  #dropZone svg { width: 40px; height: 40px; color: var(--brand); }
  #dropZone .big { font-size: 17px; font-weight: 600; color: var(--brand); }
  #chat.dropping #dropZone { display: flex; }

  @media (max-width: 860px) {
    #side { width: 210px; }
    #msgs { padding: 18px 16px 8px; }
    .msg.u { max-width: 88%; }
    /* 窄屏优先保证对话区：文件面板默认收起，由头部按钮按需展开 */
    #filesPanel { width: 260px; }
  }

  /* ============ 移动端（手机）适配 ============ */
  /* iOS/Android 地址栏会让 100vh 抖动：优先用 dvh */
  @supports (height: 100dvh) {
    #auth, #app { height: 100dvh; }
  }
  /* 侧栏抽屉的遮罩 + 顶栏汉堡按钮：桌面隐藏，<=768px 才出现 */
  #sideMask {
    display: none; position: fixed; inset: 0; z-index: 55;
    background: rgba(27,27,28,.45); opacity: 0; transition: opacity .2s var(--ease);
  }
  #sideMask.on { display: block; opacity: 1; }
  #menuBtn { display: none; margin-left: 0; }
  /* 会话标题切换器：桌面端侧栏常显，标题纯展示；移动端才可点击唤出抽屉 */
  #curTitleBtn { display: inline-flex; align-items: center; gap: 3px; min-width: 0; }
  #curTitleBtn .chev { display: none; flex: none; color: var(--ink-3); }

  @media (max-width: 768px) {
    /* 侧栏 → 左滑抽屉 */
    #side {
      position: fixed; left: 0; top: 0; bottom: 0; z-index: 60;
      width: min(300px, 84vw);
      transform: translateX(-102%);
      transition: transform .22s var(--ease);
    }
    #side.open { transform: translateX(0); box-shadow: 12px 0 32px rgba(27,27,28,.18); }
    #menuBtn { display: flex; }

    /* 会话标题变成可点击的「会话切换器」（仅移动端，参考 ChatGPT/WorkBuddy 移动端） */
    #curTitleBtn { cursor: pointer; }
    #curTitleBtn:active { opacity: .6; }
    #curTitleBtn .chev { display: block; }

    /* 顶栏 / 消息区收紧 */
    #chatHead { padding: 0 12px; gap: 6px; height: 50px; }
    #chatHead b { font-size: 13.5px; }
    #modelSel { font-size: 16px; max-width: 150px; margin-left: 0; } /* 16px 防 iOS 聚焦缩放 */
    #msgs { padding: 14px 12px 8px; gap: 14px; }
    .msg.u { max-width: 88%; }
    .msg.a { gap: 8px; }
    .msg pre { font-size: 12px; }

    /* 输入区：留出底部安全区（iPhone Home 条） */
    #composerWrap { padding: 8px 10px calc(10px + env(safe-area-inset-bottom, 0px)); }
    #text { font-size: 16px; }          /* <16px 会触发 iOS 聚焦自动放大 */

    /* 登录卡片适配窄屏（17 字院名 15px 可完整放下） */
    #auth { padding: 16px; height: 100dvh; }
    #auth input { font-size: 16px; }
    .authCard { width: min(400px, 100%); padding: 26px 22px 22px; }
    .brandName { font-size: 15px; }
    .brandSub { font-size: 12px; }

    /* 触屏没有 hover：操作按钮常显 */
    .msg.u .u-actions { opacity: 1; }
    .fDl { opacity: 1; }
    .sess .delBtn { opacity: .55; }
    .fremove { opacity: 1; }

    /* 右栏（工作空间/预览）→ 全屏浮层，由头部按钮唤出 */
    #filesPanel { position: fixed; inset: 0; z-index: 58; width: 100%; border-left: none; }
    #filesPanel.wide { width: 100%; }
    #fpGrip { display: none; }          /* 全屏浮层不需要拖宽 */

    /* 文件预览弹层贴边全屏 */
    #pvCard { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; }

    /* 技能市场弹层收紧 */
    #hubPanel { padding: 12px; }
    #hubCard { max-height: 90dvh; }
    .fileCard { width: 200px; }
    .dirCard .fname { max-width: 180px; }
  }
</style>
</head>
<body>

<!-- ================= 登录 / 注册 ================= -->
<div id="auth">
  <div class="authCard">
    <div class="brandRow">
      <svg viewBox="0 0 23.16 17.04" fill="none" aria-hidden="true"><path d="M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.6435 7.51636 12.39 7.51636C12.2955 7.51636 12.2095 7.47486 12.1445 7.44136C12.0395 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.2775 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z" fill="currentColor"/></svg>
      <div class="brandName">恩施州城乡规划设计研究院智能工作台</div>
      <div class="brandSub">多用户智能体工作台</div>
    </div>
    <form onsubmit="return doAuth(event)">
      <input id="username" placeholder="手机号" autocomplete="username" inputmode="numeric" maxlength="20">
      <input id="password" type="password" placeholder="密码" autocomplete="current-password">
      <button class="primary" id="authBtn">登录</button>
      <div id="authMsg"></div>
    </form>
    <div class="authDivider"></div>
    <a class="manualBtn" href="/app/manual" target="_blank" rel="noopener">📖 操作手册</a>
    <div class="authFoot">账号由管理员统一开通 · Built on <b>DeepSeek Harness</b> · 会话数据相互隔离</div>
  </div>
</div>

<!-- ================= 工作台 ================= -->
<div id="app">
  <div id="sideMask" onclick="toggleSide(false)"></div>
  <div id="side">
    <div class="sideBrand">
      <svg viewBox="0 0 23.16 17.04" fill="none" aria-hidden="true"><path d="M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.6435 7.51636 12.39 7.51636C12.2955 7.51636 12.2095 7.47486 12.1445 7.44136C12.0395 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.2775 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z" fill="currentColor"/></svg>
      <div class="brandText">
        <div class="brandOrg">恩施州城乡规划设计研究院</div>
        <b>智能工作台</b>
      </div>
    </div>
    <button id="newBtn" onclick="newSession()">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      新建会话
    </button>
    <div id="sessions"></div>
    <div class="userBar">
      <span class="ava" id="ava">·</span>
      <span id="whoami">-</span>
      <button id="pwBtn" onclick="openPwModal()" title="修改密码">改密</button>
      <button id="logoutBtn" onclick="doLogout()">退出</button>
    </div>
  </div>
  <div id="chat">
    <div id="chatHead">
      <button id="menuBtn" class="headIconBtn" onclick="toggleSide()" title="会话列表" aria-label="打开会话列表">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      <span id="curTitleBtn" onclick="onCurTitleClick()" title="选择或新建会话">
        <b id="curTitle">选择或新建一个会话</b>
        <svg class="chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </span>
      <span class="muted" id="curState"></span>
      <select id="modelSel" title="模型选择：自动 = 按任务难度路由" onchange="onModelChange()" style="display:none"></select>
      <span id="modelNow" style="display:none"></span>
      <button id="filesBtn" class="headIconBtn on" onclick="toggleFiles()" title="收起右栏"></button>
    </div>
    <div id="msgs"><div class="empty">左侧选择会话开始对话<br><span class="muted">支持拖拽文件或整个文件夹到此处；手机端可上传 ZIP（自动解压还原目录）</span></div></div>
    <div id="composerWrap">
      <div id="dirPath" class="dirPath" style="display:none"></div>
      <div id="pending"></div>
      <div id="skillMenu" class="skillMenu" style="display:none"></div>
      <div id="inputBar">
        <textarea id="text" placeholder="给 DSH 发送消息…  Enter 发送，Shift+Enter 换行，可拖拽文件/文件夹" onkeydown="onKeydown(event)"></textarea>
        <div class="barRow">
          <button class="iconBtn pickBtn" title="选择文件">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <input id="fileInput" type="file" multiple class="pickInput" onchange="onPick(this)">
          </button>
          <button id="dirBtn" class="iconBtn pickBtn" title="选择文件夹" onclick="pickDir()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span id="dirBtnLabel" class="dirBtnLabel" style="display:none"></span>
          </button>
          <button id="skillBtn" class="iconBtn pickBtn" title="技能（输入 / 也可唤起）" onclick="toggleSkillMenu()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M18 16.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></svg>
          </button>
          <button id="hubBtn" class="iconBtn pickBtn" title="技能中心（上传本地技能包 / 技能市场）" onclick="openHubPanel()" style="display:none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.2 9.2a1 1 0 0 0 1 .8h7.4a1 1 0 0 0 1-.75L19 7H6"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg>
          </button>
          <div class="spacer"></div>
          <button id="stopBtn" class="stopBtn" title="停止生成（Esc）" onclick="stop()" style="display:none">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/></svg>
          </button>
          <button id="sendBtn" class="sendBtn" title="发送" onclick="send()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </button>
        </div>
      </div>
      <div id="hint"></div>
    </div>
    <div id="dropZone">
      <svg viewBox="0 0 23.16 17.04" fill="none" aria-hidden="true"><path d="M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.6435 7.51636 12.39 7.51636C12.2955 7.51636 12.2095 7.47486 12.1445 7.44136C12.0395 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.2775 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z" fill="currentColor"/></svg>
      <div class="big">松开以上传</div>
      <div class="muted">文件、文件夹、ZIP 均可，将保持相对路径（ZIP 自动解压）</div>
    </div>
    <div id="pv" onclick="pvBackdrop(event)">
      <div id="pvCard" onclick="event.stopPropagation()">
        <div id="pvHead">
          <b id="pvName">-</b>
          <span id="pvBtns">
            <button onclick="pvDownload()" title="下载此文件">下载</button>
            <button onclick="closePv()" title="关闭 (Esc)">关闭</button>
          </span>
        </div>
        <div id="pvBody"></div>
      </div>
    </div>
  </div>
  <div id="filesPanel">
    <div class="fpHead">
      <b>工作空间</b>
      <button id="filesCollapse" onclick="toggleFiles(false)" title="收起右栏"></button>
    </div>
    <div id="files"></div>
    <div id="fpv">
      <div id="fpvHead">
        <button id="fpvBack" onclick="closeFpv()" title="返回文件列表"></button>
        <b id="fpvName">-</b>
        <button id="fpvDl" onclick="pvDownload()" title="下载此文件"></button>
        <button id="fpvMax" onclick="fpvMaximize()" title="放大到弹层"></button>
      </div>
      <div id="fpvBody"></div>
    </div>
    <div id="fpGrip" title="拖动调整宽度"></div>
  </div>
</div>

<div id="hubPanel" onclick="hubBackdrop(event)">
  <div id="hubCard" onclick="event.stopPropagation()">
    <div id="hubHead">
      <b>技能中心</b>
      <input id="hubSearch" placeholder="搜索市场技能…" oninput="hubSearchInput()">
      <button onclick="closeHubPanel()" title="关闭 (Esc)">关闭</button>
    </div>
    <div id="hubBody">
      <!-- 本地上传：装到当前登录用户自己的技能层，只有本人可见 -->
      <div id="locUp" class="locUp">
        <div class="locUpHead">
          <b>我的本地技能</b>
          <span class="muted">上传 .zip 技能包 → 装进你自己的技能层（仅本人可见，无需重启）</span>
        </div>
        <div class="locUpBody">
          <button onclick="pickLocalZip()">上传 .zip 技能包</button>
          <span class="muted">或把 zip 拖到这里 · 顶层需含 SKILL.md</span>
          <input id="locFile" type="file" accept=".zip" style="display:none" onchange="onLocalPick(this)">
        </div>
        <div id="locHint" class="locHint"></div>
      </div>
      <div id="locList"></div>
      <div class="hubSplit">技能市场</div>
      <div id="hubSect"></div>
    </div>
  </div>
</div>

<!-- 修改密码弹层 -->
<div id="pwModal" onclick="pwBackdrop(event)">
  <div id="pwCard" onclick="event.stopPropagation()">
    <h3>修改密码</h3>
    <div class="pwHint">新密码 8-128 位，须同时包含数字、小写字母和大写字母（如 Abc12345）。修改成功后将立即退出登录。</div>
    <input id="pwOld" type="password" placeholder="当前密码" autocomplete="current-password">
    <input id="pwNew" type="password" placeholder="新密码（数字+大小写字母）" autocomplete="new-password">
    <input id="pwNew2" type="password" placeholder="再次输入新密码" autocomplete="new-password">
    <div id="pwErrMsg"></div>
    <div class="pwRow">
      <button class="pwCancel" onclick="closePwModal()">取消</button>
      <button class="pwOk" id="pwOkBtn" onclick="doChangePw()">确认修改</button>
    </div>
  </div>
</div>

<script>
let mode = 'login', cur = null, pending = [];
let pendingGroups = [];    // 目录上传分组：[{ id, label, count }]，整批只显示目录路径
const sessionTitles = {};    // sessionId -> 标题（来自 session/title 事件 / 快照投影）
const sessionRunning = {};   // sessionId -> 是否仍在生成（按会话记录，切走不丢，切回可恢复「停止」按钮）
const sessionTurnStart = {}; // sessionId -> 本轮开始时间戳（按会话记录，支持跨切换累加计时）
const sessionTurnEnd = {};   // sessionId -> 本轮结束时间戳（0/缺省=仍在进行）
// 刚创建、还没发起过任务的会话 id。服务端 blank 投影是异步落库的（刚建完的一两秒内可能
// 还读不到 blank:true），用它兜底，避免「连点新建」在竞态窗口里建出多个空会话。
// 一旦真正发起任务（send）就清空。
let freshBlankId = null;

// ---------- 实时流状态 ----------
let es = null;              // EventSource
let events = [];            // 持久事件（user/message、assistant/message、turn/*）
let timeline = [];          // 统一渲染时间线：{kind:'ev',ev} | {kind:'reason',text,open}
let curReasonSeg = null;    // 正在增长中的思考段（reasoning block 未闭合）
let liveChunks = [];        // 进行中的 assistant 流式分片（正文）
let running = false;
let renderQueued = false;
let editingIdx = null;   // 正在 WorkBuddy 式编辑的消息在 timeline 中的下标
let editingText = '';    // 编辑框原始文本（避免 HTML 转义问题）
let stopping = false;        // 已点过"停止"，等待服务端 turn/end
let stopWatchdog = null;     // 兜底定时器：服务端不回执时提示并复位 UI
let stopRetries = 0;         // 停止后又收到 turn/start（被队列唤醒）时，自动补发停止的次数

// 思考段管理：reasoning block-start 开新段，delta 追加，block-end 关闭。
// 段与持久事件（tool/call 等）在 timeline 里按到达顺序排列，还原官方的穿插叙事。
function openReasonSeg() {
  if (curReasonSeg) return curReasonSeg;
  curReasonSeg = { kind: 'reason', text: '', open: true };
  timeline.push(curReasonSeg);
  return curReasonSeg;
}
function closeReasonSeg() { if (curReasonSeg) { curReasonSeg.open = false; curReasonSeg = null; } }
function handleStreamChunk(c) {
  if (!c || typeof c !== 'object') return;
  if (c.type === 'block-start' && c.blockType === 'reasoning') { closeReasonSeg(); openReasonSeg(); }
  else if (c.type === 'reasoning-delta') { const seg = openReasonSeg(); seg.text += chunkReasoning(c); }
  else if (c.type === 'block-end') closeReasonSeg();
}

// 根据 running 切换「发送 / 停止」按钮（互斥占位，避免输入框抖动）
function syncComposer() {
  const s = $('stopBtn'), b = $('sendBtn');
  if (!s || !b) return;
  s.style.display = running ? 'flex' : 'none';
  b.style.display = running ? 'none' : 'flex';
}

// AI 头像（官方鲸鱼 logo）
const AVA = '<span class="ava"><svg viewBox="0 0 23.16 17.04" fill="none" aria-hidden="true"><path d="M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.6435 7.51636 12.39 7.51636C12.2955 7.51636 12.2095 7.47486 12.1445 7.44136C12.0395 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.2775 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z" fill="currentColor"/></svg></span>';

// 附件图标（对齐官方 ui-attachment DocumentFileIcon）
const FILE_ICON = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>';
const DOC_ICON_SM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>';
const X_ICON = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3L13 13M13 3L3 13"/></svg>';
const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

function extOf(name) {
  if (!name) return '';
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}
function sizeText(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
function isImageName(name) { return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || ''); }

const $ = id => document.getElementById(id);
async function api(path, opts) {
  const r = await fetch(path, Object.assign({ credentials: 'same-origin' }, opts));
  if (!r.ok) {
    let e = ''; let detail = '';
    try { const j = await r.json(); e = j.error || ''; detail = j.detail || ''; } catch {}
    const msg = (e || String(r.status)) + (detail ? ' — ' + detail : '');
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r.json();
}
const jbody = o => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

// ---------- 侧栏文件树（上传附件 + 生成产物） ----------
//
// 数据来源：
// - 上传附件：当前会话持久事件 user/message 里的 file/image 附件块（含 attachmentId），
//   内容经 /app/att 由官方 attachments 服务流式取回（图片 img=1 走 readImage）。
// - 生成产物：会话专属工作目录（服务端 POST /app/sessions 时创建），
//   由 /app/sessions/files 递归列出，/app/sessions/file 流式下载。
// 两类条目统一按 name 里的 "/" 分组为目录树。

// 文件面板：对话区右侧的独立列，默认展开，头部「文件」按钮或面板 × 收起/展开。
let filesOpen = true;
let fpCustomWidth = 0;      // 用户拖过的右栏宽度（px，0=未自定义）

const FOLDER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const DL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>';
const IMG_ICON_SM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

// WorkBuddy 同款「右栏」图标：矩形 + 右半填充
const BACK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>';
const MAX_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H4v5"/><path d="M15 4h5v5"/><path d="M15 20h5v-5"/><path d="M9 20H4v-5"/></svg>';
const PANEL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M15 4v16" stroke-linecap="round"/><rect x="15.8" y="5.8" width="3.4" height="12.4" rx="1" fill="currentColor" stroke="none" opacity=".35"/></svg>';
const CLOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
$('filesBtn').innerHTML = PANEL_ICON;
$('filesCollapse').innerHTML = PANEL_ICON;
$('fpvBack').innerHTML = BACK_ICON;
$('fpvDl').innerHTML = DL_ICON;
$('fpvMax').innerHTML = MAX_ICON;

// 右栏宽度：可拖拽，宽度记到 localStorage
(function initFpWidth() {
  const saved = Number(localStorage.getItem('dshFpWidth') || 0);
  if (saved >= 280) { fpCustomWidth = saved; $('filesPanel').style.width = saved + 'px'; }
})();
function setupFpGrip() {
  const grip = $('fpGrip'), panel = $('filesPanel');
  let dragging = false;
  grip.addEventListener('mousedown', e => {
    dragging = true; grip.classList.add('on');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const w = Math.min(Math.max(window.innerWidth - e.clientX, 280), Math.floor(window.innerWidth * 0.8));
    fpCustomWidth = w;
    panel.style.width = w + 'px';
    panel.classList.remove('wide');   // 自定义宽度优先
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; grip.classList.remove('on');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try { localStorage.setItem('dshFpWidth', String(fpCustomWidth)); } catch (e) {}
  });
}

function toggleFiles(force) {
  filesOpen = typeof force === 'boolean' ? force : !filesOpen;
  if (!filesOpen) closeFpv();     // 收起右栏时顺带退出预览态
  $('filesPanel').classList.toggle('off', !filesOpen);
  const tip = filesOpen ? '收起右栏' : '展开右栏';
  const b = $('filesBtn');
  if (b) { b.classList.toggle('on', filesOpen); b.title = tip; }
  if (filesOpen) refreshFiles();
}

// ---------- 移动端：侧栏抽屉 ----------
// 仅手机端（<=768px）生效：#side 变 fixed 抽屉，点遮罩/选中会话后收回。
// 桌面端加了 class 也无视觉影响（媒体查询外 transform 不生效），但保持无残留更干净。
function toggleSide(force) {
  // 抽屉/遮罩只在移动端启用：桌面端侧栏常显，若不小心触发会让遮罩盖住全屏。
  if (!isMobile()) return;
  const side = $('side'), mask = $('sideMask');
  const open = typeof force === 'boolean' ? force : !side.classList.contains('open');
  side.classList.toggle('open', open);
  mask.classList.toggle('on', open);
  // 用户主动打开过抽屉，就不再需要「首次自动引导」了
  if (open) try { localStorage.setItem('dsh_mobile_side_hinted', '1'); } catch (_) { /* 隐私模式下忽略 */ }
}
// 顶栏会话标题：移动端点击唤出会话抽屉（会话切换器）；桌面端侧栏常显，无需响应。
function onCurTitleClick() { if (isMobile()) toggleSide(true); }
// 空状态渲染：移动端直接给「新建会话 / 查看历史」两个大按钮（入口不再藏进汉堡抽屉）；
// 桌面端保持原有的侧栏引导文案。deleteSession / enter / 视口切换时统一走这里。
function renderEmptyChat() {
  const box = $('msgs');
  if (!box) return;
  if (isMobile()) {
    box.innerHTML =
      '<div class="empty">' +
        '<div class="emptyTitle">还没有打开的会话</div>' +
        '<div class="emptyActions">' +
          '<button class="emptyBtn primary" onclick="newSession()">＋ 新建会话</button>' +
          '<button class="emptyBtn" onclick="toggleSide(true)">查看历史会话</button>' +
        '</div>' +
        '<div class="emptyHint">可上传文件或整个文件夹（ZIP），AI 会基于资料回答</div>' +
      '</div>';
  } else {
    box.innerHTML = '<div class="empty">左侧选择会话开始对话<br><span class="muted">支持拖拽文件或整个文件夹到此处；手机端可上传 ZIP（自动解压还原目录）</span></div>';
  }
}
function closeSideIfOpen() {
  const side = $('side');
  if (side && side.classList.contains('open')) toggleSide(false);
}
const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

// 视口跨过 768px 断档时同步右栏状态：手机端右栏是全屏浮层，必须收起，
// 否则会整屏盖住对话区（桌面登录后开 F12 设备模拟、或真机旋转屏幕都会触发）；
// 回到桌面端时恢复进入前的展开状态。CSS 媒体查询是即时生效的，
// 但 filesOpen 是登录时算好的 JS 状态，不随视口联动——这里补上联动。
let filesOpenBeforeMobile = null;
const mobileMq = window.matchMedia('(max-width: 768px)');
const onMobileMqChange = (e) => {
  if (e.matches) {
    if (filesOpen) { filesOpenBeforeMobile = true; toggleFiles(false); }
  } else if (filesOpenBeforeMobile) {
    filesOpenBeforeMobile = null;
    toggleFiles(true);
  }
  // 跨过断档时重渲染空态（移动端显示按钮版、桌面端显示文字版）
  if (!cur) renderEmptyChat();
};
if (mobileMq.addEventListener) mobileMq.addEventListener('change', onMobileMqChange);
else if (mobileMq.addListener) mobileMq.addListener(onMobileMqChange); // 旧 Safari

// 从当前会话的持久事件里收集全部上传附件（按 attachmentId 去重）。
// 注意：官方会把附件名净化为叶子文件名（目录前缀被剥离），所以上传区通常是
// 扁平列表；同名不同内容的文件用 (2) (3) 后缀区分。
function collectUploads() {
  const seen = new Set();
  const nameCount = {};
  const out = [];
  for (const ev of events) {
    if (!ev || ev.type !== 'user/message') continue;
    const d = ev.data || {};
    if (!d.source || d.source.kind !== 'user') continue;
    const content = Array.isArray(d.content) ? d.content : [];
    for (const p of content) {
      if (!p || typeof p !== 'object') continue;
      const a = p.attachment;
      if (!a || !a.attachmentId) continue;
      if (p.type === 'file' || p.type === 'image') {
        const key = a.attachmentId + '/' + (a.name || '');
        if (seen.has(key)) continue;
        seen.add(key);
        let name = a.name || (p.type === 'image' ? '图片' : '附件');
        if (p.type === 'image' && !a.name) name = '图片 ' + (out.length + 1);
        if (nameCount[name] != null) { nameCount[name]++; name = name + ' (' + nameCount[name] + ')'; }
        else nameCount[name] = 0;
        out.push({
          img: p.type === 'image',
          aid: a.attachmentId, name: name, bytes: a.bytes, mt: a.mediaType,
        });
      }
    }
  }
  return out;
}

function attUrl(u) {
  let s = '/app/att?id=' + encodeURIComponent(cur) + '&aid=' + encodeURIComponent(u.aid) +
    '&name=' + encodeURIComponent(u.name);
  if (u.img) s += '&img=1' + (u.mt ? '&mt=' + encodeURIComponent(u.mt) : '');
  if (u.bytes) s += '&b=' + u.bytes;
  return s;
}
function genUrl(path) {
  return '/app/sessions/file?id=' + encodeURIComponent(cur) + '&path=' + encodeURIComponent(path);
}

// Office 文档（浏览器无法内嵌渲染）走服务端 LibreOffice 转 PDF 后预览。
// convertCapable: null=未知 / true=可用 / false=服务端没装 LibreOffice（降级为下载）
let convertCapable = null;
function isOfficeName(name) { return /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(name || ''); }
async function loadCapability() {
  try {
    const r = await api('/app/preview/status');
    convertCapable = !!r.convert;
  } catch (e) { convertCapable = null; }
}

async function refreshFiles() {
  const box = $('files');
  if (!cur) {
    box.innerHTML = '<div class="fEmpty">选择或新建一个会话后<br>这里会展示它的上传附件与生成产物</div>';
    return;
  }
  const legacy = collectUploads();
  let structured = [];
  let items = [];
  try {
    const r = await api('/app/sessions/uploads?id=' + encodeURIComponent(cur));
    structured = r.items || [];
  } catch (e) { /* 老会话/登记缺失：退回事件里的扁平附件名 */ }
  try {
    const r = await api('/app/sessions/files?id=' + encodeURIComponent(cur));
    items = r.items || [];
  } catch (e) { /* 老会话/异常：生成产物留空，上传附件照常展示 */ }
  // 切换会话期间可能又发起了一次刷新，过期响应丢弃
  renderFiles(structured, legacy, items);
}

// 把 [{name,url,size}] 按 "/" 分组为嵌套目录树
function buildTreeNodes(entries) {
  const root = { dirs: [], files: [] };
  for (const e of entries) {
    const segs = String(e.name).split('/');
    let node = root;
    for (let i = 0; i < segs.length - 1; i++) {
      let d = null;
      for (const x of node.dirs) if (x.name === segs[i]) { d = x; break; }
      if (!d) { d = { name: segs[i], dirs: [], files: [] }; node.dirs.push(d); }
      node = d;
    }
    node.files.push({ name: segs[segs.length - 1], url: e.url, size: e.size, full: e.name });
  }
  const sortNode = n => {
    n.dirs.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    n.files.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    n.dirs.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

function treeNodeHTML(node, depth) {
  const d = depth || 0;
  const open = d === 0 ? 'block' : 'none';   // 顶层目录默认展开，深层折叠
  let html = '';
  for (const dir of node.dirs) {
    html += '<div class="fRow" data-fold="1"><span class="fIco">' + FOLDER_ICON + '</span>' +
      '<span class="fNm">' + esc(dir.name) + '</span><span class="fSz">' + countFiles(dir) + '</span></div>' +
      '<div class="fKids" style="display:' + open + '">' + treeNodeHTML(dir, d + 1) + '</div>';
  }
  for (const f of node.files) html += fileRowHTML(f);
  return html;
}

function countFiles(node) {
  let n = node.files.length;
  for (const d of node.dirs) n += countFiles(d);
  return n;
}

function fileRowHTML(f) {
  return '<div class="fRow" data-url="' + esc(f.url) + '" data-name="' + esc(f.name) + '">' +
    '<span class="fIco">' + (isImageName(f.name) ? IMG_ICON_SM : DOC_ICON_SM) + '</span>' +
    '<span class="fNm" title="' + esc(f.full || f.name) + '">' + esc(f.name) + '</span>' +
    '<span class="fSz">' + (f.size != null ? sizeText(f.size) : '') + '</span>' +
    '<button class="fDl" title="下载">' + DL_ICON + '</button></div>';
}

// 右栏「工作空间」：上为上传附件（按上传时的目录结构还原），下为生成产物。
// uploads  = 服务端登记的 [{path, aid, bytes}]（新会话，保留目录前缀）
// legacy   = 事件里解析出的扁平附件（老会话或登记缺失时的退化数据）
function renderFiles(uploads, legacy, items) {
  const src = uploads.length > 0
    ? uploads.map(u => ({
        name: u.path,
        url: attUrl({ aid: u.aid, name: u.path, bytes: u.bytes, img: isImageName(u.path) }),
        size: u.bytes,
      }))
    : legacy.map(u => ({ name: u.name, url: attUrl(u), size: u.bytes }));
  // 传的是目录结构就按树显示；全是散文件就平铺一行一个
  const nested = src.some(s => String(s.name).indexOf('/') >= 0);

  let html = '<div class="fSec ws">工作空间</div>';
  html += '<div class="fSub">上传附件<span class="cnt">' + src.length + '</span></div>';
  if (src.length === 0) html += '<div class="fEmpty">本会话还没有上传过附件</div>';
  else if (nested) html += treeNodeHTML(buildTreeNodes(src), 0);
  else html += src.map(f => fileRowHTML({ name: f.name, url: f.url, size: f.size, full: f.name })).join('');
  html += '<div class="fSub">生成产物<span class="cnt">' + items.length + '</span></div>';
  if (items.length === 0) html += '<div class="fEmpty">还没有生成文件。<br>新会话拥有独立工作目录，模型写出的文件会出现在这里。</div>';
  else html += treeNodeHTML(buildTreeNodes(items.map(it => ({ name: it.path, url: genUrl(it.path), size: it.size }))), 0);
  $('files').innerHTML = html;
}

// 文件树交互（事件委托：下载按钮 > 文件夹折叠 > 行点击预览）
function setupFilesBox() {
  $('files').addEventListener('click', e => {
    const dl = e.target.closest('.fDl');
    if (dl) {
      e.stopPropagation();
      const row = dl.closest('[data-url]');
      if (row) dlFile(row.dataset.url, row.dataset.name);
      return;
    }
    const fold = e.target.closest('[data-fold]');
    if (fold) {
      const kids = fold.nextElementSibling;
      if (kids) kids.style.display = kids.style.display === 'none' ? 'block' : 'none';
      return;
    }
    const row = e.target.closest('.fRow[data-url]');
    if (row && row.dataset.url) pvOpen(row.dataset.url, row.dataset.name);
  });
}

// 目录卡点击展开/收起这一批的目录结构（移除按钮不触发）
function setupPendingBox() {
  $('pending').addEventListener('click', e => {
    if (e.target.closest('.fremove')) return;
    const card = e.target.closest('.dirCard[data-gid]');
    if (!card) return;
    const gid = card.dataset.gid;
    const kids = document.querySelector('.dirKids[data-gid="' + gid + '"]');
    if (kids) kids.style.display = kids.style.display === 'none' ? 'block' : 'none';
  });
}

// 消息气泡里的附件卡/图片缩略图也可点击预览（.pvChip）
function setupMsgChips() {
  $('msgs').addEventListener('click', e => {
    const chip = e.target.closest('.pvChip');
    if (chip && chip.dataset.url) pvOpen(chip.dataset.url, chip.dataset.name);
    const uact = e.target.closest('.uact');
    if (uact) {
      const root = uact.closest('.msg.u');
      const idx = root && root.dataset.uidx;
      const item = idx && timeline[+idx];
      const ev = item && item.ev;
      const text = ev && ev.data && extractText(ev.data.content);
      if (uact.hasAttribute('data-copy')) {
        if (text) copyToClipboard(text);
        return;
      }
      if (uact.hasAttribute('data-edit')) {
        if (text) startEdit(+idx, text);
        return;
      }
      return;
    }
    const cancel = e.target.closest('[data-edit-cancel]');
    if (cancel) { cancelEdit(); return; }
    const send = e.target.closest('[data-edit-send]');
    if (send) { submitEdit(); return; }
  });
}

// 复制用户消息全文到剪贴板
async function copyToClipboard(text) {
  function show() {
    const el = $('hint');
    if (el) { el.textContent = '已复制'; setTimeout(() => { if (el.textContent === '已复制') el.textContent = ''; }, 1500); }
  }
  try {
    await navigator.clipboard.writeText(text);
    show();
  } catch (e) {
    // 降级：execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    show();
    document.body.removeChild(ta);
  }
}

// 开始内联编辑：记录当前编辑的下标和原文，渲染编辑框
function startEdit(idx, text) {
  editingIdx = idx;
  editingText = text;
  render();
  const el = $('editText');
  if (el) {
    el.value = text;
    el.focus();
    // 光标移到末尾
    el.setSelectionRange(text.length, text.length);
    // 自动增高
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
}
function cancelEdit() {
  editingIdx = null;
  editingText = '';
  render();
}
function submitEdit() {
  const el = $('editText');
  if (!el) return;
  const text = el.value.trim();
  if (!text) { cancelEdit(); return; }
  cancelEdit();
  const composer = $('text');
  if (composer) {
    composer.value = text;
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.focus();
  }
  send();
}

// ---------- 预览 / 下载 ----------
//
// 可内联预览：图片（<img>）、PDF（<iframe>）、纯文本类（fetch 后 <pre>）。
// docx/xlsx 等浏览器无法原生预览的类型点击即下载。

function isTextName(name) {
  return /\.(txt|md|json|csv|log|xml|yml|yaml|js|ts|css|py|sh|html?)$/i.test(name || '');
}
function isPreviewable(name) {
  return isImageName(name) || /\.pdf$/i.test(name || '') || isTextName(name);
}

// ---------- 预览：默认内嵌在右栏（WorkBuddy 同款），可一键放大到弹层 ----------
//
// 两个渲染面共用同一套渲染逻辑（renderPreview），只是容器不同：
//   #fpvBody —— 右栏内嵌，点击文件树/消息附件卡的默认落点
//   #pvBody  —— 「放大」后的弹层（同一时刻只有一个面活着，避免 blob 争用）

function pvOpen(url, name) {
  if (!url) return;
  openFpv(url, name);
}

/** 右栏内嵌预览：面板自动展开并变宽，文件树让位给预览。 */
function openFpv(url, name) {
  pvUrl = url; pvName = name;
  if (!filesOpen) toggleFiles(true);
  if (!fpCustomWidth) $('filesPanel').classList.add('wide');
  $('files').classList.add('off');
  $('fpv').classList.add('on');
  $('fpvName').textContent = name;
  $('fpvName').title = name;
  renderPreview($('fpvBody'), url, name);
}

/** 关闭内嵌预览，右栏回到文件树。 */
function closeFpv() {
  pvUrl = '';
  if (pvObjUrl) { URL.revokeObjectURL(pvObjUrl); pvObjUrl = ''; }
  $('fpv').classList.remove('on');
  $('fpvBody').innerHTML = '';
  $('files').classList.remove('off');
  if (!fpCustomWidth) $('filesPanel').classList.remove('wide');
}

/** 把当前预览放大到弹层（PDF / 大图看得更清楚）；面板同时回到文件树。 */
function fpvMaximize() {
  if (!pvUrl) return;
  const url = pvUrl, name = pvName;
  closeFpv();
  pvUrl = url; pvName = name;
  $('pvName').textContent = name;
  $('pvName').title = name;
  $('pv').classList.add('on');
  renderPreview($('pvBody'), url, name);
}

/** 按类型把内容渲染进任意容器：图片 / PDF / 文本 / Office（服务端转 PDF）。 */
function renderPreview(body, url, name) {
  if (!isPreviewable(name)) {
    if (isOfficeName(name)) { pvLoadOffice(body, url, name); return; }
    dlFile(url, name);
    return;
  }
  if (isImageName(name)) {
    body.innerHTML = '<img src="' + esc(url) + '" alt="">';
  } else if (/\.pdf$/i.test(name)) {
    body.innerHTML = '<iframe src="' + esc(url) + '"></iframe>';
  } else {
    body.innerHTML = '<pre>加载中…</pre>';
    fetch(url, { credentials: 'same-origin' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text() })
      .then(t => { if (pvUrl === url) body.innerHTML = '<pre>' + esc(t) + '</pre>'; })
      .catch(e => { if (pvUrl === url) body.innerHTML = '<pre>无法加载：' + esc(String(e.message || e)) + '</pre>'; });
  }
}

// Office 文档：请求服务端转成 PDF（as=pdf），用 blob 喂给 <iframe> 预览。
// 转换不可用/失败时给出明确原因，并提供「直接下载原文件」，绝不静默失败。
let pvObjUrl = '';
async function pvLoadOffice(body, url, name) {
  if (convertCapable === false) {
    body.innerHTML = pvMsgHTML(
      '当前服务端未安装 LibreOffice，无法在线预览 Word / Excel / PPT。',
      'Linux: apt install -y libreoffice；macOS: brew install --cask libreoffice；' +
      'Windows: 安装 LibreOffice 即可（默认装在 Program Files 会被自动发现，无需加 PATH）。' +
      '装好后无需重启服务，稍等片刻重试即可。',
    );
    return;
  }
  body.innerHTML = '<pre>正在转换为 PDF…（首次转换需要几秒）</pre>';
  let httpStatus = 0;
  try {
    const r = await fetch(url + '&as=pdf', { credentials: 'same-origin' });
    httpStatus = r.status;
    if (!r.ok) {
      let detail = '';
      try { const j = await r.json(); detail = j.detail || j.error || ''; } catch (e) {}
      if (r.status === 501) convertCapable = false;
      throw new Error(detail || ('HTTP ' + r.status));
    }
    const blob = await r.blob();
    if (pvUrl !== url) return;    // 期间用户又点了别的文件
    if (pvObjUrl) URL.revokeObjectURL(pvObjUrl);
    pvObjUrl = URL.createObjectURL(blob);
    body.innerHTML = '<iframe src="' + esc(pvObjUrl) + '"></iframe>';
  } catch (e) {
    if (pvUrl !== url) return;
    body.innerHTML = pvMsgHTML(
      httpStatus === 501 ? '无法在线预览：服务端未安装 LibreOffice。' : '转换失败，无法预览该文档。',
      String((e && e.message) || e),
    );
  }
}
function pvMsgHTML(title, detail) {
  return '<div id="pvMsgBox"><b>' + esc(title) + '</b>' +
    (detail ? '<p>' + esc(detail) + '</p>' : '') +
    '<button onclick="pvDownload()">直接下载原文件</button></div>';
}
function closePv() {
  pvUrl = '';
  if (pvObjUrl) { URL.revokeObjectURL(pvObjUrl); pvObjUrl = ''; }
  $('pv').classList.remove('on');
  $('pvBody').innerHTML = '';
}
function pvBackdrop(e) { if (e.target === $('pv')) closePv(); }
function pvDownload() { if (pvUrl) dlFile(pvUrl, pvName); }
function dlFile(url, name) {
  const a = document.createElement('a');
  a.href = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'dl=1';
  a.download = name || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
}


// 员工白名单模式：注册已由服务端关闭（allowRegistration 默认 false），
// mode 恒为 'login'（声明见顶部变量区）；switchTab 仅保留为空实现，避免旧缓存页报错。
function switchTab(m) { mode = 'login'; }
async function doAuth(ev) {
  ev.preventDefault();
  $('authMsg').textContent = '';
  // 先剥离一切非数字字符：从聊天软件复制粘贴常带零宽空格(U+200B)等不可见字符，
  // trim() 去不掉会导致"看着是 11 位却校验失败"；顺带也容忍用户输空格/横线。
  // ⚠️ 本文件是模板字符串 UI_HTML：JS 正则的反斜杠会被模板转义吞掉，
  //    源码必须双写 \\D / \\d，浏览器里才会得到 /\D/ 、/\d/。
  const account = $('username').value.replace(/\\D/g, '');
  if (account !== $('username').value.trim()) $('username').value = account;
  if (!/^1[3-9]\\d{9}$/.test(account)) {
    $('authMsg').textContent = '请输入 11 位手机号'; return false;
  }
  try {
    await api('/app/auth/login',
      jbody({ username: account, password: $('password').value }));
    await enter();
  } catch (e) {
    $('authMsg').textContent = e.status === 401 ? '手机号或密码错误' :
      e.status === 400 ? '账号必须是 11 位手机号' : ('失败: ' + e.message);
  }
  return false;
}
async function doLogout() {
  await api('/app/auth/logout', jbody({}));
  location.reload();
}
// ---------- 修改密码弹层 ----------
function openPwModal() {
  $('pwOld').value = ''; $('pwNew').value = ''; $('pwNew2').value = '';
  $('pwErrMsg').textContent = '';
  $('pwModal').classList.add('on');
  setTimeout(() => $('pwOld').focus(), 50);
}
function closePwModal() { $('pwModal').classList.remove('on'); }
function pwBackdrop(ev) { if (ev.target === $('pwModal')) closePwModal(); }
async function doChangePw() {
  const oldPw = $('pwOld').value, newPw = $('pwNew').value, newPw2 = $('pwNew2').value;
  const err = $('pwErrMsg');
  err.textContent = '';
  if (!oldPw || !newPw) { err.textContent = '请填写当前密码和新密码'; return; }
  if (newPw.length < 8 || newPw.length > 128) { err.textContent = '新密码长度需为 8-128 位'; return; }
  if (!(/\\d/.test(newPw) && /[a-z]/.test(newPw) && /[A-Z]/.test(newPw))) { // ⚠️ 模板字符串：\\d 双写，见 doAuth 处注释
    err.textContent = '新密码必须同时包含数字、小写字母和大写字母'; return;
  }
  if (newPw !== newPw2) { err.textContent = '两次输入的新密码不一致'; return; }
  if (newPw === oldPw) { err.textContent = '新密码不能与当前密码相同'; return; }
  const btn = $('pwOkBtn');
  btn.disabled = true; btn.textContent = '提交中…';
  try {
    await api('/app/auth/password', jbody({ currentPassword: oldPw, newPassword: newPw }));
    closePwModal();
    // 改密成功立即下线：清掉本设备的登录 cookie，刷新回登录页。
    // cookie 是无状态签名、服务端无法吊销，所以必须由前端主动登出。
    btn.textContent = '已修改，正在退出…';
    try { await api('/app/auth/logout', jbody({})); } catch (_) { /* 登出失败也照样刷新 */ }
    location.reload();
  } catch (e) {
    err.textContent = e.status === 401 ? '当前密码错误' :
      e.status === 400 ? (e.message || '新密码不符合要求') : ('修改失败: ' + (e.message || e));
    btn.disabled = false; btn.textContent = '确认修改';
  }
}
async function enter() {
  const me = await api('/app/auth/me');
  // 员工白名单模式：优先显示姓名（display_name），老账号回退 username
  const shown = me.displayName || me.username || '?';
  $('whoami').textContent = shown;
  $('whoami').title = me.username || '';
  $('ava').textContent = shown.slice(0, 1);
  $('auth').style.display = 'none';
  $('app').style.display = 'flex';
  // 手机端右栏是全屏浮层，登录后默认收起，避免盖住对话区（桌面端保持展开）。
  // 与 mobileMq 监听共用 filesOpenBeforeMobile：回到桌面端时能恢复展开。
  if (isMobile() && filesOpen) { filesOpenBeforeMobile = true; toggleFiles(false); }
  await refreshSessions();
  loadCapability();    // 不阻塞首屏：Office 预览能力探测
  refreshHubButton();  // 登录后才知道服务端有没有配市场（初始化时尚未登录，必然 401）
  loadModelOptions();  // 顶栏模型选择器（自动路由 + 手动指定）
  // 空态按端渲染（移动端给出「新建/查看历史」大按钮）
  if (!cur) renderEmptyChat();
  // 移动端首次进入且还没有会话：自动拉开会话抽屉引导一次，让用户看到会话入口
  // （localStorage 记过一次后不再打扰；用户主动点开抽屉也会记）
  if (isMobile() && !cur) {
    let hinted = false;
    try { hinted = localStorage.getItem('dsh_mobile_side_hinted') === '1'; } catch (_) { /* 忽略 */ }
    if (!hinted) setTimeout(() => toggleSide(true), 450);
  }
}

// ---------- 顶栏模型选择器 ----------
// 服务端按任务难度自动路由（modelRouting 规则）；用户也可手动锁定某个模型
// （POST /app/model 后该会话跳过自动路由，选回「自动」恢复）。
let modelOptions = null;   // /app/models 的缓存：{ default, groups, autoRouting }
function loadModelOptions() {
  api('/app/models').then((cat) => {
    modelOptions = cat;
    const sel = $('modelSel');
    sel.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = 'auto';
    auto.textContent = cat.autoRouting === false ? '模型：默认' : '模型：自动（按难度）';
    sel.appendChild(auto);
    for (const g of cat.groups || []) {
      const og = document.createElement('optgroup');
      og.label = g.name || g.id;
      for (const m of g.models || []) {
        const o = document.createElement('option');
        o.value = g.id + '/' + m.id;
        o.textContent = m.name || m.id;
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
    sel.style.display = '';
    sel.value = 'auto';
  }).catch(() => { /* 目录拉取失败：不显示选择器，功能不受影响 */ });
}

/** 切换会话时同步选择器状态（该会话是否手动锁定了模型）。 */
function syncModelSel() {
  const sel = $('modelSel');
  if (!cur || !sel) return;
  sel.value = 'auto';
  api('/app/model?id=' + encodeURIComponent(cur)).then((st) => {
    if (!cur || !sel) return;
    if (st && st.mode === 'manual' && st.provider && st.model) {
      sel.value = st.provider + '/' + st.model;
      showModelNow(st.model, '手动指定');
    } else {
      showModelNow('', '');
    }
  }).catch(() => {});
}

/** 顶栏右侧的「当前模型」指示（自动路由每轮更新，手动选择后固定显示）。 */
function showModelNow(model, rule) {
  const el = $('modelNow');
  if (!el) return;
  if (!model) { el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = '';
  el.textContent = model + (rule ? ' · ' + rule : '');
  el.title = rule || model;
}

/** 选择器 onchange：auto = 恢复自动路由；具体模型 = 本会话锁定它。 */
async function onModelChange() {
  if (!cur) { flashHint('请先选择或新建会话'); if ($('modelSel')) $('modelSel').value = 'auto'; return; }
  const sel = $('modelSel');
  try {
    if (sel.value === 'auto') {
      await api('/app/model', jbody({ sessionId: cur, auto: true }));
      showModelNow('', '');
      flashHint('已恢复按任务难度自动选模型');
    } else {
      const [provider, model] = sel.value.split('/');
      await api('/app/model', jbody({ sessionId: cur, provider, model }));
      showModelNow(model, '手动指定');
      flashHint('本会话已锁定 ' + model);
    }
  } catch (e) {
    flashHint('切换模型失败: ' + e.message);
    syncModelSel();
  }
}
async function refreshSessions() {
  const { items } = await api('/app/sessions');
  const box = $('sessions');
  box.innerHTML = '';
  for (const s of items) {
    // 标题优先级：本页 SSE 缓存 > 服务端持久投影（projections.values.title）> UUID 片段。
    // 之前只靠 SSE 缓存，重登后全部退化成 UUID —— 投影才是落库的权威标题。
    const projTitle = s.projections && s.projections.values && s.projections.values.title;
    if (projTitle && !sessionTitles[s.sessionId]) sessionTitles[s.sessionId] = projTitle;
    const name = sessionTitles[s.sessionId] || projTitle || s.sessionId.slice(8, 20);
    const d = document.createElement('div');
    d.className = 'sess' + (cur === s.sessionId ? ' on' : '');
    const title = document.createElement('span');
    title.className = 'sessTitle';
    title.textContent = name;
    title.title = s.sessionId + (s.cwd ? ' · ' + s.cwd : '');
    d.appendChild(title);
    const del = document.createElement('button');
    del.className = 'delBtn';
    del.textContent = '×';
    del.title = '删除此会话';
    del.onclick = (e) => { e.stopPropagation(); deleteSession(s.sessionId, s.cwd || ''); };
    d.appendChild(del);
    d.onclick = () => openSession(s.sessionId);
    box.appendChild(d);
  }
}
async function deleteSession(id, cwd) {
  try {
    const qs = 'id=' + encodeURIComponent(id) + (cwd ? '&cwd=' + encodeURIComponent(cwd) : '');
    await api('/app/sessions?' + qs, { method: 'DELETE' });
    if (cur === id) {
      cur = null;
      if (es) { es.close(); es = null; }
      events = []; liveChunks = []; timeline = []; curReasonSeg = null;
      $('msgs').innerHTML = ''; renderEmptyChat();
      $('curTitle').textContent = '选择或新建一个会话';
      $('curState').textContent = '';
      if (filesOpen) refreshFiles();
    }
    delete sessionTitles[id];
    delete sessionRunning[id];
    delete sessionTurnStart[id];
    delete sessionTurnEnd[id];
    await refreshSessions();
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
}
async function newSession() {
  closeSideIfOpen();     // 手机端：抽屉里点新建后收回
  // 参考 WorkBuddy：如果已经存在一个「还没跑过任务」的空会话，就切过去复用，不再新建。
  // 服务端会话列表项自带 blank 标记：只有在出现过 turn/start（真正发起过任务）后才为 false，
  // 所以「建了但没提问」的会话会一直保持 blank:true，正好用来去重。
  try {
    const list = await api('/app/sessions');
    const blank = (list.items || []).find(
      (s) => s && (s.blank || s.sessionId === freshBlankId),
    );
    if (blank) {
      if (cur !== blank.sessionId) openSession(blank.sessionId);
      else await refreshSessions();
      flashHint('已有一个未开始的会话，先在这里继续');
      return;
    }
  } catch {
    // 列表拉取失败不阻断新建，退回原行为
  }
  try {
    const created = await api('/app/sessions', jbody({}));
    // 兼容 0.1.7+：返回字段可能改名 id（本地 0.1.3 是 sessionId）
    const id = created.sessionId ?? created.id;
    if (!id) throw new Error('服务端未返回会话 ID：' + JSON.stringify(created));
    freshBlankId = id;
    await refreshSessions();
    openSession(id);
  } catch (e) {
    console.error('[newSession] 创建会话失败：', e);
    flashHint('新建会话失败：' + (e && e.message ? e.message : e));
  }
}

// ---------- 会话流（SSE） ----------

function openSession(id) {
  cur = id;
  closeSideIfOpen();     // 手机端：抽屉里选完会话立即收回
  syncModelSel();        // 顶栏选择器同步该会话的模型状态
  pending = [];
  pendingGroups = [];
  setLastDir('');        // 换会话后按钮上的目录路径复位
  renderPending();
  $('curTitle').textContent = sessionTitles[id] || ('会话 ' + id.slice(8, 20));
  $('curTitle').title = id;
  refreshSessions().then(() => {
    // 列表拉回后可能带回了持久投影标题，补刷顶栏（仅当还在这个会话）
    if (cur === id) $('curTitle').textContent = sessionTitles[id] || ('会话 ' + id.slice(8, 20));
  });
  if (es) { es.close(); es = null; }
  events = []; liveChunks = []; timeline = []; curReasonSeg = null; running = false;
  stopping = false; clearTimeout(stopWatchdog); stopWatchdog = null;
  // 计时跨会话累加：用按会话记录的起点/终点恢复本轮计时，而不是全局清零。
  // 任务在后台一直跑，wall-clock Elapsed = now - 起点 就是总用时，切走切回应连续。
  if (turnTicker) { clearInterval(turnTicker); turnTicker = null; }
  turnStart = sessionTurnStart[id] || 0;
  turnEnd = sessionTurnEnd[id] || 0;
  turnWaiting = false;
  if (sessionRunning[id]) {
    running = true;
    if (!turnStart) { turnStart = Date.now(); sessionTurnStart[id] = turnStart; }  // 起点未知时从本页加载起算
    startTurnTimer();   // 已有 turnStart 不覆盖；仅挂秒级刷新 + 渲染
  }
  scheduleRender(); syncComposer(); renderTurnState();
  loadSkills();                     // 换会话：重新拉取该会话可用的技能
  es = new EventSource('/app/sessions/follow?id=' + encodeURIComponent(id));
  es.onmessage = ev => { handleFrame(JSON.parse(ev.data)); };
  es.onerror = () => { if (cur === id) $('curState').textContent = '· 连接中断，重连中…'; };
}

function handleFrame(frame) {
  if (frame.type === 'snapshot') {
    events = (frame.records || []).map(r => r.event).filter(Boolean);
    liveChunks = []; timeline = []; curReasonSeg = null;
    // 重建时间线：持久事件按序入列，再回放 attempt.stream 的思考/正文分片
    for (const ev of events) timeline.push({ kind: 'ev', ev });
    const attempt = frame.assistantStream && frame.assistantStream.activeAttempt;
    if (attempt) {
      liveChunks = [...(attempt.stream || [])];
      for (const c of liveChunks) handleStreamChunk(c);
    }
    const pt = frame.projections && frame.projections.values && frame.projections.values.title;
    if (pt && cur) { sessionTitles[cur] = pt; $('curTitle').textContent = pt; refreshSessions(); }
    // 有 activeAttempt 说明本轮仍在生成（刷新页面后也要能停止）
    running = !!attempt;
    sessionRunning[cur] = !!attempt;   // 重连时以 harness 快照为准纠正本端记录（覆盖切走期间可能已结束的会话）
    // 刷新页面后本轮可能已在跑：起点未知，从本页加载时刻起算
    if (running && !turnStart) startTurnTimer();
    if (running) sessionTurnStart[cur] = turnStart || Date.now();   // 按会话保留起点，切回累加
    if (!running && turnStart && !turnEnd) { stopTurnTimer(); sessionTurnEnd[cur] = turnEnd; }
    scheduleRender();
    if (filesOpen) refreshFiles();
  } else if (frame.type === 'event') {
    const ev = frame.event;
    events.push(ev);
    timeline.push({ kind: 'ev', ev });
    if (ev.type === 'turn/start') {
      running = true;
      sessionRunning[cur] = true;
      startTurnTimer();          // 本轮计时开始（若 send 时已计，沿用同一个起点）
      sessionTurnStart[cur] = turnStart;   // 按会话保留起点（send 已计则沿用，否则取 turn/start 时刻）
      if (stopping && stopRetries < 3) {
        // 点了停止却又开了新的一轮：说明队列里还有活（官方 cancel 保留 inbox），再补一刀
        stopRetries++;
        $('curState').textContent = '· 仍在停止中（第 ' + stopRetries + ' 次请求）…';
        cancelOnce().catch(() => {});
        clearTimeout(stopWatchdog);
        stopWatchdog = setTimeout(() => resetStop('· 停止已请求，但未收到结束回执（当前步骤可能仍在收尾）'), 20000);
      } else {
        stopping = false; stopRetries = 0; clearTimeout(stopWatchdog); stopWatchdog = null;
      }
      refreshSessions();
    }
    if (ev.type === 'turn/end') {
      stopTurnTimer();
      sessionRunning[cur] = false;
      sessionTurnEnd[cur] = turnEnd;   // 按会话保留终点（起点已在 turn/start 记录）
      resetStop();               // 内部把备注（如「已停止」）记进 lastTurnNote
      if (turnStart) timeline.push({ kind: 'turn', start: turnStart, end: turnEnd || Date.now(), note: lastTurnNote });
      lastTurnNote = '';
      refreshSessions(); if (filesOpen) refreshFiles();
    }
    // 用户消息落地（含附件）后同步文件树
    if (ev.type === 'user/message' && filesOpen) refreshFiles();
    if (ev.type === 'session/title' && cur && ev.data && ev.data.title) {
      sessionTitles[cur] = ev.data.title;
      $('curTitle').textContent = ev.data.title;
      refreshSessions();
    }
    if (ev.type === 'assistant/message') liveChunks = [];   // 持久版本到达，清掉流式正文缓冲（思考段保留在时间线里）
    scheduleRender();
  } else if (frame.type === 'assistant-stream') {
    const f = frame.frame || {};
    if (f.type === 'start') {
      liveChunks = [...(f.stream || [])];
      // 重连/换端时 start 带全量回放：重建思考段，避免时间线里堆积重复段
      timeline = timeline.filter(it => it.kind !== 'reason');
      curReasonSeg = null;
      for (const c of liveChunks) handleStreamChunk(c);
    } else if (f.type === 'chunk') {
      liveChunks.push(f.chunk);
      handleStreamChunk(f.chunk);
    }
    // 'end' 不清缓冲：等持久 assistant/message 事件到达再清
    scheduleRender();
  } else if (frame.type === 'stream-error') {
    // 停止时 follow 流会被 abort，这类"错误"是预期内的，不要吓用户
    if (isAbortMsg(frame.message)) {
      if (stopping) resetStop('· 已停止');
    } else {
      $('curState').textContent = '· 流错误: ' + (frame.message || '').slice(0, 60);
    }
  }
  syncComposer();
  if (es && es.readyState === 1) renderTurnState();
}

function chunkText(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(chunkText).join('');
  if (!c || typeof c !== 'object') return '';
  if (c.type === 'text-delta' && typeof c.text === 'string') return c.text;
  if (c.type === 'chunk') return chunkText(c.chunk);                 // {chunk:{type:'text-delta',...}}
  if (c.type === 'text-chunks' && Array.isArray(c.texts)) return c.texts.join(''); // 压缩记录
  return '';
}
function chunkReasoning(c) {
  if (Array.isArray(c)) return c.map(chunkReasoning).join('');
  if (!c || typeof c !== 'object') return '';
  if (c.type === 'reasoning-delta' && typeof c.text === 'string') return c.text;
  if (c.type === 'chunk') return chunkReasoning(c.chunk);
  return '';
}
function extractText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(p => p && p.type === 'text' ? p.text : '').join('').trim();
}
function fileChips(content) {
  if (!Array.isArray(content)) return '';
  const parts = content.map(p => {
    if (!p) return '';
    if (p.type === 'image') {
      const a = p.attachment;
      // 持久化消息：{type:'image', attachment:{attachmentId, mediaType, bytes, width, height, name?}}
      // 经 /app/att&img=1 由官方 attachments.readImage 取回，可内联缩略图 + 点击预览
      if (a && a.attachmentId) {
        const u = { img: true, aid: a.attachmentId, name: a.name || '图片', bytes: a.bytes, mt: a.mediaType };
        const url = attUrl(u);
        return '<span class="imgThumb pvChip" data-url="' + esc(url) + '" data-name="' + esc(u.name) + '" title="点击预览">' +
          '<img src="' + esc(url) + '" alt="" loading="lazy"></span>';
      }
      const url = p.url || (p.attachment && p.attachment.url) || p.image || p.src || null;
      if (url) return '<span class="imgThumb"><img src="' + esc(url) + '" alt=""></span>';
      return fileCardHTML('图片', 'image', false);
    }
    if (p.type === 'file') {
      // 持久化消息：{type:'file', attachment:{attachmentId, name, bytes}}
      const a = p.attachment;
      const name = (a && a.name) || p.name || '附件';
      const bytes = (a && a.bytes) != null ? a.bytes : p.bytes;
      const meta = (extOf(name) + (bytes ? ' · ' + sizeText(bytes) : '')) || '文件';
      if (a && a.attachmentId) {
        const u = { img: false, aid: a.attachmentId, name: name, bytes: bytes };
        return '<span class="fileCard pvChip" data-url="' + esc(attUrl(u)) + '" data-name="' + esc(name) + '" title="点击预览">' + FILE_ICON +
          '<span class="fmain"><span class="fname">' + esc(name) + '</span><span class="fmeta">' + esc(meta) + '</span></span></span>';
      }
      return fileCardHTML(name, meta, false);
    }
    return '';
  }).filter(Boolean);
  if (parts.length === 0) return '';
  return '<div class="msgAttach">' + parts.join('') + '</div>';
}
// 生成文件卡 HTML（removeBtn=true 时带悬停删除按钮，用于待发区）
function fileCardHTML(name, meta, removeBtn, idx) {
  const remove = removeBtn ? '<button class="fremove" onclick="rmPending(' + idx + ');return false" title="移除">' + X_ICON + '</button>' : '';
  return '<span class="fileCard">' + FILE_ICON +
    '<span class="fmain"><span class="fname">' + esc(name) + '</span><span class="fmeta">' + esc(meta) + '</span></span>' +
    remove + '</span>';
}
function esc(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// 极简 markdown 渲染（先转义再变换，无 XSS 面）：围栏代码块 / 行内代码 / 加粗 / 斜体 / 标题 / 列表
function md(src) {
  const lines = esc(src).split('\\n');
  let html = '', inCode = false, codeBuf = [];
  for (const line of lines) {
    if (/^\\s*(\`\`\`|~~~)/.test(line)) {
      if (inCode) { html += '<pre><code>' + codeBuf.join('\\n') + '</code></pre>'; codeBuf = []; inCode = false; }
      else inCode = true;
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    let t = line;
    t = t.replace(/^#{1,6}\\s+(.*)/, '<b>$1</b>');
    t = t.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    t = t.replace(/\\*\\*([^*]+)\\*\\*/g, '<b>$1</b>');
    t = t.replace(/\\*([^*]+)\\*/g, '<i>$1</i>');
    t = t.replace(/^\\s*[-*]\\s+/, '• ');
    html += t + '\\n';
  }
  if (inCode) html += '<pre><code>' + codeBuf.join('\\n') + '</code></pre>';
  return html;
}

// ---------- 执行过程（tool/call + tool/result）----------

// 从 tool/result 的 message 里掏出纯文本与错误标记
function toolResultText(msg) {
  const arr = Array.isArray(msg && msg.content) ? msg.content : [];
  const parts = [];
  let isErr = false;
  for (const c of arr) {
    if (!c) continue;
    if (c.type === 'tool-result') {
      if (c.isError) isErr = true;
      const inner = Array.isArray(c.content) ? c.content : [];
      for (const i of inner) if (i && i.type === 'text') parts.push(i.text);
    } else if (typeof c.text === 'string') parts.push(c.text);
  }
  return { text: parts.join('\\n').trim(), isErr };
}

// 把扁平事件流里的 tool/call 与 tool/result 按 callId 配成对
function collectTools() {
  const map = new Map();
  for (const ev of events) {
    if (!ev || !ev.data) continue;
    if (ev.type === 'tool/call') {
      const d = ev.data;
      const rec = map.get(d.callId) || { id: d.callId };
      rec.name = d.name || rec.name || 'tool';
      rec.args = typeof d.arguments === 'string' ? d.arguments : (d.arguments ? JSON.stringify(d.arguments) : rec.args);
      rec.step = d.step ?? rec.step;
      rec.turn = d.turn ?? rec.turn;
      if (!map.has(d.callId)) map.set(d.callId, rec);
    } else if (ev.type === 'tool/result') {
      const d = ev.data;
      const msg = d.message || {};
      const cid = (msg.source && msg.source.callId) ||
        (Array.isArray(msg.content) && msg.content[0] && msg.content[0].toolCallId) ||
        d.callId;
      if (!cid) continue;
      const { text, isErr } = toolResultText(msg);
      const rec = map.get(cid) || { id: cid, name: 'tool' };
      rec.result = text; rec.error = isErr; rec.done = true;
      rec.step = d.step ?? rec.step; rec.turn = d.turn ?? rec.turn;
      map.set(cid, rec);
    }
  }
  return map;
}

// 参数展示：只留关键字段并缩短长值，避免刷屏
function shortArgs(name, args) {
  if (!args) return '';
  let o = args;
  try { o = JSON.parse(args) } catch { return args.length > 240 ? args.slice(0, 240) + '…' : args }
  if (typeof o !== 'object' || o === null) return String(o).slice(0, 240);
  const keep = { path: 1, file_path: 1, command: 1, cmd: 1, pattern: 1, query: 1, url: 1, old_str: 1, new_str: 1, content: 1 };
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (!keep[k]) continue;
    let s = typeof v === 'string' ? v : JSON.stringify(v);
    if (s && s.length > 160) s = s.slice(0, 160) + '…';
    out[k] = s;
  }
  const keys = Object.keys(out);
  if (keys.length === 0) return Object.keys(o).slice(0, 4).join(', ');
  return keys.map(k => k + ': ' + out[k]).join('\\n');
}

const TOOL_LABEL = {
  read: '读取文件', write: '写入文件', edit: '编辑文件', bash: '执行命令',
  grep: '搜索内容', glob: '查找文件', list: '列出目录', search: '搜索',
  web_fetch: '抓取网页', web_search: '联网搜索', todo: '任务清单', task: '子任务',
};

// summary 行内联摘要：像官方一样一眼看出这步在干什么
// （read/glob → 文件名；bash → 命令首行；grep → pattern；有 description 用 description）
function toolSummary(t) {
  let o = {};
  try { o = JSON.parse(t.args || '{}') } catch {}
  if (typeof o !== 'object' || o === null) o = {};
  let s = o.description || o.command || o.cmd || o.file_path || o.path || o.pattern || o.query || o.url || '';
  if (typeof s !== 'string') s = JSON.stringify(s);
  if ((o.file_path || o.path) && !o.description) s = s.split('/').pop();   // 文件只显示文件名
  s = (s || '').split('\\n')[0].trim();
  if (!s) return '';
  return s.length > 90 ? s.slice(0, 90) + '…' : s;
}

function renderTool(t) {
  const label = TOOL_LABEL[t.name] || '';
  const cls = t.error ? 'err' : (t.done ? '' : 'wait');
  const state = t.error ? '失败' : (t.done ? '完成' : '执行中…');
  const args = shortArgs(t.name, t.args);
  const summary = toolSummary(t);
  const OUT = 1600;
  let out = t.result || '';
  const truncated = out.length > OUT;
  if (truncated) out = out.slice(0, OUT);
  let body = '';
  if (args) body += '<div class="st-label">参数</div><pre class="st-args">' + esc(args) + '</pre>';
  if (out) body += '<div class="st-label">结果</div><pre class="st-out' + (t.error ? ' err' : '') + '">' + esc(out) + '</pre>' +
    (truncated ? '<div class="st-trunc">… 结果过长，已截断显示（共 ' + t.result.length + ' 字符）</div>' : '');
  if (!body) body = '<div class="st-label">' + (t.done ? '无输出' : '等待返回…') + '</div>';
  const stepTag = t.step ? '步骤 ' + t.step : '';
  return '<details class="step" ' + (t.done && !t.error ? '' : 'open') + '>' +
    '<summary><span class="st-arrow">▶</span><span class="st-dot ' + cls + '"></span>' +
    '<span class="st-name">' + esc(t.name || 'tool') + '</span>' +
    (summary ? '<span class="st-sum">' + esc(summary) + '</span>' :
      (label ? '<span class="muted">' + esc(label) + '</span>' : '')) +
    (summary && label ? '' : '') +
    (stepTag ? '<span class="muted">' + esc(stepTag) + '</span>' : '') +
    '<span class="muted">· ' + state + '</span></summary>' +
    '<div class="st-body">' + body + '</div></details>';
}

// 思考段：摘要行 + 可展开全文（对应官方的「思考 · …」穿插条目）
function renderReason(seg) {
  const t = (seg.text || '').trim();
  if (!t) return '';
  const flat = t.replace(/\\s+/g, ' ');
  const head = flat.length > 120 ? flat.slice(0, 120) + '…' : flat;
  const BODY = 4000;
  let body = t, tbd = false;
  if (body.length > BODY) { body = body.slice(0, BODY); tbd = true; }
  return '<details class="step" ' + (seg.open ? 'open' : '') + '>' +
    '<summary><span class="st-arrow">▶</span><span class="st-dot think"></span>' +
    '<span class="st-name">思考</span><span class="st-sum">' + esc(head) + '</span></summary>' +
    '<div class="st-body"><pre class="st-args think">' + esc(body) + '</pre>' +
    (tbd ? '<div class="st-trunc">… 思考过长，已截断显示</div>' : '') + '</div></details>';
}

// 增量渲染节流：一帧 rAF 内只画一次
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(render); }
function render() {
  renderQueued = false;
  const box = $('msgs');
  let html = '';
  const tools = collectTools();
  const drawn = new Set();     // 同一个 callId 只画一次（快照重放时事件不重复入列）
  // 先标记"已有 call 事件"的 id：孤儿 result 判断用
  const hasCall = new Set();
  for (const ev of events) if (ev.type === 'tool/call' && ev.data && ev.data.callId) hasCall.add(ev.data.callId);
  for (let idx = 0; idx < timeline.length; idx++) {
    const item = timeline[idx];
    if (item.kind === 'reason') { html += renderReason(item); continue; }
    if (item.kind === 'turn') {                 // 本轮用时（事后可回看）
      html += '<div class="turnMeta">' + CLOCK_ICON +
        '<span>' + fmtClock(item.start) + ' 开始 · 用时 ' + fmtDur(item.end - item.start) + '</span>' +
        (item.note ? '<span class="note">' + esc(item.note) + '</span>' : '') + '</div>';
      continue;
    }
    const ev = item.ev;
    if (!ev) continue;
    if (ev.type === 'user/message') {
      // 关键过滤：只显示真实用户消息。agent-instructions（AGENTS.md 注入）、
      // skill-catalog（技能清单）、plugin（系统提示快照）等来源全部隐藏，
      // 否则聊天窗会出现大段系统提示"代码"。
      const src = ev.data && ev.data.source;
      if (!src || src.kind !== 'user') continue;
      const t = extractText(ev.data.content);
      if (t) {
        if (editingIdx === idx) {
          // WorkBuddy 式内联编辑：显示原文输入区 + 「编辑后将从此处重新开始对话，已有产物不会被删除」+ 取消/发送
          html += '<div class="msg u edit" data-uidx="' + idx + '">' +
            '<textarea id="editText" class="editText" rows="3" placeholder="输入修改后的内容…"></textarea>' +
            '<div class="editNote">编辑后将从此处重新开始对话，已有产物不会被删除</div>' +
            '<div class="editBtns"><button class="editCancel" data-edit-cancel="1">取消</button>' +
            '<button class="editSend" data-edit-send="1">发送</button></div></div>';
        } else {
          html += '<div class="msg u" data-uidx="' + idx + '">' +
          '<span class="u-actions"><button class="uact" data-edit="1" title="编辑">' + EDIT_ICON + '</button>' +
          '<button class="uact" data-copy="1" title="复制">' + COPY_ICON + '</button></span>' +
            esc(t) + '</div>';
        }
      }
    } else if (ev.type === 'assistant/message') {
      const t = extractText(ev.data.message && ev.data.message.content);
      if (t) html += '<div class="msg a">' + AVA + '<div class="body">' + md(t) + '</div></div>';
    } else if (ev.type === 'tool/call') {
      // 执行过程：call 与 result 已在 collectTools 里配成对，这里按出现顺序出块
      const id = ev.data && ev.data.callId;
      if (!id || drawn.has(id)) continue;
      const t = tools.get(id);
      if (!t) continue;
      drawn.add(id);
      html += renderTool(t);
    } else if (ev.type === 'tool/result') {
      // 孤儿结果（只有 result 没有 call，快照压缩时可能出现）单独补一块
      const msg = ev.data && ev.data.message;
      const cid = (msg && msg.source && msg.source.callId) ||
        (msg && Array.isArray(msg.content) && msg.content[0] && msg.content[0].toolCallId);
      if (!cid || !hasCall.has(cid)) continue;          // 有 call 事件的会在 tool/call 分支渲染
      if (drawn.has(cid)) continue;
      const { text, isErr } = toolResultText(msg);
      if (!text) continue;
      drawn.add(cid);
      const t = { name: 'tool', step: ev.data.step, result: text, error: isErr, done: true };
      html += renderTool(t);
    } else if (ev.type === 'turn/end') {
      // 本轮执行失败：直接在聊天流里给出红色错误卡片（不再静默）。
      // 典型场景：MISSING_CREDENTIAL（模型密钥未配）、QUOTA、网络错误。
      const reason = ev.data && ev.data.reason;
      if (reason && reason.kind === 'error') {
        const e = reason.error || {};
        let msgText = e.message || '本轮执行失败';
        const tip = e.code === 'MISSING_CREDENTIAL'
          ? '该模型需要配置 API Key：在 ~/.dsh/.credentials.yaml 的 refs 段添加对应密钥（保存即生效），或换一个已配置密钥的模型。'
          : e.code === 'QUOTA' ? '模型额度/余额不足，请检查对应平台的账户。' : '';
        // 服务端消息可能带 "store DEEPSEEK_API_KEY ... or export ..." 的英文长句，截短到分号前
        const semi = msgText.indexOf(';');
        html += '<div class="turnErr"><b>本轮任务失败' + (e.code ? '（' + esc(e.code) + '）' : '') + '</b>'
          + esc(semi > 0 ? msgText.slice(0, semi) : msgText)
          + (tip ? '<div class="tip">' + tip + '</div>' : '') + '</div>';
      }
    }
  }
  // 兜底：map 里有但时间线里没画过的（call/result 都被压缩掉的情况）
  for (const [id, t] of tools) {
    if (drawn.has(id)) continue;
    drawn.add(id);
    html += renderTool(t);
  }
  const live = liveChunks.map(chunkText).join('');
  if (live) html += '<div class="msg a streaming">' + AVA + '<div class="body">' + md(live) + '</div></div>';
  else if (running) html += '<div class="msg a streaming">' + AVA + '<div class="body"><span class="muted">思考中…</span></div></div>';
  if (!html) html = '<div class="empty">会话为空，发送第一条消息吧</div>';
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  box.innerHTML = html;
  if (nearBottom || live || running) box.scrollTop = box.scrollHeight;
}

// ---------- 上传：文件选择 / 文件夹选择 / 拖拽 共用一条通道 ----------
//
// 流程：选完/拖入 → 入 pending 区 → 立即自动批量上传（flushPending）。
// 发送消息时直接取已上传的 receiptId；若有漏网之鱼（pending 状态）再补传一次。

function onPick(input, isDir) {
  if (!cur) { alert('请先选择或新建会话'); input.value = ''; return; }
  // webkitdirectory：所有文件的第一段就是所选目录名，用它做整批的目录标签
  let label = '';
  if (isDir && input.files && input.files.length > 0) {
    const rel = input.files[0].webkitRelativePath || input.files[0].name;
    label = String(rel).split('/')[0] || '';
  }
  addPending([...input.files], isDir, label);
  input.value = '';
}

// 统一入队：raw = [{file, name}]，label 非空表示这一整批来自同一个目录
function enqueue(raw, label) {
  const gid = label ? ('g' + Math.random().toString(36).slice(2, 9)) : '';
  let added = 0;
  for (const it of raw) {
    if (!it || !it.name || !it.file) continue;
    const isImg = (it.file.type && it.file.type.indexOf('image/') === 0) || isImageName(it.name);
    pending.push({
      id: Math.random().toString(36).slice(2, 10), name: it.name, status: 'pending', file: it.file,
      kind: isImg ? 'image' : 'file',
      url: isImg ? URL.createObjectURL(it.file) : null,
      size: it.file.size,
      gid,
    });
    added++;
  }
  if (added === 0) return 0;
  if (gid) { pendingGroups.push({ id: gid, label, count: added }); setLastDir(label); }
  renderPending();
  return added;
}

function addPending(files, isDir, label) {
  const raw = [];
  for (const f of files) {
    const name = isDir && f.webkitRelativePath ? f.webkitRelativePath : f.name;
    if (!name) continue;
    raw.push({ file: f, name });
  }
  const added = enqueue(raw, label || groupLabelOf(raw));
  if (added === 0) return;
  const g = pendingGroups[pendingGroups.length - 1];
  $('hint').textContent = g ? ('目录 ' + g.label + '/ · ' + g.count + ' 个文件，正在上传…')
                            : ('正在上传 ' + added + ' 个文件…');
  flushPending();   // 选完立即上传，不等发送
}

// 入队通用入口：给拖拽/目录直选路径使用（name 已由调用方拼好相对路径）
function addItems(items, label) {
  const added = enqueue(items, label || groupLabelOf(items));
  if (added === 0) return;
  const g = pendingGroups[pendingGroups.length - 1];
  $('hint').textContent = g ? ('目录 ' + g.label + '/ · ' + g.count + ' 个文件，正在上传…')
                            : ('正在上传 ' + added + ' 个文件…');
  flushPending();   // 拖入立即上传，不等发送
}

// 整批 name 都带同一段目录前缀时，认为这是一个目录上传
function groupLabelOf(items) {
  const roots = new Set();
  for (const it of items || []) {
    const n = String((it && it.name) || '');
    if (n.indexOf('/') > 0) roots.add(n.split('/')[0]);
  }
  return roots.size === 1 ? [...roots][0] : '';
}

// 把所有 status='pending' 的项批量上传到 /app/upload，并发 3 路。
// 上传完的项 status='done' 并获得 receiptId，可被 send() 拼到 attachments。
// 失败的项 status='error'，保留在 pending 里可单独 ✕ 删除。
async function flushPending() {
  if (!cur) return false;
  const tasks = pending.map((p, i) => ({ p, i })).filter(x => x.p.status === 'pending');
  if (tasks.length === 0) return true;
  let done = 0;
  const failed = [];
  const CONC = 3;
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const idx = cursor++;
      const { p } = tasks[idx];
      if (!p.file) { done++; continue; }
      p.status = 'uploading'; renderPending();
      try {
        const r = await fetch('/app/upload?id=' + encodeURIComponent(cur), {
          method: 'POST', credentials: 'same-origin',
          headers: { 'x-file-name': encodeURIComponent(p.name), 'content-type': 'application/octet-stream' },
          body: p.file,
        });
        if (!r.ok) {
          let detail = ''; try { const j = await r.json(); detail = j.detail || j.error || r.status } catch { detail = r.status }
          throw new Error(detail);
        }
        const jr = await r.json();
        p.receiptId = jr.receiptId; p.status = 'done';
        if (jr.extracted > 0) {
          $('hint').textContent = 'ZIP 已解压 ' + jr.extracted + ' 个文件' +
            (jr.extractLabel ? ('（目录 ' + jr.extractLabel + '/）') : '') + '，目录结构已还原';
        }
        delete p.file;                 // 释放 File 引用
      } catch (e) {
        p.status = 'error'; p.err = e.message;
        failed.push(p.name + '（' + e.message + '）');
      }
      done++;
      const g = p.gid ? pendingGroups.find(x => x.id === p.gid) : null;
      $('hint').textContent = g
        ? (g.label + '/ · 上传中 ' + done + '/' + tasks.length)
        : ('上传中 ' + done + '/' + tasks.length);
      renderPending();
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, tasks.length) }, worker));
  const okCount = tasks.length - failed.length;
  const gl = tasks.length > 0 && tasks[0].p.gid
    ? (pendingGroups.find(x => x.id === tasks[0].p.gid) || {}).label : '';
  $('hint').textContent = failed.length
    ? ((gl ? gl + '/ · ' : '') + '完成 ' + okCount + '/' + tasks.length + '，失败 ' + failed.length)
    : (gl ? ('目录 ' + gl + '/ 已上传 ' + okCount + ' 个文件，可随下一条消息发送')
          : ('已上传 ' + okCount + ' 个文件，可随下一条消息发送'));
  refreshFiles();     // 上传完立刻按目录结构刷新右栏
  if (failed.length) alert('以下文件上传失败：\\n' + failed.join('\\n'));
  setTimeout(() => {
    const h = $('hint').textContent;
    if (h.indexOf('已上传') >= 0 || h.indexOf('完成 ') === 0) $('hint').textContent = '';
  }, 5000);
  return failed.length === 0;
}

// 目录上传：输入区不渲染任何目录卡（目录结构只在工作空间右栏展示），
// 上传进度走 #hint 一行文字。目录分组里的文件也不单独出卡。
function renderPending() {
  let html = '';
  html += pending.map((p, i) => {
    if (p.gid) return '';                      // 目录分组里的文件不再单独出卡
    const meta = p.status === 'pending' ? '待上传'
               : p.status === 'uploading' ? '上传中…'
               : p.status === 'error' ? ('失败：' + (p.err || ''))
               : (extOf(p.name) + (p.size ? ' · ' + sizeText(p.size) : '') || '已就绪');
    const cls = 'fileCard' + (p.status === 'error' ? ' failed' : '');
    if (p.kind === 'image') {
      const inner = p.url ? '<img src="' + p.url + '" alt="">' : FILE_ICON;
      return '<span class="imgThumb' + (p.status === 'error' ? ' failed' : '') + '" title="' + esc(p.name) + '">' +
        inner + '<button class="fremove" onclick="rmPending(' + i + ');return false" title="移除">' + X_ICON + '</button></span>';
    }
    const icon = p.status === 'uploading' ? '<span class="spin"></span>' : FILE_ICON;
    return '<span class="' + cls + '" title="' + esc(p.name) + '">' + icon +
      '<span class="fmain"><span class="fname">' + esc(p.name) + '</span><span class="fmeta">' + esc(meta) + '</span></span>' +
      '<button class="fremove" onclick="rmPending(' + i + ');return false" title="移除">' + X_ICON + '</button></span>';
  }).join('');
  $('pending').innerHTML = html;
  renderDirPath();
}

// 按钮上显示路径 + 上方一行显示进度/文件数（两者不重复）
function renderDirPath() {
  const tag = $('dirPath');
  if (!tag) return;
  const plain = [];
  const parts = [];
  for (const g of pendingGroups) {
    const items = pending.filter(p => p.gid === g.id);
    if (items.length === 0) continue;
    const errN = items.filter(p => p.status === 'error').length;
    const doneN = items.filter(p => p.status === 'done').length;
    const tail = errN ? (doneN + '/' + items.length + '，失败 ' + errN)
      : doneN >= items.length ? (items.length + ' 个文件 · 已就绪')
      : (items.length + ' 个文件 · 上传中 ' + doneN + '/' + items.length);
    parts.push(tail);
    plain.push(g.label + '/ · ' + tail);
  }
  if (parts.length === 0) { tag.style.display = 'none'; tag.innerHTML = ''; return; }
  tag.style.display = 'flex';
  tag.innerHTML = '<span class="ico">' + FOLDER_ICON + '</span>' + esc(parts.join('、'));
  tag.title = plain.join('、') + '（目录结构见右栏工作空间）';
}

// 「选择文件夹」按钮上直接显示本次上传的目录路径；上传结束后保留，
// 直到切换会话或换一个目录。记录 lastDir，发送后也不清空。
let lastDir = '';
function setLastDir(label) { lastDir = label || ''; renderDirBtn(); }
function renderDirBtn() {
  const btn = $('dirBtn'), lab = $('dirBtnLabel');
  if (!btn || !lab) return;
  if (!lastDir) {
    lab.style.display = 'none';
    lab.textContent = '';
    btn.classList.remove('named');
    btn.title = '选择文件夹';
    return;
  }
  lab.style.display = 'inline';
  lab.textContent = lastDir + '/';
  btn.classList.add('named');
  btn.title = '已上传目录：' + lastDir + '/（重新点击可换一个目录）';
}
function rmPending(i) { pending.splice(i, 1); renderPending(); }
function rmGroup(gid) {
  const g = pendingGroups.find(x => x.id === gid);
  pending = pending.filter(p => p.gid !== gid);
  pendingGroups = pendingGroups.filter(x => x.id !== gid);
  if (g && lastDir === g.label) setLastDir('');    // 整批移除后按钮上的路径一并清掉
  renderPending();
}

// ---------- 文件夹选择 ----------
//
// 首选 File System Access API（showDirectoryPicker）：授权弹窗**每个浏览器会话只弹一次**，
// 点过「允许」后本次会话内再选目录不再弹（在 chrome://settings/content/fileEditing
// 把站点设为「允许」则永久不弹）。
// 相比之下 <input webkitdirectory> 每次上传都必弹「将 N 个文件上传到此网站？」，
// 无法记忆、代码无法关闭 —— 所以 FS Access 仍是默认通道，webkitdirectory 仅兜底
// （HTTP 明文等非安全上下文下 showDirectoryPicker 不存在）。
// 完全零弹窗的路径是「拖拽文件夹到聊天区」（webkitGetAsEntry，不经过任何授权）。

async function pickDir() {
  if (!cur) { alert('请先选择或新建会话'); return; }
  if (window.showDirectoryPicker) {
    try {
      const dirHandle = await window.showDirectoryPicker({ id: 'dsh-uploads', mode: 'read' });
      const root = dirHandle.name || '';
      const out = [];
      // 必须带上顶层目录名：拖拽通道（walkEntry）和 webkitdirectory 通道
      // （webkitRelativePath）都会带，唯独 FS Access 的 entries() 只给子项名。
      // 不带的话右栏会退化成「目录里面的文件」平铺，拼不成整棵树。
      for await (const it of walkDir(dirHandle, root)) out.push(it);
      if (out.length === 0) return;
      addItems(out, root || groupLabelOf(out));
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;   // 用户点取消，静默返回
      // 其它原因（权限被拒、安全上下文变化等）也继续降级，不打断用户
    }
  }
  pickDirFallback();
}

// 兜底通道：webkitdirectory（非安全上下文 / 不支持 FS Access 的浏览器）。
// 环境矩阵（2026-10 查证）：iOS 18.4+ / 安卓 Chrome 147+ / Firefox 安卓 150+ 均已
// 完整支持 webkitdirectory 目录选择；唯一不行的是安卓微信（X5/XWeb 内核无目录
// 选择 UI，点了不弹框，且 webkitdirectory 属性探测不可靠——未知属性会变成 expando）。
// 所以只对「安卓微信」精确降级：多选文件 + 指引用浏览器打开（Chrome 可直接选目录）
// 或压 ZIP（服务端自动解压还原目录树）；其余环境保持原生目录选择通道。
function pickDirFallback() {
  const ua = navigator.userAgent || '';
  const inAndroidWeChat = ua.indexOf('MicroMessenger') >= 0 && ua.indexOf('Android') >= 0;
  let input = $('dirInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'dirInput';
    input.multiple = true;
    if (!inAndroidWeChat) { input.webkitdirectory = true; input.directory = true; }
    input.style.display = 'none';
    input.onchange = function () { onPick(input, !inAndroidWeChat); };
    document.body.appendChild(input);
  }
  $('hint').textContent = inAndroidWeChat
    ? '微信内暂不支持选文件夹：点右上角「···」→「在浏览器中打开」可直接选目录（Chrome）；或把文件夹压成 ZIP 上传（自动解压还原目录）'
    : '已打开系统目录选择框：选择文件夹并确认即可上传';
  input.value = '';
  input.click();
}

async function* walkDir(handle, base) {
  for await (const [name, entry] of handle.entries()) {
    const path = base ? base + '/' + name : name;
    if (entry.kind === 'directory') {
      yield* walkDir(entry, path);
    } else if (entry.kind === 'file') {
      try {
        const file = await entry.getFile();
        yield { file, name: path };
      } catch (e) {
        // 个别文件无权限读取时跳过，不阻塞整批
      }
    }
  }
}

// ---------- 拖拽（文件与文件夹，保留相对路径） ----------

function setupDrop() {
  const chat = $('chat');
  let depth = 0;
  chat.addEventListener('dragenter', e => { e.preventDefault(); depth++; chat.classList.add('dropping'); });
  chat.addEventListener('dragover', e => e.preventDefault());
  chat.addEventListener('dragleave', e => { e.preventDefault(); if (--depth <= 0) { depth = 0; chat.classList.remove('dropping'); } });
  chat.addEventListener('drop', async e => {
    e.preventDefault();
    depth = 0; chat.classList.remove('dropping');
    if (!cur) { alert('请先选择或新建会话'); return; }
    // getAsEntry 必须在 await 之前同步取出
    const entries = [...(e.dataTransfer.items || [])]
      .map(it => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
    if (entries.length > 0) {
      const out = [];
      for (const entry of entries) await walkEntry(entry, '', out);
      // 只拖了一个目录时，用它的名字做整批标签
      const label = entries.length === 1 && entries[0].isDirectory ? entries[0].name : '';
      addItems(out, label);
    } else {
      // 无 entry（部分浏览器/应用来源）：退回纯文件列表
      const out = [...(e.dataTransfer.files || [])].map(f => ({ file: f, name: f.name }));
      if (out.length > 0) addItems(out);
    }
  });
}
async function walkEntry(entry, base, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ file, name: base + entry.name });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (batch.length === 0) break;
      for (const child of batch) await walkEntry(child, base + entry.name + '/', out);
    }
  }
}

// 停止过程中被 abort 掉的内部等待（jobs.wait 抛 'wait aborted'、AbortError 等）
// 属于用户主动停止的正常副产物，不该当成报错弹给用户。
function isAbortMsg(s) {
  return /abort|cancel|interrupt|stopped|中止|中断|已停止/i.test(String(s || ''));
}

// ---------- 本轮计时（开始时间 + 实时用时 + 结束总耗时） ----------
//
// 起点：用户点发送即开始计（含排队等待），收到 turn/start 沿用同一起点不重置；
// 终点：turn/end（或被用户停止）时停表，保留「开始 → 结束 · 用时」直到下一轮。

let turnStart = 0;        // 本轮开始时间戳
let turnEnd = 0;          // 本轮结束时间戳（0=仍在进行）
let turnTicker = null;    // 秒级刷新定时器
let turnWaiting = false;  // 已发送、尚未收到 turn/start（排队中）
let lastTurnNote = '';    // 本轮备注（如「已停止」），随用时记录写入时间线

function fmtClock(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + ' 秒';
  const m = Math.floor(s / 60), rs = s % 60;
  if (m < 60) return m + ' 分 ' + rs + ' 秒';
  return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
}
function startTurnTimer() {
  if (!turnStart) { turnStart = Date.now(); turnEnd = 0; }
  turnWaiting = !running;
  if (!turnTicker) turnTicker = setInterval(() => renderTurnState(), 1000);
  renderTurnState();
}
function stopTurnTimer() {
  if (!turnStart) return;
  turnEnd = Date.now();
  turnWaiting = false;
  if (turnTicker) { clearInterval(turnTicker); turnTicker = null; }
}
function resetTurnTimer() {
  turnStart = 0; turnEnd = 0; turnWaiting = false;
  if (turnTicker) { clearInterval(turnTicker); turnTicker = null; }
}
function renderTurnState(note) {
  const el = $('curState');
  if (!el) return;
  if (note) lastTurnNote = note;
  if (!turnStart) { el.textContent = note || ''; el.title = ''; el.classList.remove('live'); return; }
  const end = turnEnd || Date.now();
  const dur = fmtDur(end - turnStart);
  el.classList.toggle('live', !turnEnd);
  if (!turnEnd) {
    const phase = stopping ? '正在停止' : (turnWaiting ? '排队中' : '回答中');
    el.textContent = '· ' + phase + ' · 已用 ' + dur + '（' + fmtClock(turnStart) + ' 开始）' + (note ? ' ' + note : '');
    el.title = '开始于 ' + fmtClock(turnStart) + '，已用时 ' + dur + '（含排队等待）';
  } else {
    el.textContent = '· ' + fmtClock(turnStart) + ' 开始 · 用时 ' + dur + (note ? ' ' + note : '');
    el.title = '开始 ' + fmtClock(turnStart) + ' · 结束 ' + fmtClock(turnEnd) + ' · 总用时 ' + dur;
  }
}

// 停止后复位（收到 turn/end 或兜底超时都会走到这里）
function resetStop(note) {
  running = false;
  if (cur) { sessionRunning[cur] = false; if (turnEnd) sessionTurnEnd[cur] = turnEnd; }
  stopping = false;
  stopRetries = 0;
  clearTimeout(stopWatchdog); stopWatchdog = null;
  const s = $('stopBtn'); if (s) { s.disabled = false; s.title = '停止生成（Esc）'; }
  syncComposer(); scheduleRender();
  renderTurnState(note || '');      // 保留本轮的开始时间与总用时
}

// 向服务端发一次停止请求（deep=true 会连待处理队列一起清掉）
async function cancelOnce() {
  return api('/app/sessions/cancel', jbody({ sessionId: cur, deep: true }));
}

// 停止当前这一轮生成。
// 注意：官方 cancel 是协作式的——agent 会跑完当前这一步才停；
// 且 keepInbox:true 时排队的消息会继续跑，所以后端会补一次 keepInbox:false 的深度停止。
async function stop() {
  if (!cur || stopping) return;
  stopping = true;
  stopRetries = 0;
  const s = $('stopBtn'); if (s) { s.title = '正在停止…'; }
  syncComposer();
  $('curState').textContent = '· 正在停止…';
  try {
    await cancelOnce();
  } catch (e) {
    if (e.status === 501) {
      // 老版本 dsh 没有 cancel 能力：只做前端复位，服务端会继续跑完
      resetStop('· 当前 dsh 版本不支持停止，请升级到 >= 0.1.3-alpha.2');
      return;
    }
    if (isAbortMsg(e.message) || isAbortMsg(e.detail)) {
      // 'wait aborted' 之类：停止已生效，只是内部等待被中断，静默收尾
      resetStop('· 已停止');
      return;
    }
    stopping = false;
    if (s) { s.disabled = false; s.title = '停止生成（Esc）'; }
    alert('停止失败: ' + e.message);
    return;
  }
  // 兜底：不要过早假装"已停"（否则服务端还在跑、UI 却显示结束，观感就是"停了又自动跑"）。
  // 20s 还没等到 turn/end，才提示未收到回执并复位按钮。
  clearTimeout(stopWatchdog);
  stopWatchdog = setTimeout(() => resetStop('· 停止已请求，但未收到结束回执（当前步骤可能仍在收尾）'), 20000);
}

// ---------- 技能菜单（WorkBuddy 式「技能」入口） ----------
//
// 数据来自插件自有路由 GET /app/skills?id=<sessionId>（后端读官方 ctx.skills 注册表，
// 只取 user-invocable 的技能）。选中后把 "/<name> " 写入输入框，由用户补参数后发送。
// 也可以在输入框行首直接敲 / 唤起菜单（边打字边过滤，输入空格即收起）。

let skillList = [];          // 当前会话可用的 user-invocable 技能
let skillMenuOpen = false;
let skillQuery = '';

async function loadSkills() {
  if (!cur) { skillList = []; closeSkillMenu(); return; }
  try {
    const r = await api('/app/skills?id=' + encodeURIComponent(cur));
    skillList = r && Array.isArray(r.skills) ? r.skills : [];
  } catch (e) {
    skillList = [];
  }
  if (skillMenuOpen) renderSkillMenu();
}

// 打开菜单前先刷新一次：技能是磁盘上的文件，随时可能新增/改名，
// 只在 openSession 拉一次会拿到过期结果（表现为"点了没反应/列表是空的"）。
async function toggleSkillMenu() {
  if (skillMenuOpen) { closeSkillMenu(); return; }
  await loadSkills();
  openSkillMenu('');
}

function renderSkillMenu() {
  const el = $('skillMenu');
  if (!el) return;
  const q = skillQuery.trim().toLowerCase();
  const list = q
    ? skillList.filter((s) => (s.name + ' ' + (s.description || '')).toLowerCase().includes(q))
    : skillList;
  if (!list.length) {
    el.innerHTML = '<div class="skEmpty">' +
      (skillList.length
        ? '没有匹配的技能'
        : '暂无可用技能<br><span class="muted">点顶栏「技能中心」上传本地 .zip 技能包，或手工放到 ~/.dsh/skills/&lt;name&gt;/SKILL.md</span>') +
      '</div>';
    return;
  }
  el.innerHTML = '<div class="skHead"><span>技能</span><span>' + list.length + ' 个</span></div>' +
    list.map((s) => {
      const h = s.hub;
      const badge = h && h.version ? '<span class="skBadge">v' + esc(h.version) + '</span>' : '';
      const who = h && (h.author || h.namespace)
        ? '<span class="skAuthor">' + esc(h.namespace ? '@' + h.namespace : h.author) + '</span>'
        : '';
      return '<button class="skItem" data-skill="' + esc(s.name) + '">' +
        '<div class="skTop"><div class="skName"><span class="skSlash">/</span>' + esc(s.name) + '</div>' +
        badge + who + '</div>' +
        '<div class="skDesc">' + esc(s.description || '') + '</div></button>';
    }).join('');
}
function openSkillMenu(q) {
  const el = $('skillMenu');
  if (!el) return;
  skillMenuOpen = true;
  skillQuery = q || '';
  renderSkillMenu();
  el.style.display = 'block';
}
function closeSkillMenu() {
  const el = $('skillMenu');
  if (el) el.style.display = 'none';
  skillMenuOpen = false;
}
function pickSkill(name) {
  const el = $('text');
  if (el) {
    el.value = '/' + name + ' ';
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }
  closeSkillMenu();
}

// 输入框行首敲 / 且还没打空格 → 边打字边过滤技能；否则收起菜单
async function onComposerInput() {
  const v = $('text') ? $('text').value : '';
  if (/^\\/[^\\s]*$/.test(v)) {
    if (!skillList.length) await loadSkills();   // 列表还是空就补拉一次再开
    openSkillMenu(v.slice(1));
  } else if (skillMenuOpen) closeSkillMenu();
}

function setupSkills() {
  const t = $('text');
  if (t) t.addEventListener('input', onComposerInput);
  const m = $('skillMenu');
  if (m) {
    m.addEventListener('click', (e) => {
      const it = e.target.closest('.skItem');
      if (it && it.dataset.skill) pickSkill(it.dataset.skill);
    });
  }
  // 点击别处收起
  document.addEventListener('click', (e) => {
    if (!skillMenuOpen) return;
    if ($('skillMenu') && $('skillMenu').contains(e.target)) return;
    if ($('skillBtn') && $('skillBtn').contains(e.target)) return;
    closeSkillMenu();
  });
  // 市场入口只在服务端配置了 hub.indexUrl 时才出现
  refreshHubButton();
}

// ---------------------------------------------------------------------------
// 技能市场（对标 WorkBuddy SkillHub）
//
// 后端 /app/skills/hub 给出索引 + 安装态；未配置 indexUrl 时 configured=false，
// 此时隐藏入口，技能菜单等既有功能完全不受影响。
// 装完的技能落在 ~/.dsh/skills/<slug>__hub，由官方 provider 的目录监视器自动纳入。
// ---------------------------------------------------------------------------

let hubList = [];            // 市场索引里的技能
let hubConfigured = false;   // 服务端是否配置了市场

async function refreshHubButton() {
  const btn = $('hubBtn');
  if (!btn) return;
  try {
    const r = await api('/app/skills/hub');
    hubConfigured = !!r.configured;
    hubList = Array.isArray(r.skills) ? r.skills : [];
  } catch (e) {
    hubConfigured = false;
    hubList = [];
  }
  // 面板同时承载「本地上传」与「技能市场」，即使没配市场也常驻显示
  btn.style.display = '';
}

async function openHubPanel() {
  const el = $('hubPanel');
  if (!el) return;
  el.classList.add('on');
  try {
    const r = await api('/app/skills/hub');
    hubConfigured = !!r.configured;
    hubList = Array.isArray(r.skills) ? r.skills : [];
  } catch (e) {
    hubConfigured = false;
    hubList = [];
  }
  await renderLocalSkills();
  await renderHubList();
}

function closeHubPanel() {
  const el = $('hubPanel');
  if (el) el.classList.remove('on');
}

function hubBackdrop(e) { if (e.target === $('hubPanel')) closeHubPanel(); }

// 搜框输入：防抖后触发服务端搜索（250ms）
let hubSearchTimer = null;
function hubSearchInput() {
  if (hubSearchTimer) clearTimeout(hubSearchTimer);
  hubSearchTimer = setTimeout(() => { void renderHubList(); }, 250);
}

// 把一份技能列表渲染成市场卡片
function paintHubList(list, searched) {
  const body = $('hubSect');
  if (!body) return;
  if (!list.length) {
    body.innerHTML = '<div class="hubEmpty">' +
      (searched ? '没有匹配的技能' : (hubList.length ? '没有匹配的技能' : '市场暂无技能')) + '</div>';
    return;
  }
  body.innerHTML = list.map((s) => {
    const icon = s.icon
      ? '<img src="' + esc(s.icon) + '" alt="">'
      : esc((s.name || s.slug || '?').slice(0, 1).toUpperCase());
    const ns = s.namespace ? '@' + s.namespace : (s.author || '');
    const installs = s.installs ? (s.installs >= 10000 ? (s.installs / 10000).toFixed(1) + ' 万次安装' : s.installs + ' 次安装') : '';
    let act;
    if (s.upgradable) {
      act = '<button data-hub-install="' + esc(s.slug) + '">升级</button>' +
        '<button class="ghost" data-hub-del="' + esc(s.slug) + '">卸载</button>';
    } else if (s.installed) {
      act = '<button disabled>已安装</button>' +
        '<button class="ghost" data-hub-del="' + esc(s.slug) + '">卸载</button>';
    } else {
      act = '<button data-hub-install="' + esc(s.slug) + '">安装</button>';
    }
    return '<div class="hubItem">' +
      '<div class="hubIcon">' + icon + '</div>' +
      '<div class="hubMain">' +
      '<div class="hubTitle"><b>' + esc(s.name || s.slug) + '</b>' +
      (s.version ? '<span class="hubVer">v' + esc(s.version) + '</span>' : '') +
      (ns ? '<span class="hubNs">' + esc(ns) + '</span>' : '') + '</div>' +
      '<div class="hubDesc">' + esc(s.description || '') + '</div>' +
      '<div class="hubMeta">' + esc(s.installed ? ('已安装 ' + (s.installedVersion ? 'v' + s.installedVersion : '')) : installs) + '</div>' +
      '</div><div class="hubAct">' + act + '</div></div>';
  }).join('');
}

// 渲染市场列表：无关键词用已拉取的全量 hubList；有关键词走服务端搜索
async function renderHubList() {
  const body = $('hubSect');
  if (!body) return;
  if (!hubConfigured) {
    body.innerHTML = '<div class="hubEmpty">未配置技能市场<br>' +
      '<span class="muted">在插件 config 里设置 hub.indexUrl 后即可启用</span></div>';
    return;
  }
  const q = ($('hubSearch') ? $('hubSearch').value : '').trim();
  if (!q) {
    paintHubList(hubList, false);
    return;
  }
  body.innerHTML = '<div class="hubEmpty">搜索中…</div>';
  try {
    const r = await api('/app/skills/hub/search?q=' + encodeURIComponent(q));
    const list = (r && Array.isArray(r.skills)) ? r.skills : [];
    paintHubList(list, true);
  } catch (e) {
    body.innerHTML = '<div class="hubEmpty">搜索失败，请重试</div>';
  }
}

function flashHint(text) {
  const el = $('hint');
  if (el) el.textContent = text;
}

async function hubInstall(slug) {
  try {
    await api('/app/skills/hub/install', jbody({ slug }));
    flashHint('已安装 ' + slug);
    await loadSkills();          // 立刻让新技能出现在 / 菜单里
    await openHubPanel();        // 刷新安装态
  } catch (e) {
    flashHint('安装失败：' + (e.message || e));
  }
}

async function hubUninstall(slug) {
  try {
    await api('/app/skills/hub/uninstall', jbody({ slug }));
    flashHint('已卸载 ' + slug);
    await loadSkills();
    await openHubPanel();
  } catch (e) {
    flashHint('卸载失败：' + (e.message || e));
  }
}

function setupHub() {
  const body = $('hubSect');
  if (body) {
    body.addEventListener('click', (e) => {
      const ins = e.target.closest('[data-hub-install]');
      if (ins) { hubInstall(ins.dataset.hubInstall); return; }
      const del = e.target.closest('[data-hub-del]');
      if (del) hubUninstall(del.dataset.hubDel);
    });
  }
}

// ---------------------------------------------------------------------------
// 本地自定义技能包上传
//
// 后端 POST /app/skills/upload 收原始 zip 字节，解包后装进当前登录用户的专属
// 技能层（workspaces/u<uid>/.dsh/skills/<slug>__local），由官方 provider 的
// 目录监视器自动纳入，装完刷新 / 菜单即可见，无需重启服务。
// ---------------------------------------------------------------------------

function locHint(text) {
  const el = $('locHint');
  if (el) el.textContent = text || '';
}

function pickLocalZip() {
  const el = $('locFile');
  if (el) { el.value = ''; el.click(); }
}

function onLocalPick(input) {
  const f = input && input.files && input.files[0];
  if (f) localUploadFile(f);
}

async function localUploadFile(file) {
  if (!file) return;
  if (!/\.zip$/i.test(file.name)) { locHint('只支持 .zip 包：请把技能文件夹压缩成 zip 后上传'); return; }
  locHint('正在上传并安装 ' + file.name + ' …');
  try {
    const buf = await file.arrayBuffer();
    const r = await api('/app/skills/upload?name=' + encodeURIComponent(file.name), {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: buf,
    });
    let msg = '已安装「' + (r.name || (r.skill && r.skill.slug) || '') + '」'
      + (r.overwritten ? '（已覆盖更新）' : '')
      + ' —— 在输入框敲 / 即可调用';
    // 用户层优先级最低（project-dsh），与内置/共享层同名会被盖掉
    if (r.shadowed) msg += '；⚠ 与内置或共享层技能同名，可能被遮蔽，建议改个名字';
    locHint(msg);
    await loadSkills();          // 立刻让新技能出现在 / 菜单里
    await renderLocalSkills();
  } catch (e) {
    locHint('安装失败：' + (e.message || e));
  }
}

async function localUninstall(slug) {
  try {
    await api('/app/skills/local/uninstall', jbody({ slug }));
    locHint('已卸载 ' + slug);
    await loadSkills();
    await renderLocalSkills();
  } catch (e) {
    locHint('卸载失败：' + (e.message || e));
  }
}

async function renderLocalSkills() {
  const el = $('locList');
  if (!el) return;
  let list = [];
  try {
    const r = await api('/app/skills/local');
    list = Array.isArray(r.skills) ? r.skills : [];
  } catch (e) {
    el.innerHTML = '<div class="hubEmpty">本地技能加载失败</div>';
    return;
  }
  if (!list.length) { el.innerHTML = ''; return; }
  el.innerHTML = list.map((s) => {
    const badge = s.version ? '<span class="hubVer">v' + esc(s.version) + '</span>' : '';
    const warn = s.shadowed ? '<span class="locWarn">同名被遮蔽</span>' : '';
    const meta = (s.file ? esc(s.file) + ' · ' : '') + s.files + ' 个文件';
    return '<div class="hubItem">' +
      '<div class="hubIcon">' + esc((s.name || s.slug || '?').slice(0, 1).toUpperCase()) + '</div>' +
      '<div class="hubMain">' +
      '<div class="hubTitle"><b>' + esc(s.name || s.slug) + '</b>' + badge + warn + '</div>' +
      '<div class="hubDesc">' + esc(s.description || '') + '</div>' +
      '<div class="hubMeta">' + meta + '</div>' +
      '</div><div class="hubAct"><button class="ghost" data-loc-del="' + esc(s.slug) + '">卸载</button></div></div>';
  }).join('');
}

function setupLocal() {
  const up = $('locUp');
  if (up) {
    ['dragenter', 'dragover'].forEach((ev) =>
      up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) =>
      up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.remove('over'); }));
    up.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) localUploadFile(f);
    });
  }
  const list = $('locList');
  if (list) {
    list.addEventListener('click', (e) => {
      const del = e.target.closest('[data-loc-del]');
      if (del) localUninstall(del.dataset.locDel);
    });
  }
}

// Enter 发送 / Shift+Enter 换行；中文输入法组词中（isComposing 或 keyCode 229）不发送
function onKeydown(e) {
  if (e.key === 'Escape') {
    if (skillMenuOpen) { e.preventDefault(); closeSkillMenu(); return; }
    if ($('hubPanel').classList.contains('on')) { closeHubPanel(); return; }
    if ($('fpv').classList.contains('on')) { closeFpv(); return; }
  if ($('pv').classList.contains('on')) { closePv(); return; }
    if (running) { e.preventDefault(); stop(); }
    return;
  }
  if (e.key !== 'Enter') return;
  if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;   // 组合键交给默认行为（换行）
  if (e.isComposing || e.keyCode === 229) return;                 // IME 组词中
  e.preventDefault();
  send();
}

async function send() {
  if (!cur) { alert('请先选择或新建会话'); return; }
  const text = $('text').value.trim();
  if (!text && pending.length === 0) return;

  // 先把暂存区的文件批量上传（如果有），再取 receiptId 发消息。
  // 这覆盖了两种情况：之前未上传的（status='pending'）会被 flushPending 转 done 后再取 receiptId；
  // 之前已上传成功的（status='done'）直接跳过重传。
  if (pending.some((p) => p.status === 'pending')) {
    $('hint').textContent = '正在上传附件…';
    const ok = await flushPending();
    if (!ok && !pending.some((p) => p.status === 'done')) {
      // 全部失败且无文字 → 不发，避免空消息
      alert('附件上传失败，请检查网络后重试');
      return;
    }
  }

  const done = pending.filter((p) => p.status === 'done');
  const attachments = done.map((p) => p.receiptId);
  if (!text && attachments.length === 0) return;

  // 被服务端并发闸门拒绝时，把输入与附件放回暂存区，别让用户重打重传。
  // 附件本身还在服务端（receiptId 仍有效），只是预览 URL 已释放，
  // 卡片会从缩略图回退成文件图标；gid 清掉以免残留的分组索引错位。
  const restoreDraft = () => {
    if (text) $('text').value = text;
    if (done.length) {
      pending = done.map((p) => Object.assign({}, p, { url: undefined, gid: undefined }));
      pendingGroups = [];
      renderPending();
    }
  };

  // 任务真的发出去了：这个会话不再是「空的」，允许再新建下一个
  freshBlankId = null;

  $('text').value = '';
  pending.forEach((p) => { if (p.url) URL.revokeObjectURL(p.url); });
  pending = []; pendingGroups = []; renderPending();
  try {
    const v = await api('/app/sessions/prompt', jbody({ sessionId: cur, text: text || '(见附件)', attachments }));
    // 难度路由反馈：顶栏显示本轮实际使用的模型（手动模式则保持手动显示）
    if (v && v.routedModel && v.routedModel.model) {
      showModelNow(v.routedModel.model, v.routedModel.rule || '');
    }
    turnStart = 0; turnEnd = 0;      // 新一轮：从点发送这一刻开始计（含排队）
    sessionRunning[cur] = true;
    startTurnTimer();
    sessionTurnStart[cur] = turnStart;   // 按会话保留起点，跨切换累加
  } catch (e) {
    // 429 = 服务端并发闸门（同时跑的任务太多）。这不是故障而是排队提示，
    // 用 inline hint 而不是 alert，并把草稿还回去。
    if (e && e.status === 429) {
      restoreDraft();
      flashHint(e.message || '当前任务较多，请稍后重试');
      return;
    }
    alert('发送失败: ' + e.message);
  }
}

setupDrop();
setupFilesBox();
setupPendingBox();
setupMsgChips();
setupFpGrip();
setupSkills();
setupHub();
setupLocal();
// 全局 Esc：优先关市场弹层与预览弹层；其次停止生成（输入框未聚焦时同样生效）
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ($('hubPanel').classList.contains('on')) { closeHubPanel(); return; }
  if ($('pwModal').classList.contains('on')) { closePwModal(); return; }
  if ($('fpv').classList.contains('on')) { closeFpv(); return; }
  if ($('pv').classList.contains('on')) { closePv(); return; }
  if (running) stop();
});
(async function init() {
  try { await enter(); } catch (e) { /* 未登录，停留在登录页 */ }
})();
</script>
</body>
</html>`
