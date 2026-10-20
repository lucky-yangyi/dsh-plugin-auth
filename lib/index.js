/**
 * dsh-plugin-auth — deepseek-harness 多用户注册登录 + 会话隔离插件。
 *
 * 设计要点（零 harness 源码修改）：
 * - 自有路由挂在 /app/* 下，不经过官方 /api 的 requestRejection 闸门
 *   （webserver 路由表 exact 优先，/app 与 /api 是不同条目）。
 * - 进程内直接调用官方 ctx.sessionController 的 list/create/inspect/prompt，
 *   所有返回数据前先做 user_id 过滤 / 归属校验。
 * - 用户与归属关系存 MySQL；会话正文仍由官方 JSONL 持久化，格式不动。
 * - 用户拿不到官方 ?token= 令牌，官方 /api 与官方 Web UI 对其天然 401。
 *
 * 类型说明：刻意不 import harness 包的类型（它们是 pre-stable API），
 * 仅声明本插件用到的最小结构。运行时对象是官方服务的真实实例；
 * 若上游方法签名变化，升级后跑一次 `tsc` 即可在本文件暴露。
 */
import { createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { accessSync, copyFileSync, cpSync, createReadStream, createWriteStream, existsSync, constants, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, } from 'node:fs';
import { basename, delimiter, dirname, extname, join, resolve, sep } from 'node:path';
import * as os from 'node:os';
import { promisify } from 'node:util';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import mysql from 'mysql2/promise';
import { UI_HTML } from './ui.js';
// ---------------------------------------------------------------------------
// 会话目录路径编码（与 @deepseek-ai/dsh-session-persistence-jsonl 的
// packages/session/session-persistence-jsonl/src/format.ts 完全一致，
// 用于删除时定位并清理磁盘上的会话 JSONL。仅做“尽力为之”的本地清理，
// 路径算错或被占用都不会影响软删除（归属行已删、会话已不可见/不可访问）。
// ---------------------------------------------------------------------------
/** 单段路径安全编码（与 format.ts encodeSegment 同算法）。 */
function encodeSegment(raw) {
    if (raw.length === 0)
        throw new Error('cannot encode an empty path segment');
    if (raw === '.')
        return '~002E';
    if (raw === '..')
        return '~002E~002E';
    let out = '';
    for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        const ch = String.fromCharCode(code);
        if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch))
            out += ch;
        else
            out += '~' + code.toString(16).toUpperCase().padStart(4, '0');
    }
    return out;
}
/** 可读的项目目录名（与 format.ts projectKey 同算法）。 */
function projectKey(cwd) {
    if (cwd === undefined)
        return '_no-cwd';
    if (cwd.length === 0)
        throw new Error('cannot encode an empty project path');
    let readable = '';
    let separatorRun = false;
    for (let i = 0; i < cwd.length; i++) {
        const code = cwd.charCodeAt(i);
        const ch = String.fromCharCode(code);
        if (ch === '/' || ch === '\\' || ch === ':') {
            if (!separatorRun)
                readable += '-';
            separatorRun = true;
        }
        else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
            readable += ch;
            separatorRun = false;
        }
        else {
            readable += '~' + code.toString(16).toUpperCase().padStart(4, '0');
            separatorRun = false;
        }
    }
    const slug = readable.replace(/^-+/, '') || 'root';
    return `--${slug.slice(0, 251)}--`;
}
/** 市场包安装后目录名的后缀（与 SkillHub 的 <slug>__skillhub 同思路）。 */
const HUB_DIR_SUFFIX = '__hub';
/** 市场元数据文件名。 */
const HUB_META_FILE = '_hub_meta.json';
/** slug 白名单：只允许小写字母数字与 - _ .，避免路径穿越与奇怪目录名。 */
const HUB_SLUG_PATTERN = /^[a-z0-9][a-z0-9-_.]{0,63}$/;
/** 用户级技能根目录（全局共享层：手工放置的技能对所有 dsh 用户可见）。 */
function skillRoot() {
    const home = process.env.DSH_HOME ?? join(os.homedir(), '.dsh');
    return join(home, 'skills');
}
/**
 * 每用户技能根：<dshHome>/workspaces/u<uid>/.dsh/skills。
 * harness 的 FileSystemSkillProvider 会从会话 cwd 向上找 projectRoot（只认 .git 标记，
 * 见 packages/skill/skill-filesystem findProjectRoot），并把 <projectRoot>/.dsh/skills
 * 作为 project-dsh 技能根。用户工作区根放上 .git 标记后，projectRoot 恒停在 u<uid>，
 * 于是该目录成为**此用户专属**的技能层 —— 市场安装按登录用户隔离，
 * 其他用户的目录永远不会被选为 projectRoot（向上查找在各自的 u<uid> 就停了）。
 */
function userSkillRoot(userId) {
    const home = process.env.DSH_HOME ?? join(os.homedir(), '.dsh');
    return join(home, 'workspaces', `u${userId}`, '.dsh', 'skills');
}
/**
 * 幂等地确保该用户的「项目根标记 + 技能目录」存在，返回技能根路径。
 * .git 是一个**空目录**：findProjectRoot 只做 pathExists 检查；空目录里没有
 * HEAD/objects，git 命令依旧视其为非仓库，不影响任何 git 相关行为。
 * 必须在会话创建 / 技能枚举 / 市场安装之前调用，保证发现时机不漏。
 */
function ensureUserSkillRoot(userId) {
    const home = process.env.DSH_HOME ?? join(os.homedir(), '.dsh');
    const userWs = join(home, 'workspaces', `u${userId}`);
    const root = join(userWs, '.dsh', 'skills');
    mkdirSync(root, { recursive: true });
    const marker = join(userWs, '.git');
    if (!existsSync(marker)) {
        mkdirSync(marker, { recursive: true });
        console.log(`[dsh-plugin-auth] per-user skill layer enabled for u${userId} -> ${root}`);
    }
    return root;
}
/** 读一个已安装技能目录的市场元数据；不存在或坏 JSON 返回 undefined。 */
function readHubMeta(dir) {
    const p = join(dir, HUB_META_FILE);
    if (!existsSync(p))
        return undefined;
    try {
        const parsed = JSON.parse(readFileSync(p, 'utf8'));
        if (typeof parsed.slug !== 'string' || parsed.slug.length === 0)
            return undefined;
        return {
            slug: parsed.slug,
            ...(parsed.name === undefined ? {} : { name: String(parsed.name) }),
            ...(parsed.version === undefined ? {} : { version: String(parsed.version) }),
            ...(parsed.namespace === undefined ? {} : { namespace: String(parsed.namespace) }),
            ...(parsed.author === undefined ? {} : { author: String(parsed.author) }),
            ...(parsed.icon === undefined ? {} : { icon: String(parsed.icon) }),
            ...(parsed.installs === undefined ? {} : { installs: Number(parsed.installs) }),
            installedAt: Number(parsed.installedAt ?? 0),
            source: 'hub',
        };
    }
    catch {
        return undefined;
    }
}
/** 语义化版本比较：a > b 返回正数。非数字段按字符串比，解析失败按 0 处理。 */
function compareVersion(a, b) {
    const pa = String(a ?? '').split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s));
    const pb = String(b ?? '').split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s));
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const x = pa[i] ?? 0;
        const y = pb[i] ?? 0;
        if (x === y)
            continue;
        return typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : 1;
    }
    return 0;
}
// ---------------------------------------------------------------------------
// ZIP 解压（移动端目录上传：手机把文件夹压成 ZIP 上传，服务端还原目录树）
//
// 纯 Node 实现：EOCD + 中央目录解析 + inflateRawSync，零 npm 依赖。
// 安全约束：拒绝加密条目、拒绝 .. 路径穿越、单条 50MB、总量 200MB、最多 2000 条。
// 中文兼容：条目无 UTF-8 标志位（bit11）时优先按 GBK 解码（国内安卓工具压缩的常态），
// 解码出替换符（U+FFFD）再退回 latin1。
// ---------------------------------------------------------------------------
const ZIP_MAX_ENTRIES = 2000;
const ZIP_MAX_TOTAL = 209_715_200; // 200MB（解压后累计）
const ZIP_MAX_ENTRY = 52_428_800; // 50MB（单条解压后）
/** 从尾部反向扫描 EOCD（End of Central Directory），注释区最长 65535 字节。 */
function findZipEocd(buf) {
    const lo = Math.max(0, buf.length - 22 - 65535);
    for (let i = buf.length - 22; i >= lo; i--) {
        if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06)
            return i;
    }
    return -1;
}
/** 解析 zip 并返回清洗后的文件条目。目录项 / 系统垃圾 / 越界或损坏条目直接跳过。 */
function extractZipEntries(buf) {
    const eocd = findZipEocd(buf);
    if (eocd < 0)
        throw new Error('zip_eocd_not_found');
    const count = buf.readUInt16LE(eocd + 10);
    const cdSize = buf.readUInt32LE(eocd + 12);
    let ptr = buf.readUInt32LE(eocd + 16);
    if (ptr + cdSize > buf.length)
        throw new Error('zip_directory_truncated');
    const gbk = (() => { try {
        return new TextDecoder('gbk');
    }
    catch {
        return null;
    } })();
    const out = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
        if (ptr + 46 > buf.length)
            break;
        if (buf.readUInt32LE(ptr) !== 0x02014b50)
            break; // 中央目录签名
        const flags = buf.readUInt16LE(ptr + 8);
        const method = buf.readUInt16LE(ptr + 10);
        const csize = buf.readUInt32LE(ptr + 20);
        const usize = buf.readUInt32LE(ptr + 24);
        const nameLen = buf.readUInt16LE(ptr + 28);
        const extraLen = buf.readUInt16LE(ptr + 30);
        const commentLen = buf.readUInt16LE(ptr + 32);
        const lho = buf.readUInt32LE(ptr + 42);
        const nameBuf = buf.subarray(ptr + 46, ptr + 46 + nameLen);
        ptr += 46 + nameLen + extraLen + commentLen;
        if ((flags & 0x1) !== 0)
            continue; // 加密条目：跳过
        let name;
        if ((flags & 0x800) !== 0)
            name = nameBuf.toString('utf8');
        else if (gbk !== null) {
            name = gbk.decode(nameBuf);
            if (name.includes('￿'))
                name = nameBuf.toString('latin1');
        }
        else
            name = nameBuf.toString('latin1');
        // 清洗：反斜杠归一 → 去前导 / 与 ./ → 拒绝空段/. /.. → 跳过目录项与系统垃圾
        name = name.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^(\.\/)+/, '');
        if (name.length === 0 || name.endsWith('/'))
            continue;
        const segs = name.split('/');
        if (segs.some(s => s === '' || s === '.' || s === '..'))
            continue;
        if (segs[0] === '__MACOSX')
            continue;
        const leaf = segs[segs.length - 1];
        if (leaf === '.DS_Store' || leaf === 'Thumbs.db' || leaf.startsWith('._'))
            continue;
        if (out.length >= ZIP_MAX_ENTRIES)
            break;
        if (usize > ZIP_MAX_ENTRY || csize > ZIP_MAX_ENTRY)
            continue;
        if (total + usize > ZIP_MAX_TOTAL)
            break;
        // 数据区起点 = 本地头 30 字节 + 文件名 + extra；长度以中央目录为准（数据描述符场景本地头为 0）
        if (lho + 30 > buf.length)
            continue;
        if (buf.readUInt32LE(lho) !== 0x04034b50)
            continue;
        const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
        const raw = buf.subarray(start, start + csize);
        if (raw.length < csize)
            continue;
        let data;
        if (method === 0)
            data = Buffer.from(raw);
        else if (method === 8) {
            try {
                data = inflateRawSync(raw);
            }
            catch {
                continue;
            }
        }
        else
            continue;
        if (data.length !== usize)
            continue; // 与中央目录声明一致才收
        total += usize;
        out.push({ name, data });
    }
    return out;
}
// ---------------------------------------------------------------------------
// 文件预览/下载辅助（MIME 与 Content-Disposition）
// ---------------------------------------------------------------------------
const MIME = {
    pdf: 'application/pdf',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
    txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', log: 'text/plain; charset=utf-8',
    json: 'application/json', csv: 'text/csv; charset=utf-8', html: 'text/html; charset=utf-8',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
    zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg',
};
function mimeOf(name) {
    return MIME[extname(name).slice(1).toLowerCase()] ?? 'application/octet-stream';
}
function disposition(kind, name) {
    return kind + "; filename*=UTF-8''" + encodeURIComponent(name);
}
/**
 * 极简 YAML frontmatter 解析（只取技能需要的字段）。
 * 官方 provider 用完整 YAML 解析器；这里只做兜底，避免引入依赖。
 * 支持 key: value，value 可用引号包裹；布尔支持 true/false/yes/no/on/off/1/0。
 */
