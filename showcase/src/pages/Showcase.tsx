import { useState } from 'react'
import { usePhaseFlagContext } from '@/hooks/usePhaseFlagContext'
import { Flag, ToggleRight, Layers, Target, Percent, Users, FlaskConical, Globe, Zap, Radio, GitBranch, X, Info } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import Tooltip from '@/components/Tooltip'

interface DemoSectionProps {
    number: number
    title: string
    flagKey: string
    icon: React.ElementType
    capability: string
    description: string
    children: React.ReactNode
    codeLanguage?: string
    codeTitle?: string
    code: string
}

function DemoSection({ number, title, flagKey, icon: Icon, capability, description, children, code, codeLanguage = 'typescript', codeTitle }: DemoSectionProps) {
    return (
        <section className="bg-surface rounded-xl border border-gray-800 p-6 mb-6">
            <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-full bg-pf-primary/10 text-pf-primary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                        <span className="text-xs text-gray-600 font-mono">#{number}</span>
                        <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-pf-primary/10 text-pf-primary border border-pf-primary/20">{capability}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">{description}</p>
                    <div className="bg-surface-light rounded-lg p-4 mb-3">
                        {children}
                    </div>
                    <code className="text-[11px] font-mono text-gray-600 bg-gray-900 px-2 py-1 rounded">
                        pfClient.evaluate('{flagKey}')
                    </code>
                    <CodeBlock language={codeLanguage} code={code} title={codeTitle} />
                </div>
            </div>
        </section>
    )
}

