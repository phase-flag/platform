/**
 * Seed script — creates all demo flags in the Phase Flag API.
 * Run: npx tsx scripts/seed-flags.ts
 */

const API = 'http://localhost:8000/api/v1'

async function request(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if ((globalThis as any).__token) {
        headers['Authorization'] = `Bearer ${(globalThis as any).__token}`
    }
    const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    try { return { status: res.status, data: JSON.parse(text) } }
    catch { return { status: res.status, data: text } }
}

async function login() {
    // Register (idempotent — 409 if exists)
    await request('POST', '/auth/register', {
        email: 'admin@phaseflag.dev',
        password: 'PhaseFlag2026!',
        username: 'admin',
        name: 'Admin',
    })
    const { data } = await request('POST', '/auth/login', {
        email: 'admin@phaseflag.dev',
        password: 'PhaseFlag2026!',
    })
    ;(globalThis as any).__token = data.access_token || data.token
    console.log('Authenticated')
}

interface FlagSeed {
    key: string
    name: string
    description: string
    flag_type: string
    variations: { key: string; name: string; value: unknown }[]
    default_variation_key: string
    targeting_rules?: unknown[]
    tags?: string[]
}

const FLAGS: FlagSeed[] = [
    {
        key: 'nexus-dark-mode',
        name: 'Dark Mode',
        description: 'Toggle the Nexus app between light and dark theme',
        flag_type: 'boolean',
        variations: [
            { key: 'on', name: 'Enabled', value: true },
            { key: 'off', name: 'Disabled', value: false },
        ],
        default_variation_key: 'on',
        tags: ['ui', 'theme'],
    },
    {
        key: 'nexus-task-layout',
        name: 'Task Card Layout',
        description: 'Controls the visual style of task cards (compact, standard, detailed)',
        flag_type: 'string',
        variations: [
            { key: 'compact', name: 'Compact', value: 'compact' },
            { key: 'standard', name: 'Standard', value: 'standard' },
            { key: 'detailed', name: 'Detailed', value: 'detailed' },
        ],
        default_variation_key: 'standard',
        tags: ['ui', 'experiment'],
    },
    {
        key: 'nexus-max-projects',
        name: 'Max Projects',
        description: 'Maximum number of projects a user can create, gated by plan tier',
        flag_type: 'number',
        variations: [
            { key: 'free-limit', name: 'Free (3)', value: 3 },
            { key: 'pro-limit', name: 'Pro (10)', value: 10 },
            { key: 'unlimited', name: 'Unlimited', value: 999 },
        ],
        default_variation_key: 'free-limit',
        tags: ['billing', 'limits'],
    },
    {
        key: 'nexus-dashboard-widgets',
        name: 'Dashboard Widget Config',
        description: 'JSON config controlling which KPI widgets appear on the dashboard',
        flag_type: 'json',
        variations: [
            { key: 'basic', name: 'Basic', value: { widgets: ['tasks', 'projects'], layout: '2-col' } },
            { key: 'advanced', name: 'Advanced', value: { widgets: ['tasks', 'projects', 'velocity', 'burndown'], layout: '4-col' } },
        ],
        default_variation_key: 'basic',
        tags: ['ui', 'dashboard'],
    },
    {
        key: 'nexus-beta-features',
        name: 'Beta Features Access',
        description: 'Shows Labs section — only for enterprise users or internal emails',
        flag_type: 'boolean',
        variations: [
            { key: 'on', name: 'Enabled', value: true },
            { key: 'off', name: 'Disabled', value: false },
        ],
        default_variation_key: 'off',
        tags: ['targeting', 'beta'],
    },
    {
        key: 'nexus-chat-widget',
        name: 'Support Chat Widget',
        description: 'Floating chat widget — rolling out to 30% of users',
        flag_type: 'boolean',
        variations: [
            { key: 'on', name: 'Show Chat', value: true },
            { key: 'off', name: 'Hide Chat', value: false },
        ],
        default_variation_key: 'off',
        tags: ['rollout', 'support'],
    },
    {
        key: 'nexus-ai-summaries',
        name: 'AI Task Summaries',
        description: 'AI-generated task summaries — lifecycle demo flag',
        flag_type: 'boolean',
        variations: [
            { key: 'on', name: 'Enabled', value: true },
            { key: 'off', name: 'Disabled', value: false },
        ],
        default_variation_key: 'off',
        tags: ['ai', 'lifecycle'],
    },
    {
        key: 'nexus-notifications',
        name: 'Notification Center',
        description: 'Bell icon notifications — active in dev, inactive in prod',
        flag_type: 'boolean',
        variations: [
            { key: 'on', name: 'Enabled', value: true },
            { key: 'off', name: 'Disabled', value: false },
        ],
        default_variation_key: 'on',
        tags: ['ui', 'environment'],
    },
    {
        key: 'nexus-onboarding',
        name: 'Onboarding Flow',
        description: 'A/B test: classic checklist vs guided tour',
        flag_type: 'string',
        variations: [
            { key: 'classic', name: 'Classic Checklist', value: 'classic' },
            { key: 'guided-tour', name: 'Guided Tour', value: 'guided-tour' },
        ],
        default_variation_key: 'classic',
        tags: ['experiment', 'onboarding'],
    },
    {
        key: 'nexus-power-tools',
        name: 'Power User Tools',
        description: 'Advanced shortcuts panel — shown to power users via segment targeting',
        flag_type: 'boolean',
        variations: [
            { key: 'on', name: 'Enabled', value: true },
            { key: 'off', name: 'Disabled', value: false },
        ],
        default_variation_key: 'off',
        tags: ['segment', 'power-users'],
    },
]

