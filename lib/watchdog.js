/**
 * turn-watchdog — 卡死轮次的兜底看门狗。
 *
 * 背景（为什么 harness 自带的机制不够）：
 * - `ask_user_question` 改成 timed 模式后，工具自己有了 deadline，不会再无限等待；
 *   但**其它阻塞点依然存在**：交互式命令等 stdin、网络挂起的工具、LLM 流断在
 *   半路没产出 —— 这些情况下 step 拿不到 tool/result，turn 永远不结束，UI 停在
 *   「执行中…」，用户既不知道为什么也不知道该怎么救。
 * - 整个仓库没有 turn / step / tool 级别的超时（`packages/core/agent-loop` 里的
 *   `AbortSignal` 只用于 dispose 与显式 cancel，`idleTimeoutMs` 只作用于 pnpm 子进程）。
 *
 * 本模块做的事：对每个正在跑的轮次订阅官方事件流，跟踪「最后一次有进展的时刻」，
 * 静默超过阈值就替用户按下停止键，并把**判定依据**翻译成一句人话推给前端。
 *
 * 判据设计（两套时钟）：
 * - 静默时长 idle：距最后一条事件的时间。正常执行时事件是密集的（LLM 流式 chunk、
 *   工具调用/返回），长时间没事件 = 卡住了，与「是不是在算」无关。
 * - 整轮时长 elapsed：单轮硬上限，防「一直有事件但死循环」的模型行为。
 *
 * 为什么分三档而不是一个统一 timeout：
 * - `waiting-answer`：模型在等人类回答。这是**确定性死锁**（回答者断连后没人结算
 *   Promise），给最短时间（默认 120s）——用户明确要求的就是这个数字。
 * - `tool-silent`：工具在跑但长时间没输出。命令类任务本来就慢（编译、下载），
 *   给较宽的默认（5 分钟），避免误杀正常长任务。
 * - `model-silent`：LLM 流式半途断线。常规首 token 延迟远小于此，给 3 分钟。
 *
 * 时间必须具备可观测性：每次判停都会产出一条 {@link WatchdogStopRecord}，既推给
 * 前端（实时提示），也留在服务端 ring buffer 里（`GET /app/watchdog` 可查）。
 */
/** 工具自身超时之后，留给它的结算宽限（避免竞态）。 */
const ASK_SETTLE_GRACE_MS = 15_000;
/** turn/end 之后多久清理订阅（等 status 落定，避免竞态误判）。 */
const TURN_END_CLEANUP_MS = 5_000;
/** agent 已空闲多久就认为这一轮确实结束了。 */
const IDLE_CLEANUP_MS = 5_000;
/** ring buffer 上限。 */
const MAX_RECORDS = 50;
/** 名字里带这些词的工具视为「在等人」。 */
const ANSWER_TOOL_PATTERN = /ask|question|confirm|choose/i;
function seconds(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60)
        return `${s} 秒`;
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest === 0 ? `${m} 分钟` : `${m} 分 ${rest} 秒`;
}
/** 从任意 follow 帧里取出工具名；不是工具事件返回 null。 */
function toolNameOf(frame) {
    if (frame.type !== 'event')
        return null;
    const event = frame.event;
    if (event === undefined || event.type !== 'tool/call')
        return null;
    const data = (event.data ?? {});
    return typeof data.name === 'string' ? data.name : null;
}
/**
 * 卡死轮次看门狗。
 *
 * 用法：
 * - 每次投 prompt 成功后调用 {@link TurnWatchdog.watch}；
 * - 判停时调 `deps.cancel` 并通过 `deps.onStop` 回报；
 * - 进程卸载前调用 {@link TurnWatchdog.dispose}。
 */