function parseSkillFrontmatter(raw) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!m)
        return undefined;
    const out = {};
    for (const line of m[1].split(/\r?\n/)) {
        const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
        if (!kv)
            continue;
        const key = kv[1].toLowerCase();
        let val = kv[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (key === 'name')
            out.name = val;
        else if (key === 'description')
            out.description = val;
        else if (key === 'whentouse')
            out.whenToUse = val;
        else if (key === 'user-invocable')
            out.userInvocable = /^(true|yes|on|1)$/i.test(val) ? true : /^(false|no|off|0)$/i.test(val) ? false : undefined;
    }
    if (out.name === undefined && out.description === undefined)
        return undefined;
    return out;
}
/** attachmentId 形如 sha256:<64 位小写十六进制>（dsh-attachment brand 约束）。 */
const AID_PATTERN = /^sha256:[a-f0-9]{64}$/;
/** 展示名（可能是「目录/子目录/文件」形式）必须是非空、非 `.`/`..` 的路径段。 */
function safeName(name) {
    if (typeof name !== 'string' || name.length === 0 || name.length > 400)
        return false;
    return name.split('/').every((s) => s.length > 0 && s !== '.' && s !== '..');
}
// ---------------------------------------------------------------------------
// Office 文档预览：LibreOffice 无头转 PDF
//
// 浏览器无法内嵌渲染 docx/xlsx/pptx，官方前端也只做下载。这里在服务端用
// LibreOffice headless 把文档转成 PDF，再复用已有的 PDF 预览通道。
// 关键点：
// - 转换结果按「源标识 + size + mtime」缓存在 $DSH_HOME/preview-cache，
//   同一文档反复预览只转换一次；附件（sha256 内容寻址）直接用 aid 做 key。
// - 所有转换串行执行（LibreOffice 并发会互抢 UserInstallation 锁且吃满 CPU）；
//   每次转换用独立临时 UserInstallation 目录彻底避锁。
// - 没装 LibreOffice 时返回 501，由前端降级为下载，不做静默失败。
// ---------------------------------------------------------------------------
/** 允许转 PDF 的输入扩展名（浏览器不能直接渲染的办公文档）。 */
const CONVERTIBLE = new Set([
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'odt', 'ods', 'odp', 'rtf',
]);
/** 是否是可以交给 LibreOffice 转 PDF 的文档。 */
function convertible(name) {
    return CONVERTIBLE.has(extname(name).slice(1).toLowerCase());
}
/**
 * PATH 里要试的可执行文件名。
 * Windows 的可执行文件带 .exe/.com 后缀，且 LibreOffice 安装时**不会**把
 * program 目录写进 PATH，所以只按 'soffice' 找必然落空。
 */
function sofficeBinNames() {
    return process.platform === 'win32'
        ? ['soffice.exe', 'soffice.com', 'libreoffice.exe']
        : ['soffice', 'libreoffice'];
}
/** Linux 发行版常见的 soffice 安装位置（也用于 macOS 的 Homebrew 安装）。 */
const POSIX_SOFFICE_PATHS = [
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
    '/opt/libreoffice/program/soffice',
    '/usr/lib/libreoffice/program/soffice',
    '/snap/bin/libreoffice',
];
/**
 * 各平台 soffice 的常见安装位置（显式配置与 PATH 之外的最后一道兜底）。
 * Windows 默认装在 Program Files 且不进 PATH —— 这是“明明装了却提示未安装”的主因。
 */
function sofficeInstallPaths() {
    if (process.platform === 'win32') {
        const roots = [
            process.env.ProgramW6432,
            process.env.ProgramFiles,
            process.env['ProgramFiles(x86)'],
            process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs') : undefined,
        ];
        const out = [];
        const add = (p) => { if (!out.includes(p))
            out.push(p); };
        for (const root of roots) {
            if (!root)
                continue;
            add(join(root, 'LibreOffice', 'program', 'soffice.exe'));
            add(join(root, 'LibreOffice', 'program', 'soffice.com'));
        }
        // 装在非系统盘的常见情况（自定义安装目录交给注册表探测）
        add('C:\\Program Files\\LibreOffice\\program\\soffice.exe');
        add('C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe');
        add('D:\\Program Files\\LibreOffice\\program\\soffice.exe');
        return out;
    }
    // macOS 保留完整的 POSIX 列表：Homebrew 装的 LibreOffice 落在 /usr/local/bin
    // 或 /opt/homebrew/bin，非交互启动时 PATH 可能不含这些目录，靠硬编码兜底。
    if (process.platform === 'darwin') {
        return [...POSIX_SOFFICE_PATHS, '/Applications/LibreOffice.app/Contents/MacOS/soffice'];
    }
    return POSIX_SOFFICE_PATHS;
}
/** soffice 候选路径（显式配置 → 环境变量 → PATH → 平台默认安装位置）。 */
function sofficeCandidates(explicit) {
    const out = [];
    const push = (p) => {
        if (p && p.length > 0 && !out.includes(p))
            out.push(p);
    };
    push(explicit);
    push(process.env.LIBREOFFICE_PATH);
    push(process.env.SOFFICE_PATH);
    const names = sofficeBinNames();
    for (const dir of (process.env.PATH ?? '').split(delimiter)) {
        if (!dir)
            continue;
        for (const name of names)
            push(join(dir, name));
    }
    for (const p of sofficeInstallPaths())
        push(p);
    return out;
}
/**
 * Windows：从注册表读 LibreOffice 实际安装目录。
 * Program Files 之外的安装（如 D:\Apps\LibreOffice）只有这里能查到；
 * 注册表不可用（受限环境 / 键不存在）时静默返回 undefined。
 */
function windowsRegistrySoffice() {
    if (process.platform !== 'win32')
        return undefined;
    const keys = [
        'HKLM\\SOFTWARE\\LibreOffice\\UNO\\InstallPath',
        'HKLM\\SOFTWARE\\WOW6432Node\\LibreOffice\\UNO\\InstallPath',
    ];
    for (const key of keys) {
        try {
            const out = execFileSync('reg', ['query', key, '/ve'], {
                encoding: 'utf8', timeout: 2000, windowsHide: true,
            });
            const m = /REG_SZ\s+(.+)/.exec(out);
            const dir = m?.[1]?.trim();
            if (!dir)
                continue;
            const exe = join(dir, 'soffice.exe');
            if (existsSync(exe))
                return exe;
        }
        catch { /* 键不存在或 reg 不可用，继续下一项 */ }
    }
    return undefined;
}
/** 探测结果按显式配置缓存 60s：装好 LibreOffice 后无需重启进程。 */
const sofficeCache = new Map();
function findSoffice(explicit) {
    const key = explicit ?? '';
    const hit = sofficeCache.get(key);
    if (hit && Date.now() - hit.at < 60_000)
        return hit.path;
    let found;
    for (const p of sofficeCandidates(explicit)) {
        try {
            if (statSync(p).isFile()) {
                accessSync(p, constants.X_OK);
                found = p;
                break;
            }
        }
        catch { /* 不存在或不可执行，继续下一个候选 */ }
    }
    // 注册表兜底：只在前面的候选全落空时查一次（Windows 自定义安装目录）
    if (!found)
        found = windowsRegistrySoffice();
    if (found) {
        if (!hit)
            console.log(`[dsh-plugin-auth] LibreOffice detected at ${found}`);
    }
    else if (!hit) {
        console.log(`[dsh-plugin-auth] LibreOffice not found (platform=${process.platform}); ` +
            'Office 预览将降级为下载。可设 LIBREOFFICE_PATH 或插件配置 libreOfficePath 指定 soffice。');
    }
    sofficeCache.set(key, { path: found, at: Date.now() });
    return found;
}
/**
 * 并发限流器：限制同时进行的 LibreOffice 转换数。
 * 转换彼此独立（各自的临时 UserInstallation），但 CPU/内存开销大，
 * 需要给个上限；默认 2，4 核以上机器可以再调。
 */
class Limiter {
    max;
    active = 0;
    waiting = [];
    constructor(max) {
        this.max = max;
    }
    /** 当前在途数量（供 /app/health 观测）。 */
    get activeCount() { return this.active; }
    /** 在途上限。 */
    get limit() { return this.max; }
    /** 当前排队等待的数量。 */
    get pendingCount() { return this.waiting.length; }
    async run(fn) {
        if (this.active >= this.max) {
            await new Promise(resolve => this.waiting.push(resolve));
        }
        this.active++;
        try {
            return await fn();
        }
        finally {
            this.active--;
            this.waiting.shift()?.();
        }
    }
}
let convertLimiter = new Limiter(2);
/** 会话 -> 该会话引用过的 attachmentId 集合（只缓存"通过"的结果，未命中一律重查）。 */
const aidCache = new Map();
const AID_CACHE_TTL_MS = 60_000;
const AID_CACHE_MAX = 500;
/** 工作目录 -> 文件列表（短 TTL，抵消 SSE 事件密集触发的重复遍历）。 */
const filesCache = new Map();
const FILES_CACHE_MAX = 200;
/** 把转换产物放入缓存（跨设备时 rename 会失败，退回复制）。 */
function storePdf(cachePath, produced) {
    mkdirSync(dirname(cachePath), { recursive: true });
    try {
        renameSync(produced, cachePath);
    }
    catch {
        copyFileSync(produced, cachePath);
    }
}
/**
 * macOS 专用修复：LibreOffice.app 内置的 fontconfig 只扫描自己包里的
 * Resources/fonts/truetype，看不到 /System/Library/Fonts 等系统字体，
 * 导致 CJK 字符在转 PDF 时被整体丢弃（PDF 里只剩 ASCII/数字）。
 * 这里生成一份包含系统字体目录的 fonts.conf，经 FONTCONFIG_FILE 注入。
 * Linux 的 fontconfig 行为正常（装 fonts-noto-cjk 即可），不做任何事。
 */