async function createFlag(seed: FlagSeed) {
    // Check if exists
    const { status } = await request('GET', `/flags/${seed.key}`)
    if (status === 200) {
        console.log(`  [skip] ${seed.key} already exists`)
        return
    }

    const { status: createStatus, data } = await request('POST', '/flags', {
        key: seed.key,
        name: seed.name,
        description: seed.description,
        flag_type: seed.flag_type,
        environment: 'development',
        variations: seed.variations,
        default_variation_key: seed.default_variation_key,
        tags: seed.tags || [],
    })

    if (createStatus === 201 || createStatus === 200) {
        console.log(`  [created] ${seed.key}`)
    } else {
        console.error(`  [error] ${seed.key}:`, data)
    }
}

async function activateFlags() {
    // Toggle specific flags to active
    const toActivate = [
        'nexus-dark-mode', 'nexus-task-layout', 'nexus-max-projects',
        'nexus-dashboard-widgets', 'nexus-chat-widget', 'nexus-notifications',
        'nexus-onboarding', 'nexus-beta-features',
    ]
    for (const key of toActivate) {
        await request('POST', `/flags/${key}/toggle`)
    }
    console.log('  Activated demo flags')
}

async function addTargetingRules() {
    // Beta features: enterprise plan OR internal email
    await request('PUT', '/flags/nexus-beta-features', {
        targeting_rules: [
            {
                description: 'Enterprise users',
                priority: 1,
                conditions: [{ attribute: 'plan', operator: 'is', value: 'enterprise' }],
                variation_id: null, // Will need to resolve - use the 'on' variation
            },
            {
                description: 'Internal team',
                priority: 2,
                conditions: [{ attribute: 'email', operator: 'contains', value: '@nexus-internal.com' }],
                variation_id: null,
            },
        ],
    })

    // Max projects: plan-based targeting
    await request('PUT', '/flags/nexus-max-projects', {
        targeting_rules: [
            {
                description: 'Enterprise unlimited',
                priority: 1,
                conditions: [{ attribute: 'plan', operator: 'is', value: 'enterprise' }],
                variation_id: null, // unlimited
            },
            {
                description: 'Pro plan',
                priority: 2,
                conditions: [{ attribute: 'plan', operator: 'is', value: 'pro' }],
                variation_id: null, // pro-limit
            },
        ],
    })

    // Power tools: high task completion + account age
    await request('PUT', '/flags/nexus-power-tools', {
        targeting_rules: [
            {
                description: 'Power users',
                priority: 1,
                conditions: [
                    { attribute: 'tasks_completed', operator: 'gt', value: 50 },
                    { attribute: 'account_age_days', operator: 'gt', value: 30 },
                ],
                variation_id: null,
            },
        ],
    })

    console.log('  Added targeting rules')
}

async function main() {
    console.log('Phase Flag Showcase — Seed Script')
    console.log('==================================\n')

    await login()

    console.log('\nCreating flags...')
    for (const flag of FLAGS) {
        await createFlag(flag)
    }

    console.log('\nActivating flags...')
    await activateFlags()

    console.log('\nAdding targeting rules...')
    await addTargetingRules()

    console.log('\nDone! Created', FLAGS.length, 'demo flags.')
    console.log('\nOpen the showcase app at http://localhost:5176')
    console.log('Open the dashboard at http://localhost:5173/flags to manage them')
}

main().catch(console.error)
