import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
})

// Add auth token interceptor
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    const env = localStorage.getItem('phaseflag_environment')
    const validEnvs = ['development', 'staging', 'production']
    if (env && validEnvs.includes(env)) {
        config.headers['X-PhaseFlag-Environment'] = env
    }
    return config
})

// Response interceptor: handle auth failures, rate limits, payment errors, and sanitize errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status

        if (status === 401) {
            localStorage.removeItem('auth_token')
            localStorage.removeItem('auth_user')
            window.location.href = '/login'
        }

        if (status === 429) {
            const retryAfter = error.response?.headers?.['retry-after']
            const detail = retryAfter
                ? `Rate limit exceeded. Please wait ${retryAfter} second(s) before trying again.`
                : 'Rate limit exceeded. Please wait a moment before trying again.'
            // Emit a custom DOM event so ToastContext can display the message
            // without requiring a React context reference here.
            window.dispatchEvent(new CustomEvent('phaseflag:toast', { detail: { type: 'error', message: detail } }))
        }

        if (status === 402) {
            window.dispatchEvent(new CustomEvent('phaseflag:toast', {
                detail: { type: 'error', message: 'This action requires a plan upgrade.', link: '/billing' },
            }))
        }

        if (status === 403) {
            const serverMessage: string = error.response?.data?.detail || ''
            const tierKeywords = ['plan', 'tier', 'upgrade', 'pro', 'enterprise', 'feature']
            const isTierGated = tierKeywords.some((kw) => serverMessage.toLowerCase().includes(kw))
            if (isTierGated) {
                window.dispatchEvent(new CustomEvent('phaseflag:toast', {
                    detail: { type: 'error', message: 'This feature is available on the Pro plan.' },
                }))
            }
        }

        // Sanitize error messages — never expose raw server errors
        if (error.response?.data?.error?.message) {
            error.message = error.response.data.error.message
        } else if (status === 500) {
            error.message = 'An unexpected error occurred. Please try again.'
        }
        return Promise.reject(error)
    }
)

// Types
export interface FeatureFlag {
    id: string
    key: string
    name: string
    description: string
    flag_type: string
    status: string
    environment: string
    variations: Variation[]
    default_variation_id: string
    targeting_rules: TargetingRule[]
    tags: string[]
    created_by: string
    owner: string
    evaluation_count: number
    last_evaluated_at: string | null
    created_at: string
    updated_at: string
    lifecycle_stage: string | null
    scheduled_on: string | null
    scheduled_status: string | null
    prerequisites: Array<{ flag_key: string; variation_key: string }>
    is_permanent?: boolean
    expires_at?: string | null
    ticket_url?: string | null
    runbook_url?: string | null
}

export interface Variation {
    id: string
    key: string
    name: string
    value: unknown
    description?: string
}

export interface TargetingRule {
    id?: string
    description: string
    priority: number
    conditions: Condition[]
    variation_id?: string
    percentage_rollout?: PercentageRollout
}

export interface Condition {
    attribute: string
    operator: string
    value?: unknown
    values?: unknown[]
}

export interface PercentageRollout {
    variations: Array<{
        variation_id: string
        weight: number
    }>
}

export interface FlagCreateInput {
    key: string
    name: string
    description?: string
    flag_type?: string
    environment?: string
    variations: Array<{ key: string; name?: string; value: unknown }>
    default_variation_key: string
    tags?: string[]
    targeting_rules?: TargetingRule[]
}

export interface FlagUpdateInput {
    name?: string
    description?: string
    flag_type?: string
    environment?: string
    variations?: Array<{ key: string; name?: string; value: unknown }>
    default_variation_key?: string
    tags?: string[]
    targeting_rules?: TargetingRule[]
    prerequisites?: Array<{ flag_key: string; variation_key: string }>
    lifecycle_stage?: string
}

export interface Segment {
    id: string
    key: string
    name: string
    description: string
    conditions: Condition[]
    created_by: string
    created_at: string
}

export interface Webhook {
    id: string
    url: string
    events: string[]
    active: boolean
    created_at: string
}

