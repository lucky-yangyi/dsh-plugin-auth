// WorkBuddy SkillHub 适配器：把 WorkBuddy「专家中心」公开目录（Expert Center）
// 转成 dsh 技能市场能消费的格式，并支持按需打包安装。
//
// 数据来源（公开、无需鉴权）：
//   https://acc-1258344699.cos.accelerate.myqcloud.com/workbuddy/expert-marketplace/expert_center.json
//   + 每个专家的 promptFile（如 /plugins/content-creator/agents/content-creator.md）同样公开可拉。
//
// 暴露的端点（与 dsh 插件契约一致）：
//   GET /index.json           完整目录 { skills:[...] }
//   GET /index.json?q=xxx     / GET /search?q=xxx   服务端搜索（name/desc/profession/tags，中英文）
//   GET /package/<slug>.tgz   把某专家 promptFile 包成 dsh 技能包（package/SKILL.md）并返回
//   GET /health
//
// 说明：这是「专家中心」公开快照（真实 WorkBuddy 市场数据），不是需鉴权的可安装 SkillHub
// （api.skillhub.cn，需账号 token + 签名 URL）。若要对接后者，给 token 后在此适配器加一路鉴权转发即可。
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.HUB_PORT ?? 8099)
const COS_BASE = 'https://acc-1258344699.cos.accelerate.myqcloud.com/workbuddy/expert-marketplace'
const CATALOG_URL = `${COS_BASE}/expert_center.json`

const MIME = { '.json': 'application/json; charset=utf-8', '.tgz': 'application/octet-stream', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png' }

let CATALOG = { skills: [] }
const PKG_CACHE = new Map() // slug -> tarball Buffer

function slugify(id) {
  let s = String(id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9]/.test(s)) s = 'x-' + s
  return s.slice(0, 63)
}

function verFromDate(d) {
  // 2026-06-04 → 1.6.4（合法 semver，编码更新时间）
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '')
  if (!m) return '1.0.0'
  return `1.${Number(m[2])}.${Number(m[3])}`
}

function pick(o, lang = 'zh') {
  if (o == null) return ''
  if (typeof o === 'string') return o
  return o[lang] || o.en || o.zh || ''
}

async function loadCatalog() {
  try {
    const r = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(20000) })
    if (!r.ok) throw new Error('catalog HTTP ' + r.status)
    const data = await r.json()
    const experts = Array.isArray(data.experts) ? data.experts : []
    const seen = new Map()
    const skills = []
    for (const e of experts) {
      if (!e || !e.id || !e.promptFile) continue
      let slug = slugify(e.id)
      if (seen.has(slug)) slug = slug + '-' + seen.get(slug)++
      else seen.set(slug, 1)
      skills.push({
        slug,
        name: slug,
        version: verFromDate(e.updatedAt),
        description: pick(e.description) || pick(e.profession),
        author: 'WorkBuddy Expert Center',
        namespace: 'skillhub',
        icon: e.avatar ? (e.avatar.startsWith('http') ? e.avatar : COS_BASE + e.avatar) : '🧠',
        installs: 0,
        tarball: `http://127.0.0.1:${PORT}/package/${slug}.tgz`,
        promptFile: e.promptFile,
        profession: pick(e.profession),
        tags: (e.tags || []).map((t) => pick(t)).filter(Boolean),
      })
    }
    CATALOG = { skills }
    console.log(`[skillhub-adapter] loaded ${skills.length} experts from Expert Center`)
  } catch (err) {
    console.warn('[skillhub-adapter] catalog load failed:', String(err))
  }
}

function filterSkills(q) {
  const needle = String(q || '').trim().toLowerCase()
  if (!needle) return CATALOG.skills
  return CATALOG.skills.filter((s) =>
    [s.name, s.slug, s.description, s.profession, (s.tags || []).join(' '), s.author, s.namespace]
      .filter(Boolean).some((f) => String(f).toLowerCase().includes(needle)),
  )
}

async function buildPackage(skill) {
  if (PKG_CACHE.has(skill.slug)) return PKG_CACHE.get(skill.slug)
  let body = ''
  try {
    const pu = skill.promptFile.startsWith('http') ? skill.promptFile : COS_BASE + skill.promptFile
    const pr = await fetch(pu, { signal: AbortSignal.timeout(20000) })
    if (pr.ok) body = await pr.text()
  } catch (e) { /* 忽略，用兜底描述 */ }
  const md =
`---
name: ${skill.name}
description: ${skill.description || skill.profession || 'WorkBuddy 专家'}
version: ${skill.version}
author: ${skill.author}
namespace: ${skill.namespace}
license: CC-BY
---

# ${skill.profession || skill.name}（来自 WorkBuddy 专家中心）

${skill.description || ''}

## 原始提示词（Expert Center 快照）
${body || '(promptFile 拉取失败)'}
`
  const tmp = join('/tmp', `skillhub-pkg-${skill.slug}.tgz`)
  const dir = `/tmp/skillhub-pkg-${skill.slug}`
  execFileSync('mkdir', ['-p', join(dir, 'package')], { stdio: 'inherit' })
  execFileSync('sh', ['-c', `printf '%s' ${JSON.stringify(md)} > ${join(dir, 'package', 'SKILL.md')}`], { stdio: 'inherit' })
  execFileSync('tar', ['-czf', tmp, '-C', dir, 'package'], { stdio: 'inherit' })
  const { readFileSync } = await import('node:fs')
  const buf = readFileSync(tmp)
  PKG_CACHE.set(skill.slug, buf)
  return buf
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    const params = new URL(req.url || '/', 'http://localhost').searchParams
    const q = params.get('q')

    if (urlPath === '/health') { res.writeHead(200, { 'content-type': MIME['.json'] }); res.end(JSON.stringify({ ok: true, skills: CATALOG.skills.length })); return }

    if (urlPath === '/index.json' || urlPath === '/search' || urlPath === '/') {
      const skills = filterSkills(q)
      const out = JSON.stringify({ skills })
      res.writeHead(200, { 'content-type': MIME['.json'], 'content-length': Buffer.byteLength(out) })
      res.end(out); return
    }

    const pkgMatch = /^\/package\/([a-z0-9][a-z0-9-_.]{0,63})\.tgz$/.exec(urlPath)
    if (pkgMatch) {
      const slug = pkgMatch[1]
      const skill = CATALOG.skills.find((s) => s.slug === slug)
      if (!skill) { res.writeHead(404); res.end('not found'); return }
      const buf = await buildPackage(skill)
      res.writeHead(200, { 'content-type': MIME['.tgz'], 'content-length': buf.byteLength })
      res.end(buf); return
    }

    res.writeHead(404); res.end('not found')
  } catch (err) {
    res.writeHead(500); res.end('server error: ' + String(err))
  }
})

await loadCatalog()
server.listen(PORT, '127.0.0.1', () => console.log(`[skillhub-adapter] API listening on http://127.0.0.1:${PORT}`))
// 每 10 分钟刷新一次目录快照
setInterval(loadCatalog, 10 * 60 * 1000)
