// 本地演示市场构建：扫描 seed/<slug>/package/SKILL.md，逐个打包成 npm 风格的
// .tgz（顶层 package/），计算 sha256，并汇总写出 dist/index.json（顶层 {skills:[...]}）。
// 纯本地资产，供 dsh 技能市场读取与安装。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = join(__dirname, 'dist')
const seed = join(__dirname, 'seed')
mkdirSync(dist, { recursive: true })

const baseUrl = process.env.HUB_BASE_URL ?? 'http://127.0.0.1:8099'

/** 解析 SKILL.md 的 YAML frontmatter（仅取我们需要的字段）。 */
function parseFrontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out = {}
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (mm) out[mm[1]] = mm[2].trim()
  }
  return out
}

const skills = []
for (const slug of readdirSync(seed)) {
  const pkgDir = join(seed, slug, 'package')
  const skillMd = join(pkgDir, 'SKILL.md')
  if (!existsSync(skillMd)) continue
  const fm = parseFrontmatter(readFileSync(skillMd, 'utf8'))
  const version = fm.version ?? '0.0.1'
  const tarballName = `${slug}-${version}.tgz`
  const tarballPath = join(dist, tarballName)
  // 以 seed/<slug> 为根，只收 package/ → 顶层即 package/SKILL.md（npm 惯例，安装代码据此定位）
  execFileSync('tar', ['-czf', tarballPath, '-C', join(seed, slug), 'package'], { stdio: 'inherit' })
  const sha = execFileSync('shasum', ['-a', '256', tarballPath], { encoding: 'utf8' })
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()

  skills.push({
    slug,
    name: fm.name ?? slug,
    version,
    description: fm.description ?? '',
    author: fm.author ?? 'demo-hub',
    namespace: fm.namespace ?? 'demo',
    icon: fm.icon ?? '📦',
    installs: Number(fm.installs ?? 0) || Math.floor(Math.random() * 500) + 20,
    tarball: `${baseUrl}/${tarballName}`,
    sha256: sha,
  })
}

skills.sort((a, b) => a.name.localeCompare(b.name))
const indexPath = join(dist, 'index.json')
writeFileSync(indexPath, JSON.stringify({ skills }, undefined, 2) + '\n')
console.log(`wrote ${indexPath} with ${skills.length} skills:`)
for (const s of skills) console.log(`  - ${s.slug}@${s.version} (${s.tarball}, sha256 ${s.sha256.slice(0, 12)}…)`)
