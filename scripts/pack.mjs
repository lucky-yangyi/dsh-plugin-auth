#!/usr/bin/env node
// 打 tgz 包（本机 npm pack 在 arborist 下报 "Cannot read properties of null (reading 'package')"，手搓替代）。
// 产物：<name>-<version>.tgz，结构为 package/{lib,package.json,cordis.patch.yml,schema.sql,README.md}
//
// 用法: npm run pack:tgz
import {
  existsSync, mkdirSync, mkdtempSync, rmSync, readFileSync, statSync, cpSync, readdirSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const here = process.cwd()
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))
const tgz = `${pkg.name.replace(/^@/, '').replace(/\//, '-')}-${pkg.version}.tgz`

if (!existsSync(join(here, 'lib', 'index.js'))) {
  console.error('[pack] 找不到 lib/index.js，请先 npm run build')
  process.exit(1)
}

// 跨平台 tar 解析：Windows 优先用系统自带的 tar.exe（bsdtar，不会把路径里的
// 盘符 `C:` 当作远程主机）；找不到再退到 PATH 里的 tar（在 Windows 上可能是 Git
// Bash 的 GNU tar，需要用 --force-local 才能处理带盘符的输出路径）。
const SYSTEM32_TAR = 'C:\\Windows\\System32\\tar.exe'
function resolveTar() {
  const candidates = []
  if (process.platform === 'win32') candidates.push(SYSTEM32_TAR)
  candidates.push('tar')
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore' })
      return bin
    } catch { /* 该候选不可用，试下一个 */ }
  }
  return 'tar'
}
const tar = resolveTar()
// GNU tar（Git Bash 那个）看到 `-f C:\...` 会把 `C:` 当成远程主机；本机 tar 之外
// 才需要 --force-local 关掉这个语义。系统自带 bsdtar 不需要也不接受该选项。
const tarForceLocal = process.platform === 'win32' && tar !== SYSTEM32_TAR


// 打包内容先用 Node 的 cpSync 物化到一个临时目录（避免依赖系统 cp / cp -R，
// Windows 上没有 cp，且 Windows 下 /tmp 含义也不稳定）。
const stage = mkdtempSync(join(tmpdir(), 'dsh-plugin-pack-'))
const pkgDir = join(stage, 'package')
rmSync(pkgDir, { recursive: true, force: true })
mkdirSync(pkgDir, { recursive: true })

const include = ['lib', 'package.json', 'cordis.patch.yml', 'schema.sql', 'README.md']
for (const f of include) {
  const src = join(here, f)
  if (!existsSync(src)) { console.warn(`[pack] 跳过缺失项 ${f}`); continue }
  cpSync(src, join(pkgDir, f), { recursive: true })
}

// 清掉不该进包的产物：递归删掉 *.tsbuildinfo 和 .DS_Store（跨平台用 Node 而非 glob）。
function prune(node) {
  let st
  try { st = statSync(node) } catch { return }
  if (st.isDirectory()) {
    for (const c of readdirSync(node)) prune(join(node, c))
    return
  }
  if (node.endsWith('.tsbuildinfo') || node.endsWith('.DS_Store')) {
    rmSync(node, { force: true })
  }
}
prune(join(pkgDir, 'lib'))

rmSync(join(here, tgz), { force: true })
const createArgs = []
if (tarForceLocal) createArgs.push('--force-local')
createArgs.push('-czf', join(here, tgz), '-C', stage, 'package')
execFileSync(tar, createArgs, { stdio: 'ignore' })

console.log(`[pack] ✅ ${tgz}  ${statSync(join(here, tgz)).size} bytes`)
console.log('[pack] 内容:')
const listArgs = []
if (tarForceLocal) listArgs.push('--force-local')
console.log(execFileSync(tar, [...listArgs, '-tzf', join(here, tgz)], { encoding: 'utf8' })
  .trim().split('\n').map((l) => '  ' + l).join('\n'))

rmSync(stage, { recursive: true, force: true })