export interface WebhookCreateInput {
    url: string
    events: string[]
    secret?: string
}

export interface WebhookUpdateInput {
    url?: string
    events?: string[]
    active?: boolean
}

export interface AuditLogEntry {
    id: string
    action: string
    entity_type: string
    entity_id: string
    entity_key: string
    actor: string
    changes: Record<string, unknown>
    timestamp: string
}

export interface PaginatedResponse<T> {
    items: T[]
    total: number
    limit: number
    offset: number
}

export interface ExclusionGroup {
    id: string
    key: string
    name: string
    description: string | null
    member_flag_keys: string[]
    created_at: string
}

export interface ExclusionGroupCreateInput {
    key: string
    name: string
    description?: string
    member_flag_keys: string[]
}

export interface ExclusionGroupUpdateInput {
    name?: string
    description?: string
    member_flag_keys?: string[]
}

export interface EvaluationBucket {
    period: string
    variation_key: string | null
    count: number
}

export interface Experiment {
    id: string
    flag_key: string
    status: 'draft' | 'running' | 'paused' | 'concluded'
    hypothesis: string | null
    traffic_percentage: number
    variations: ExperimentVariation[]
    created_at: string
    started_at: string | null
    stopped_at: string | null
    concluded_at: string | null
    winner: string | null
    results: ExperimentResults | null
}

export interface ExperimentVariation {
    key: string
    name: string
    weight: number
    traffic_split: number
    participants: number
    conversions: number
}

export interface ExperimentResults {
    variation_results: Array<{
        key: string
        name: string
        participants: number
        conversions: number
        conversion_rate: number
    }>
    absolute_lift: number
    relative_lift: number
    p_value: number
    statistically_significant: boolean
    recommendation: string | null
    total_participants: number
}

export interface ApprovalRequest {
    id: string
    flag_key: string
    environment: string
    change_type: string
    change_description: string
    requested_by: string
    status: 'pending' | 'approved' | 'rejected'
    approvals: Array<{ user_id: string; comment?: string; timestamp: string }>
    rejections: Array<{ user_id: string; reason: string; timestamp: string }>
    required_approvals: number
    created_at: string
    resolved_at: string | null
}

export interface ComplianceResult {
    flag_key: string
    environment: string
    overall_passed: boolean
    constraint_results: Array<{
        constraint: string
        framework: string
        passed: boolean
        details: Record<string, unknown>
    }>
    evaluated_at: string
}

export interface HoldoutGroup {
    id: string
    key: string
    name: string
    description: string | null
    holdout_percentage: number
    member_flag_keys: string[]
    created_at: string
}

export interface HoldoutGroupCreateInput {
    key: string
    name: string
    description?: string
    holdout_percentage: number
    member_flag_keys: string[]
}

export interface HoldoutGroupUpdateInput {
    name?: string
    description?: string
    holdout_percentage?: number
    member_flag_keys?: string[]
}

export interface Organization {
    id: string
    key: string
    name: string
    description: string | null
    created_at: string
}

export interface Project {
    id: string
    key: string
    name: string
    description: string | null
    created_by: string
    created_at: string
}

export interface ProjectCreateInput {
    key: string
    name: string
    description?: string
}

export interface Environment {
    id: string
    key: string
    name: string
    color: string
    project_id: string
    is_frozen: boolean
    frozen_by: string | null
    frozen_at: string | null
    created_at: string
}

export interface EnvironmentCreateInput {
    key: string
    name: string
    color?: string
}

export interface IntegrationStatus {
    id: string
    integration_type: string
    active: boolean
    created_at: string
    updated_at: string
}

export interface RolloutPipeline {
    id: string
    flag_key: string
    stages: Array<{ percentage: number; duration_minutes: number }>
    current_stage_index: number
    status: string
    stage_started_at: string
    created_at: string
}

export interface ChangeRequest {
    id: string
    flag_key: string
    environment: string
    change_type: string
    change_description: string
    requested_by: string
    status: 'pending' | 'approved' | 'rejected'
    required_reviewers: string[]
    approvals: Array<{ user_id: string; comment?: string; timestamp: string }>
    rejections: Array<{ user_id: string; reason: string; timestamp: string }>
    created_at: string
    resolved_at: string | null
}

