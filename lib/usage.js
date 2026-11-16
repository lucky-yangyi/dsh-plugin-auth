/**
 * usage — 会话用量采集器。
 *
 * 设计原则（与 index.ts 一致：零 harness 源码改动、不依赖官方 pre-stable 包）：
 *
 * 1. **数据源是官方会话日志**，不是实时埋点。
 *    官方把每一轮都持久化到 ~/.dsh/sessions/<编码cwd>/<sessionId>/session[.vN].jsonl[.zstd]，
 *    其中 `assistant/message.data.usage` 是 provider 上报的**精确** token 数。
 *    日志天然幂等（有 seq）、天然完整（关页面不影响），比在 SSE 里补埋点可靠：
 *    后者多标签页/断线重连会重复收帧，用户关页面还会漏采。
 *
 * 2. **多帧容器**：日志是「一帧一批」追加写入的 zstd 串联容器
 *    （concatenated frames），`zstdDecompressSync` 只解第一帧。
 *    这里移植官方 session-persistence-jsonl 的帧边界扫描思路（纯结构解析，不解压），
 *    再逐帧解压 —— 零第三方依赖，Windows/Linux 通用，不需要系统装 zstd。
 *
 * 3. **软保留**：index.ts 的 purgeSessionFiles 会在用户删会话时删掉磁盘日志。
 *    所以统计必须尽早入库，且 usage_turns / usage_daily **不随会话删除而删**，
 *    否则用户一删会话，历史用量就永久丢失。
 *
 * 4. **按 (session_id, turn) 幂等 upsert**：重复扫描不会重复计数；
 *    同一轮后续补齐（例如本轮尚未结束、下次才写入 usage）会被正确覆盖。
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as os from 'node:os';
import { basename, join } from 'node:path';
import * as zlib from 'node:zlib';
// ---------------------------------------------------------------------------
// 多帧 zstd 解码
// ---------------------------------------------------------------------------
const ZSTD_MAGIC = 0xFD2FB528;
/**
 * 纯结构性定位串联 zstd 容器里的每一帧边界（不解压 block，只按格式跳过）。
 *
 * 帧格式：magic(4) + frame header(可变) + blocks（每块 3 字节头）+ 可选 4 字节 checksum。
 * EOF 落在最后一帧中间时返回 tornStart（正在写入的半帧），调用方应丢弃该尾部。
 */
function scanZstdFrames(buffer) {
    const frames = [];
    let offset = 0;
    while (offset < buffer.length) {
        const start = offset;
        if (buffer.length - offset < 4)
            return { frames, tornStart: start };
        if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
            // 结构损坏：已解出的帧仍然可用，剩下的丢掉即可（不抛，避免一个坏会话拖垮整次扫描）
            return { frames, tornStart: start };
        }
        offset += 4;
        if (offset === buffer.length)
            return { frames, tornStart: start };
        const descriptor = buffer.readUInt8(offset);
        offset += 1;
        if ((descriptor & 0x18) !== 0)
            return { frames, tornStart: start };
        const contentSizeFlag = descriptor >>> 6;
        const singleSegment = (descriptor & 0x20) !== 0;
        const checksum = (descriptor & 0x04) !== 0;
        const dictionaryFlag = descriptor & 0x03;
        const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
        const contentSizeBytes = contentSizeFlag === 0
            ? (singleSegment ? 1 : 0)
            : 1 << contentSizeFlag;
        const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
        if (buffer.length - offset < remainingHeaderBytes)
            return { frames, tornStart: start };
        offset += remainingHeaderBytes;
        for (;;) {
            if (buffer.length - offset < 3)
                return { frames, tornStart: start };
            const blockHeader = buffer.readUIntLE(offset, 3);
            offset += 3;
            const lastBlock = (blockHeader & 1) !== 0;
            const blockType = (blockHeader >>> 1) & 0x03;
            const blockSize = blockHeader >>> 3;
            if (blockType === 0x03)
                return { frames, tornStart: start };
            const payloadBytes = blockType === 0x01 ? 1 : blockSize;
            if (buffer.length - offset < payloadBytes)
                return { frames, tornStart: start };
            offset += payloadBytes;
            if (lastBlock)
                break;
        }
        if (checksum) {
            if (buffer.length - offset < 4)
                return { frames, tornStart: start };
            offset += 4;
        }
        frames.push({ start, end: offset });
    }
    return { frames };
}
/** Node 内置 zstd（Node 22.15+ / 24）在 @types 里可能还没声明，这里做最小类型断言。 */
const zlibZstd = zlib;
/**
 * 解一个会话日志为纯 JSONL 文本。
 * 优先 Node 内置 zstd；没有则退回系统 `zstd` 命令；两者都不可用时抛错（调用方跳过该文件）。
 */
