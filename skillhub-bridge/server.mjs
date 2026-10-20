// SkillHub 云目录桥：把官方 SkillHub 云 API（api.skillhub.cn）实时代理成 dsh 技能市场
// 能直接消费的格式（{skills:[...]} + 可下载 .tgz + 服务端搜索）。
//
// 为什么需要这层桥：
//   - SkillHub 官方支持 DeepSeek Harness，公开 API 底座 https://api.skillhub.cn：
//       * GET  /api/v1/search?q=<kw>&limit=N      —— 搜索云目录
//       * GET  /api/v1/showcase/hot               —— 热榜（默认目录）
//       * GET  /api/v1/download?slug=&namespace=  —— 下载技能包（zip）
//   - 但 dsh 市场安装要求 .tgz（含 SKILL.md）；官方下发的是 zip。本桥负责：
//     下载 zip → 解包 → 递归定位 SKILL.md → 清洗 frontmatter（去重复键）
//     → 重新打成 tgz 下发。dsh 插件零改动（仍消费本桥的 index.json）。
//
// 部署要点（Linux 服务器同理）：
//   - 依赖：curl 或 wget（下载）、unzip/bsdtar/tar/python 之一（解包）、tar（打包）。
//     缺失时启动会打印告警，安装时才会真正失败，方便提前发现。
//     Windows 10 1803+ 自带 curl.exe 与 tar.exe（bsdtar，能直接解 zip），所以无需额外装任何东西。
//   - 本机访问用 127.0.0.1 即可；若 dsh web 在别的机器/容器，用 HUB_HOST=0.0.0.0 并把
//     插件的 hub.indexUrl 指到本桥的对外地址。
//
// 用法：node skillhub-bridge/server.mjs
//   HUB_PORT=8099  HUB_HOST=127.0.0.1  SKILLHUB_API=https://api.skillhub.cn
import { createServer } from 'node:http'
import {
  existsSync, readFileSync, readdirSync, statSync,
  mkdtempSync, rmSync, writeFileSync, mkdirSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const PORT = Number(process.env.HUB_PORT ?? 8099)
const HOST = process.env.HUB_HOST || '127.0.0.1'
const API = (process.env.SKILLHUB_API || 'https://api.skillhub.cn').replace(/\/$/, '')
const HUB_SLUG = /^[a-z0-9][a-z0-9-_.]{0,63}$/
const DEFAULT_LIMIT = Number(process.env.HUB_DEFAULT_LIMIT ?? 60)

// ---------------------------------------------------------------- 依赖探测
// 注意：不能用 `sh -c 'command -v ...'` 探测——Windows 没有 sh，execFileSync 直接 ENOENT，
// 会把 curl/tar/python 全部误判成缺失（真机踩过：PowerShell 里六项全 =n，告警刷屏）。
// 按平台选探测方式：Windows 用 where.exe，其余用 POSIX sh。
function hasBin(bin) {
  try {
    if (process.platform === 'win32') {
      execFileSync('where', [bin], { stdio: 'ignore' })
    } else {
      execFileSync('sh', ['-c', `command -v ${bin} >/dev/null 2>&1`])
    }
    return true
  } catch {
    return false
  }
}
const BIN = {
  curl: hasBin('curl'),
  wget: hasBin('wget'),
  unzip: hasBin('unzip'),
  bsdtar: hasBin('bsdtar'),
  // Windows 上 python 解释器通常叫 python.exe，没有 python3 这个名字
  python3: hasBin('python3'),
  python: hasBin('python'),
  tar: hasBin('tar'),
}
const PY = BIN.python3 ? 'python3' : BIN.python ? 'python' : ''
// Windows 10 1803+ / macOS 的 tar 就是 bsdtar，本身能读 zip，所以 tar 也算解包器
if (!BIN.curl && !BIN.wget) console.warn('[skillhub-bridge] WARNING: neither curl nor wget found — 下载会失败')
if (!BIN.unzip && !BIN.bsdtar && !PY && !BIN.tar) console.warn('[skillhub-bridge] WARNING: no zip extractor (unzip/bsdtar/tar/python) — 解包会失败')
if (!BIN.tar) console.warn('[skillhub-bridge] WARNING: tar not found — 无法重新打包 tgz')

// ---------------------------------------------------------------- 网络与解包
function httpJson(url) {
  return JSON.parse(httpDownloadToString(url))
}
function httpDownloadToString(url) {
  if (BIN.curl) return execFileSync('curl', ['-fsSL', '--max-time', '20', url], { encoding: 'utf8', maxBuffer: 16 << 20 })
  if (BIN.wget) return execFileSync('wget', ['-q', '-O', '-', '--timeout=20', url], { encoding: 'utf8', maxBuffer: 16 << 20 })
  throw new Error('no http client (curl/wget)')
}
function httpDownloadToFile(url, outPath) {
  if (BIN.curl) {
    execFileSync('curl', ['-fsSL', '--max-time', '60', url, '-o', outPath], { maxBuffer: 16 << 20 })
    return
  }
  if (BIN.wget) {
    execFileSync('wget', ['-q', '-O', outPath, '--timeout=60', url], { maxBuffer: 16 << 20 })
    return
  }
  throw new Error('no http client (curl/wget)')
}
function unzipTo(zipPath, outDir) {
  const attempts = []
  if (BIN.unzip) attempts.push(['unzip', ['-q', '-o', zipPath, '-d', outDir]])
  if (BIN.bsdtar) attempts.push(['bsdtar', ['-xf', zipPath, '-C', outDir]])
  // Win10+/macOS 的 tar 即 bsdtar，能直接解 zip（GNU tar 不行，失败会自动落到下一个候选）
  if (BIN.tar) attempts.push(['tar', ['-xf', zipPath, '-C', outDir]])
  if (PY) attempts.push([PY, ['-c', 'import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zipPath, outDir]])
  let last
  for (const [bin, args] of attempts) {
    try { execFileSync(bin, args, { maxBuffer: 16 << 20, stdio: 'ignore' }); return } catch (e) { last = e }
  }
  throw new Error(`no usable zip extractor: ${last?.message ?? 'none installed'}`)
}

// ---------------------------------------------------------------- 映射与清洗
function baseUrl() {
  return `http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`
}
function mapEntry(r) {
  const ns = r.namespace || {}
  const slug = ns.publicSlug || r.publicSlug || r.slug || r.name || ''
  if (!HUB_SLUG.test(slug)) return null
  const handle = ns.handle || r.owner_name || ns.displayName || ''
  const nsParam = handle ? `?ns=${encodeURIComponent(handle)}` : ''
  return {
    slug,
    name: r.displayName || r.name || slug,
    version: r.version || '0.0.0',
    description: r.description || r.description_zh || '',
    author: handle || 'skillhub',
    namespace: handle,
    icon: r.icon_url || '',
    installs: Number(r.downloads ?? r.installs ?? 0) || 0,
    // 命名空间靠 tarball 的 ?ns= 传递：dsh 插件 fetch(entry.tarball) 会原样带查询串
    tarball: `${baseUrl()}/pkg/${encodeURIComponent(slug)}.tgz${nsParam}`,
    sha256: '',
    _ns: handle,
  }
}

// dsh 用严格 YAML 解析，frontmatter 重复键会直接 throw 导致技能被静默忽略（真实例：
// multi-search-engine 的 homepage 写了两行）。这里去掉重复的顶层键，保留首个。
function sanitizeSkillMd(raw) {
  const lines = raw.split('\n')
  if (lines[0].trim() !== '---') return raw
  const out = [lines[0]]
  const seen = new Set()
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '---') {
      out.push(line)
      out.push(...lines.slice(i + 1))
      return out.join('\n')
    }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):/)
    if (m) {
      if (seen.has(m[1])) continue
      seen.add(m[1])
    }
    out.push(line)
  }
  return raw
}

