/**
 * 提问卡片桥：把官方 `ask_user_question`（`user-questions/request` 瀑布）
 * 接到 /app 自己的前端卡片上。
 *
 * 背景：官方 web 客户端经 typert remote 事件（waterfall 模式）接收提问请求，
 * 由客户端组件渲染成卡片并把答案原样返回。本插件的 /app 是独立前端，
 * 既没有那条 remote 通道，官方卡片也就永远不出现 —— 用户只看到一行
 * 「ask_user_question 执行中…」，只能干等 tool-ask-user 的 timed 超时（120s）。
 *
 * 这里注册一个同名 waterfall listener：**只在「该会话有本插件前端在订阅」时接管**，
 * 否则 `next()` 交回官方链路，不影响开发者用官方 UI。
 *
 * 参考实现：packages/sdk/server/src/user-questions.ts（SdkUserQuestionBridge）。
 * 纯标准库，不 import 官方包（与 usage.ts 保持一致）。
 */

/** 一个可选答案。 */
export interface QuestionOptionLike {
  label: string
  description?: string
}

/** 一道提问。字段与官方 AskUserQuestionItem 结构兼容（只取渲染需要的部分）。 */
export interface QuestionItemLike {
  id: string
  question: string
  header?: string
  detail?: string
  options?: QuestionOptionLike[]
  multiSelect?: boolean
}

/** 瀑布请求体（只声明本插件会读的字段）。 */
export interface QuestionRequestLike {
  questions?: QuestionItemLike[]
  agent?: { session?: { id?: unknown } }
  signal?: AbortSignal
  wait?: { callId?: unknown; timed?: boolean }
}

/** 单题答案。 */
export interface AnswerItemLike {
  id: string
  selected: string[]
  custom?: string
}

/** 一批答案（与官方 AskUserQuestionAnswer 结构一致）。 */
export interface AnswerLike {
  answers: AnswerItemLike[]
}

/** 下发给前端的待答提问快照。 */
export interface PendingQuestionView {
  key: string
  callId: string | null
  questions: QuestionItemLike[]
  createdAt: number
  expiresAt: number
}

/** 下发给前端的事件。 */
export type QuestionBrokerEvent =
  | { type: 'question'; question: PendingQuestionView }
  | { type: 'question-closed'; key: string; reason: 'answered' | 'timeout' | 'stopped' }

type Sink = (event: QuestionBrokerEvent) => void

interface PendingEntry extends PendingQuestionView {
  sessionId: string
  settled: boolean
  /** 前端给出答案：收尾并 resolve。 */
  take: (answer: AnswerLike) => void
  /** 超时 / 被中止：收尾并 reject。 */
  close: (reason: 'timeout' | 'stopped') => void
}

/** 单题自定义输入长度上限（防止把整篇文档塞进 tool result）。 */
const MAX_CUSTOM_LEN = 2000

/**
 * 提问中转站：一问一答的登记表 + 订阅推送。
 *
 * 生命周期：`ask()` 登记 → 前端 SSE 收到卡片 → `POST /app/questions/answer`
 * 调用 `answer()` 收尾。工具侧 signal abort（timed 超时 / 用户停止）也会收尾。
 */
export class QuestionBroker {
  /** key → 待答登记。key 用 callId，拿不到时用序号。 */
  private readonly pending = new Map<string, PendingEntry>()
  /** sessionId → 前端订阅者。 */
  private readonly sinks = new Map<string, Set<Sink>>()
  private seq = 0

  /**
   * @param ttlMs 兜底有效期。必须**略大于** profile 里 tool-ask-user 的 timeout，
   *   让工具自己的 abort 先发生（那样模型拿到的是「pending」而不是插件造的异常）。
   */
  constructor(private readonly ttlMs = 125_000) {}

  /** 前端订阅某会话的提问事件，返回退订函数。 */
  subscribe(sessionId: string, sink: Sink): () => void {
    const set = this.sinks.get(sessionId) ?? new Set<Sink>()
    set.add(sink)
    this.sinks.set(sessionId, set)
    return () => {
      const cur = this.sinks.get(sessionId)
      if (cur === undefined) return
      cur.delete(sink)
      if (cur.size === 0) this.sinks.delete(sessionId)
    }
  }

  /** 该会话当前有没有前端在看（没有就不接管，交回官方链路）。 */
  hasSubscriber(sessionId: string): boolean {
    return (this.sinks.get(sessionId)?.size ?? 0) > 0
  }

  /** 某会话当前待答的提问（供刷新页面后重建卡片）。 */
  pendingOf(sessionId: string): PendingQuestionView[] {
    const out: PendingQuestionView[] = []
    for (const entry of this.pending.values()) {
      if (entry.sessionId !== sessionId || entry.settled) continue
      out.push(viewOf(entry))
    }
    return out
  }

