#!/usr/bin/env node
// 打 tgz 包（本机 npm pack 在 arborist 下报 "Cannot read properties of null (reading 'package')"，手搓替代）。
// 产物：<name>-<version>.tgz，结构为 package/{lib,package.json,cordis.patch.yml,schema.sql,README.md}
//
// 用法: npm run pack:tgz
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const here = process.cwd()
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))
const tgz = `${pkg.name.replace(/^@/, '').replace(/\//, '-')}-${pkg.version}.tgz`

if (!existsSync(join(here, 'lib', 'index.js'))) {
  console.error('[pack] 找不到 lib/index.js，请先 npm run build')
  process.exit(1)
}

const stage = '/tmp/dsh-plugin-pack'
rmSync(stage, { recursive: true, force: true })
mkdirSync(join(stage, 'package'), { recursive: true })

const include = ['lib', 'package.json', 'cordis.patch.yml', 'schema.sql', 'README.md']
for (const f of include) {
  if (!existsSync(join(here, f))) { console.warn(`[pack] 跳过缺失项 ${f}`); continue }
  execFileSync('cp', ['-R', join(here, f), join(stage, 'package', f)])
}
rmSync(join(stage, 'package', 'lib', '*.tsbuildinfo'), { force: true })
rmSync(join(stage, 'package', 'lib', '.DS_Store'), { force: true })   // 别把 Finder 垃圾打进包

rmSync(join(here, tgz), { force: true })
execFileSync('tar', ['-czf', join(here, tgz), '-C', stage, 'package'])

const { statSync } = await import('node:fs')
console.log(`[pack] ✅ ${tgz}  ${statSync(join(here, tgz)).size} bytes`)
console.log('[pack] 内容:')
console.log(execFileSync('tar', ['-tzf', join(here, tgz)]).toString().trim().split('\n').map((l) => '  ' + l).join('\n'))