// 递归定位 SKILL.md，返回其父目录（有些包 SKILL.md 在子目录里）
function locateSkillDir(root) {
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    let names = []
    try { names = readdirSync(dir) } catch { continue }
    for (const name of names) {
      if (name === 'SKILL.md') return dir
      const p = join(dir, name)
      try { if (statSync(p).isDirectory()) stack.push(p) } catch { /* 跳过不可读项 */ }
    }
  }
  return root
}

// ---------------------------------------------------------------- 打包缓存
const pkgCache = new Map() // `${ns}/${slug}` -> { buf } | { err, at }
const FAIL_TTL = 2 * 60 * 1000 // 上游缺包时短期记住，避免反复打官方接口
function getPackage(slug, ns) {
  const key = `${ns}/${slug}`
  const hit = pkgCache.get(key)
  if (hit) {
    if (hit.err && Date.now() - hit.at < FAIL_TTL) throw hit.err
    if (hit.buf) return hit
  }
  const tmp = mkdtempSync(join(tmpdir(), 'dsh-cloud-'))
  try {
    const zipPath = join(tmp, 'pkg.zip')
    try {
      httpDownloadToFile(`${API}/api/v1/download?slug=${encodeURIComponent(slug)}&namespace=${encodeURIComponent(ns)}`, zipPath)
    } catch (e) {
      // curl -f 的报错形如 `curl: (22) The requested URL returned error: 404`；
      // 直接抛原始信息对用户没意义，翻译成「上游缺包」。
      const status = /returned error:\s*(\d{3})/.exec(String(e?.stderr ?? e?.message ?? ''))
      const code = status ? status[1] : '不可达'
      const err = new Error(`SkillHub 上游无法提供 ${ns}/${slug}（${code}）：该技能包在官方源不存在或已下架`)
      pkgCache.set(key, { err, at: Date.now() })
      throw err
    }
    const ex = join(tmp, 'ex')
    mkdirSync(ex, { recursive: true })
    unzipTo(zipPath, ex)
    const skillDir = locateSkillDir(ex)
    const skillMdPath = join(skillDir, 'SKILL.md')
    if (!existsSync(skillMdPath)) throw new Error('package contains no SKILL.md')
    writeFileSync(skillMdPath, sanitizeSkillMd(readFileSync(skillMdPath, 'utf8')))
    const buf = execFileSync('tar', ['-czf', '-', '-C', skillDir, '.'], { maxBuffer: 64 << 20 })
    const entry = { buf }
    pkgCache.set(key, entry)
    return entry
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------- 目录缓存
// dsh 插件的 install 会重新 GET /index.json 并按 slug 找 entry，所以默认目录必须是
// 「热榜 + 所有搜过的结果」的并集，否则搜到的技能点安装会 404。
const entryCache = new Map()
let hotCache = { at: 0, list: [] }

function defaultEntries() {
  if (Date.now() - hotCache.at < 5 * 60 * 1000) return hotCache.list
  const body = httpJson(`${API}/api/v1/showcase/hot`)
  const list = (Array.isArray(body.skills) ? body.skills : []).map(mapEntry).filter(Boolean).slice(0, DEFAULT_LIMIT)
  hotCache = { at: Date.now(), list }
  for (const e of list) entryCache.set(e.slug, e)
  return list
}
function searchEntries(q) {
  const body = httpJson(`${API}/api/v1/search?q=${encodeURIComponent(q)}&limit=20`)
  const list = (Array.isArray(body.results) ? body.results : []).map(mapEntry).filter(Boolean)
  for (const e of list) entryCache.set(e.slug, e)
  return list
}
function mergedCatalog() {
  defaultEntries()
  const merged = new Map()
  for (const e of hotCache.list) merged.set(e.slug, e)
  for (const [slug, e] of entryCache) merged.set(slug, e)
  return [...merged.values()].sort((a, b) => b.installs - a.installs)
}
const stripInternal = (list) => list.map(({ _ns, ...rest }) => rest)

function sendJson(res, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
  })
  res.end(body)
}

