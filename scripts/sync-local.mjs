#!/usr/bin/env node
// 把 build 产物同步到本机已安装的插件目录，省去每次重新 dsh plugin add。
//
// 用法:
//   npm run sync:local              # 自动探测 $DSH_HOME/profiles/*/node_modules 下的插件目录
//   DSH_HOME=/www/dsh-home npm run sync:local
//   npm run sync:local -- /path/to/plugin-dir   # 显式指定
//
// 为什么需要它：dsh 启动时直接从 profile 的 node_modules 里 require 插件，
// 在源码目录 build 不会自动生效；而 dsh plugin add 会把同一插件注册两次
// （bundle + 手动 insert）触发 "duplicate loader entry id"。
import { existsSync, readdirSync, copyFileSync, statSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

const here = process.cwd()
const libDir = join(here, 'lib')
if (!existsSync(libDir)) {
  console.error('[sync] 找不到 lib/，请先 npm run build')
  process.exit(1)
}

const home = process.env.DSH_HOME || join(homedir(), '.dsh')
const explicit = process.argv[2]

function candidates() {
  if (explicit) return [resolve(explicit)]
  const out = []
  const profiles = join(home, 'profiles')
  if (!existsSync(profiles)) return out
  for (const profile of readdirSync(profiles)) {
    const nm = join(profiles, profile, 'node_modules')
    if (!existsSync(nm)) continue
    // 标准布局：node_modules/@my/dsh-plugin-auth
    const std = join(nm, '@my', 'dsh-plugin-auth')
    if (existsSync(std)) out.push(std)
    // 服务器上的非标准布局：手动解压 tgz 导致目录名带 .tgz
    for (const entry of readdirSync(nm)) {
      if (entry.includes('dsh-plugin-auth') && !out.includes(join(nm, entry))) out.push(join(nm, entry))
    }
  }
  return out
}

const targets = candidates().filter((d) => existsSync(join(d, 'lib')))
if (targets.length === 0) {
  console.error(`[sync] 没找到已安装的插件目录（DSH_HOME=${home}）。`)
  console.error('      先跑一次 dsh plugin --profile <name> add <tgz>，或显式传目录：')
  console.error('      npm run sync:local -- /path/to/plugin-dir')
  process.exit(1)
}

let ok = 0
for (const dir of targets) {
  for (const f of ['index.js', 'index.d.ts', 'ui.js', 'ui.d.ts']) {
    const src = join(libDir, f)
    if (!existsSync(src)) continue
    copyFileSync(src, join(dir, 'lib', f))
  }
  const t = statSync(join(dir, 'lib', 'ui.js')).mtime
  console.log(`[sync] ✅ ${dir}  (ui.js mtime ${t.toISOString().slice(0, 19).replace('T', ' ')})`)
  ok++
}
console.log(`[sync] 完成，同步 ${ok} 个目录。重启 dsh 后生效。`)
