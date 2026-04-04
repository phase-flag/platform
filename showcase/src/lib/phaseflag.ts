/**
 * Lightweight Phase Flag client for the showcase app.
 * Fetches flags from the API and evaluates them locally using DJB2 hashing.
 */

import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserContext {
    userId: string
    attributes: Record<string, unknown>
}

export interface Variation {
    id: string
    key: string
    name: string
    value: unknown
}

export interface TargetingCondition {
    attribute: string
    operator: string
    value: unknown
}

export interface TargetingRule {
    priority: number
    conditions: TargetingCondition[]
    variation_id?: string
    percentage_rollout?: { variations: { variation_id: string; weight: number }[] }
}

export interface FlagDef {
    id: string
    key: string
    name: string
    flag_type: string
    status: string
    environment: string
    default_variation_id: string
    variations: Variation[]
    targeting_rules: TargetingRule[]
}

export interface EvalResult {
    key: string
    value: unknown
    variationKey: string
    reason: 'default' | 'targeting_match' | 'percentage_rollout' | 'disabled'
}

// ---------------------------------------------------------------------------
// DJB2 Hash (matches the API evaluation engine)
// ---------------------------------------------------------------------------

function djb2(str: string): number {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
    }
    return hash
}

// ---------------------------------------------------------------------------
// Evaluation Engine (client-side, mirrors server logic)
// ---------------------------------------------------------------------------

function matchCondition(cond: TargetingCondition, attrs: Record<string, unknown>): boolean {
    const val = attrs[cond.attribute]
    if (val === undefined) return false

    switch (cond.operator) {
        case 'is': return String(val) === String(cond.value)
        case 'is_not': return String(val) !== String(cond.value)
        case 'contains': return String(val).includes(String(cond.value))
        case 'not_contains': return !String(val).includes(String(cond.value))
        case 'one_of': return Array.isArray(cond.value) && cond.value.map(String).includes(String(val))
        case 'gt': return Number(val) > Number(cond.value)
        case 'lt': return Number(val) < Number(cond.value)
        case 'gte': return Number(val) >= Number(cond.value)
        case 'lte': return Number(val) <= Number(cond.value)
        case 'matches_regex': {
            try { return new RegExp(String(cond.value)).test(String(val)) } catch { return false }
        }
        default: return false
    }
}