export interface FreezeWindow {
    id: string
    environment: string
    reason: string
    frozen_by: string
    frozen_at: string
    unfrozen_at: string | null
}

export interface ServiceAccount {
    id: string
    name: string
    key_prefix: string
    scopes: string[]
    created_at: string
    last_used_at: string | null
}

export interface MigrationFlag {
    id: string
    key: string
    name: string
    description: string
    source_system: string
    target_system: string
    current_stage: string
    stages: string[]
    metrics: Record<string, number>
    created_at: string
    updated_at: string
}

export interface RemoteConfigEntry {
    id: string
    key: string
    name: string
    value_type: string
    value: unknown
    schema: Record<string, unknown> | null
    environment: string
    version: number
    created_at: string
    updated_at: string
}

/** Matches the actual RemoteConfigDB model returned by /configs endpoints */
export interface RemoteConfigV2 {
    id: string
    key: string
    name: string
    description: string | null
    config_type: string
    value: unknown
    default_value: unknown
    environment: string
    is_server_only: boolean
    version: number
    owner: string
    created_at: string
    updated_at: string
}

export interface RemoteConfigHistoryEntry {
    version: number
    value: unknown
    updated_at: string
    is_current: boolean
}

export interface RemoteConfigCreateInput {
    key: string
    name: string
    description?: string
    config_type: string
    value: unknown
    default_value: unknown
    environment: string
    schema_definition?: Record<string, unknown>
    is_server_only?: boolean
}

/** Matches the actual ExperimentDB/ExperimentOut model from /enterprise/experiments */
export interface ExperimentGoalV2 {
    id: string
    name: string
    metric_key: string
    goal_type: string
    is_primary: boolean
}

export interface ExperimentResultV2 {
    id: string
    variation_key: string
    sample_size: number
    conversions: number
    conversion_rate: number | null
    confidence_level: number | null
    is_significant: boolean
    is_winner: boolean
    lift: number | null
}

export interface ExperimentV2 {
    id: string
    key: string
    name: string
    description: string | null
    flag_key: string
    hypothesis: string | null
    status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'
    experiment_type: string
    traffic_percentage: number
    start_date: string | null
    end_date: string | null
    goals: ExperimentGoalV2[]
    results: ExperimentResultV2[]
    created_by: string
    created_at: string
}

export interface ExperimentCreateV2Input {
    key: string
    name: string
    flag_key: string
    description?: string
    hypothesis?: string
    experiment_type?: string
    traffic_percentage?: number
    goals?: Array<{
        name: string
        metric_key: string
        description?: string
        goal_type?: string
        is_primary?: boolean
        min_sample_size?: number
    }>
}

export interface CodeReference {
    id: string
    flag_key: string
    file_path: string
    line_number: number
    repository: string
    branch: string
    last_seen_at: string
}

export interface AIInsight {
    type: string
    severity: string
    message: string
    recommendation: string
    flag_key?: string
}

export interface SimulationResult {
    id: string
    flag_key: string
    proposed_state: Record<string, unknown>
    traffic_window_hours: number
    original_distribution: Record<string, number>
    proposed_distribution: Record<string, number>
    affected_users_pct: number
    metric_impact: Record<string, { before: number; after: number; change_pct: number; confidence_interval?: [number, number] }>
    status: string
    created_at: string
}

export interface TrafficStats {
    flag_key: string
    total_records: number
    unique_users: number
    variation_distribution: Record<string, number>
    earliest_record: string | null
    latest_record: string | null
}

export interface PredictImpactResult {
    flag_key: string
    proposed_state: Record<string, unknown>
    predictions: Array<{
        metric: string
        current_value: number
        predicted_value: number
        change_pct: number
        confidence_interval: [number, number]
        sample_size: number
    }>
    total_traffic: number
}