  /**
   * 接管一次提问并等待用户作答。
   * @returns 用户的答案；`null` 表示不接管（调用方应 `next()` 交回官方链路）。
   */
  async ask(sessionId: string, request: QuestionRequestLike): Promise<AnswerLike | null> {
    // 没有前端在看 → 不接管。否则会把请求悬在这里，直到工具超时，
    // 反而比官方链路更糟。
    if (!this.hasSubscriber(sessionId)) return null
    const questions = Array.isArray(request.questions) ? request.questions : []
    if (questions.length === 0) return null
    if (request.signal?.aborted === true) return null
    const rawCallId = request.wait?.callId
    const callId = typeof rawCallId === 'string' && rawCallId !== '' ? rawCallId : null
    const key = callId ?? `q${++this.seq}`
    if (this.pending.has(key)) return null   // 同一个 call 重复进来：交回官方

    const createdAt = Date.now()
    const expiresAt = createdAt + this.ttlMs

    return await new Promise<AnswerLike>((resolve, reject) => {
      const entry: PendingEntry = {
        key,
        callId,
        questions,
        createdAt,
        expiresAt,
        sessionId,
        settled: false,
        take: () => {},
        close: () => {},
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      const settle = (): boolean => {
        if (entry.settled) return false
        entry.settled = true
        if (timer !== undefined) clearTimeout(timer)
        request.signal?.removeEventListener('abort', onAbort)
        this.pending.delete(key)
        return true
      }
      const onAbort = (): void => {
        if (!settle()) return
        this.emit(sessionId, { type: 'question-closed', key, reason: 'stopped' })
        reject(new Error('user question aborted'))
      }
      entry.take = (answer: AnswerLike): void => {
        if (!settle()) return
        this.emit(sessionId, { type: 'question-closed', key, reason: 'answered' })
        resolve(answer)
      }
      entry.close = (reason): void => {
        if (!settle()) return
        this.emit(sessionId, { type: 'question-closed', key, reason })
        reject(new Error(reason === 'timeout' ? 'user question expired' : 'user question aborted'))
      }
      timer = setTimeout(() => { entry.close('timeout') }, this.ttlMs)
      request.signal?.addEventListener('abort', onAbort, { once: true })

      this.pending.set(key, entry)
      this.emit(sessionId, { type: 'question', question: viewOf(entry) })
    })
  }

  /**
   * 收下前端的答案。
   * @returns `{ ok: true }` 或带 HTTP 状态码的失败原因。
   */
  answer(sessionId: string, key: string, raw: unknown): { ok: true } | { ok: false; status: number; error: string } {
    const entry = this.pending.get(key)
    if (entry === undefined || entry.settled || entry.sessionId !== sessionId) {
      return { ok: false, status: 404, error: 'question_not_found' }
    }
    const normalized = normalizeAnswer(entry.questions, raw)
    if ('error' in normalized) return { ok: false, status: 400, error: normalized.error }
    entry.take(normalized)
    return { ok: true }
  }

  /** 插件卸载：把所有等待中的提问 reject 掉，避免连接悬挂。 */
  dispose(): void {
    for (const entry of [...this.pending.values()]) entry.close('stopped')
    this.pending.clear()
    this.sinks.clear()
  }

  private emit(sessionId: string, event: QuestionBrokerEvent): void {
    const set = this.sinks.get(sessionId)
    if (set === undefined) return
    for (const sink of [...set]) {
      try {
        sink(event)
      } catch {
        // 单个连接写失败（浏览器已断开）不影响其它订阅者
      }
    }
  }
}

function viewOf(entry: PendingEntry): PendingQuestionView {
  return {
    key: entry.key,
    callId: entry.callId,
    questions: entry.questions,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
  }
}

/**
 * 校验并规范化答案批次。
 *
 * 官方要求「每道题恰好出现一次」；这里额外收紧两点，避免把脏数据送进模型：
 * 选项必须来自该题的 options，且每题必须有选项或自定义文本。
 */
function normalizeAnswer(
  questions: readonly QuestionItemLike[],
  raw: unknown,
): AnswerLike | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'invalid_body' }
  const list = (raw as { answers?: unknown }).answers
  if (!Array.isArray(list)) return { error: 'invalid_answers' }
  const byId = new Map<string, unknown>()
  for (const item of list) {
    if (typeof item !== 'object' || item === null) return { error: 'invalid_answers' }
    const rec = item as { id?: unknown }
    if (typeof rec.id !== 'string' || rec.id === '') return { error: 'invalid_answers' }
    if (byId.has(rec.id)) return { error: `duplicate_answer:${rec.id}` }
    byId.set(rec.id, item)
  }
  if (byId.size !== questions.length) return { error: 'answer_count_mismatch' }

  const answers: AnswerItemLike[] = []
  for (const question of questions) {
    const item = byId.get(question.id)
    if (item === undefined) return { error: `missing_answer:${question.id}` }
    const rec = item as { selected?: unknown; custom?: unknown }
    const allowed = new Set((question.options ?? []).map(option => option.label))
    const selectedRaw = Array.isArray(rec.selected) ? rec.selected : []
    const selected: string[] = []
    for (const label of selectedRaw) {
      if (typeof label !== 'string') return { error: `invalid_selection:${question.id}` }
      if (!allowed.has(label)) return { error: `unknown_option:${question.id}` }
      if (!selected.includes(label)) selected.push(label)
    }
    if (selected.length > 0 && question.multiSelect !== true && selected.length > 1) {
      return { error: `single_select_only:${question.id}` }
    }
    const customRaw = typeof rec.custom === 'string' ? rec.custom.trim() : ''
    const custom = customRaw === '' ? '' : customRaw.slice(0, MAX_CUSTOM_LEN)
    if (selected.length === 0 && custom === '') return { error: `unanswered:${question.id}` }
    answers.push(custom === '' ? { id: question.id, selected } : { id: question.id, selected, custom })
  }
  return { answers }
}