// ─── Welcome banner ────────────────────────────────────────────────────────────
function WelcomeBanner() {
    const [dismissed, setDismissed] = useState(false)
    if (dismissed) return null

    return (
        <div className="mb-6 relative rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-5 py-4 pr-10">
            <p className="text-sm text-gray-300 leading-relaxed">
                <span className="font-semibold text-indigo-400">Welcome to the Phase Flag Showcase!</span>{' '}
                This demo app uses Phase Flag to control its features in real-time.
                Toggle flags in the{' '}
                <a
                    href="https://app.phaseflag.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline"
                >
                    Dashboard
                </a>{' '}
                and watch this app update. Switch between user personas above to see how targeting works.
            </p>
            <button
                onClick={() => setDismissed(true)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}

// ─── Info icon helper ──────────────────────────────────────────────────────────
function InfoIcon({ tip }: { tip: string }) {
    return (
        <Tooltip text={tip}>
            <Info className="w-3.5 h-3.5 text-gray-600 hover:text-indigo-400 cursor-help transition-colors" />
        </Tooltip>
    )
}

// ─── Code snippets ─────────────────────────────────────────────────────────────
const CODE = {
    boolean: `// 1. Initialise the client (done once at app startup)
import { PhaseFlagClient } from '@phaseflag/js-sdk'

const client = new PhaseFlagClient({ apiKey: 'YOUR_SDK_KEY' })
await client.connect()

// 2. Evaluate the boolean flag
const darkMode = client.evaluateBoolean('nexus-dark-mode', false)

// darkMode === true  → dark theme
// darkMode === false → light theme`,

    string: `// Evaluate a string multivariate flag with a safe default
const layout = client.evaluateString('nexus-task-layout', 'standard')
// Returns one of: 'compact' | 'standard' | 'detailed'

// Use the value to drive your UI
if (layout === 'compact') renderCompact()
else if (layout === 'detailed') renderDetailed()
else renderStandard()`,

    number: `// Number flags — great for limits, quotas, thresholds
const maxProjects = client.evaluateNumber('nexus-max-projects', 3)
// free → 3  |  pro → 10  |  enterprise → 999

// Gate creation
if (projects.length >= maxProjects) {
  showUpgradePrompt()
}`,

    json: `// JSON flags carry structured config — no code deploy needed
const defaultConfig = { widgets: ['tasks', 'activity'] }

const config = client.evaluateJSON(
  'nexus-dashboard-widgets',
  defaultConfig
)
// config.widgets → ['tasks', 'activity', 'analytics', 'calendar']
// config.layout  → 'grid'`,

    targeting: `// Attach user context so targeting rules can match
client.setContext({
  userId: user.id,
  attributes: {
    plan: user.plan,           // 'free' | 'pro' | 'enterprise'
    role: user.role,           // 'admin' | 'member' | 'viewer'
    email: user.email,
    accountAgeDays: user.accountAgeDays,
    tasksCompleted: user.tasksCompleted,
  },
})

// Now evaluations reflect this user's context
const hasBeta = client.evaluateBoolean('nexus-beta-features', false)`,

    rollout: `// Percentage rollout — deterministic via DJB2 hash on userId
//
// hash(userId + flagKey) % 100 < rolloutPct → true
//
// Alice  → hash("user-001nexus-chat-widget") % 100 = 18  ✓ (< 30)
// Bob    → hash("user-002nexus-chat-widget") % 100 = 72  ✗ (>= 30)
// Same user ALWAYS gets the same result across sessions.

const showChat = client.evaluateBoolean('nexus-chat-widget', false)

if (showChat) {
  mountChatWidget()
}`,

    segment: `// Segment rule: tasks_completed > 50 AND account_age_days > 30
//
// The SDK evaluates compound conditions server-side and returns
// a single boolean — your app never sees the raw rule logic.

const hasPowerTools = client.evaluateBoolean('nexus-power-tools', false)

// Internally the server runs:
// user.tasksCompleted > 50 && user.accountAgeDays > 30`,

    abtest: `// A/B experiment — 50/50 split, sticky by userId
const variant = client.evaluateString('nexus-onboarding', 'classic')
// Returns: 'classic' | 'guided-tour'

// Each user is assigned once and stays in their bucket
if (variant === 'guided-tour') {
  renderGuidedTour()
} else {
  renderClassicChecklist()
}

// Track conversion back to Phase Flag for experiment analysis
client.track('onboarding_complete', { variant })`,

    environment: `// Flags can have different values per environment
// Switch environment at runtime (e.g. dev → staging → production)

client.setEnvironment('production')
// or pass it at init time:
const client = new PhaseFlagClient({
  apiKey: 'YOUR_SDK_KEY',
  environment: 'production', // 'development' | 'staging' | 'production'
})

// Flag values are scoped to the active environment
const notificationsOn = client.evaluateBoolean('nexus-notifications', false)
// development → true  |  production → false`,

    realtime: `// Real-time updates via Server-Sent Events (SSE)
const client = new PhaseFlagClient({
  apiKey: 'YOUR_SDK_KEY',
  streaming: true,          // enable SSE (default: true)
  pollingInterval: 30_000,  // fallback polling every 30 s
})

// React to flag changes without a page reload
client.on('flag:change', ({ key, value, previousValue }) => {
  console.log(\`\${key} changed: \${previousValue} → \${value}\`)
  // Re-render or update app state here
})

await client.connect() // opens the SSE stream`,
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Showcase() {
    const { flagValues, flagResults, currentUser, environment } = usePhaseFlagContext()

    const getResult = (key: string) => flagResults.find(r => r.key === key)

    return (
        <div className="p-8 max-w-4xl">
            {/* Welcome banner */}
            <WelcomeBanner />

            <div className="mb-8">
                <div className="flex items-center space-x-3 mb-2">
                    <Flag className="w-8 h-8 text-pf-primary" />
                    <h1 className="text-3xl font-bold text-gray-100">Phase Flag Showcase</h1>
                </div>
                <p className="text-gray-400">
                    This page demonstrates every Phase Flag capability. Switch users with the dropdown in the top-right
                    and watch the UI change in real-time. Open the <span className="text-pf-primary">Flag Inspector</span> (bottom-right button) to see evaluation details.
                </p>
                <div className="mt-4 flex items-center space-x-4 text-xs text-gray-500">
                    <span>User: <span className="text-pf-primary">{currentUser.name}</span></span>
                    <span>Plan: <span className="text-pf-primary">{currentUser.plan}</span></span>
                    <span>Env: <span className="text-pf-primary">{environment}</span></span>
                    <span>Flags loaded: <span className="text-pf-primary">{flagResults.length}</span></span>
                </div>
            </div>

            {/* 1. Boolean Flag */}
            <DemoSection
                number={1}
                title="Dark Mode"
                flagKey="nexus-dark-mode"
                icon={ToggleRight}
                capability="Boolean Flag"
                description="The simplest flag type — a boolean on/off toggle. Controls the entire app theme."
                code={CODE.boolean}
                codeTitle="evaluateBoolean"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Current value:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${flagValues['nexus-dark-mode'] ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {String(flagValues['nexus-dark-mode'] ?? 'undefined')}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Toggle this flag in the <a href="http://localhost:5173/flags" target="_blank" className="text-pf-primary hover:underline">dashboard</a> and watch this page update via SSE.</p>
            </DemoSection>

            {/* 2. String Multivariate */}
            <DemoSection
                number={2}
                title="Task Card Layout"
                flagKey="nexus-task-layout"
                icon={Layers}
                capability="String Multivariate"
                description="A string flag with 3 variations: compact, standard, detailed. Go to the Tasks page to see the visual difference."
                code={CODE.string}
                codeTitle="evaluateString"
            >
                <div className="flex items-center space-x-3">
                    {['compact', 'standard', 'detailed'].map(v => (
                        <span key={v} className={`px-3 py-1.5 rounded-lg text-sm ${
                            flagValues['nexus-task-layout'] === v
                                ? 'bg-pf-primary text-pf-dark font-medium'
                                : 'bg-gray-800 text-gray-500'
                        }`}>
                            {v}
                        </span>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Reason: <span className="text-pf-primary-light">{getResult('nexus-task-layout')?.reason}</span></p>
            </DemoSection>

            {/* 3. Number Variation */}
            <DemoSection
                number={3}
                title="Max Projects Limit"
                flagKey="nexus-max-projects"
                icon={GitBranch}
                capability="Number + Targeting"
                description="Number flag gated by plan tier. Free=3, Pro=10, Enterprise=unlimited. Switch users to see it change."
                code={CODE.number}
                codeTitle="evaluateNumber"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Project limit for {currentUser.name}:</span>
                    <span className="text-2xl font-bold text-pf-primary">
                        {flagValues['nexus-max-projects'] === 999 ? '∞' : String(flagValues['nexus-max-projects'] ?? 3)}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Plan: <span className="text-pf-primary-light">{currentUser.plan}</span> —
                    Reason: <span className="text-pf-primary-light">{getResult('nexus-max-projects')?.reason}</span>
                </p>
            </DemoSection>

            {/* 4. JSON Config */}
            <DemoSection
                number={4}
                title="Dashboard Widgets"
                flagKey="nexus-dashboard-widgets"
                icon={Layers}
                capability="JSON Variation"
                description="A JSON flag that controls which widgets appear on the dashboard and their layout."
                code={CODE.json}
                codeTitle="evaluateJSON"
            >
                <pre className="text-xs text-pf-primary-light font-mono overflow-x-auto">
                    {JSON.stringify(flagValues['nexus-dashboard-widgets'] ?? {}, null, 2)}
                </pre>
            </DemoSection>

            {/* 5. Targeting Rules */}
            <DemoSection
                number={5}
                title="Beta Features"
                flagKey="nexus-beta-features"
                icon={Target}
                capability="Targeting Rules"
                description="Only shown to enterprise users OR emails containing @nexus-internal.com. Switch to Carol (enterprise) or Dan (internal) to see it."
                code={CODE.targeting}
                codeTitle="setContext"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Beta access:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${flagValues['nexus-beta-features'] ? 'bg-purple-900/30 text-purple-300' : 'bg-gray-800 text-gray-500'}`}>
                        {flagValues['nexus-beta-features'] ? 'Granted' : 'Not available'}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Your plan: <span className="text-pf-primary-light">{currentUser.plan}</span> —
                    Email: <span className="text-pf-primary-light">{currentUser.email}</span> —
                    Reason: <span className="text-pf-primary-light">{getResult('nexus-beta-features')?.reason}</span>
                </p>
            </DemoSection>

            {/* 6. Percentage Rollout */}
            <DemoSection
                number={6}
                title="Chat Widget"
                flagKey="nexus-chat-widget"
                icon={Percent}
                capability="Percentage Rollout"
                description="Rolling out to 30% of users via DJB2 hash. The same user always gets the same result (deterministic)."
                code={CODE.rollout}
                codeTitle="evaluateBoolean + DJB2 rollout"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Chat widget for {currentUser.name}:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${flagValues['nexus-chat-widget'] ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                        {flagValues['nexus-chat-widget'] ? 'Shown (in 30%)' : 'Hidden (in 70%)'}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Switch users — some will see the chat widget on the Tasks page, others won't.</p>
            </DemoSection>

            {/* 7. Segments */}
            <DemoSection
                number={7}
                title="Power User Tools"
                flagKey="nexus-power-tools"
                icon={Users}
                capability="Segment Targeting"
                description="Shown to users with tasks_completed > 50 AND account_age_days > 30. Bob and Carol qualify."
                code={CODE.segment}
                codeTitle="compound segment rule"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Power tools for {currentUser.name}:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${flagValues['nexus-power-tools'] ? 'bg-pf-primary/20 text-pf-primary' : 'bg-gray-800 text-gray-500'}`}>
                        {flagValues['nexus-power-tools'] ? 'Unlocked' : 'Locked'}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Tasks completed: <span className="text-pf-primary-light">{currentUser.tasksCompleted}</span> —
                    Account age: <span className="text-pf-primary-light">{currentUser.accountAgeDays} days</span>
                </p>
            </DemoSection>

            {/* 8. A/B Experiment */}
            <DemoSection
                number={8}
                title="Onboarding Flow"
                flagKey="nexus-onboarding"
                icon={FlaskConical}
                capability="A/B Experiment"
                description="50/50 split between classic checklist and guided tour. See both variants on the Settings page."
                code={CODE.abtest}
                codeTitle="variation assignment + tracking"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Assigned variant:</span>
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-900/30 text-blue-300">
                        {String(flagValues['nexus-onboarding'] ?? 'classic')}
                    </span>
                </div>
            </DemoSection>

            {/* 9. Environment-Specific */}
            <DemoSection
                number={9}
                title="Notifications"
                flagKey="nexus-notifications"
                icon={Globe}
                capability="Environment-Specific"
                description="Active in development, inactive in production. Switch environments in the sidebar to see it change."
                code={CODE.environment}
                codeTitle="setEnvironment"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Notifications in <span className="capitalize">{environment}</span>:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${flagValues['nexus-notifications'] ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {flagValues['nexus-notifications'] ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </DemoSection>

            {/* 10. Real-time SSE */}
            <DemoSection
                number={10}
                title="Real-Time Updates"
                flagKey="nexus-ai-summaries"
                icon={Radio}
                capability="SSE Streaming"
                description="Open the Phase Flag dashboard in another tab, toggle nexus-ai-summaries, and watch this page update instantly."
                code={CODE.realtime}
                codeTitle="SSE / polling setup"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">AI Summaries:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${flagValues['nexus-ai-summaries'] ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                        {flagValues['nexus-ai-summaries'] ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Try it: go to <a href="http://localhost:5173/flags" target="_blank" className="text-pf-primary hover:underline">Dashboard &gt; Flags</a>,
                    toggle <code className="bg-gray-800 px-1 rounded">nexus-ai-summaries</code>, and watch this value change.
                </p>
            </DemoSection>

            {/* Footer */}
            <div className="text-center py-8 text-gray-600 text-sm">
                <p>Built with <span className="text-pf-primary">Phase Flag</span> — Open-source feature flag management</p>
                <div className="mt-2 flex items-center justify-center space-x-4 text-xs">
                    <a href="http://localhost:5173" target="_blank" className="text-pf-primary hover:underline">Dashboard</a>
                    <a href="http://localhost:5175" target="_blank" className="text-pf-primary hover:underline">Marketing</a>
                    <a href="http://localhost:5174" target="_blank" className="text-pf-primary hover:underline">Portal</a>
                </div>
            </div>
        </div>
    )
}

export { InfoIcon }