export interface SystemMetrics {
    total_flags: number
    active_flags: number
    total_evaluations: number
    avg_latency_ms: number
    error_rate: number
    cache_hit_rate: number
    connected_clients: number
    uptime_seconds: number
}

export interface FlagHealth {
    flag_key: string
    evaluation_count: number
    error_count: number
    avg_latency_ms: number
    last_evaluated_at: string | null
    stale: boolean
    has_owner: boolean
}

// API Functions
export const flagsApi = {
    list: (environment?: string, params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<FeatureFlag>>('/flags', {
            params: { ...params, ...(environment ? { environment } : {}) },
        }),
    get: (key: string, environment?: string) =>
        api.get<FeatureFlag>(`/flags/${key}`, { params: environment ? { environment } : {} }),
    create: (data: FlagCreateInput) =>
        api.post<FeatureFlag>('/flags', data),
    update: (key: string, data: FlagUpdateInput) =>
        api.put<FeatureFlag>(`/flags/${key}`, data),
    toggle: (key: string) =>
        api.post<FeatureFlag>(`/flags/${key}/toggle`),
    archive: (key: string) =>
        api.post<FeatureFlag>(`/flags/${key}/archive`),
    restore: (key: string) =>
        api.post<FeatureFlag>(`/flags/${key}/restore`),
    clone: (key: string) =>
        api.post<FeatureFlag>(`/flags/${key}/clone`),
    delete: (key: string) =>
        api.delete(`/flags/${key}`),
    exportFlags: () =>
        api.get('/flags/export'),
    importFlags: (data: unknown) =>
        api.post('/flags/import', data),
    schedule: (key: string, data: { scheduled_on: string; scheduled_status: string }) =>
        api.post<FeatureFlag>(`/flags/${key}/schedule`, data),
    cancelSchedule: (key: string) =>
        api.delete(`/flags/${key}/schedule`),
    explain: (key: string, context?: Record<string, unknown>) =>
        api.post(`/flags/${key}/explain`, { context }),
    evaluate: (data: { flag_key: string; context: Record<string, unknown> }) =>
        api.post('/sdk/evaluate', data),
    evaluateBatch: (data: { flag_keys: string[]; context: Record<string, unknown> }) =>
        api.post('/sdk/evaluate/batch', data),
    ruleset: () =>
        api.get('/sdk/ruleset'),
    bootstrap: () =>
        api.get('/sdk/bootstrap'),
}

export const segmentsApi = {
    list: (params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<Segment>>('/segments', { params }),
    get: (key: string) => api.get<Segment>(`/segments/${key}`),
    create: (data: { key: string; name: string; description?: string; conditions?: Condition[] }) =>
        api.post<Segment>('/segments', data),
    update: (key: string, data: { name?: string; description?: string; conditions?: Condition[] }) =>
        api.put<Segment>(`/segments/${key}`, data),
    delete: (key: string) => api.delete(`/segments/${key}`),
}

export const analyticsApi = {
    flagEvaluations: (key: string, params?: { period?: string; days?: number }) =>
        api.get<EvaluationBucket[]>(`/analytics/flags/${key}/evaluations`, { params }),
    systemMetrics: () =>
        api.get<SystemMetrics>('/analytics/system'),
    flagHealth: (params?: { limit?: number }) =>
        api.get<FlagHealth[]>('/analytics/flags/health', { params }),
    inventory: () =>
        api.get('/analytics/inventory'),
}

export const auditApi = {
    list: (params?: { entity_key?: string; entity_type?: string; limit?: number; offset?: number }) =>
        api.get<AuditLogEntry[]>('/audit-logs', { params }),
    listForFlag: (key: string, params?: { limit?: number; offset?: number }) =>
        api.get<AuditLogEntry[]>(`/flags/${key}/audit-logs`, { params }),
}

export const webhooksApi = {
    list: (params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<Webhook>>('/webhooks', { params }),
    create: (data: WebhookCreateInput) =>
        api.post<Webhook>('/webhooks', data),
    update: (id: string, data: WebhookUpdateInput) =>
        api.put<Webhook>(`/webhooks/${id}`, data),
    delete: (id: string) =>
        api.delete(`/webhooks/${id}`),
}

export const exclusionGroupsApi = {
    list: (params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<ExclusionGroup>>('/exclusion-groups', { params }),
    get: (key: string) =>
        api.get<ExclusionGroup>(`/exclusion-groups/${key}`),
    create: (data: ExclusionGroupCreateInput) =>
        api.post<ExclusionGroup>('/exclusion-groups', data),
    update: (key: string, data: ExclusionGroupUpdateInput) =>
        api.put<ExclusionGroup>(`/exclusion-groups/${key}`, data),
    delete: (key: string) =>
        api.delete(`/exclusion-groups/${key}`),
}

export const holdoutGroupsApi = {
    list: (params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<HoldoutGroup>>('/holdout-groups', { params }),
    get: (key: string) =>
        api.get<HoldoutGroup>(`/holdout-groups/${key}`),
    create: (data: HoldoutGroupCreateInput) =>
        api.post<HoldoutGroup>('/holdout-groups', data),
    update: (key: string, data: HoldoutGroupUpdateInput) =>
        api.put<HoldoutGroup>(`/holdout-groups/${key}`, data),
    delete: (key: string) =>
        api.delete(`/holdout-groups/${key}`),
}

export const sseApi = {
    status: () => api.get<{ connected_clients: number; streaming_enabled: boolean }>('/sdk/stream/status'),
}

export const experimentsApi = {
    list: (params?: { flag_key?: string; status?: string }) =>
        api.get<Experiment[]>('/enterprise/experiments', { params }),
    get: (id: string) =>
        api.get<Experiment>(`/enterprise/experiments/${id}`),
    create: (data: { flag_key: string; variations: Array<{ key: string; weight?: number }>; traffic_percentage?: number; hypothesis?: string }) =>
        api.post<Experiment>('/enterprise/experiments', data),
    start: (id: string) =>
        api.post<Experiment>(`/enterprise/experiments/${id}/start`),
    stop: (id: string) =>
        api.post<Experiment>(`/enterprise/experiments/${id}/stop`),
    conclude: (id: string, winning_variation?: string) =>
        api.post<Experiment>(`/enterprise/experiments/${id}/conclude`, { winning_variation }),
}

/** Full experiment API using the /enterprise/experiments backend with ExperimentV2 types */
export const experimentsApi2 = {
    list: (params?: { flag_key?: string; status?: string; limit?: number; offset?: number }) =>
        api.get<{ items: ExperimentV2[]; total: number }>('/enterprise/experiments', { params }),
    get: (key: string) =>
        api.get<ExperimentV2>(`/enterprise/experiments/${key}`),
    create: (data: ExperimentCreateV2Input) =>
        api.post<ExperimentV2>('/enterprise/experiments', data),
    start: (key: string) =>
        api.post<ExperimentV2>(`/enterprise/experiments/${key}/start`),
    stop: (key: string) =>
        api.post<ExperimentV2>(`/enterprise/experiments/${key}/stop`),
    pause: (key: string) =>
        api.post<ExperimentV2>(`/enterprise/experiments/${key}/pause`),
    conclude: (key: string, winning_variation?: string) =>
        api.post<ExperimentV2>(`/enterprise/experiments/${key}/stop`, { winning_variation }),
    recordResult: (key: string, data: { variation_key: string; sample_size: number; conversions: number; goal_id?: string }) =>
        api.post<ExperimentResultV2>(`/enterprise/experiments/${key}/results`, data),
    calculateSignificance: (data: { control_conversions: number; control_size: number; treatment_conversions: number; treatment_size: number; confidence_threshold?: number }) =>
        api.post('/enterprise/experiments/calculate/significance', data),
    calculateSampleSize: (data: { baseline_rate: number; min_detectable_effect: number; confidence?: number; power?: number }) =>
        api.post<{ sample_size_per_variation: number; total_sample_size: number }>('/enterprise/experiments/calculate/sample-size', data),
}

export const approvalsApi = {
    list: (params?: { flag_key?: string; status?: string }) =>
        api.get<ApprovalRequest[]>('/enterprise/approvals', { params }),
    pending: (environment?: string) =>
        api.get<ApprovalRequest[]>('/enterprise/approvals/pending', { params: environment ? { environment } : {} }),
    create: (data: { flag_key: string; environment: string; change_description: string; change_type?: string }) =>
        api.post<ApprovalRequest>('/enterprise/approvals', data),
    approve: (id: string, comment?: string) =>
        api.post<ApprovalRequest>(`/enterprise/approvals/${id}/approve`, { comment }),
    reject: (id: string, reason: string) =>
        api.post<ApprovalRequest>(`/enterprise/approvals/${id}/reject`, { reason }),
}

export const complianceApi = {
    check: (data: { flag_key: string; targeting_rules: unknown[]; environment?: string }) =>
        api.post<ComplianceResult>('/enterprise/compliance/check', data),
    constraints: (framework?: string) =>
        api.get('/enterprise/compliance/constraints', { params: framework ? { framework } : {} }),
}

export const simulationsApi = {
    list: (flag_key?: string) =>
        api.get<SimulationResult[]>('/enterprise/simulations', { params: flag_key ? { flag_key } : {} }),
    get: (id: string) =>
        api.get<SimulationResult>(`/enterprise/simulations/${id}`),
    run: (data: { flag_key: string; proposed_state: Record<string, unknown>; traffic_window_hours?: number }) =>
        api.post<SimulationResult>('/enterprise/simulations/run', data),
    predict: (data: { flag_key: string; proposed_state: Record<string, unknown>; metrics: string[] }) =>
        api.post<PredictImpactResult>('/enterprise/simulations/predict', data),
    trafficStats: (flagKey: string) =>
        api.get<TrafficStats>(`/enterprise/simulations/traffic/${flagKey}`),
    recordTraffic: (data: { flag_key: string; context: Record<string, unknown>; variation_served: string; metrics?: Record<string, number> }) =>
        api.post('/enterprise/simulations/record', data),
}

export const enterpriseApi = {
    modules: () => api.get('/enterprise/modules'),
}

export const organizationsApi = {
    list: (params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<Organization>>('/organizations', { params }),
    get: (key: string) =>
        api.get<Organization>(`/organizations/${key}`),
    create: (data: { key: string; name: string; description?: string }) =>
        api.post<Organization>('/organizations', data),
    update: (key: string, data: { name?: string; description?: string }) =>
        api.put<Organization>(`/organizations/${key}`, data),
    delete: (key: string) =>
        api.delete(`/organizations/${key}`),
    projects: (orgKey: string, params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<Project>>(`/organizations/${orgKey}/projects`, { params }),
}

export const projectsApi = {
    list: (params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<Project>>('/projects', { params }),
    get: (key: string) =>
        api.get<Project>(`/projects/${key}`),
    create: (data: ProjectCreateInput) =>
        api.post<Project>('/projects', data),
    update: (key: string, data: Partial<ProjectCreateInput>) =>
        api.put<Project>(`/projects/${key}`, data),
    delete: (key: string) =>
        api.delete(`/projects/${key}`),
}

export const environmentsApi = {
    list: (projectId: string, params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<Environment>>(`/projects/${projectId}/environments`, { params }),
    get: (id: string) =>
        api.get<Environment>(`/environments/${id}`),
    create: (projectId: string, data: EnvironmentCreateInput) =>
        api.post<Environment>(`/projects/${projectId}/environments`, data),
    update: (id: string, data: { name?: string; color?: string }) =>
        api.put<Environment>(`/environments/${id}`, data),
    delete: (id: string) =>
        api.delete(`/environments/${id}`),
    clone: (id: string, data: { target_name: string; target_key: string }) =>
        api.post<Environment>(`/environments/${id}/clone`, data),
    promote: (id: string, data: { target_environment_id: string; flag_keys?: string[] }) =>
        api.post(`/environments/${id}/promote`, data),
    freeze: (id: string, data: { reason: string }) =>
        api.post(`/environments/${id}/freeze`, data),
    unfreeze: (id: string) =>
        api.post(`/environments/${id}/unfreeze`),
}

export const governanceApi = {
    changeRequests: (params?: { status?: string; environment?: string; limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<ChangeRequest>>('/changes', { params }),
    createChangeRequest: (data: { flag_key: string; environment: string; change_description: string; change_type: string; required_reviewers?: string[] }) =>
        api.post<ChangeRequest>('/changes', data),
    approveChange: (id: string, comment?: string) =>
        api.post<ChangeRequest>(`/changes/${id}/approve`, { comment }),
    rejectChange: (id: string, reason: string) =>
        api.post<ChangeRequest>(`/changes/${id}/reject`, { reason }),
    freezeWindows: (params?: { environment?: string }) =>
        api.get<FreezeWindow[]>('/environments/freeze-windows', { params }),
    breakGlass: (environmentId: string, data: { reason: string }) =>
        api.post(`/environments/${environmentId}/break-glass`, data),
    serviceAccounts: (params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<ServiceAccount>>('/service-accounts', { params }),
    createServiceAccount: (data: { name: string; scopes: string[] }) =>
        api.post<ServiceAccount & { api_key: string }>('/service-accounts', data),
    deleteServiceAccount: (id: string) =>
        api.delete(`/service-accounts/${id}`),
}

export const pipelinesApi = {
    list: (params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<RolloutPipeline>>('/rollouts', { params }),
    get: (flagKey: string) =>
        api.get<RolloutPipeline>(`/flags/${flagKey}/pipeline`),
    create: (flagKey: string, data: { stages: Array<{ percentage: number; duration_minutes: number }> }) =>
        api.post<RolloutPipeline>(`/flags/${flagKey}/pipeline`, data),
    advance: (flagKey: string) =>
        api.post<RolloutPipeline>(`/flags/${flagKey}/pipeline/advance`),
    pause: (flagKey: string) =>
        api.post(`/flags/${flagKey}/pipeline/pause`),
    resume: (flagKey: string) =>
        api.post(`/flags/${flagKey}/pipeline/resume`),
    rollback: (flagKey: string) =>
        api.post(`/flags/${flagKey}/pipeline/rollback`),
    cancel: (flagKey: string) =>
        api.post(`/flags/${flagKey}/pipeline/cancel`),
    templates: () =>
        api.get<Array<{ name: string; stages: Array<{ percentage: number; duration_minutes: number }> }>>('/rollouts/templates'),
}

export const migrationsApi = {
    list: (params?: { limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<MigrationFlag>>('/migrations', { params }),
    get: (key: string) =>
        api.get<MigrationFlag>(`/migrations/${key}`),
    create: (data: { key: string; name: string; description?: string; source_system: string; target_system: string; stages?: string[] }) =>
        api.post<MigrationFlag>('/migrations', data),
    advanceStage: (key: string) =>
        api.post<MigrationFlag>(`/migrations/${key}/advance`),
    rollbackStage: (key: string) =>
        api.post<MigrationFlag>(`/migrations/${key}/rollback`),
    delete: (key: string) =>
        api.delete(`/migrations/${key}`),
}

export const remoteConfigApi = {
    list: (params?: { environment?: string; limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<RemoteConfigEntry>>('/remote-config', { params }),
    get: (key: string, environment?: string) =>
        api.get<RemoteConfigEntry>(`/remote-config/${key}`, { params: environment ? { environment } : {} }),
    create: (data: RemoteConfigCreateInput) =>
        api.post<RemoteConfigV2>('/configs', data),
    update: (key: string, data: { value?: unknown; schema?: Record<string, unknown> }) =>
        api.put<RemoteConfigEntry>(`/remote-config/${key}`, data),
    delete: (key: string) =>
        api.delete(`/remote-config/${key}`),
    history: (key: string) =>
        api.get<Array<{ version: number; value: unknown; updated_at: string; updated_by: string }>>(`/remote-config/${key}/history`),
    // Methods targeting the /configs backend routes (ID-based)
    listV2: (params?: { environment?: string; limit?: number; offset?: number }) =>
        api.get<{ items: RemoteConfigV2[]; total: number }>('/configs', { params }),
    getById: (id: string) =>
        api.get<RemoteConfigV2>(`/configs/${id}`),
    updateById: (id: string, data: { value?: unknown; name?: string; description?: string; is_server_only?: boolean; schema_definition?: Record<string, unknown> | null }) =>
        api.put<RemoteConfigV2>(`/configs/${id}`, data),
    deleteById: (id: string) =>
        api.delete(`/configs/${id}`),
    historyById: (id: string, limit?: number) =>
        api.get<RemoteConfigHistoryEntry[]>(`/configs/${id}/history`, { params: limit ? { limit } : {} }),
    validateById: (id: string, value: unknown) =>
        api.post<{ valid: boolean; message: string }>(`/configs/${id}/validate`, { value }),
}

export const codeRefsApi = {
    list: (params?: { flag_key?: string; repository?: string; limit?: number; offset?: number }) =>
        api.get<PaginatedResponse<CodeReference>>('/code-refs', { params }),
    upload: (data: { references: Array<{ flag_key: string; file_path: string; line_number: number; repository: string; branch: string }> }) =>
        api.post('/code-refs/upload', data),
    search: (query: string) =>
        api.get<CodeReference[]>('/code-refs/search', { params: { q: query } }),
    unusedFlags: () =>
        api.get<string[]>('/code-refs/unused'),
    summary: () =>
        api.get<Record<string, number>>('/code-refs/summary'),
}

export const integrationsApi = {
    status: () =>
        api.get<IntegrationStatus[]>('/integrations/status'),
    configureSlack: (data: { webhook_url: string }) =>
        api.post('/integrations/slack/configure', data),
    configureJira: (data: { url: string; email: string; api_token: string; project_key: string }) =>
        api.post('/integrations/jira/configure', data),
    testSlack: () =>
        api.post('/integrations/slack/test'),
    delete: (type: string) =>
        api.delete(`/integrations/${type}`),
}

export const aiApi = {
    analyze: (data?: Record<string, unknown>) =>
        api.post<AIInsight[]>('/ai/analyze', data || {}),
    suggestRules: (data: { flag_key: string; context?: Record<string, unknown> }) =>
        api.post('/ai/suggest-rules', data),
    explain: (data: { flag_key: string; context?: Record<string, unknown> }) =>
        api.post('/ai/explain', data),
}

export const eventsApi = {
    export: (params: { start_date?: string; end_date?: string; format?: string }) =>
        api.get('/events/export', { params }),
    streamStatus: () =>
        api.get<{ streaming_enabled: boolean; destination?: string }>('/events/stream/status'),
    configureStream: (data: { destination: string; config: Record<string, unknown> }) =>
        api.post('/events/stream/configure', data),
    deleteStream: () =>
        api.delete('/events/stream'),
    ingest: (data: { events: Array<{ flag_key: string; variation_key: string; context: Record<string, unknown>; timestamp?: string }> }) =>
        api.post('/sdk/events', data),
}

export const healthApi = {
    health: () => api.get('/health'),
    ready: () => api.get('/ready'),
}

export const adminApi = {
    getOverview: () => api.get('/admin/overview'),
    listTenants: (params?: Record<string, unknown>) => api.get('/admin/tenants', { params }),
    getTenant: (id: string) => api.get(`/admin/tenants/${id}`),
    suspendTenant: (id: string) => api.put(`/admin/tenants/${id}/suspend`),
    activateTenant: (id: string) => api.put(`/admin/tenants/${id}/activate`),
    listAllUsers: (params?: Record<string, unknown>) => api.get('/admin/users', { params }),
    updateUserRole: (id: string, role: string) => api.put(`/admin/users/${id}/role`, { role }),
    deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
    getUsage: (params?: Record<string, unknown>) => api.get('/admin/usage', { params }),
    getBilling: () => api.get('/admin/billing'),
    getPlatformHealth: () => api.get('/admin/health'),
}

export default api