const server = createServer((req, res) => {
  try {
    const u = new URL(req.url || '/', baseUrl())
    const urlPath = decodeURIComponent(u.pathname)
    const q = u.searchParams.get('q')
    const ns = u.searchParams.get('ns')

    if (urlPath === '/index.json' || urlPath === '/') {
      if (q && q.trim()) return sendJson(res, { skills: stripInternal(searchEntries(q.trim())) })
      return sendJson(res, { skills: stripInternal(mergedCatalog()) })
    }
    if (urlPath === '/search') return sendJson(res, { skills: stripInternal(searchEntries(q || '')) })

    if (urlPath.startsWith('/pkg/')) {
      const slug = decodeURIComponent(urlPath.slice('/pkg/'.length).replace(/\.tgz$/i, ''))
      if (!HUB_SLUG.test(slug)) { res.writeHead(400); res.end('bad_slug'); return }
      const entry = entryCache.get(slug)
      const ns2 = ns || entry?._ns || ''
      if (!ns2) { res.writeHead(400); res.end('missing namespace'); return }
      const tb = getPackage(slug, ns2)
      res.writeHead(200, {
        'content-type': 'application/gzip',
        'content-length': tb.buf.byteLength,
        'access-control-allow-origin': '*',
      })
      res.end(tb.buf)
      return
    }

    if (urlPath === '/health') {
      return sendJson(res, { ok: true, skills: mergedCatalog().length, cache: entryCache.size, api: API, deps: BIN })
    }

    res.writeHead(404); res.end('not found')
  } catch (err) {
    res.writeHead(502); res.end('bridge error: ' + String(err))
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[skillhub-bridge] SkillHub cloud proxy on http://${HOST}:${PORT} -> ${API}`)
  console.log(`[skillhub-bridge] deps: ${Object.entries(BIN).map(([k, v]) => `${k}=${v ? 'y' : 'n'}`).join(' ')}`)
})