function evaluateFlag(flag: FlagDef, ctx: UserContext): EvalResult {
    const defaultVar = flag.variations.find(v => v.id === flag.default_variation_id)
        || flag.variations[0]

    if (flag.status !== 'active') {
        return { key: flag.key, value: defaultVar?.value, variationKey: defaultVar?.key || 'off', reason: 'disabled' }
    }

    // Evaluate targeting rules in priority order
    const sortedRules = [...flag.targeting_rules].sort((a, b) => a.priority - b.priority)

    for (const rule of sortedRules) {
        const allMatch = rule.conditions.every(c => matchCondition(c, { ...ctx.attributes, userId: ctx.userId }))
        if (!allMatch) continue

        // Direct variation
        if (rule.variation_id) {
            const v = flag.variations.find(v => v.id === rule.variation_id)
            if (v) return { key: flag.key, value: v.value, variationKey: v.key, reason: 'targeting_match' }
        }

        // Percentage rollout
        if (rule.percentage_rollout) {
            const hashKey = `${flag.key}:${ctx.userId}`
            const bucket = djb2(hashKey) % 100
            let cumulative = 0
            for (const entry of rule.percentage_rollout.variations) {
                cumulative += entry.weight
                if (bucket < cumulative) {
                    const v = flag.variations.find(v => v.id === entry.variation_id)
                    if (v) return { key: flag.key, value: v.value, variationKey: v.key, reason: 'percentage_rollout' }
                }
            }
        }
    }

    return { key: flag.key, value: defaultVar?.value, variationKey: defaultVar?.key || 'off', reason: 'default' }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

type Listener = () => void

export class PhaseFlagClient {
    private flags: Map<string, FlagDef> = new Map()
    private context: UserContext = { userId: 'anonymous', attributes: {} }
    private environment = 'development'
    private token = ''
    private listeners: Set<Listener> = new Set()
    private pollTimer: ReturnType<typeof setInterval> | null = null
    private eventSource: EventSource | null = null
    public sseConnected = false
    public loading = true

    async init(email: string, password: string) {
        // Authenticate
        try {
            const { data } = await api.post('/auth/login', { email, password })
            this.token = data.access_token || data.token
            api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        } catch {
            console.warn('Phase Flag: auth failed, using unauthenticated mode')
        }

        await this.fetchFlags()
        this.loading = false
        this.notify()

        // Poll every 10s
        this.pollTimer = setInterval(() => this.fetchFlags(), 10_000)

        // SSE
        this.connectSSE()
    }

    private async fetchFlags() {
        try {
            const headers: Record<string, string> = { 'X-PhaseFlag-Environment': this.environment }
            if (this.token) headers['Authorization'] = `Bearer ${this.token}`
            const { data } = await api.get('/sdk/ruleset', { headers })
            const flagList: FlagDef[] = data.flags || data
            this.flags.clear()
            for (const f of flagList) {
                this.flags.set(f.key, f)
            }
            this.notify()
        } catch (e) {
            console.warn('Phase Flag: failed to fetch flags', e)
        }
    }

    private connectSSE() {
        try {
            const url = `/api/v1/sdk/stream`
            this.eventSource = new EventSource(url)
            this.eventSource.onopen = () => { this.sseConnected = true; this.notify() }
            this.eventSource.onmessage = () => { this.fetchFlags() }
            this.eventSource.onerror = () => { this.sseConnected = false; this.notify() }
        } catch { /* SSE not critical */ }
    }

    setContext(ctx: UserContext) {
        this.context = ctx
        this.notify()
    }

    setEnvironment(env: string) {
        this.environment = env
        api.defaults.headers.common['X-PhaseFlag-Environment'] = env
        this.fetchFlags()
    }

    evaluate(flagKey: string): EvalResult {
        const flag = this.flags.get(flagKey)
        if (!flag) {
            return { key: flagKey, value: undefined, variationKey: 'unknown', reason: 'disabled' }
        }
        return evaluateFlag(flag, this.context)
    }

    evaluateBoolean(flagKey: string, defaultValue = false): boolean {
        const result = this.evaluate(flagKey)
        if (result.reason === 'disabled' && result.value === undefined) return defaultValue
        return result.value === true || result.value === 'true'
    }

    evaluateString(flagKey: string, defaultValue = ''): string {
        const result = this.evaluate(flagKey)
        if (result.reason === 'disabled' && result.value === undefined) return defaultValue
        return String(result.value ?? defaultValue)
    }

    evaluateNumber(flagKey: string, defaultValue = 0): number {
        const result = this.evaluate(flagKey)
        if (result.reason === 'disabled' && result.value === undefined) return defaultValue
        return Number(result.value ?? defaultValue)
    }

    evaluateJSON<T>(flagKey: string, defaultValue: T): T {
        const result = this.evaluate(flagKey)
        if (result.reason === 'disabled' && result.value === undefined) return defaultValue
        if (typeof result.value === 'string') {
            try { return JSON.parse(result.value) } catch { return defaultValue }
        }
        return (result.value as T) ?? defaultValue
    }

    getAllEvaluations(): EvalResult[] {
        return Array.from(this.flags.keys()).map(k => this.evaluate(k))
    }

    getFlagCount(): number { return this.flags.size }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    private notify() {
        this.listeners.forEach(l => l())
    }

    destroy() {
        if (this.pollTimer) clearInterval(this.pollTimer)
        if (this.eventSource) this.eventSource.close()
    }
}

// Singleton
export const pfClient = new PhaseFlagClient()
