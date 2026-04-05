import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CookieConsent from './components/CookieConsent';
import Home from './pages/Home';
import FlagDemo from './pages/FlagDemo';
import EvaluationDemo from './pages/EvaluationDemo';
import RolloutDemo from './pages/RolloutDemo';
import SDKDemo from './pages/SDKDemo';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Billing from './pages/Billing';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Settings from './pages/Settings';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <h1 className="text-6xl font-bold mb-4" style={{ color: '#6366F1' }}>404</h1>
      <p className="text-xl text-white/70 mb-8">Page not found</p>
      <Link to="/" className="px-6 py-3 rounded-xl hover:opacity-90 transition-opacity" style={{ background: '#6366F1', color: '#FFFFFF' }}>
        Back to Home
      </Link>
    </div>
  );
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0F1A20]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth pages — no shell */}
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected pages — no shell */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      {/* Public pages with shell */}
      <Route path="/" element={<ShellLayout><Home /></ShellLayout>} />
      <Route path="/flags" element={<ShellLayout><FlagDemo /></ShellLayout>} />
      <Route path="/evaluation" element={<ShellLayout><EvaluationDemo /></ShellLayout>} />
      <Route path="/rollouts" element={<ShellLayout><RolloutDemo /></ShellLayout>} />
      <Route path="/sdks" element={<ShellLayout><SDKDemo /></ShellLayout>} />
      <Route path="*" element={<ShellLayout><NotFound /></ShellLayout>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
        <CookieConsent />
      </ToastProvider>
    </AuthProvider>
  );
}
