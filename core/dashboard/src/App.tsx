import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Flags from './pages/Flags'
import FlagDetail from './pages/FlagDetail'
import Segments from './pages/Segments'
import SegmentDetail from './pages/SegmentDetail'
import SettingsPage from './pages/Settings'
import FlagComparison from './pages/FlagComparison'
import Webhooks from './pages/Webhooks'
import Experiments from './pages/Experiments'
import Approvals from './pages/Approvals'
import Simulations from './pages/Simulations'
import ExclusionGroups from './pages/ExclusionGroups'
import HoldoutGroups from './pages/HoldoutGroups'
import Integrations from './pages/Integrations'
import Projects from './pages/Projects'
import Environments from './pages/Environments'
import Governance from './pages/Governance'
import Pipelines from './pages/Pipelines'
import Migrations from './pages/Migrations'
import Observability from './pages/Observability'
import RemoteConfig from './pages/RemoteConfig'
import RemoteConfigDetail from './pages/RemoteConfigDetail'
import ExperimentDetail from './pages/ExperimentDetail'
import CodeRefs from './pages/CodeRefs'
import AdminOverview from './pages/admin/Overview'
import AdminTenants from './pages/admin/Tenants'
import AdminUsers from './pages/admin/Users'
import AdminBilling from './pages/admin/Billing'
import AdminPlatformHealth from './pages/admin/PlatformHealth'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import { useAuth } from './contexts/AuthContext'

function ProtectedRoutes() {
    const { isAuthenticated } = useAuth()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="flags" element={<Flags />} />
                <Route path="flags/compare" element={<FlagComparison />} />
                <Route path="flags/:flagKey" element={<FlagDetail />} />
                <Route path="segments" element={<Segments />} />
                <Route path="segments/:segmentKey" element={<SegmentDetail />} />
                <Route path="webhooks" element={<Webhooks />} />
                <Route path="experiments" element={<Experiments />} />
                <Route path="experiments/:experimentKey" element={<ExperimentDetail />} />
                <Route path="exclusion-groups" element={<ExclusionGroups />} />
                <Route path="holdout-groups" element={<HoldoutGroups />} />
                <Route path="integrations" element={<Integrations />} />
                <Route path="simulations" element={<Simulations />} />
                <Route path="approvals" element={<Approvals />} />
                <Route path="projects" element={<Projects />} />
                <Route path="environments" element={<Environments />} />
                <Route path="governance" element={<Governance />} />
                <Route path="pipelines" element={<Pipelines />} />
                <Route path="migrations" element={<Migrations />} />
                <Route path="observability" element={<Observability />} />
                <Route path="remote-config" element={<RemoteConfig />} />
                <Route path="remote-config/:configId" element={<RemoteConfigDetail />} />
                <Route path="code-refs" element={<CodeRefs />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="admin" element={<AdminOverview />} />
                <Route path="admin/tenants" element={<AdminTenants />} />
                <Route path="admin/users" element={<AdminUsers />} />
                <Route path="admin/billing" element={<AdminBilling />} />
                <Route path="admin/health" element={<AdminPlatformHealth />} />
                <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
    )
}

function App() {
    const { isAuthenticated } = useAuth()

    // Apply dark mode class on mount (before Layout renders)
    useEffect(() => {
        const stored = localStorage.getItem('darkMode')
        const shouldBeDark = stored !== null ? stored === 'true' : true
        if (shouldBeDark) {
            document.documentElement.classList.add('dark')
        }
    }, [])

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
                <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
