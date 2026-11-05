#!/usr/bin/env node
// 一键把插件（重）装进本机 dsh profile —— 用于 profile 被重置 / node_modules 被清空的事故恢复。
//
// 背景：~/.dsh/profiles/web 被 dsh 重新脚手架时，web/node_modules 会被清空，
// 第三方插件（不在官方 bundle 列表里）随之消失，表现为 /app 404。
// 官方 bundle 靠父级 ~/.dsh/profiles/node_modules 兜底所以主页还能出 401，极具迷惑性。
//
// sync:local 只会「更新已存在目录」，本脚本会「从零创建目录 + 写回 cordis.patch.yml」。
//
// 用法:
//   node scripts/reinstall-local.mjs          # 装到 $DSH_HOME/profiles/web（默认 ~/.dsh）
//   DSH_HOME=/www/dsh-home node scripts/reinstall-local.mjs
//   node scripts/reinstall-local.mjs --profile other   # 指定 profile 名
import { existsSync, mkdirSync, copyFileSync, cpSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'

const here = process.cwd()
const home = process.env.DSH_HOME || join(homedir(), '.dsh')
const profile = process.argv.includes('--profile') ? process.argv[process.argv.indexOf('--profile') + 1] : 'web'

const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))
const name = pkg.name // @my/dsh-plugin-auth
if (!existsSync(join(here, 'lib', 'index.js'))) {
  console.error('[reinstall] 找不到 lib/index.js，请先 npm run build')
  process.exit(1)
}

const dst = join(home, 'profiles', profile, 'node_modules', ...name.split('/'))
mkdirSync(join(dst, 'lib'), { recursive: true })
// 必须同步 lib/ 下全部产物，不能写死文件名：插件后加的 manual.js / watchdog.js
// 一旦漏掉，index.js 的 import 失败 -> 插件整体不激活 -> /app 仍是 404。
for (const f of readdirSync(join(here, 'lib'))) {
  if (!statSync(join(here, 'lib', f)).isFile()) continue
  copyFileSync(join(here, 'lib', f), join(dst, 'lib', f))
}
for (const f of ['package.json', 'cordis.patch.yml', 'schema.sql', 'README.md']) {
  if (existsSync(join(here, f))) copyFileSync(join(here, f), join(dst, f))
}
// 运行时依赖：源码仓库是 pnpm 布局（node_modules/.pnpm/...），直接 cpSync
// 只能解引用顶层包，mysql2 的传递依赖（sql-escaper / long / lru.min ...）全丢，
// require('mysql2/promise') 会 MODULE_NOT_FOUND。按 dst/package.json 重装最稳。
const isWin = process.platform === 'win32'
try {
  // Windows 上 npm 是 npm.cmd，execFileSync 需借 cmd.exe 才能解析。
  execFileSync(isWin ? 'npm.cmd' : 'npm',
    ['install', '--omit=dev', '--no-workspaces', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: dst, stdio: 'inherit', shell: isWin })
  console.log('[reinstall] 运行时依赖已装齐')
} catch (error) {
  console.warn('[reinstall] npm install 失败（离线兜底，传递依赖可能不全）:', error.message)
  // 只在目标还没有依赖树时降级复制，避免把已装好的完整依赖树覆盖坏。
  if (!existsSync(join(dst, 'node_modules')) && existsSync(join(here, 'node_modules'))) {
    cpSync(join(here, 'node_modules'), join(dst, 'node_modules'), {
      dereference: true,
      recursive: true,
      force: true,
      filter: (src) => !/(^|\/)\.bin(\/|$)/.test(src),
    })
  }
}

// 把 insert 条目写回 profile 的 cordis.patch.yml（若尚未包含）
const patchDst = join(home, 'profiles', profile, 'cordis.patch.yml')
let patchText = existsSync(patchDst) ? readFileSync(patchDst, 'utf8') : '[]\n'
const hasEntry = patchText.includes(`name: '${name}'`) || patchText.includes(`name: "${name}"`)
if (!hasEntry && existsSync(join(here, 'cordis.patch.yml'))) {
  const insertBlock = readFileSync(join(here, 'cordis.patch.yml'), 'utf8')
  patchText = patchText.replace(/^\s*\[\s*\]\s*$/, '').trimEnd() + '\n' + insertBlock
  writeFileSync(patchDst, patchText)
  console.log(`[reinstall] 已把 insert 条目写回 ${patchDst}`)
} else if (hasEntry) {
  console.log('[reinstall] cordis.patch.yml 已含该插件条目，跳过')
}

console.log(`[reinstall] ✅ ${dst}`)
console.log('[reinstall] 完成。profile 的 patchReload=live 时热生效，否则重启 dsh web。')
