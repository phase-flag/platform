/**
 * Mock data for the Nexus project management app.
 */

export interface User {
    id: string
    name: string
    email: string
    avatar: string
    plan: string
    role: string
    tasksCompleted: number
    accountAgeDays: number
}

export interface Task {
    id: string
    title: string
    description: string
    status: 'backlog' | 'in_progress' | 'review' | 'done'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    assignee: string
    tags: string[]
    createdAt: string
    dueDate: string | null
}

export interface Project {
    id: string
    name: string
    description: string
    color: string
    taskCount: number
    memberCount: number
}

// Pre-configured user personas for the UserSwitcher
export const DEMO_USERS: User[] = [
    {
        id: 'user-alice',
        name: 'Alice Chen',
        email: 'alice@gmail.com',
        avatar: 'AC',
        plan: 'free',
        role: 'member',
        tasksCompleted: 12,
        accountAgeDays: 5,
    },
    {
        id: 'user-bob',
        name: 'Bob Martinez',
        email: 'bob@company.com',
        avatar: 'BM',
        plan: 'pro',
        role: 'admin',
        tasksCompleted: 85,
        accountAgeDays: 120,
    },
    {
        id: 'user-carol',
        name: 'Carol Singh',
        email: 'carol@bigcorp.com',
        avatar: 'CS',
        plan: 'enterprise',
        role: 'admin',
        tasksCompleted: 200,
        accountAgeDays: 365,
    },
    {
        id: 'user-dan',
        name: 'Dan (Internal)',
        email: 'dan@nexus-internal.com',
        avatar: 'DN',
        plan: 'pro',
        role: 'admin',
        tasksCompleted: 30,
        accountAgeDays: 60,
    },
    {
        id: 'anon-guest',
        name: 'Guest User',
        email: 'guest@example.com',
        avatar: 'GU',
        plan: 'free',
        role: 'viewer',
        tasksCompleted: 0,
        accountAgeDays: 0,
    },
]

export const MOCK_TASKS: Task[] = [
    { id: 't1', title: 'Design new onboarding flow', description: 'Create wireframes for the guided tour experience', status: 'in_progress', priority: 'high', assignee: 'user-alice', tags: ['design', 'ux'], createdAt: '2026-03-18', dueDate: '2026-03-25' },
    { id: 't2', title: 'Implement SSO integration', description: 'Add SAML 2.0 support for enterprise customers', status: 'review', priority: 'urgent', assignee: 'user-bob', tags: ['backend', 'security'], createdAt: '2026-03-15', dueDate: '2026-03-22' },
    { id: 't3', title: 'Optimize dashboard queries', description: 'Reduce p95 latency from 800ms to under 200ms', status: 'in_progress', priority: 'high', assignee: 'user-carol', tags: ['backend', 'performance'], createdAt: '2026-03-17', dueDate: '2026-03-24' },
    { id: 't4', title: 'Add dark mode support', description: 'Implement system-aware theme switching', status: 'done', priority: 'medium', assignee: 'user-alice', tags: ['frontend', 'ux'], createdAt: '2026-03-10', dueDate: null },
    { id: 't5', title: 'Write API documentation', description: 'Document all v2 endpoints with examples', status: 'backlog', priority: 'low', assignee: 'user-dan', tags: ['docs'], createdAt: '2026-03-20', dueDate: '2026-04-01' },
    { id: 't6', title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions with staging deploy', status: 'done', priority: 'medium', assignee: 'user-bob', tags: ['devops'], createdAt: '2026-03-08', dueDate: null },
    { id: 't7', title: 'Mobile responsive layouts', description: 'Fix breakpoints for tablet and phone views', status: 'backlog', priority: 'medium', assignee: 'user-alice', tags: ['frontend', 'mobile'], createdAt: '2026-03-19', dueDate: '2026-03-28' },
    { id: 't8', title: 'Audit log viewer', description: 'Build UI to browse and filter audit events', status: 'in_progress', priority: 'medium', assignee: 'user-carol', tags: ['frontend', 'compliance'], createdAt: '2026-03-16', dueDate: '2026-03-26' },
    { id: 't9', title: 'Rate limiting middleware', description: 'Implement sliding window rate limiter', status: 'review', priority: 'high', assignee: 'user-dan', tags: ['backend', 'security'], createdAt: '2026-03-14', dueDate: '2026-03-21' },
    { id: 't10', title: 'User invitation system', description: 'Allow team admins to invite members via email', status: 'backlog', priority: 'high', assignee: 'user-bob', tags: ['backend', 'frontend'], createdAt: '2026-03-20', dueDate: '2026-04-05' },
]

export const MOCK_PROJECTS: Project[] = [
    { id: 'p1', name: 'Nexus Core', description: 'Core platform features', color: '#6366F1', taskCount: 42, memberCount: 5 },
    { id: 'p2', name: 'Mobile App', description: 'iOS and Android apps', color: '#818CF8', taskCount: 28, memberCount: 3 },
    { id: 'p3', name: 'Data Pipeline', description: 'ETL and analytics infrastructure', color: '#F59E0B', taskCount: 15, memberCount: 2 },
    { id: 'p4', name: 'Marketing Site', description: 'Landing pages and blog', color: '#EC4899', taskCount: 8, memberCount: 2 },
    { id: 'p5', name: 'Enterprise Suite', description: 'SSO, SCIM, and compliance', color: '#EF4444', taskCount: 35, memberCount: 4 },
]