const SOFFICE_EXTRA_ENV = (() => {
    const env = {};
    if (process.platform !== 'darwin')
        return env;
    try {
        const dshHome = process.env.DSH_HOME ?? join(os.homedir(), '.dsh');
        const dir = join(dshHome, 'preview-cache');
        const conf = join(dir, 'fontconfig-mac.conf');
        const xml = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "/etc/fonts/conf.d/fonts.dtd">
<fontconfig>
<dir>/System/Library/Fonts</dir>
<dir>/System/Library/Fonts/Supplemental</dir>
<dir>/Library/Fonts</dir>
<dir>${join(os.homedir(), 'Library', 'Fonts')}</dir>
<dir>/Applications/LibreOffice.app/Contents/Resources/fonts/truetype</dir>
<cachedir>${join(dir, 'fc-cache')}</cachedir>
</fontconfig>
`;
        mkdirSync(dir, { recursive: true });
        writeFileSync(conf, xml);
        console.log(`[dsh-plugin-auth] macOS fontconfig for soffice -> ${conf}`);
        env.FONTCONFIG_FILE = conf;
        return env;
    }
    catch {
        return env; // 生成失败就退回 LibreOffice 默认行为
    }
})();
/**
 * 调用 soffice 把 srcPath 转成 PDF，返回生成的 PDF 路径。
 * outDir 由调用方提供并负责清理（PDF 必须落在调用方的目录里，
 * 否则本函数的 finally 清理会把产物一起删掉）。
 */
async function runConvert(soffice, srcPath, outDir, timeoutMs) {
    // 每次转换一个独立 UserInstallation：并发/残留锁都不会互相阻塞
    const profile = mkdtempSync(join(os.tmpdir(), 'dsh-loprof-'));
    try {
        await new Promise((ok, reject) => {
            const child = spawn(soffice, [
                '--headless', '--norestore', '--invisible', '--nodefault', '--nolockcheck',
                // 尾部斜杠是有意的：Windows 上少了它，部分 LibreOffice 启动器会直接崩溃
                // （soffice.bin 实测 exit=81 且不产 PDF），加上后 .exe/.bin 都稳定。
                `-env:UserInstallation=${pathToFileURL(profile).href}/`,
                '--convert-to', 'pdf', '--outdir', outDir, srcPath,
            ], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, ...SOFFICE_EXTRA_ENV }, windowsHide: true });
            let stderr = '';
            child.stderr?.on('data', (c) => { if (stderr.length < 4096)
                stderr += c.toString('utf8'); });
            const timer = setTimeout(() => {
                child.kill('SIGKILL');
                reject(Object.assign(new Error('convert_timeout'), { statusCode: 504 }));
            }, timeoutMs);
            child.on('error', (err) => { clearTimeout(timer); reject(err); });
            child.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0)
                    ok();
                else
                    reject(new Error(`soffice exited with ${code}${stderr ? ': ' + stderr.trim().slice(0, 300) : ''}`));
            });
        });
        const pdf = readdirSync(outDir).find((f) => f.toLowerCase().endsWith('.pdf'));
        if (!pdf)
            throw new Error('soffice produced no pdf');
        return join(outDir, pdf);
    }
    finally {
        rmSync(profile, { recursive: true, force: true });
    }
}
/** 把一个字节流写成文件（物化附件供 LibreOffice 读取）。 */
async function writeToFile(path, iter, limitBytes) {
    let total = 0;
    await new Promise((ok, reject) => {
        const ws = createWriteStream(path);
        ws.on('error', reject);
        ws.on('finish', () => ok());
        (async () => {
            for await (const chunk of iter) {
                total += chunk.byteLength;
                if (total > limitBytes)
                    throw new Error('source_too_large');
                if (!ws.write(chunk))
                    await new Promise((r) => ws.once('drain', () => r()));
            }
            ws.end();
        })().catch((err) => {
            ws.destroy();
            reject(err);
        });
    });
}
/** 缓存清理（最多每 10 分钟一次），避免预览缓存无限增长。 */
let lastPrune = 0;
function pruneCache(root, maxAgeMs = 7 * 86_400_000) {
    const now = Date.now();
    if (now - lastPrune < 600_000)
        return;
    lastPrune = now;
    try {
        for (const shard of readdirSync(root)) {
            const dir = join(root, shard);
            if (!statSync(dir).isDirectory())
                continue;
            for (const f of readdirSync(dir)) {
                const p = join(dir, f);
                try {
                    if (now - statSync(p).mtimeMs > maxAgeMs)
                        rmSync(p, { force: true });
                }
                catch { /* 单个文件清理失败忽略 */ }
            }
        }
    }
    catch { /* 缓存目录还不存在，忽略 */ }
}
/** 默认注入的中文输出要求（注意：系统提示里 {{x}} 会被当变量解析，文案里不要用双花括号）。 */
const DEFAULT_LANGUAGE_ZH = [
    '## 输出语言要求（最高优先级，覆盖默认行为）',
    '- 全部输出一律使用简体中文：包括思考/推理过程、任务分析、执行计划、每次工具调用前后的说明、以及最终回复与总结。',
    '- 除非用户显式要求，不得使用英文输出说明性或推理性文本。',
    '- 代码、命令、文件路径、日志原文、专有名词与技术标识符保持原样，不要翻译。',
    '- 用户用中文提问就必须用中文作答；用户切换语言时跟随用户。',
].join('\n');
// ---------------------------------------------------------------------------
// Cordis 插件入口
// ---------------------------------------------------------------------------
export const name = 'dsh-plugin-auth';
// 注意：fileUploads 不在此处声明（见 AuthPluginContext 注释）。运行时惰性获取。
// 'llm' + 'agentDefaultModel'：模型难度路由需要（modelCatalog/selectModel 官方实现
// 内部会经调用方 ctx 访问这两个服务；Cordis 按「访问方插件 inject 清单」做服务
// 访问控制 —— vendor/cordis/src/reflect.ts:144 "cannot get property without inject"，
// 不加进 inject 直调 modelCatalog 会 502）。
export const inject = ['webServer', 'sessionController', 'llm', 'agentDefaultModel'];
export async function apply(ctx, config) {
    if (!config?.secret || config.secret.length < 32) {
        throw new Error('dsh-plugin-auth: config.secret 必填且至少 32 字符');
    }
    // 注入“输出语言”系统提示分区（默认强制简体中文，含思考/分析过程）。
    // 说明：settings/cordis.patch.yml 里改 system-prompt 的 personaPrefix/ personaSuffix
    // 不生效——preset（standard）注册了同名 scoped 分区 deployment:persona-* 会把它遮蔽。
    const instruction = config.languageInstruction ?? DEFAULT_LANGUAGE_ZH;
    const systemPrompt = ctx.get('systemPrompt', false);
    if (instruction.trim() !== '' && systemPrompt !== undefined) {
        // section() 返回 cordis effect 的 disposer，交给 ctx.effect 托管生命周期
        ctx.effect(() => systemPrompt.section({
            name: 'myauth:language',
            order: systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX') + 10,
            text: instruction,
        }));
        console.log('[dsh-plugin-auth] injected output-language system prompt section');
    }
    else if (instruction.trim() !== '') {
        console.warn('[dsh-plugin-auth] systemPrompt 服务不可用，未注入输出语言要求');
    }
    const app = new AuthApp(ctx, config);
    await app.init();
}
// 注意：不要加 `export default`——cordis Loader 的 unwrapExports 会丢弃命名空间
// （见 docs/postmortem/0001-acp-default-export-drops-inject.md Bug #1）。
// ---------------------------------------------------------------------------
// 实现
// ---------------------------------------------------------------------------
/**
 * 异步 scrypt。**不要改回 scryptSync**：scrypt 默认 N=16384 是纯 CPU 计算，
 * 同步版会在主线程上阻塞约 50-100ms —— 而本进程同时承载所有用户的 agent loop
 * 和 SSE 推送，N 个用户同时登录就等于全服冻结 N×80ms。
 * 异步版把计算交给 libuv 线程池，事件循环不再被卡住。
 */
const scryptAsync = promisify(scryptCb);
class AuthApp {
    ctx;
    config;
    pool;
    cookieName;
    maxAgeMs;
    /** 预转换在途 key，避免同一文档被重复触发转换。 */
    warming = new Set();
    /**
     * 正在进行的对话轮：sessionId -> { 归属用户, 投递时刻 }。
     *
     * 只用于「按用户 / 全局计数」，不用于判断某个会话是否在跑 —— 那个判据是
     * 官方 agent.status。每次检查前先 reconcile 掉已经不 running 的记录，
     * 所以这张表会自愈，不会随运行时间累积。
     */
    activeTurns = new Map();
    maxTurnsPerUser;
    maxTurnsGlobal;
    // ---------- 模型难度路由 ----------
    /** 用户手动选定的模型（会话级；清除 = 回到自动路由）。进程内状态，重启后回落自动。 */
    manualModel = new Map();
    /** 本会话最近一次实际下发的模型（避免每次 prompt 重复 selectModel 写事件）。 */
    lastRouted = new Map();
    /**
     * 部署默认模型（惰性捕获一次）。官方 selectModel 有副作用：会把选择
     * saveSelection 成部署默认 —— 多用户场景互相覆盖会漂移，所以路由兜底
     * 用这份「原始默认」而非实时读 currentSelection。捕获发生在首次路由时，
     * 早于本插件任何 selectModel 调用，因此是干净的。
     */
    capturedDefault = null;
    /** 规则正则编译缓存（pattern 字符串 -> RegExp）。 */
    routingRegex = new Map();
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        // 转换并发度：配置优先，夹在 1..4（再高 LibreOffice 自己会成瓶颈）
        const conc = Math.min(4, Math.max(1, Math.floor(config.previewConcurrency ?? 2)));
        convertLimiter = new Limiter(conc);
        // 对话轮并发上限：每用户默认 2；全局默认 = CPU 核数（夹在 2..16）。
        this.maxTurnsPerUser = Math.min(32, Math.max(1, Math.floor(config.maxConcurrentTurnsPerUser ?? 2)));
        const cpus = os.cpus?.().length ?? 4;
        this.maxTurnsGlobal = Math.min(16, Math.max(this.maxTurnsPerUser, Math.floor(config.maxConcurrentTurnsGlobal ?? cpus)));
        console.log(`[dsh-plugin-auth] mysql pool=${config.mysql.connectionLimit ?? 20}, preview concurrency=${conc}`);
        console.log(`[dsh-plugin-auth] max concurrent turns: ${this.maxTurnsGlobal} global / ${this.maxTurnsPerUser} per user (cpus=${cpus})`);
        // Office 预览能力启动即探测一次：让「明明装了却没被发现」这类问题一眼可见，
        // 而不是等用户点预览才看到 501。
        const sofficePath = this.soffice();
        if (sofficePath === undefined) {
            console.warn('[dsh-plugin-auth] office preview: LibreOffice (soffice) NOT found — Word/Excel/PPT 预览将降级为下载。'
                + (process.platform === 'win32'
                    ? 'Windows 默认装到 C:\\Program Files\\LibreOffice 即可自动发现；自定义目录请设 LIBREOFFICE_PATH。'
                    : 'Linux: apt install -y libreoffice | macOS: brew install --cask libreoffice'));
        }
        this.pool = mysql.createPool({
            host: config.mysql.host,
            port: config.mysql.port ?? 3306,
            user: config.mysql.user,
            password: config.mysql.password,
            database: config.mysql.database,
            connectionLimit: config.mysql.connectionLimit ?? 20,
            namedPlaceholders: false,
        });
        this.cookieName = config.cookieName ?? 'myauth';
        this.maxAgeMs = (config.cookieMaxAgeDays ?? 7) * 86_400_000;
    }
    /** 启动即建表 + 连通性检查；MySQL 不可用则 fail-fast（绝不降级为不过滤）。 */
    async init() {
        await this.pool.query('SELECT 1');
        await this.pool.query(`CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        // 员工白名单模式（scripts/import-staff.mjs 导入）：users 表补充 Excel 字段。
        // CREATE TABLE IF NOT EXISTS 不会给已存在的表加列，迁移用 information_schema 判存在性。
        await this.addColumnIfMissing('users', 'employee_id', 'VARCHAR(32) NULL');
        await this.addColumnIfMissing('users', 'display_name', 'VARCHAR(64) NULL');
        await this.pool.query(`CREATE TABLE IF NOT EXISTS session_owners (
      session_id VARCHAR(64) PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        // 上传附件的「原始相对路径」登记表。
        // 官方 attachments 会把附件名净化成叶子文件名（fileLeafName 剥掉目录前缀），
        // 所以右栏要按目录结构还原上传附件，只能由插件自己把上传时的 name（相对路径）
        // 落库一份，按 (session_id, attachment_id) 唯一。
        await this.pool.query(`CREATE TABLE IF NOT EXISTS session_uploads (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      session_id VARCHAR(64) NOT NULL,
      attachment_id VARCHAR(191) NOT NULL,
      path VARCHAR(1024) NOT NULL,
      bytes BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_session_aid (session_id, attachment_id),
      INDEX idx_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        this.registerRoutes();
    }
    /** 给已存在的表幂等加列（查 information_schema，不存在才 ALTER）。 */
    async addColumnIfMissing(table, column, definition) {
        const [rows] = await this.pool.query('SELECT 1 AS ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1', [table, column]);
        if (rows.length === 0) {
            await this.pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
            console.log(`[dsh-plugin-auth] migrated: users.${column} added`);
        }
    }
    // ---- 密码（scrypt，无原生依赖）----
    async hashPassword(password) {
        const salt = randomBytes(16).toString('hex');
        const hash = await scryptAsync(password, salt, 64);
        return `s2$${salt}$${hash.toString('hex')}`;
    }
    async verifyPassword(password, stored) {
        const [scheme, salt, hash] = stored.split('$');
        if (scheme !== 's2' || !salt || !hash)
            return false;
        const actual = await scryptAsync(password, salt, 64);
        const expect = Buffer.from(hash, 'hex');
        return actual.length === expect.length && timingSafeEqual(actual, expect);
    }
    // ---- 自有 cookie（HMAC-SHA256，与官方 cookie 完全独立）----
    sign(userId, exp) {
        return createHmac('sha256', this.config.secret).update(`${userId}.${exp}`).digest('hex');
    }
    issueCookie(userId) {
        const exp = Date.now() + this.maxAgeMs;
        const secure = this.config.secureCookie ? '; Secure' : '';
        return (`${this.cookieName}=${userId}.${exp}.${this.sign(userId, exp)}` +
            `; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(this.maxAgeMs / 1000)}${secure}`);
    }
    clearCookie() {
        return `${this.cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
    }
    /** 从请求 cookie 解析并验签出 userId；无效/过期返回 null。 */
    currentUser(req) {
        const raw = String(req.headers.cookie ?? '')
            .split(';').map((p) => p.trim())
            .find((p) => p.startsWith(`${this.cookieName}=`))
            ?.slice(this.cookieName.length + 1);
        if (!raw)
            return null;
        const [uid, exp, sig] = raw.split('.');
        const userId = Number(uid);
        const expNum = Number(exp);
        if (!Number.isSafeInteger(userId) || !Number.isFinite(expNum) || !sig)
            return null;
        if (Date.now() > expNum)
            return null;
        const expect = Buffer.from(this.sign(userId, expNum), 'hex');
        const actual = Buffer.from(sig, 'hex');
        if (expect.length !== actual.length || !timingSafeEqual(expect, actual))
            return null;
        return userId;
    }
    // ---- HTTP 工具 ----
    json(res, code, body, headers = {}) {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...headers });
        res.end(JSON.stringify(body));
    }
    async readBody(req) {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
            size += chunk.length;
            if (size > 1_048_576)
                throw Object.assign(new Error('body too large'), { statusCode: 413 });
            chunks.push(chunk);
        }
        if (chunks.length === 0)
            return {};
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    route(path, handler) {
        this.ctx.effect(() => this.ctx.webServer.register({
            kind: 'exact',
            path,
            handler: (req, res) => {
                void handler(req, res).catch((err) => {
                    const code = typeof err?.statusCode === 'number' ? err.statusCode : 500;
                    // 打印真实错误便于排查（浏览器看到 internal_error 时看服务器日志）
                    console.error(`[dsh-plugin-auth] ${req.method} ${req.url} -> ${code}:`, err);
                    this.json(res, code, {
                        error: code === 500 ? 'internal_error' : String(err.message ?? 'error'),
                        ...(code === 500 && err instanceof Error ? { detail: err.message } : {}),
                    });
                });
            },
        }));
    }
    /** 登录态守卫：未登录直接 401 并返回 null。 */
    requireUser(req, res) {
        const userId = this.currentUser(req);
        if (userId === null)
            this.json(res, 401, { error: 'unauthorized' });
        return userId;
    }
    // ---- 归属（隔离核心：全部走 SQL，服务端强制）----
    async ownedBy(sessionId, userId) {
        const [rows] = await this.pool.execute('SELECT 1 AS ok FROM session_owners WHERE session_id = ? AND user_id = ? LIMIT 1', [sessionId, userId]);
        return rows.length > 0;
    }
    /** 归属不符一律 404（不泄露 session 存在性）。返回 false 表示已响应。 */
    async requireOwnership(res, sessionId, userId) {
        if (await this.ownedBy(sessionId, userId))
            return true;
        this.json(res, 404, { error: 'not_found' });
        return false;
    }
    // ---- 并发闸门（保护单进程事件循环）----
    /** 刚投递后的宽限期：这段时间内 agent 还没翻到 running，不能据此删记录。 */
    static TURN_RECONCILE_GRACE_MS = 3000;
    /** agents 服务不可用时的兜底过期时间，防止记录无限累积。 */
    static TURN_RECORD_STALE_MS = 1_800_000;
    /**
     * 回收「其实已经不在跑」的记录。
     *
     * 判据是官方 Agent 的公开 status（不是插件自己的记账）：agent 不在 running
     * 就说明这个会话没有占用事件循环，记录即可删除。**必须保留宽限期** ——
     * prompt 是投递即返回的，agent 要过一会儿才翻到 running，否则会把自己刚写
     * 的记录误删，闸门形同虚设。
     */
    reconcileActiveTurns(agents) {
        const now = Date.now();
        for (const [sessionId, rec] of this.activeTurns) {
            if (now - rec.at < AuthApp.TURN_RECONCILE_GRACE_MS)
                continue;
            if (agents === undefined) {
                // 极端情况：agents 服务拿不到，退化为按时间过期
                if (now - rec.at > AuthApp.TURN_RECORD_STALE_MS)
                    this.activeTurns.delete(sessionId);
                continue;
            }
            if (agents.get(sessionId)?.status !== 'running')
                this.activeTurns.delete(sessionId);
        }
    }
    /** 该用户当前在跑的轮数（调用前需先 reconcile）。 */
    runningTurnsOf(userId) {
        let n = 0;
        for (const rec of this.activeTurns.values())
            if (rec.userId === userId)
                n++;
        return n;
    }
    /**
     * 准入判断。返回 null 表示放行；否则返回应当抛出的 429 错误（含中文提示）。
     *
     * 关键语义 —— **只拦「新开一轮」，不拦「往已在跑的会话追加消息」**：
     * 目标会话本身在跑时，再发消息只是进它自己的 inbox（queue/steer），
     * 不会新增并发。若这里也拦，用户在长任务中途追加指令会被误拒。
     */
    admitTurn(sessionId, userId) {
        const agents = this.ctx.get('agents', false);
        if (agents?.get(sessionId)?.status === 'running')
            return null;
        this.reconcileActiveTurns(agents);
        const mine = this.runningTurnsOf(userId);
        if (mine >= this.maxTurnsPerUser) {
            return Object.assign(new Error(`你已有 ${mine} 个任务正在运行（上限 ${this.maxTurnsPerUser} 个），请等其中一个完成或点停止后再试`), { statusCode: 429 });
        }
        const global = this.activeTurns.size;
        if (global >= this.maxTurnsGlobal) {
            return Object.assign(new Error(`服务器当前任务已满（${global}/${this.maxTurnsGlobal}），请稍后重试`), { statusCode: 429 });
        }
        return null;
    }
    /** 投递成功后才记账；失败不占额度。 */
    recordTurn(sessionId, userId) {
        this.activeTurns.set(sessionId, { userId, at: Date.now() });
    }
    // ---------- 模型难度路由 ----------
    // 官方机制：sessionController.selectModel 写 durable model/selection 事件，
    // 下一次 prompt 生效（commands.ts:307 读 selectionFor(agent).current）。
    // 手动选择的会话跳过自动路由；自动路由不命中规则时回落部署默认。
    /** 惰性捕获部署默认模型（见字段注释）。 */
    deploymentDefaultModel() {
        const configured = this.config.modelRouting?.defaultModel;
        if (configured?.provider && configured.model)
            return configured;
        if (this.capturedDefault === null) {
            const svc = this.ctx.get('agentDefaultModel', false);
            const sel = svc?.currentSelection();
            this.capturedDefault = sel?.provider && sel?.model
                ? { provider: sel.provider, model: sel.model }
                : { provider: 'deepseek-official', model: 'deepseek-v4-flash' };
        }
        return this.capturedDefault;
    }
    /** 单条规则是否命中任务文本（关键词子串匹配 + 可选正则，取并集）。 */
    ruleMatches(rule, text) {
        const lower = text.toLowerCase();
        for (const kw of rule.keywords ?? []) {
            if (kw && lower.includes(kw.toLowerCase()))
                return true;
        }
        const pattern = rule.pattern;
        if (pattern) {
            let re = this.routingRegex.get(pattern);
            if (re === undefined) {
                try {
                    re = new RegExp(pattern, 'i');
                }
                catch {
                    re = /$^/; // 永不匹配，坏正则不炸服务
                }
                this.routingRegex.set(pattern, re);
            }
            if (re.test(text))
                return true;
        }
        return false;
    }
    /**
     * 为下一次 prompt 下发模型选择。仅在目标与本会话上次下发不同时才调
     * selectModel（每次调用都会追加 durable 事件 + saveSelection 副作用，
     * 没必要每轮都写）。失败只警告不阻断 —— 投递回落到当前默认模型。
     */
    async applyModelSelection(sessionId, target) {
        const last = this.lastRouted.get(sessionId);
        if (last && last.provider === target.provider && last.model === target.model)
            return true;
        const selectModel = this.ctx.sessionController.selectModel;
        if (typeof selectModel !== 'function')
            return false;
        try {
            await selectModel.call(this.ctx.sessionController, {
                sessionId,
                provider: target.provider,
                model: target.model,
            });
            this.lastRouted.set(sessionId, target);
            return true;
        }
        catch (err) {
            console.warn(`[dsh-plugin-auth] model routing to ${target.provider}/${target.model} failed:`, err?.message ?? err);
            return false;
        }
    }
    /**
     * 难度路由主入口：任务文本 → 规则 → 目标模型 → selectModel。
     * 返回实际使用的模型信息（供前端展示）；不启用/无规则/手动模式返回 null。
     */
    async routeModelForPrompt(sessionId, text) {
        const routing = this.config.modelRouting;
        if (routing?.enabled === false)
            return null;
        const rules = routing?.rules ?? [];
        if (rules.length === 0 && !this.manualModel.has(sessionId))
            return null;
        // 手动选择优先：用户在顶栏选了具体模型的会话不做自动路由。
        const manual = this.manualModel.get(sessionId);
        if (manual) {
            const ok = await this.applyModelSelection(sessionId, manual);
            return ok ? { ...manual, rule: '手动选择' } : null;
        }
        let target = this.deploymentDefaultModel();
        let ruleName = '默认模型';
        for (const r of rules) {
            if (this.ruleMatches(r, text)) {
                if (r.provider && r.model) {
                    target = { provider: r.provider, model: r.model };
                    ruleName = r.name;
                }
                break;
            }
        }
        // 不命中规则也要显式回落默认：上一轮路由到 pro 后，官方
        // selectionFor().current 会停在 last request header（pro），
        // 不主动切回的话简单任务会一直用重模型。
        const ok = await this.applyModelSelection(sessionId, target);
        return ok ? { ...target, rule: ruleName } : null;
    }
    /**
     * 尽力清理磁盘上的会话 JSONL（session.v2.jsonl.zstd + session.lock）。
     * 路径完全照抄官方 session-persistence-jsonl 的编码；算错或目录被占用均
     * 不影响软删除结果，纯防御性操作。
     */
    purgeSessionFiles(sessionId, cwd) {
        try {
            const dshHome = process.env.DSH_HOME ?? join(os.homedir(), '.dsh');
            const root = join(dshHome, 'sessions');
            const dir = join(root, projectKey(cwd), encodeSegment(sessionId));
            if (existsSync(dir)) {
                rmSync(dir, { recursive: true, force: true });
                console.log(`[dsh-plugin-auth] purged session files at ${dir}`);
            }
        }
        catch (err) {
            console.warn(`[dsh-plugin-auth] session file purge skipped for ${sessionId}:`, err);
        }
    }
    /**
     * 会话专属工作目录：模型经工具写出的文件（生成产物）全部落在这里
     * （workspace-write 沙箱以 cwd 为边界）。目录按 用户/会话 两级隔离，
     * 同时避免多用户共享 dsh 启动目录。
     */
    workspaceDir(userId, sessionId) {
        const dshHome = process.env.DSH_HOME ?? join(os.homedir(), '.dsh');
        return join(dshHome, 'workspaces', `u${userId}`, sessionId);
    }
    /**
     * 兜底扫描技能目录：该用户专属层（workspaces/u<uid>/.dsh/skills）优先，
     * 再叠加全局共享层（<dshHome>/skills，手工放置、所有用户可见），按名字去重。
     * 支持两种布局：<name>/SKILL.md 与 <name>.md（与官方 filesystem provider 一致），
     * 只取 frontmatter 里 user-invocable 不为 false 的技能。
     */
    scanUserSkills(userId) {
        const roots = [userSkillRoot(userId), skillRoot()];
        const out = [];
        const seen = new Set();
        for (const root of roots) {
            if (!existsSync(root))
                continue;
            let entries = [];
            try {
                entries = readdirSync(root);
            }
            catch {
                continue;
            }
            for (const entry of entries) {
                if (entry.startsWith('.'))
                    continue;
                let file;
                let stat;
                try {
                    stat = statSync(join(root, entry));
                }
                catch {
                    continue;
                }
                if (stat && stat.isDirectory()) {
                    const p = join(root, entry, 'SKILL.md');
                    if (existsSync(p))
                        file = p;
                }
                else if (entry.toLowerCase().endsWith('.md')) {
                    file = join(root, entry);
                }
                if (!file)
                    continue;
                let raw = '';
                try {
                    raw = readFileSync(file, 'utf8');
                }
                catch {
                    continue;
                }
                const fm = parseSkillFrontmatter(raw);
                if (!fm)
                    continue;
                if (fm.userInvocable === false)
                    continue;
                const name = fm.name || (stat && stat.isDirectory() ? entry : entry.replace(/\.md$/i, ''));
                if (!/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(name))
                    continue;
                if (seen.has(name))
                    continue;
                seen.add(name);
                out.push({
                    name,
                    description: fm.description || '',
                    ...(fm.whenToUse === undefined ? {} : { whenToUse: fm.whenToUse }),
                    source: 'user-dsh',
                });
            }
        }
        return out.sort((a, b) => a.name.localeCompare(b.name));
    }
    // -------------------------------------------------------------------------
    // 技能市场（对标 WorkBuddy SkillHub）
    //
    // 落点：**按登录用户隔离**，装到 workspaces/u<uid>/.dsh/skills/<slug>__hub。
    // 原理：harness findProjectRoot 只认 .git 标记，从会话 cwd 向上找到 u<uid> 即停，
    // <u<uid>>/.dsh/skills 就是该用户专属的 project-dsh 技能根（ensureUserSkillRoot
    // 负责放标记）。装完由官方 filesystem provider 的目录监视器自动纳入，无需重启 dsh。
    // 全局 ~/.dsh/skills 保留为「共享层」：手工放进去的技能对所有用户可见。
    // -------------------------------------------------------------------------
    /** 该登录用户已安装的市场技能，按「技能名」索引（名字取自目录内 SKILL.md 的 frontmatter）。
     *  只扫该用户专属层；全局共享层的手工技能不算「该用户的市场安装」。 */
    installedHubBySkillName(userId) {
        const root = userSkillRoot(userId);
        const out = new Map();
        if (!existsSync(root))
            return out;
        let entries = [];
        try {
            entries = readdirSync(root);
        }
        catch {
            return out;
        }
        for (const entry of entries) {
            if (!entry.endsWith(HUB_DIR_SUFFIX))
                continue;
            const meta = readHubMeta(join(root, entry));
            if (!meta)
                continue;
            let name = meta.slug;
            const md = join(root, entry, 'SKILL.md');
            if (existsSync(md)) {
                try {
                    const fm = parseSkillFrontmatter(readFileSync(md, 'utf8'));
                    if (fm?.name !== undefined && fm.name.length > 0)
                        name = fm.name;
                }
                catch {
                    // 读不到就退回 slug，不影响其它技能
                }
            }
            out.set(name, meta);
        }
        return out;
    }
    /** 拉取市场索引。未配置 indexUrl 时 configured=false（UI 据此隐藏市场入口）。
     *  q 非空时拼到索引 URL 上（?q= / &q=），由市场后端做服务端搜索过滤。 */
    async fetchHubIndex(q) {
        const url = this.config.hub?.indexUrl;
        if (typeof url !== 'string' || url.length === 0)
            return { entries: [], configured: false };
        if (!/^https?:\/\//i.test(url))
            throw new Error('hub.indexUrl must be an http(s) url');
        let target = url;
        if (q && q.length > 0) {
            const sep = target.includes('?') ? '&' : '?';
            target = target + sep + 'q=' + encodeURIComponent(q);
        }
        const timeout = this.config.hub?.timeoutMs ?? 15_000;
        const res = await fetch(target, { signal: AbortSignal.timeout(timeout) });
        if (!res.ok)
            throw new Error(`hub index returned HTTP ${res.status}`);
        const body = (await res.json());
        const list = Array.isArray(body?.skills) ? body.skills : [];
        const entries = [];
        for (const raw of list) {
            const e = raw;
            if (typeof e.slug !== 'string' || !HUB_SLUG_PATTERN.test(e.slug))
                continue;
            entries.push(e);
        }
        return { entries, configured: true };
    }
    /** 把市场索引项映射成 UI 需要的技能列表（附带 installed / upgradable 状态，平铺字段与前端一致）。 */
    mapHubSkills(entries, userId) {
        const installed = new Map();
        for (const meta of this.installedHubBySkillName(userId).values())
            installed.set(meta.slug, meta);
        return entries.map((e) => {
            const slug = String(e.slug);
            const local = installed.get(slug);
            return {
                slug,
                name: e.name ?? slug,
                description: e.description ?? '',
                version: e.version ?? '',
                ...(e.author === undefined ? {} : { author: e.author }),
                ...(e.namespace === undefined ? {} : { namespace: e.namespace }),
                ...(e.icon === undefined ? {} : { icon: e.icon }),
                installs: Number(e.installs ?? 0),
                installed: local !== undefined,
                installedVersion: local?.version ?? '',
                upgradable: local !== undefined && compareVersion(e.version, local.version) > 0,
            };
        });
    }
    /** 下载并安装（或覆盖升级）一个市场技能到**该登录用户**的专属技能层。 */
    async installHubEntry(entry, userId) {
        const slug = String(entry.slug);
        const tarball = typeof entry.tarball === 'string' ? entry.tarball : '';
        if (!/^https?:\/\//i.test(tarball))
            throw new Error('entry has no usable tarball url');
        const timeout = this.config.hub?.timeoutMs ?? 15_000;
        const maxBytes = this.config.hub?.maxBytes ?? 20 * 1024 * 1024;
        const res = await fetch(tarball, { signal: AbortSignal.timeout(timeout) });
        if (!res.ok)
            throw new Error(`tarball returned HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > maxBytes)
            throw new Error('tarball exceeds maxBytes');
        if (typeof entry.sha256 === 'string' && entry.sha256.length === 64) {
            const actual = createHash('sha256').update(buf).digest('hex');
            if (actual !== entry.sha256.toLowerCase())
                throw new Error('tarball sha256 mismatch');
        }
        const tmp = mkdtempSync(join(os.tmpdir(), 'dsh-hub-'));
        try {
            const tgz = join(tmp, 'pkg.tgz');
            writeFileSync(tgz, buf);
            // 先列清单再解包：第三方包不可信，拒绝绝对路径与 .. 穿越
            const listing = execFileSync('tar', ['-tzf', tgz], { encoding: 'utf8', maxBuffer: 8 << 20 });
            for (const line of listing.split('\n')) {
                const n = line.trim();
                if (n.length === 0)
                    continue;
                if (n.startsWith('/') || n.split('/').includes('..'))
                    throw new Error('unsafe path in tarball');
            }
            const ex = join(tmp, 'ex');
            mkdirSync(ex, { recursive: true });
            execFileSync('tar', ['-xzf', tgz, '-C', ex], { maxBuffer: 8 << 20 });
            // npm/tgz 惯例：内容在顶层 package/ 里；没有则视为直接以根目录打包
            let src = ex;
            const inner = join(ex, 'package');
            if (existsSync(inner) && statSync(inner).isDirectory())
                src = inner;
            if (!existsSync(join(src, 'SKILL.md')))
                throw new Error('tarball contains no SKILL.md');
            const root = ensureUserSkillRoot(userId);
            const target = join(root, slug + HUB_DIR_SUFFIX);
            // 同目录内的 staging + rename：避免跨设备 rename，也避免中途失败留下半包
            const staging = `${target}.staging-${randomUUID()}`;
            cpSync(src, staging, { recursive: true, dereference: true });
            rmSync(target, { recursive: true, force: true });
            renameSync(staging, target);
            const meta = {
                slug,
                ...(entry.name === undefined ? {} : { name: String(entry.name) }),
                ...(entry.version === undefined ? {} : { version: String(entry.version) }),
                ...(entry.namespace === undefined ? {} : { namespace: String(entry.namespace) }),
                ...(entry.author === undefined ? {} : { author: String(entry.author) }),
                ...(entry.icon === undefined ? {} : { icon: String(entry.icon) }),
                ...(entry.installs === undefined ? {} : { installs: Number(entry.installs) }),
                installedAt: Date.now(),
                source: 'hub',
            };
            writeFileSync(join(target, HUB_META_FILE), JSON.stringify(meta, undefined, 2) + '\n');
            return meta;
        }
        finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    }
    /** 卸载一个市场技能（只在该用户专属层里删带 __hub 后缀的目录，绝不碰手工建的技能）。 */
    uninstallHubSlug(slug, userId) {
        const target = join(userSkillRoot(userId), slug + HUB_DIR_SUFFIX);
        if (!existsSync(target))
            return false;
        rmSync(target, { recursive: true, force: true });
        return true;
    }
    /**
     * 预转换：文件列表加载后悄悄把工作区里的 Office 文档提前转成 PDF 缓存好，
     * 用户点开时 ensurePdf 命中缓存 → 秒开，无需等待「正在转换」。
     * 非阻塞：仅登记在途 key 后 fire-and-forget，不拖慢列表接口本身。
     * 依赖 LibreOffice；未安装则直接跳过（前端照常降级为下载）。
     */
    warmWorkspaceFiles(userId, sessionId) {
        if (this.soffice() === undefined)
            return;
        const ws = this.workspaceDir(userId, sessionId);
        if (!existsSync(ws))
            return;
        const items = this.listWorkspaceFiles(ws);
        for (const it of items) {
            const name = it.path.split('/').pop() ?? '';
            if (!convertible(name))
                continue;
            const key = createHash('sha256')
                .update(`ws|${userId}|${sessionId}|${it.path}|${it.size}|${it.mtime}`)
                .digest('hex');
            if (this.warming.has(key))
                continue;
            this.warming.add(key);
            void this.ensurePdf(key, async () => resolve(ws, it.path))
                .catch(() => { })
                .finally(() => this.warming.delete(key));
        }
    }
    /** 递归列出工作目录内的文件（跳过 dotfile；限 2000 个 / 深度 8，防御异常目录）。 */
    listWorkspaceFiles(root) {
        const out = [];
        const walk = (dir, rel, depth) => {
            if (out.length >= 2000 || depth > 8)
                return;
            let entries;
            try {
                entries = readdirSync(dir, { withFileTypes: true });
            }
            catch {
                return;
            }
            entries.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
            for (const e of entries) {
                if (e.name.startsWith('.'))
                    continue;
                const childRel = rel === '' ? e.name : rel + '/' + e.name;
                const child = join(dir, e.name);
                if (e.isDirectory()) {
                    walk(child, childRel, depth + 1);
                }
                else if (e.isFile()) {
                    try {
                        const st = statSync(child);
                        out.push({ path: childRel, size: st.size, mtime: Math.floor(st.mtimeMs) });
                    }
                    catch { /* 单个文件 stat 失败跳过 */ }
                }
                if (out.length >= 2000)
                    return;
            }
        };
        walk(root, '', 0);
        return out;
    }
    /**
     * 把异步字节流写回 HTTP 响应（带背压处理）。头部写完后不再走 json()。
     */
    async streamOut(res, code, headers, iter) {
        res.writeHead(code, headers);
        for await (const chunk of iter) {
            if (!res.write(chunk))
                await new Promise((r) => res.once('drain', () => r()));
        }
        res.end();
    }
    /** 官方 attachments 服务（惰性获取，未激活时返回 undefined）。 */
    attachments() {
        return this.ctx.get('attachments', false);
    }
    // ---- 文档转 PDF 预览 ----
    /** soffice 可执行文件；未安装返回 undefined（结果带 60s 缓存）。 */
    soffice() {
        return findSoffice(this.config.libreOfficePath);
    }
    /** 预览缓存根目录（$DSH_HOME/preview-cache，按首字节分片）。 */
    previewCacheRoot() {
        const dshHome = process.env.DSH_HOME ?? join(os.homedir(), '.dsh');
        return join(dshHome, 'preview-cache');
    }
    /**
     * 取得 cacheKey 对应文档的 PDF；缓存命中直接返回，否则调用 LibreOffice 转换。
     * produce 负责给出源文件路径（已存在的磁盘文件，或物化到 tmp 目录里的临时文件）。
     * 返回 undefined 表示本机没有可用的转换器（调用方应回 501 让前端降级）。
     */
    async ensurePdf(cacheKey, produce) {
        const soffice = this.soffice();
        if (soffice === undefined)
            return undefined;
        const root = this.previewCacheRoot();
        const cachePath = join(root, cacheKey.slice(0, 2), cacheKey + '.pdf');
        if (existsSync(cachePath))
            return cachePath;
        const pdf = await convertLimiter.run(async () => {
            if (existsSync(cachePath))
                return cachePath; // 排队期间已被别的请求转换好
            // tmp 同时作为「源物化目录」和「PDF 输出目录」，转换产物落在调用方手里
            const tmp = mkdtempSync(join(os.tmpdir(), 'dsh-cv-'));
            try {
                const src = await produce(tmp);
                const produced = await runConvert(soffice, src, tmp, this.config.previewConvertTimeoutMs ?? 60_000);
                storePdf(cachePath, produced);
                return cachePath;
            }
            finally {
                rmSync(tmp, { recursive: true, force: true });
            }
        });
        pruneCache(root);
        return pdf;
    }
    /** 直接下发一个 PDF（预览或下载）。 */
    servePdf(res, pdfPath, displayName, dl) {
        const st = statSync(pdfPath);
        res.writeHead(200, {
            'content-type': 'application/pdf',
            'content-length': String(st.size),
            'content-disposition': disposition(dl ? 'attachment' : 'inline', displayName),
            'cache-control': 'private, max-age=3600',
            'x-preview-converted': 'libreoffice',
        });
        const stream = createReadStream(pdfPath);
        stream.on('error', () => res.end());
        stream.pipe(res);
    }
    /** 转换不可用的统一响应（前端据此降级为下载并提示）。 */
    noConverter(res) {
        const hint = process.platform === 'win32'
            ? 'Windows: 安装 LibreOffice（https://www.libreoffice.org/download/ 或 winget install TheDocumentFoundation.LibreOffice）；'
                + '默认装在 C:\\Program Files\\LibreOffice 会被自动发现，自定义目录请设环境变量 LIBREOFFICE_PATH 或插件配置 libreOfficePath。'
            : 'Linux: apt install -y libreoffice | macOS: brew install --cask libreoffice';
        this.json(res, 501, {
            error: 'converter_unavailable',
            detail: '服务端未安装 LibreOffice（soffice），无法在线预览 Office 文档。' + hint,
        });
    }
    /**
     * 校验 attachmentId 确实出现在该会话的 user/message 附件块里。
     * attachments 存储是全局内容寻址的（attachmentId 即 sha256），仅靠会话归属
     * 校验无法阻止"知道内容哈希就能读任意附件"；这道检查把可读范围收紧到
     * 本会话真正引用过的附件。inspect 读本地 JSONL，代价可接受。
     */
    async attachmentInSession(sessionId, aid) {
        // 命中缓存且该 aid 在集合里 → 直接放行（省掉一次全量 inspect）
        const hit = aidCache.get(sessionId);
        if (hit !== undefined && Date.now() - hit.at < AID_CACHE_TTL_MS && hit.aids.has(aid))
            return true;
        const aids = new Set();
        try {
            const inspection = await this.ctx.sessionController.inspect(sessionId, new AbortController().signal);
            const events = Array.isArray(inspection.events) ? inspection.events : [];
            for (const ev of events) {
                const e = ev;
                if (e?.type !== 'user/message' || !e.data || !Array.isArray(e.data.content))
                    continue;
                for (const p of e.data.content) {
                    const att = p?.attachment;
                    if (typeof att?.attachmentId === 'string')
                        aids.add(att.attachmentId);
                }
            }
        }
        catch {
            return false; // 读不到会话就当作未引用，绝不因异常放行
        }
        // 只缓存"已引用"的正向集合：新上传的附件不在集合里时会重新 inspect，不会被缓存误判
        if (aidCache.size >= AID_CACHE_MAX) {
            const oldest = aidCache.keys().next();
            if (!oldest.done)
                aidCache.delete(oldest.value);
        }
        aidCache.set(sessionId, { aids, at: Date.now() });
        return aids.has(aid);
    }
    /** 会话删除时清掉它的归属缓存。 */
    invalidateSessionCaches(sessionId, workspace) {
        aidCache.delete(sessionId);
        filesCache.delete(workspace);
    }
    // ---- 路由 ----
    registerRoutes() {
        // 注册（员工白名单模式下默认关闭；配置 allowRegistration: true 恢复）
        this.route('/app/auth/register', async (req, res) => {
            if (req.method !== 'POST')
                return this.json(res, 405, { error: 'method_not_allowed' });
            if (this.config.allowRegistration !== true) {
                return this.json(res, 403, { error: 'registration_disabled', detail: '账号由管理员统一导入，如需开通请联系管理员' });
            }
            const { username, password } = await this.readBody(req);
            if (typeof username !== 'string' || !/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
                return this.json(res, 400, { error: 'invalid_username' });
            }
            if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
                return this.json(res, 400, { error: 'password_too_short' });
            }
            try {
                const passwordHash = await this.hashPassword(password);
                const [result] = await this.pool.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
                this.json(res, 200, { ok: true, userId: result.insertId }, { 'set-cookie': this.issueCookie(result.insertId) });
            }
            catch (err) {
                if (err?.code === 'ER_DUP_ENTRY')
                    return this.json(res, 409, { error: 'username_taken' });
                throw err;
            }
        });
        // 登录
        this.route('/app/auth/login', async (req, res) => {
            if (req.method !== 'POST')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const { username, password } = await this.readBody(req);
            // 先剥离一切非数字字符：复制粘贴可能带零宽空格(U+200B)等不可见字符，
            // trim() 去不掉；顺带容忍用户输入空格/横线分隔。前端已做同款清洗，这里兜底。
            const account = String(username ?? '').replace(/\D/g, '');
            // 员工白名单模式：账号一律是导入的手机号，格式不对直接 400，
            // 不进数据库查询（也避免老用户名形式被继续使用）。
            if (!/^1[3-9]\d{9}$/.test(account)) {
                return this.json(res, 400, { error: 'invalid_phone', detail: '账号必须是 11 位手机号' });
            }
            const [rows] = await this.pool.execute('SELECT id, password_hash FROM users WHERE username = ? LIMIT 1', [account]);
            const user = rows[0];
            const ok = user !== undefined && (await this.verifyPassword(String(password ?? ''), String(user.password_hash)));
            if (!ok) {
                await new Promise((r) => setTimeout(r, this.config.loginFailureDelayMs ?? 400));
                return this.json(res, 401, { error: 'bad_credentials' });
            }
            this.json(res, 200, { ok: true, userId: user.id }, { 'set-cookie': this.issueCookie(Number(user.id)) });
        });
        // 登出
        this.route('/app/auth/logout', async (req, res) => {
            if (req.method !== 'POST')
                return this.json(res, 405, { error: 'method_not_allowed' });
            this.json(res, 200, { ok: true }, { 'set-cookie': this.clearCookie() });
        });
        // 当前用户
        this.route('/app/auth/me', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            const [rows] = await this.pool.execute('SELECT username, display_name, created_at FROM users WHERE id = ? LIMIT 1', [userId]);
            const me = rows[0];
            // displayName：员工白名单模式存的是姓名；老用户/未导入行该列为 NULL，回退 username
            this.json(res, 200, {
                userId,
                username: me?.username,
                displayName: me?.display_name ?? me?.username,
                createdAt: me?.created_at,
            });
        });
        // 修改密码（登录后自助）。POST /app/auth/password { currentPassword, newPassword }
        //
        // 设计要点：
        // - 必须先验当前密码（防止共用电脑上他人趁登录态改密）；
        // - 新密码强度：8-128 位，必须同时包含数字、小写字母、大写字母
        //   （初始密码 123456 是弱密码，改密正是为了升级强度，所以这里从严）；
        // - cookie 是无状态 HMAC 签名，改密后**无法吊销其他设备的登录态**
        //   （7 天自然过期）。改密成功由前端主动登出回到登录页。
        // - 旧密码错误时套用与登录相同的固定延迟，抑制爆破。
        this.route('/app/auth/password', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'POST')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const body = await this.readBody(req);
            const currentPassword = String(body.currentPassword ?? '');
            const newPassword = String(body.newPassword ?? '');
            if (newPassword.length < 8 || newPassword.length > 128) {
                return this.json(res, 400, { error: 'invalid_password', detail: '新密码长度需为 8-128 位' });
            }
            if (!(/\d/.test(newPassword) && /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword))) {
                return this.json(res, 400, {
                    error: 'weak_password',
                    detail: '新密码必须同时包含数字、小写字母和大写字母',
                });
            }
            if (newPassword === currentPassword) {
                return this.json(res, 400, { error: 'same_password', detail: '新密码不能与当前密码相同' });
            }
            const [rows] = await this.pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [userId]);
            const stored = String(rows[0]?.password_hash ?? '');
            if (!(await this.verifyPassword(currentPassword, stored))) {
                await new Promise((r) => setTimeout(r, this.config.loginFailureDelayMs ?? 400));
                return this.json(res, 401, { error: 'bad_credentials', detail: '当前密码错误' });
            }
            const passwordHash = await this.hashPassword(newPassword);
            await this.pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
            this.json(res, 200, { ok: true });
        });
        // 会话列表（GET，按 user_id 过滤）/ 创建会话（POST，自动记录归属）
        this.route('/app/sessions', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method === 'GET') {
                const [rows] = await this.pool.execute('SELECT session_id FROM session_owners WHERE user_id = ?', [userId]);
                const mine = new Set(rows.map((r) => String(r.session_id)));
                const { items } = await this.ctx.sessionController.list({}, new AbortController().signal);
                return this.json(res, 200, { items: items.filter((s) => mine.has(s.sessionId)) });
            }
            if (req.method === 'POST') {
                const body = await this.readBody(req);
                // 会话专属工作目录（生成产物的落点，也是左侧文件树「生成产物」的数据源）。
                // 自定义 sessionId 由官方 create 幂等采纳（SessionCommandController.create：
                // request.sessionId ?? `session-${uuid}`，ensureSession(…, true)），先建目录再创建会话。
                const sessionId = `session-${randomUUID()}`;
                const cwd = this.workspaceDir(userId, sessionId);
                mkdirSync(cwd, { recursive: true });
                // 会话创建前先落好该用户的 projectRoot 标记（.git 空目录）与专属技能层，
                // 保证 harness 后续从 cwd 向上找 projectRoot 时停在本用户目录。
                ensureUserSkillRoot(userId);
                const created = await this.ctx.sessionController.create({
                    sessionId,
                    cwd,
                    agentPreset: typeof body.agentPreset === 'string' ? body.agentPreset : undefined,
                });
                // 兼容 0.1.7+：create 返回字段可能改名 id（本地 0.1.3 为 sessionId）
                const createdId = String(created.sessionId ?? created.id ?? '');
                if (!createdId)
                    throw new Error('sessionController.create 未返回会话 ID：' + JSON.stringify(created));
                await this.pool.execute('INSERT INTO session_owners (session_id, user_id) VALUES (?, ?)', [createdId, userId]);
                return this.json(res, 200, { ...created, sessionId: createdId });
            }
            if (req.method === 'DELETE') {
                const sessionId = new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '';
                const cwd = new URL(req.url ?? '', 'http://localhost').searchParams.get('cwd') || undefined;
                if (!sessionId)
                    return this.json(res, 400, { error: 'missing_id' });
                if (!(await this.requireOwnership(res, sessionId, userId)))
                    return;
                // 模型路由状态一并清理（手动选择/最近下发记录）
                this.manualModel.delete(sessionId);
                this.lastRouted.delete(sessionId);
                // 先尽力清理磁盘上的会话 JSONL（不可见、不可访问；失败也不影响软删除）
                this.purgeSessionFiles(sessionId, cwd);
                // 再清理会话专属工作目录（生成产物；失败同样不影响软删除）
                try {
                    const ws = this.workspaceDir(userId, sessionId);
                    if (existsSync(ws))
                        rmSync(ws, { recursive: true, force: true });
                    this.invalidateSessionCaches(sessionId, ws);
                }
                catch (err) {
                    console.warn(`[dsh-plugin-auth] workspace purge skipped for ${sessionId}:`, err);
                }
                try {
                    await this.pool.execute('DELETE FROM session_uploads WHERE session_id = ?', [sessionId]);
                }
                catch (err) {
                    console.warn(`[dsh-plugin-auth] session_uploads purge skipped for ${sessionId}:`, err);
                }
                // 再删除归属行：会话从侧栏消失，且 history/prompt/follow 对该用户全部 404
                await this.pool.execute('DELETE FROM session_owners WHERE session_id = ? AND user_id = ?', [sessionId, userId]);
                return this.json(res, 200, { ok: true });
            }
            this.json(res, 405, { error: 'method_not_allowed' });
        });
        // 读取会话内容（用户提问 + agent 回答都在 events 里）。GET ?id=<sessionId>
        this.route('/app/sessions/history', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            const sessionId = new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '';
            if (!sessionId)
                return this.json(res, 400, { error: 'missing_id' });
            if (!(await this.requireOwnership(res, sessionId, userId)))
                return;
            const inspection = await this.ctx.sessionController.inspect(sessionId, new AbortController().signal);
            this.json(res, 200, inspection);
        });
        // 技能清单（WorkBuddy 式「技能」菜单数据源）。GET /app/skills?id=<sessionId>
        //
        // 只返回 user-invocable 的技能（人类可调用面），模型侧目录由官方 tool-skill 自己管。
        // 会话 cwd 是每会话专属目录，项目级技能（.dsh/skills、.agents/skills）发现不到，
        // 但**用户级根目录 ~/.dsh/skills 与 cwd 无关，始终会被扫描**，所以把技能放那里即可全局可用。
        this.route('/app/skills', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            const sessionId = new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '';
            if (!sessionId)
                return this.json(res, 400, { error: 'missing_id' });
            if (!(await this.requireOwnership(res, sessionId, userId)))
                return;
            // 优先走官方 sessionSkillCatalog（packages/api/session-controller/src/skill-catalog.ts）：
            // 它会按会话的 agent/preset 作用域选正确的技能注册表，并已过滤 user-invocable。
            // 直接用全局 ctx.skills 会拿到一个没有 provider 的注册表（技能由 provider 注册进作用域层），
            // 结果就是返回空清单 —— 所以官方这条链路才是正确入口。
            const withHub = (list) => {
                if (list.length === 0)
                    return list;
                const hubBy = this.installedHubBySkillName(userId);
                if (hubBy.size === 0)
                    return list;
                return list.map((s) => {
                    const meta = hubBy.get(s.name);
                    return meta === undefined ? s : { ...s, hub: meta };
                });
            };
            const catalog = this.ctx.get('sessionSkillCatalog', false);
            if (catalog !== undefined) {
                try {
                    const value = await catalog.list({ sessionId }, AbortSignal.timeout(8000));
                    const skills = value && Array.isArray(value.skills) ? value.skills : [];
                    if (skills.length > 0)
                        return this.json(res, 200, { skills: withHub(skills) });
                }
                catch (err) {
                    console.warn('[dsh-plugin-auth] sessionSkillCatalog.list failed:', err);
                }
            }
            const registry = this.ctx.get('skills', false);
            if (registry !== undefined) {
                const cwd = this.workspaceDir(userId, sessionId);
                try {
                    const all = await registry.list({ cwd, signal: AbortSignal.timeout(8000) });
                    const skills = (all || [])
                        .filter((s) => s && s.invocation && s.invocation.userInvocable)
                        .map((s) => ({
                        name: s.name,
                        description: s.description,
                        ...(s.whenToUse === undefined ? {} : { whenToUse: s.whenToUse }),
                        source: s.source,
                    }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                    if (skills.length > 0)
                        return this.json(res, 200, { skills: withHub(skills) });
                }
                catch (err) {
                    console.warn('[dsh-plugin-auth] skill listing failed:', err);
                }
            }
            // 兜底：官方链路都拿不到（注册表未挂载 / provider 未注册 / 作用域不同）时，
            // 直接扫描该用户专属层 + 全局共享层，保证 UI 里能看到技能。
            ensureUserSkillRoot(userId);
            const scanned = this.scanUserSkills(userId);
            this.json(res, 200, { skills: withHub(scanned), fallback: true });
        });
        // 技能市场索引。GET /app/skills/hub → { configured, skills: [...] }
        //
        // 每一项带 installed / installedVersion / upgradable，UI 据此显示「安装 / 升级 / 已安装」。
        // 未配置 hub.indexUrl 时 configured=false，UI 隐藏市场入口。
        this.route('/app/skills/hub', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'GET')
                return this.json(res, 405, { error: 'method_not_allowed' });
            let index;
            try {
                index = await this.fetchHubIndex();
            }
            catch (err) {
                console.warn('[dsh-plugin-auth] hub index fetch failed:', err);
                return this.json(res, 502, { error: 'hub_unreachable', detail: String(err?.message ?? err) });
            }
            if (!index.configured)
                return this.json(res, 200, { configured: false, skills: [] });
            this.json(res, 200, { configured: true, skills: this.mapHubSkills(index.entries, userId) });
        });
        // 服务端搜索。GET /app/skills/hub/search?q=<关键词> → 把 q 透传给市场索引 URL（?q=），
        // 由市场后端过滤后返回与 /app/skills/hub 同构的 skills 列表。无 q 时等价于整份索引。
        this.route('/app/skills/hub/search', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'GET')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const q = new URL(req.url ?? '', 'http://localhost').searchParams.get('q') ?? '';
            let index;
            try {
                index = await this.fetchHubIndex(q);
            }
            catch (err) {
                console.warn('[dsh-plugin-auth] hub search failed:', err);
                return this.json(res, 502, { error: 'hub_unreachable', detail: String(err?.message ?? err) });
            }
            if (!index.configured)
                return this.json(res, 200, { configured: false, skills: [] });
            this.json(res, 200, { configured: true, skills: this.mapHubSkills(index.entries, userId) });
        });
        // 安装 / 升级一个市场技能（装到**当前登录用户**的专属层）。POST { slug }
        this.route('/app/skills/hub/install', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'POST')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const body = await this.readBody(req);
            const slug = String(body.slug ?? '');
            if (!HUB_SLUG_PATTERN.test(slug))
                return this.json(res, 400, { error: 'bad_slug' });
            let index;
            try {
                index = await this.fetchHubIndex();
            }
            catch (err) {
                return this.json(res, 502, { error: 'hub_unreachable', detail: String(err?.message ?? err) });
            }
            const entry = index.entries.find((e) => e.slug === slug);
            if (entry === undefined)
                return this.json(res, 404, { error: 'not_found' });
            try {
                const meta = await this.installHubEntry(entry, userId);
                this.json(res, 200, { ok: true, skill: meta });
            }
            catch (err) {
                console.warn(`[dsh-plugin-auth] hub install ${slug} failed:`, err);
                this.json(res, 502, { error: 'install_failed', detail: String(err?.message ?? err) });
            }
        });
        // 卸载一个市场技能（只卸**当前登录用户**层里的）。POST { slug }
        this.route('/app/skills/hub/uninstall', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'POST')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const body = await this.readBody(req);
            const slug = String(body.slug ?? '');
            if (!HUB_SLUG_PATTERN.test(slug))
                return this.json(res, 400, { error: 'bad_slug' });
            this.json(res, 200, { ok: this.uninstallHubSlug(slug, userId) });
        });
        // 模型目录：所有可选模型（deepseek 内置 + llm-pi-ai 配置的厂商）+ 部署默认。
        // GET /app/models
        this.route('/app/models', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'GET')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const modelCatalog = this.ctx.sessionController.modelCatalog;
            if (typeof modelCatalog !== 'function') {
                return this.json(res, 501, { error: 'unsupported', detail: 'dsh 版本过旧，无 modelCatalog' });
            }
            try {
                const catalog = await modelCatalog.call(this.ctx.sessionController);
                this.json(res, 200, {
                    default: catalog.default,
                    groups: catalog.groups,
                    failures: catalog.failures,
                    // 告诉前端自动路由是否启用（没配规则时 UI 只显示手动选择）
                    autoRouting: this.config.modelRouting?.enabled !== false
                        && (this.config.modelRouting?.rules?.length ?? 0) > 0,
                });
            }
            catch (err) {
                this.json(res, 502, { error: 'catalog_failed', detail: String(err?.message ?? err) });
            }
        });
        // 会话模型选择。POST /app/model
        //   { sessionId, provider, model }  手动选定（本会话跳过自动路由）
        //   { sessionId, auto: true }        切回自动路由
        //   GET /app/model?id=<sessionId>    查询当前模式
        this.route('/app/model', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            const sessionId = req.method === 'GET'
                ? new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? ''
                : '';
            if (req.method === 'GET') {
                if (!sessionId)
                    return this.json(res, 400, { error: 'missing_sessionId' });
                if (!(await this.requireOwnership(res, sessionId, userId)))
                    return;
                const manual = this.manualModel.get(sessionId);
                return this.json(res, 200, manual
                    ? { mode: 'manual', provider: manual.provider, model: manual.model }
                    : { mode: 'auto' });
            }
            if (req.method !== 'POST')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const body = await this.readBody(req);
            const sid = String(body.sessionId ?? '');
            if (!sid)
                return this.json(res, 400, { error: 'missing_sessionId' });
            if (!(await this.requireOwnership(res, sid, userId)))
                return;
            const selectModel = this.ctx.sessionController.selectModel;
            if (typeof selectModel !== 'function') {
                return this.json(res, 501, { error: 'unsupported', detail: 'dsh 版本过旧，无 selectModel' });
            }
            if (body.auto === true) {
                this.manualModel.delete(sid);
                return this.json(res, 200, { ok: true, mode: 'auto' });
            }
            const provider = String(body.provider ?? '');
            const model = String(body.model ?? '');
            if (!provider || !model)
                return this.json(res, 400, { error: 'missing_fields' });
            try {
                // 先让官方校验（模型不存在会抛 session/model-unavailable），成功才记手动选择
                await selectModel.call(this.ctx.sessionController, { sessionId: sid, provider, model });
                this.manualModel.set(sid, { provider, model });
                this.lastRouted.set(sid, { provider, model });
                this.json(res, 200, { ok: true, mode: 'manual', provider, model });
            }
            catch (err) {
                this.json(res, 400, { error: 'model_unavailable', detail: String(err?.message ?? err) });
            }
        });
        // 向会话发送一条消息。POST { sessionId, text, attachments?: [receiptId], mode?: 'queue'|'steer' }
        this.route('/app/sessions/prompt', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'POST')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const body = await this.readBody(req);
            const sessionId = String(body.sessionId ?? '');
            const text = String(body.text ?? '');
            const attachments = Array.isArray(body.attachments)
                ? body.attachments.map((r) => String(r))
                : [];
            if (!sessionId || (!text && attachments.length === 0))
                return this.json(res, 400, { error: 'missing_fields' });
            if (!(await this.requireOwnership(res, sessionId, userId)))
                return;
            // 并发闸门：超过全局/每人上限时抛 429，前端提示排队而不是静默失败。
            // 注意 prompt 是「投递即返回」的，投递成功并不代表这一轮已经结束，
            // 因此额度靠 agent.status 在下次检查时回收（见 reconcileActiveTurns）。
            const blocked = this.admitTurn(sessionId, userId);
            if (blocked !== null)
                throw blocked;
            // 旧会话保险：本会话创建早于「按用户隔离」改动时，这里补上 projectRoot 标记，
            // 确保本次 turn 的技能发现（/name 展开、agent 技能清单）落在该用户专属层。
            ensureUserSkillRoot(userId);
            // 模型难度路由：按任务文本选模型（手动选择的会话跳过）。在投递前生效 ——
            // selectModel 写的 model/selection 事件正是被本次 prompt 消费的。
            const routed = text ? await this.routeModelForPrompt(sessionId, text) : null;
            const content = [];
            if (text)
                content.push({ type: 'text', text });
            for (const receiptId of attachments)
                content.push({ type: 'file', receiptId });
            const value = await this.ctx.sessionController.prompt({
                requestId: randomUUID(),
                sessionId,
                mode: body.mode === 'steer' ? 'steer' : 'queue',
                content,
                clientTimeZone: typeof body.clientTimeZone === 'string' ? body.clientTimeZone : undefined,
            }, new AbortController().signal);
            this.recordTurn(sessionId, userId);
            this.json(res, 200, { ...(value ?? { ok: true }), ...(routed ? { routedModel: routed } : {}) });
        });
        // 取消正在进行的一轮对话（前端"停止"按钮）。
        // POST /app/sessions/cancel  { sessionId, deep?: true }
        //
        // 官方 sessionController.cancel 调用的是 agent.cancel({kind:'user'}, {keepInbox:true})：
        // 只中断当前这一步，inbox 里排队的消息会被继续消费 —— 所以"点了停止又自动跑起来"。
        // deep=true（默认）时在官方 cancel 之后，再直接对 agent 发一次 keepInbox:false 的取消，
        // 把待处理队列一并清掉，实现真正的停止。
        this.route('/app/sessions/cancel', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'POST')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const body = await this.readBody(req);
            const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
            if (!sessionId)
                return this.json(res, 400, { error: 'missing_sessionId' });
            if (!(await this.requireOwnership(res, sessionId, userId)))
                return;
            const deep = body?.deep !== false;
            const cancel = this.ctx.sessionController.cancel;
            const agents = this.ctx.get('agents', false);
            const agent = agents?.get(sessionId);
            if (typeof cancel !== 'function' && typeof agent?.cancel !== 'function') {
                // 极老的 dsh（<0.1.2）没有 cancel 命令；此时只能前端丢弃流，服务端仍在跑。
                return this.json(res, 501, {
                    error: 'cancel_unsupported',
                    detail: '当前 dsh 版本没有可用的 cancel 能力，请升级到 >= 0.1.3-alpha.2',
                });
            }
            const abortLike = (s) => /abort|cancel|interrupt|stopped|wait aborted|已停止|中断/i.test(s);
            let inboxCleared = false;
            const notes = [];
            try {
                if (typeof cancel === 'function') {
                    await cancel.call(this.ctx.sessionController, { sessionId });
                }
            }
            catch (err) {
                const msg = String(err?.message ?? err);
                // 停止过程中被 abort 掉的内部等待（如 jobs.wait 抛 'wait aborted'）
                // 是用户主动停止的正常副产物，不该报成失败。
                if (abortLike(msg)) {
                    this.json(res, 200, { accepted: true, inboxCleared: false, notes: ['ignored: ' + msg] });
                    return;
                }
                notes.push('cancel: ' + msg);
            }
            if (deep && typeof agent?.cancel === 'function') {
                try {
                    agent.cancel({ kind: 'user' }, { keepInbox: false });
                    inboxCleared = true;
                }
                catch (err) {
                    notes.push('deep: ' + String(err?.message ?? err));
                }
            }
            this.json(res, 200, { accepted: true, inboxCleared, notes });
        });
        // 实时流（SSE）：官方 follow 流的旁路出口，帧结构与 SessionFollowFrame 一致。
        // GET /app/sessions/follow?id=<sessionId>，text/event-stream。
        this.route('/app/sessions/follow', async (req, res) => {
            const userId = this.currentUser(req);
            if (userId === null)
                return this.json(res, 401, { error: 'unauthorized' });
            const sessionId = new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '';
            if (!sessionId)
                return this.json(res, 400, { error: 'missing_id' });
            if (!(await this.requireOwnership(res, sessionId, userId)))
                return;
            res.writeHead(200, {
                'content-type': 'text/event-stream; charset=utf-8',
                'cache-control': 'no-store',
                connection: 'keep-alive',
                'x-accel-buffering': 'no',
            });
            const ac = new AbortController();
            req.on('close', () => ac.abort());
            // 心跳防中间层断连（nginx 默认 60s 读超时）
            const heartbeat = setInterval(() => { res.write(': ping\n\n'); }, 20_000);
            try {
                for await (const frame of this.ctx.sessionController.follow({ address: { kind: 'session', sessionId }, assistantStream: true }, ac.signal)) {
                    res.write('data: ' + JSON.stringify(frame) + '\n\n');
                }
            }
            catch (err) {
                // 流被 abort（用户停止 / 客户端断开）是预期内的，不要写成错误帧吓前端
                const msg = String(err?.message ?? err);
                const aborted = ac.signal.aborted || /abort|cancel|interrupt|stopped/i.test(msg);
                if (!aborted) {
                    // 头已发出，只能以帧形式报告错误；浏览器 EventSource 会自动重连
                    res.write('data: ' + JSON.stringify({ type: 'stream-error', message: msg }) + '\n\n');
                }
            }
            finally {
                clearInterval(heartbeat);
                res.end();
            }
        });
        // 上传文件到指定会话（返回 receiptId，供 prompt 的 attachments 引用）。
        // POST /app/upload?id=<sessionId>，请求体为原始文件字节，
        // 头部 x-file-name 传 URL 编码的文件名。上限 50MB。
        this.route('/app/upload', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'POST')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const sessionId = new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '';
            if (!sessionId)
                return this.json(res, 400, { error: 'missing_id' });
            if (!(await this.requireOwnership(res, sessionId, userId)))
                return;
            const rawName = req.headers['x-file-name'];
            const name = rawName === undefined ? undefined : decodeURIComponent(String(rawName)).slice(0, 200);
            // fileUploads 是官方 @deepseek-ai/dsh-file-upload 提供的可选服务：
            // 不声明到 `inject`（避免整树 loading pending），
            // 通过 cordis 提供的 ctx.get(name, false) 拓扑无关查找读取。
            // 未提供时返回 503，不影响核心功能。
            // 参见 docs/postmortem/0001-acp-default-export-drops-inject.md
            const fileUploads = this.ctx.get('fileUploads', false);
            if (fileUploads === undefined) {
                return this.json(res, 503, {
                    error: 'uploads_unavailable',
                    detail: 'fileUploads 服务在当前 profile 未激活，文件上传不可用',
                });
            }
            const MAX = 52_428_800;
            // 移动端目录上传方案：.zip 边上传边缓冲，上传完成后解压、按相对路径逐条挂到会话上
            const isZip = typeof name === 'string' && name.toLowerCase().endsWith('.zip');
            let size = 0;
            const zipChunks = [];
            const source = req;
            const data = {
                async *[Symbol.asyncIterator]() {
                    for await (const chunk of source) {
                        size += chunk.length;
                        if (size > MAX)
                            throw Object.assign(new Error('file too large'), { statusCode: 413 });
                        if (isZip)
                            zipChunks.push(chunk);
                        yield chunk;
                    }
                },
            };
            const result = await fileUploads.uploadStream({ sessionId, data, name });
            // 记下「相对路径 → attachmentId」：官方存的是叶子名，右栏还原目录结构靠这张表
            const aid = String(result.file?.attachmentId ?? '');
            if (aid) {
                try {
                    await this.pool.execute('INSERT INTO session_uploads (session_id, attachment_id, path, bytes) VALUES (?, ?, ?, ?) ' +
                        'ON DUPLICATE KEY UPDATE path = VALUES(path), bytes = VALUES(bytes)', [sessionId, aid, name ?? 'file', size]);
                }
                catch (err) {
                    // 登记表失败不影响上传本身（右栏会退化为扁平文件名）
                    console.warn('[dsh-plugin-auth] session_uploads record failed:', err);
                }
            }
            // ZIP 自动解压（移动端目录上传）：条目已清洗（无 ../、无目录项/垃圾），
            // 命名规则与桌面目录上传一致 —— 全部条目共享同一顶层目录时保持原样，
            // 否则以「zip 去扩展名」为顶层目录前缀，保证右栏能拼出完整目录树。
            let extracted = 0;
            let extractLabel = '';
            let extractError;
            if (isZip && size > 0) {
                try {
                    const entries = extractZipEntries(Buffer.concat(zipChunks));
                    const base = (name ?? 'zip').replace(/\.zip$/i, '').trim() || 'zip';
                    const roots = new Set(entries.map(e => e.name.split('/')[0]));
                    const singleRoot = entries.length > 0 && roots.size === 1;
                    const prefix = singleRoot ? '' : base + '/';
                    extractLabel = singleRoot ? Array.from(roots)[0] : base;
                    for (const e of entries) {
                        const one = {
                            async *[Symbol.asyncIterator]() { yield e.data; },
                        };
                        const r = await fileUploads.uploadStream({ sessionId, data: one, name: prefix + e.name });
                        const ea = String(r.file?.attachmentId ?? '');
                        if (ea) {
                            try {
                                await this.pool.execute('INSERT INTO session_uploads (session_id, attachment_id, path, bytes) VALUES (?, ?, ?, ?) ' +
                                    'ON DUPLICATE KEY UPDATE path = VALUES(path), bytes = VALUES(bytes)', [sessionId, ea, prefix + e.name, e.data.length]);
                            }
                            catch (err) {
                                console.warn('[dsh-plugin-auth] session_uploads record failed:', err);
                            }
                        }
                        extracted++;
                    }
                }
                catch (err) {
                    extractError = err instanceof Error ? err.message : String(err);
                    console.warn('[dsh-plugin-auth] zip extract failed:', extractError);
                }
            }
            this.json(res, 200, { receiptId: result.receiptId, name: name ?? 'file', aid, extracted, extractLabel, extractError });
        });
        // 列出会话工作目录里的生成产物（左侧文件树「生成产物」分区）。
        // GET /app/sessions/files?id=<sessionId> → { items: [{path,size,mtime}] }
        // 仅新会话（专属 cwd 建立的）有内容；老会话目录不存在时返回空列表。
        this.route('/app/sessions/files', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'GET')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const sessionId = new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '';
            if (!sessionId)
                return this.json(res, 400, { error: 'missing_id' });
            if (!(await this.requireOwnership(res, sessionId, userId)))
                return;
            const ws = this.workspaceDir(userId, sessionId);
            if (!existsSync(ws))
                return this.json(res, 200, { items: [] });
            const ttl = this.config.filesCacheTtlMs ?? 1000;
            if (ttl > 0) {
                const cached = filesCache.get(ws);
                if (cached !== undefined && Date.now() - cached.at < ttl) {
                    return this.json(res, 200, { items: cached.items });
                }
            }
            const items = this.listWorkspaceFiles(ws);
            // 文件列表返回后，后台悄悄预转换 Office 文档，用户点开即秒开（不阻塞本响应）
            void this.warmWorkspaceFiles(userId, sessionId);
            if (ttl > 0) {
                if (filesCache.size >= FILES_CACHE_MAX) {
                    const oldest = filesCache.keys().next();
                    if (!oldest.done)
                        filesCache.delete(oldest.value);
                }
                filesCache.set(ws, { items, at: Date.now() });
            }
            this.json(res, 200, { items });
        });
        // 上传附件的目录结构（右栏「工作空间 → 上传附件」按此还原树形）。
        // GET /app/sessions/uploads?id=<sessionId> → { items: [{path, aid, bytes}] }
        // 数据来自 /app/upload 时登记的 session_uploads；老会话（无登记）返回空，
        // 前端自动退回按事件里的叶子名扁平展示。
        this.route('/app/sessions/uploads', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'GET')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const sessionId = new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '';
            if (!sessionId)
                return this.json(res, 400, { error: 'missing_id' });
            if (!(await this.requireOwnership(res, sessionId, userId)))
                return;
            try {
                const [rows] = await this.pool.execute('SELECT attachment_id, path, bytes FROM session_uploads WHERE session_id = ? ORDER BY id', [sessionId]);
                this.json(res, 200, {
                    items: rows.map((r) => ({
                        aid: String(r.attachment_id),
                        path: String(r.path),
                        bytes: r.bytes === null || r.bytes === undefined ? null : Number(r.bytes),
                    })),
                });
            }
            catch (err) {
                this.json(res, 200, { items: [] });
            }
        });
        // 下载/预览会话工作目录里的一个生成产物。
        // GET /app/sessions/file?id=<sessionId>&path=<相对路径>[&dl=1]
        // 防穿越：resolve + realpath 双重校验，越界一律 400。
        this.route('/app/sessions/file', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'GET')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const u = new URL(req.url ?? '', 'http://localhost');
            const sessionId = u.searchParams.get('id') ?? '';
            const rel = u.searchParams.get('path') ?? '';
            if (!sessionId || !rel)
                return this.json(res, 400, { error: 'missing_params' });
            if (!(await this.requireOwnership(res, sessionId, userId)))
                return;
            if (!safeName(rel))
                return this.json(res, 400, { error: 'bad_path' });
            const ws = this.workspaceDir(userId, sessionId);
            const full = resolve(ws, rel);
            if (full !== ws && !full.startsWith(ws + sep))
                return this.json(res, 400, { error: 'bad_path' });
            let realFull, realWs;
            try {
                realFull = realpathSync(full);
                realWs = realpathSync(ws);
            }
            catch {
                return this.json(res, 404, { error: 'not_found' });
            }
            if (!realFull.startsWith(realWs + sep))
                return this.json(res, 400, { error: 'bad_path' });
            let st;
            try {
                st = statSync(realFull);
            }
            catch {
                return this.json(res, 404, { error: 'not_found' });
            }
            if (!st.isFile())
                return this.json(res, 400, { error: 'not_a_file' });
            const name = rel.split('/').pop() ?? 'file';
            const dl = u.searchParams.get('dl') === '1';
            // as=pdf：Office 文档（docx/xlsx/pptx…）服务端转 PDF 后预览/下载。
            // 本身是 PDF 就原样下发；不支持的扩展名 415；无转换器 501（前端降级为下载）。
            if (u.searchParams.get('as') === 'pdf' && extname(name).toLowerCase() !== '.pdf') {
                if (!convertible(name)) {
                    return this.json(res, 415, { error: 'not_convertible', detail: '该格式无法转换为 PDF 预览' });
                }
                if (this.soffice() === undefined)
                    return this.noConverter(res);
                const key = createHash('sha256')
                    .update(`ws|${userId}|${sessionId}|${rel}|${st.size}|${Math.floor(st.mtimeMs)}`)
                    .digest('hex');
                try {
                    const pdf = await this.ensurePdf(key, async () => realFull);
                    if (pdf === undefined)
                        return this.noConverter(res);
                    return this.servePdf(res, pdf, basename(name, extname(name)) + '.pdf', dl);
                }
                catch (err) {
                    console.warn(`[dsh-plugin-auth] pdf convert failed (${rel}):`, err instanceof Error ? err.message : err);
                    const code = typeof err?.statusCode === 'number'
                        ? err.statusCode : 500;
                    return this.json(res, code, {
                        error: 'convert_failed',
                        detail: err instanceof Error ? err.message : String(err),
                    });
                }
            }
            res.writeHead(200, {
                'content-type': mimeOf(name),
                'content-length': String(st.size),
                'content-disposition': disposition(dl ? 'attachment' : 'inline', name),
                'cache-control': 'no-store',
            });
            const stream = createReadStream(realFull);
            stream.on('error', () => res.end());
            stream.pipe(res);
        });
        // 取回一条上传附件的内容（预览/下载）。数据源是官方 attachments 服务：
        // 文件走 readFileStream（files/<sha[:2]>/<sha>/<name> 布局），
        // 图片走 readImage（normalizedImagePath 布局，img=1 区分）。
        // GET /app/att?id=<sessionId>&aid=<sha256:…>&name=<文件名>[&img=1][&mt=<mediaType>][&b=<bytes>][&dl=1]
        this.route('/app/att', async (req, res) => {
            const userId = this.requireUser(req, res);
            if (userId === null)
                return;
            if (req.method !== 'GET')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const u = new URL(req.url ?? '', 'http://localhost');
            const sessionId = u.searchParams.get('id') ?? '';
            const aid = u.searchParams.get('aid') ?? '';
            const name = u.searchParams.get('name') ?? '';
            const isImg = u.searchParams.get('img') === '1';
            const mt = u.searchParams.get('mt') ?? '';
            const bytes = Number(u.searchParams.get('b') ?? '0');
            if (!sessionId || !aid || !name)
                return this.json(res, 400, { error: 'missing_params' });
            if (!(await this.requireOwnership(res, sessionId, userId)))
                return;
            if (!AID_PATTERN.test(aid) || !safeName(name))
                return this.json(res, 400, { error: 'bad_params' });
            // 收紧：附件必须是本会话消息里真正引用过的（防跨会话按哈希探测读取）
            if (!(await this.attachmentInSession(sessionId, aid)))
                return this.json(res, 404, { error: 'not_found' });
            const attachments = this.attachments();
            if (attachments === undefined) {
                return this.json(res, 503, { error: 'attachments_unavailable', detail: 'attachments 服务未激活' });
            }
            // as=pdf：上传的 Office 文档同样转 PDF 后预览。
            // 附件内容是 sha256 内容寻址的，缓存 key 直接用 aid（内容不变则永不过期）。
            if (u.searchParams.get('as') === 'pdf' && !isImg) {
                const fn = name.split('/').pop() || 'attachment';
                if (!convertible(fn)) {
                    return this.json(res, 415, { error: 'not_convertible', detail: '该格式无法转换为 PDF 预览' });
                }
                if (this.soffice() === undefined)
                    return this.noConverter(res);
                const ext = extname(fn).toLowerCase();
                const key = createHash('sha256').update(`att|${aid}|${ext}`).digest('hex');
                try {
                    const pdf = await this.ensurePdf(key, async (tmp) => {
                        const src = join(tmp, 'input' + ext);
                        await writeToFile(src, attachments.readFileStream({ attachmentId: aid, name, bytes: Number.isFinite(bytes) ? bytes : 0 }), 64 * 1024 * 1024);
                        return src;
                    });
                    if (pdf === undefined)
                        return this.noConverter(res);
                    return this.servePdf(res, pdf, basename(fn, ext) + '.pdf', u.searchParams.get('dl') === '1');
                }
                catch (err) {
                    console.warn(`[dsh-plugin-auth] pdf convert failed (${aid}):`, err instanceof Error ? err.message : err);
                    const code = typeof err?.statusCode === 'number'
                        ? err.statusCode : 500;
                    return this.json(res, code, {
                        error: 'convert_failed',
                        detail: err instanceof Error ? err.message : String(err),
                    });
                }
            }
            const dl = u.searchParams.get('dl') === '1';
            const fileName = name.split('/').pop() || 'attachment';
            const contentType = isImg && mt ? mt : mimeOf(fileName);
            const headers = {
                'content-type': contentType,
                'content-disposition': disposition(dl ? 'attachment' : 'inline', fileName),
                // attachmentId 即内容哈希，同一 id 的内容永不变 → 可永久缓存
                'cache-control': 'private, max-age=31536000, immutable',
            };
            try {
                if (isImg) {
                    const stored = await attachments.readImage({
                        attachmentId: aid, mediaType: mt || 'image/png',
                        bytes: Number.isFinite(bytes) ? bytes : 0, width: 0, height: 0, name: fileName,
                    });
                    await this.streamOut(res, 200, { ...headers, 'content-length': String(stored.data.byteLength) }, [stored.data]);
                }
                else {
                    await this.streamOut(res, 200, headers, attachments.readFileStream({ attachmentId: aid, name, bytes: Number.isFinite(bytes) ? bytes : 0 }));
                }
            }
            catch (err) {
                if (!res.headersSent)
                    this.json(res, 404, { error: 'not_found' });
                else
                    res.end();
                console.warn(`[dsh-plugin-auth] att read failed (${aid}):`, err instanceof Error ? err.message : err);
            }
        });
        // 运行指标。GET /app/health -> 并发占用 / 内存 / MySQL / 预览队列快照。
        //
        // 用途：判断「现在还有多少余量」以及「被闸门拦了多少」。dsh web 是单进程
        // 单事件循环，扩容决策看的是**同时进行中的对话轮**而不是在线人数
        // （SSE 长连接很轻）。turns.running 逼近 limitGlobal 时就该加实例或升配置了。
        //
        // 需要登录：不向未认证者泄露 pid/内存/负载。外部存活探针请直接探 /app
        // （未登录也返回 200 的静态页），本端点定位为登录后的诊断视图。
        this.route('/app/health', async (req, res) => {
            if (this.requireUser(req, res) === null)
                return;
            if (req.method !== 'GET')
                return this.json(res, 405, { error: 'method_not_allowed' });
            const agents = this.ctx.get('agents', false);
            this.reconcileActiveTurns(agents);
            const byUser = {};
            for (const rec of this.activeTurns.values()) {
                const k = String(rec.userId);
                byUser[k] = (byUser[k] ?? 0) + 1;
            }
            let mysqlReachable = true;
            let userCount = null;
            let sessionCount = null;
            try {
                const [u] = await this.pool.query('SELECT COUNT(*) AS n FROM users');
                const [s] = await this.pool.query('SELECT COUNT(*) AS n FROM session_owners');
                userCount = Number(u[0]?.n ?? 0);
                sessionCount = Number(s[0]?.n ?? 0);
            }
            catch (err) {
                mysqlReachable = false;
                console.warn('[dsh-plugin-auth] health: mysql query failed:', err instanceof Error ? err.message : err);
            }
            const mem = process.memoryUsage();
            const mb = (n) => Math.round(n / 1_048_576);
            this.json(res, 200, {
                ok: mysqlReachable,
                uptimeSec: Math.floor(process.uptime()),
                pid: process.pid,
                node: process.version,
                cpus: os.cpus?.().length ?? 0,
                loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
                turns: {
                    running: this.activeTurns.size,
                    limitGlobal: this.maxTurnsGlobal,
                    limitPerUser: this.maxTurnsPerUser,
                    byUser,
                },
                preview: {
                    converting: convertLimiter.activeCount,
                    queued: convertLimiter.pendingCount,
                    limit: convertLimiter.limit,
                    available: this.soffice() !== undefined,
                },
                mysql: {
                    reachable: mysqlReachable,
                    users: userCount,
                    sessions: sessionCount,
                    poolLimit: this.config.mysql.connectionLimit ?? 20,
                },
                memory: {
                    rssMb: mb(mem.rss),
                    heapUsedMb: mb(mem.heapUsed),
                    externalMb: mb(mem.external),
                },
            });
        });
        // 预览能力探测：前端据此决定 Office 文档走 PDF 预览还是直接下载。
        // GET /app/preview/status -> { convert: boolean }
        this.route('/app/preview/status', async (req, res) => {
            if (this.requireUser(req, res) === null)
                return;
            if (req.method !== 'GET')
                return this.json(res, 405, { error: 'method_not_allowed' });
            this.json(res, 200, { convert: this.soffice() !== undefined });
        });
        // 多用户前端页面
        this.route('/app', async (req, res) => {
            if (req.method !== 'GET' && req.method !== 'HEAD')
                return this.json(res, 405, { error: 'method_not_allowed' });
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : UI_HTML);
        });
    }
}