function readSessionLog(file) {
    const buf = readFileSync(file);
    if (!file.endsWith('.zstd'))
        return buf.toString('utf8');
    const decompress = zlibZstd.zstdDecompressSync;
    if (typeof decompress === 'function') {
        const { frames } = scanZstdFrames(buf);
        if (frames.length === 0)
            return '';
        let text = '';
        for (const frame of frames) {
            try {
                text += decompress.call(zlib, buf.subarray(frame.start, frame.end)).toString('utf8');
            }
            catch {
                // 单帧损坏不影响其余帧：跳过这一批事件
            }
        }
        return text;
    }
    // 兜底：系统 zstd（部分环境 Node 版本较老）
    return execFileSync('zstd', ['-d', '-c', '-q', file], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
}
/** 系统注入的 user/message（运行上下文、技能清单等）文本前缀，不能当成用户提问。 */
const SYSTEM_TEXT_PREFIXES = [
    'Current runtime context',
    '<system-reminder>',
    '<available_skills>',
    'AGENTS.md',
];
function asRecord(value) {
    return typeof value === 'object' && value !== null ? value : undefined;
}
function asCount(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function textOfContent(content) {
    if (!Array.isArray(content))
        return '';
    const parts = [];
    for (const block of content) {
        const b = asRecord(block);
        if (b?.type === 'text' && typeof b.text === 'string')
            parts.push(b.text);
    }
    return parts.join('\n').trim();
}
function countFiles(content) {
    if (!Array.isArray(content))
        return 0;
    let n = 0;
    for (const block of content) {
        const b = asRecord(block);
        if (b?.type === 'file' || b?.type === 'image')
            n++;
    }
    return n;
}
/** 真实用户输入判定：优先看 source.kind，老日志无 source 时按文本前缀兜底。 */
function isUserPrompt(data, text) {
    const source = asRecord(data.source);
    if (source !== undefined && typeof source.kind === 'string')
        return source.kind === 'user';
    return !SYSTEM_TEXT_PREFIXES.some((prefix) => text.startsWith(prefix));
}
function excerpt(text, max) {
    const flat = text.replace(/\s+/g, ' ').trim();
    if (flat.length === 0)
        return '';
    return flat.length <= max ? flat : flat.slice(0, max) + '…';
}
/**
 * 把一份日志折叠成「每轮一条」用量记录。
 *
 * 关键字段来自：
 * - `turn/start` / `turn/end`      → 轮次边界、耗时、结束原因
 * - `user/message`                → 用户提问（过滤系统注入）+ 附件数
 * - `assistant/message.data.usage` → provider 精确 token（含 cache 分桶）
 * - `...message.source`           → 实际路由到的 provider/model
 * - `tool/call`                   → 调用了哪些工具
 * - `session/title`               → 官方自动生成的会话标题（取最后一次，LLM 版优于 fallback）
 */
export function parseSessionLog(text, fallbackSessionId, userId, excerptChars) {
    const events = [];
    let sessionId = fallbackSessionId;
    let title = null;
    for (const line of text.split('\n')) {
        if (line.length === 0)
            continue;
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch {
            continue;
        }
        const event = asRecord(parsed);
        if (event === undefined)
            continue;
        if (event.type === 'session' && typeof event.data === 'undefined') {
            // 头部行：{"type":"session","version":4,"id":"session-...",...}
            const head = parsed;
            if (typeof head.id === 'string' && head.id.length > 0)
                sessionId = head.id;
            continue;
        }
        if (event.type === 'session/title') {
            const t = event.data?.title;
            if (typeof t === 'string' && t.trim().length > 0)
                title = t.trim();
            continue;
        }
        events.push(event);
    }
    const turns = [];
    let draft = null;
    for (const event of events) {
        const data = event.data ?? {};
        const time = typeof event.time === 'number' ? event.time : Date.now();
        if (event.type === 'turn/start') {
            const turn = asCount(data.turn);
            if (turn === 0)
                continue;
            draft = {
                sessionId,
                userId,
                turn,
                title,
                promptExcerpt: null,
                provider: null,
                model: null,
                startedAt: new Date(time),
                endedAt: null,
                durationMs: null,
                inputTokens: 0,
                outputTokens: 0,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                totalTokens: 0,
                llmCalls: 0,
                toolCalls: 0,
                toolNames: null,
                attachments: 0,
                finishReason: null,
            };
            continue;
        }
        if (draft === null)
            continue;
        if (event.type === 'user/message') {
            const text = textOfContent(data.content);
            if (draft.promptExcerpt === null && text.length > 0 && isUserPrompt(data, text)) {
                draft.promptExcerpt = excerpt(text, excerptChars) || null;
                draft.attachments = countFiles(data.content);
            }
            continue;
        }
        if (event.type === 'assistant/message') {
            const usage = asRecord(data.usage);
            const source = asRecord(asRecord(data.message)?.source);
            if (source !== undefined) {
                if (typeof source.provider === 'string' && source.provider.length > 0)
                    draft.provider = source.provider;
                if (typeof source.model === 'string' && source.model.length > 0)
                    draft.model = source.model;
            }
            if (usage !== undefined) {
                const input = asCount(usage.inputTokens);
                const output = asCount(usage.outputTokens);
                const cacheRead = asCount(usage.cacheReadTokens);
                const cacheWrite = asCount(usage.cacheWriteTokens);
                // 官方口径：totalTokens 含缓存读写，不能简单用 input+output。
                // 缺省时按 llm-deepseek 的算法补：input + output + cacheRead + cacheWrite。
                const total = typeof usage.totalTokens === 'number' && Number.isSafeInteger(usage.totalTokens)
                    ? usage.totalTokens
                    : input + output + cacheRead + cacheWrite;
                draft.inputTokens += input;
                draft.outputTokens += output;
                draft.cacheReadTokens += cacheRead;
                draft.cacheWriteTokens += cacheWrite;
                draft.totalTokens += total;
                draft.llmCalls += 1;
            }
            continue;
        }
        if (event.type === 'tool/call') {
            draft.toolCalls += 1;
            const name = data.name;
            if (typeof name === 'string' && name.length > 0) {
                const names = draft.toolNames === null ? [] : draft.toolNames.split(',');
                if (!names.includes(name))
                    names.push(name);
                draft.toolNames = names.slice(0, 12).join(',');
            }
            continue;
        }
        if (event.type === 'turn/end') {
            const reason = asRecord(data.reason);
            draft.finishReason = typeof reason?.kind === 'string' ? reason.kind : 'completed';
            draft.endedAt = new Date(time);
            const duration = time - draft.startedAt.getTime();
            draft.durationMs = Number.isSafeInteger(duration) && duration >= 0 ? duration : null;
            // 标题可能在该轮之后才由 LLM 生成：统一在收尾时取当前已知的最新标题
            if (title !== null)
                draft.title = title;
            turns.push(draft);
            draft = null;
        }
    }
    // 进行中的最后一轮（尚未 turn/end）：也落一条，ended_at 为空，下次扫描补齐
    if (draft !== null && (draft.llmCalls > 0 || draft.promptExcerpt !== null)) {
        turns.push(draft);
    }
    // 标题在解析阶段可能变化（session/title 事件出现在轮次之后），统一回填
    for (const turn of turns)
        if (title !== null)
            turn.title = title;
    return turns;
}
const LOG_NAME = /^session(?:\.v([0-9]+))?\.jsonl(\.zstd)?$/;
function pad(n) {
    return n < 10 ? '0' + n : String(n);
}
/** 本地时区日期（YYYY-MM-DD）。**不要用 toISOString**：那是 UTC，会整体偏 8 小时。 */
function localDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function localDateTime(d) {
    return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export class UsageCollector {
    pool;
    root;
    excerptChars;
    retentionDays;
    log;
    /** 文件指纹 → 上次处理时的大小/时间，用于增量扫描。 */
    fingerprints = new Map();
    scanning = false;
    timer = null;
    lastPurge = 0;
    constructor(pool, options = {}) {
        this.pool = pool;
        this.root = options.sessionsRoot ?? join(os.homedir(), '.dsh', 'sessions');
        this.excerptChars = Math.min(500, Math.max(20, options.promptExcerptChars ?? 120));
        this.retentionDays = Math.max(1, options.detailRetentionDays ?? 365);
        this.log = options.log ?? ((message, ...args) => { console.log(message, ...args); });
    }
    /** 启动定时扫描（首次立即跑一次，不阻塞调用方）。 */
    start(intervalMs = 120_000) {
        if (this.timer !== null)
            return;
        void this.scanOnce();
        this.timer = setInterval(() => { void this.scanOnce(); }, Math.max(30_000, intervalMs));
        // 定时器不应阻止进程退出
        this.timer.unref?.();
    }
    dispose() {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    /** 跑一次扫描。并发调用会直接返回 busy 结果，避免两个扫描同时写库。 */
    async scanOnce() {
        const started = Date.now();
        if (this.scanning)
            return { files: 0, skipped: 0, turns: 0, tokens: 0, ms: 0 };
        this.scanning = true;
        try {
            const owners = await this.loadOwners();
            const files = this.collectLogFiles();
            let handled = 0;
            let skipped = 0;
            let turnCount = 0;
            let tokens = 0;
            const dates = new Set();
            for (const entry of files) {
                const fingerprint = `${entry.mtimeMs}:${entry.size}`;
                if (this.fingerprints.get(entry.file) === fingerprint)
                    continue;
                const userId = owners.get(entry.sessionId);
                if (userId === undefined) {
                    // 无主会话（插件接管前创建 / 已删归属行）：不计入任何人，避免张冠李戴
                    skipped += 1;
                    this.fingerprints.set(entry.file, fingerprint);
                    continue;
                }
                let text;
                try {
                    text = readSessionLog(entry.file);
                }
                catch (err) {
                    skipped += 1;
                    this.log('[usage] 读取失败，跳过：%s (%s)', entry.file, String(err?.message ?? err));
                    continue;
                }
                const turns = parseSessionLog(text, entry.sessionId, userId, this.excerptChars);
                if (turns.length > 0) {
                    await this.writeTurns(turns);
                    for (const turn of turns)
                        dates.add(localDate(turn.startedAt));
                    turnCount += turns.length;
                    for (const turn of turns)
                        tokens += turn.totalTokens;
                }
                this.fingerprints.set(entry.file, fingerprint);
                handled += 1;
            }
            if (dates.size > 0)
                await this.refreshDaily([...dates]);
            await this.purgeOldDetail();
            const result = { files: handled, skipped, turns: turnCount, tokens, ms: Date.now() - started };
            if (turnCount > 0) {
                this.log('[usage] 扫描完成：%d 个会话 / %d 轮 / %d tokens / %dms', handled, turnCount, tokens, result.ms);
            }
            return result;
        }
        finally {
            this.scanning = false;
        }
    }
    // ---- 内部 ----
    /** session_id → user_id（服务端权威归属，不按路径猜）。 */
    async loadOwners() {
        const [rows] = await this.pool.execute('SELECT session_id, user_id FROM session_owners');
        const map = new Map();
        for (const row of rows)
            map.set(String(row.session_id), Number(row.user_id));
        return map;
    }
    /** 递归找日志，同一会话多个 generation 只取最新一代。 */
    collectLogFiles() {
        const best = new Map();
        const visit = (dir, depth) => {
            if (depth > 6)
                return;
            let entries;
            try {
                entries = readdirSync(dir, { withFileTypes: true });
            }
            catch {
                return;
            }
            for (const entry of entries) {
                const full = join(dir, entry.name);
                if (entry.isDirectory()) {
                    visit(full, depth + 1);
                    continue;
                }
                if (!entry.isFile())
                    continue;
                const match = LOG_NAME.exec(entry.name);
                if (match === null)
                    continue;
                const generation = match[1] === undefined ? 0 : Number(match[1]);
                const sessionId = basename(dir);
                if (!sessionId.startsWith('session-'))
                    continue;
                let stat;
                try {
                    stat = statSync(full);
                }
                catch {
                    continue;
                }
                const candidate = {
                    sessionId,
                    file: full,
                    generation,
                    mtimeMs: stat.mtimeMs,
                    size: stat.size,
                };
                const previous = best.get(sessionId);
                if (previous === undefined || candidate.generation > previous.generation) {
                    best.set(sessionId, candidate);
                }
            }
        };
        visit(this.root, 0);
        return [...best.values()];
    }
    async writeTurns(turns) {
        const sql = `INSERT INTO usage_turns (
        user_id, session_id, turn, title, prompt_excerpt, provider, model,
        started_at, ended_at, duration_ms,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_tokens,
        llm_calls, tool_calls, tool_names, attachments, finish_reason
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        prompt_excerpt = COALESCE(VALUES(prompt_excerpt), prompt_excerpt),
        provider = COALESCE(VALUES(provider), provider),
        model = COALESCE(VALUES(model), model),
        ended_at = COALESCE(VALUES(ended_at), ended_at),
        duration_ms = COALESCE(VALUES(duration_ms), duration_ms),
        input_tokens = VALUES(input_tokens),
        output_tokens = VALUES(output_tokens),
        cache_read_tokens = VALUES(cache_read_tokens),
        cache_write_tokens = VALUES(cache_write_tokens),
        total_tokens = VALUES(total_tokens),
        llm_calls = VALUES(llm_calls),
        tool_calls = VALUES(tool_calls),
        tool_names = COALESCE(VALUES(tool_names), tool_names),
        attachments = VALUES(attachments),
        finish_reason = COALESCE(VALUES(finish_reason), finish_reason)`;
        for (const turn of turns) {
            await this.pool.execute(sql, [
                turn.userId,
                turn.sessionId,
                turn.turn,
                turn.title,
                turn.promptExcerpt,
                turn.provider,
                turn.model,
                localDateTime(turn.startedAt),
                turn.endedAt === null ? null : localDateTime(turn.endedAt),
                turn.durationMs,
                turn.inputTokens,
                turn.outputTokens,
                turn.cacheReadTokens,
                turn.cacheWriteTokens,
                turn.totalTokens,
                turn.llmCalls,
                turn.toolCalls,
                turn.toolNames,
                turn.attachments,
                turn.finishReason,
            ]);
        }
    }
    /** 重算受影响日期的日汇总（明细是唯一事实源，汇总可随时重建）。 */
    async refreshDaily(dates) {
        const sql = `INSERT INTO usage_daily (
        user_id, stat_date, turns, sessions, llm_calls, tool_calls,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_tokens, last_at
      )
      SELECT user_id, DATE(started_at) AS d, COUNT(*), COUNT(DISTINCT session_id),
             SUM(llm_calls), SUM(tool_calls),
             SUM(input_tokens), SUM(output_tokens), SUM(cache_read_tokens), SUM(cache_write_tokens),
             SUM(total_tokens), MAX(COALESCE(ended_at, started_at))
        FROM usage_turns
       WHERE DATE(started_at) = ?
       GROUP BY user_id, DATE(started_at)
      ON DUPLICATE KEY UPDATE
        turns = VALUES(turns), sessions = VALUES(sessions),
        llm_calls = VALUES(llm_calls), tool_calls = VALUES(tool_calls),
        input_tokens = VALUES(input_tokens), output_tokens = VALUES(output_tokens),
        cache_read_tokens = VALUES(cache_read_tokens), cache_write_tokens = VALUES(cache_write_tokens),
        total_tokens = VALUES(total_tokens), last_at = VALUES(last_at)`;
        for (const date of dates)
            await this.pool.execute(sql, [date]);
    }
    /** 明细按保留期清理；日汇总不动（长期趋势不丢）。每 24 小时最多跑一次。 */
    async purgeOldDetail() {
        const now = Date.now();
        if (now - this.lastPurge < 86_400_000)
            return;
        this.lastPurge = now;
        await this.pool.execute('DELETE FROM usage_turns WHERE started_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [this.retentionDays]);
    }
}