export class TurnWatchdog {
    deps;
    states = new Map();
    recent = [];
    timer = null;
    /** 依赖与环境无关的内部开关（{@link TurnWatchdog.enabled} 是其只读投影）。 */
    enabledValue;
    answerIdleMs;
    idleMs;
    modelIdleMs;
    maxTurnMs;
    askToolTimeoutMs;
    tickMs;
    /** 是否启用。 */
    get enabled() {
        return this.enabledValue;
    }
    /** 当前生效的全部阈值（ms），供启动日志与诊断接口展示。 */
    get thresholds() {
        return {
            answerIdleMs: this.answerIdleMs,
            idleMs: this.idleMs,
            modelIdleMs: this.modelIdleMs,
            maxTurnMs: this.maxTurnMs,
        };
    }
    constructor(deps, options = {}) {
        this.deps = deps;
        this.enabledValue = options.enabled !== false;
        this.answerIdleMs = options.answerIdleMs ?? 120_000;
        this.idleMs = options.idleMs ?? 300_000;
        this.modelIdleMs = options.modelIdleMs ?? 180_000;
        this.maxTurnMs = options.maxTurnMs ?? 1_200_000;
        this.askToolTimeoutMs = options.askToolTimeoutMs ?? 120_000;
        this.tickMs = options.tickMs ?? 10_000;
        if (this.enabled) {
            this.timer = setInterval(() => { this.tick(); }, this.tickMs);
            this.timer.unref();
        }
    }
    /** 最近若干条自动停止记录（最新在后）；`?since=` 可按时间过滤。 */
    recentStops(sinceMs) {
        if (sinceMs === undefined)
            return [...this.recent];
        return this.recent.filter((r) => r.at >= sinceMs);
    }
    /** 某会话当前是否守着（供 UI 显示「有兜底保护」）。 */
    isWatching(sessionId) {
        return this.states.has(sessionId);
    }
    /**
     * 开始（或续接）对一个会话的守护。重复调用刷新 userId 与起始时间。
     * 幂等：已在守护中的会话不会重复订阅 follow。
     */
    watch(sessionId, userId) {
        if (!this.enabled)
            return;
        const existing = this.states.get(sessionId);
        if (existing !== undefined) {
            existing.userId = userId;
            if (existing.stopping) {
                // 上一轮已判停但订阅未清理（罕见）→ 重置为新一轮
                existing.stopping = false;
                existing.startedAt = Date.now();
                existing.lastEventAt = Date.now();
                existing.phase = 'starting';
                existing.openCallId = null;
                existing.toolName = null;
            }
            return;
        }
        const controller = new AbortController();
        const now = Date.now();
        const state = {
            sessionId,
            userId,
            startedAt: now,
            lastEventAt: now,
            phase: 'starting',
            toolName: null,
            openCallId: null,
            controller,
            stopping: false,
        };
        this.states.set(sessionId, state);
        this.startLoop(state);
    }
    /** 主动停止守护（用户自己点了停止 / 会话被删除）。 */
    unwatch(sessionId) {
        const state = this.states.get(sessionId);
        if (state === undefined)
            return;
        this.states.delete(sessionId);
        try {
            state.controller.abort();
        }
        catch {
            /* abort 幂等，异常无意义 */
        }
    }
    /** 停止所有守护并清掉定时器。 */
    dispose() {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
        for (const sessionId of [...this.states.keys()])
            this.unwatch(sessionId);
    }
    // ---------- 内部：事件观察 ----------
    startLoop(state) {
        void (async () => {
            try {
                for await (const frame of this.deps.follow({ address: { kind: 'session', sessionId: state.sessionId }, assistantStream: true }, state.controller.signal)) {
                    this.observe(state, frame);
                }
            }
            catch {
                // abort（用户停止 / 会话结束 / 插件卸载）是预期路径，不算错误
            }
        })().catch(() => {
            /* 兜底：follow 抛同步异常时不要炸掉进程 */
        });
    }
    /** 把一帧折进 {WatchState}。 */
    observe(state, frame) {
        if (typeof frame !== 'object' || frame === null)
            return;
        const f = frame;
        const now = Date.now();
        if (f.type === 'event') {
            const event = f.event;
            if (event !== undefined) {
                const type = String(event.type ?? '');
                const data = (event.data ?? {});
                if (type === 'tool/call') {
                    state.phase = 'tool';
                    state.toolName = typeof data.name === 'string' ? data.name : null;
                    state.openCallId = typeof data.callId === 'string' ? data.callId : null;
                }
                else if (type === 'tool/result') {
                    // 工具已结算，回到「等待下一步」状态；openCallId 清空是关键判据
                    state.openCallId = null;
                    state.phase = 'tool';
                }
                else if (type === 'turn/start') {
                    state.phase = 'starting';
                    state.startedAt = now;
                }
                else if (type === 'turn/end') {
                    state.phase = 'turn-end';
                    state.openCallId = null;
                }
            }
            state.lastEventAt = now;
            return;
        }
        if (f.type === 'assistant-stream') {
            state.phase = 'model';
            state.lastEventAt = now;
        }
        // 'snapshot' 是订阅开始时的历史回放，不代表新进展，刻意不刷新 lastEventAt
    }
    // ---------- 内部：定时巡检 ----------
    tick() {
        if (this.states.size === 0)
            return;
        const now = Date.now();
        for (const state of [...this.states.values()]) {
            const idle = now - state.lastEventAt;
            const elapsed = now - state.startedAt;
            // ① 本轮已收尾 → 清理订阅
            if (state.phase === 'turn-end' && idle > TURN_END_CLEANUP_MS) {
                this.unwatch(state.sessionId);
                continue;
            }
            // ② 官方 agent 已不在运行且确实安静了 → 清理订阅（权威判据）
            const status = this.safeStatus(state.sessionId);
            if (status !== undefined && status !== 'running' && idle > IDLE_CLEANUP_MS) {
                this.unwatch(state.sessionId);
                continue;
            }
            if (state.stopping)
                continue;
            // ③ 判停（先到先判）
            const answerThreshold = Math.max(this.answerIdleMs, this.askToolTimeoutMs + ASK_SETTLE_GRACE_MS);
            if (this.isWaitingAnswer(state) && idle > answerThreshold) {
                this.stop(state, 'waiting-answer', idle, elapsed);
                continue;
            }
            if (elapsed > this.maxTurnMs) {
                this.stop(state, 'turn-limit', idle, elapsed);
                continue;
            }
            if (state.phase === 'model' && idle > this.modelIdleMs) {
                this.stop(state, 'model-silent', idle, elapsed);
                continue;
            }
            if (idle > this.idleMs) {
                this.stop(state, 'tool-silent', idle, elapsed);
            }
        }
    }
    /** 是否正卡在「等人类回答」的提问工具里。 */
    isWaitingAnswer(state) {
        if (state.openCallId === null || state.toolName === null)
            return false;
        return ANSWER_TOOL_PATTERN.test(state.toolName);
    }
    safeStatus(sessionId) {
        try {
            return this.deps.getAgentStatus(sessionId);
        }
        catch {
            return undefined;
        }
    }
    stop(state, reason, idleMs, elapsedMs) {
        state.stopping = true;
        const detail = this.describe(state, reason, idleMs, elapsedMs);
        const record = {
            sessionId: state.sessionId,
            userId: state.userId,
            reason,
            detail,
            phase: state.phase,
            toolName: state.toolName,
            idleMs,
            elapsedMs,
            at: Date.now(),
        };
        this.recent.push(record);
        if (this.recent.length > MAX_RECORDS)
            this.recent.shift();
        this.deps.log?.('[dsh-plugin-auth] watchdog 自动停止会话 %s（原因 %s，静默 %s，已运行 %s）', state.sessionId, reason, seconds(idleMs), seconds(elapsedMs));
        // 先通知前端，再真的按下停止 —— 顺序反了用户会先看到流断、后看到原因
        try {
            this.deps.onStop(record);
        }
        catch {
            /* 通知失败不影响停止 */
        }
        void this.deps.cancel(state.sessionId, state.userId).catch(() => {
            /* 已经停了 / 会话不存在都算达到目的 */
        });
        // 留一点时间让 follow 收到尾帧后再摘订阅
        const timer = setTimeout(() => { this.unwatch(state.sessionId); }, TURN_END_CLEANUP_MS);
        timer.unref();
    }
    /** 把内部判据翻译成一句用户看得懂的话。 */
    describe(state, reason, idleMs, elapsedMs) {
        switch (reason) {
            case 'waiting-answer':
                return `模型在等待你回答问题（工具 ${state.toolName ?? 'ask_user_question'}），` +
                    `已经 ${seconds(idleMs)} 没有收到回复，也没有自行继续。` +
                    `这通常发生在提问卡片没渲染出来或浏览器断连的那一刻 —— 已自动停止本轮，你可以直接回复它想问的内容，或重新发一句指令。`;
            case 'turn-limit':
                return `本轮任务已连续运行 ${seconds(elapsedMs)}，达到单轮上限 ${seconds(this.maxTurnMs)}，已自动停止。` +
                    `如果任务是正常在推进的，把指令拆成更小的步骤会更好控；需要更长上限可以调整配置。`;
            case 'model-silent':
                return `模型响应中断：连续 ${seconds(idleMs)} 没有任何输出。多为供应商连接超时或中途断流，已自动停止，重试通常即可继续。`;
            case 'tool-silent':
                return state.toolName === null
                    ? `本轮已 ${seconds(idleMs)} 没有任何进展，判定为卡死并自动停止。`
                    : `工具 ${state.toolName} 已执行 ${seconds(idleMs)} 没有任何输出并判定为卡死，已自动停止。` +
                        `常见原因：命令在等待交互式输入、进程被网络挂起，或它在等一个不会到来的回答。`;
        }
    }
}
export { toolNameOf };
