// 本地演示「技能市场 API」：把 sample-hub/dist 暴露为市场后端。
//   GET /index.json          完整目录 { skills:[...] }
//   GET /index.json?q=xxx    服务端按 name/slug/description/author/namespace 过滤（子串，忽略大小写）
//   GET /search?q=xxx        同上（别名）
//   GET /<slug>-<ver>.tgz    技能包下载
//   GET /health             { ok:true }
// 仅供本地验证 dsh 技能市场「对接 API + 服务端搜索」闭环；生产请替换为真实目录后端。
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = join(__dirname, 'dist')
const PORT = Number(process.env.HUB_PORT ?? 8099)

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.tgz': 'application/octet-stream',
  '.md': 'text/markdown; charset=utf-8',
}

// 启动时读入目录（由 build.mjs 预生成 dist/index.json + dist/*.tgz）
let CATALOG = { skills: [] }
try {
  CATALOG = JSON.parse(readFileSync(join(dist, 'index.json'), 'utf8'))
  console.log(`[sample-hub] loaded ${CATALOG.skills?.length ?? 0} skills from dist/index.json`)
} catch (e) {
  console.warn('[sample-hub] dist/index.json missing — run `node build.mjs` first:', String(e))
}

function filterSkills(q) {
  const needle = String(q || '').trim().toLowerCase()
  if (!needle) return CATALOG.skills
  return CATALOG.skills.filter((s) =>
    [s.name, s.slug, s.description, s.author, s.namespace]
      .filter(Boolean)
      .some((f) => String(f).toLowerCase().includes(needle)),
  )
}

const server = createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    const params = new URL(req.url || '/', 'http://localhost').searchParams
    const q = params.get('q')

    // API 路由
    if (urlPath === '/index.json' || urlPath === '/search' || urlPath === '/') {
      const skills = filterSkills(q)
      const body = JSON.stringify({ skills })
      res.writeHead(200, { 'content-type': MIME['.json'], 'content-length': Buffer.byteLength(body) })
      res.end(body)
      return
    }
    if (urlPath === '/health') {
      res.writeHead(200, { 'content-type': MIME['.json'] })
      res.end(JSON.stringify({ ok: true, skills: CATALOG.skills.length }))
      return
    }

    // 静态资源（tarball 等）
    let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
    if (rel === '/' || rel === '\\' || rel === '') rel = 'index.json'
    const file = join(dist, rel)
    if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    const buf = readFileSync(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'content-length': buf.byteLength })
    res.end(buf)
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('server error: ' + String(err))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[sample-hub] API listening on http://127.0.0.1:${PORT}`)
})
