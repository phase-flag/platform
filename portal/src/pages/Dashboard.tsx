import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#0F1A20] px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-white/50 text-sm mt-1">Welcome back, {user?.name}</p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-white/50 hover:text-white transition-colors px-4 py-2 border border-white/10 rounded-lg"
          >
            Sign out
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/50 text-sm">Feature flags</p>
            <p className="text-3xl font-bold text-white mt-1">0</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/50 text-sm">Environments</p>
            <p className="text-3xl font-bold text-white mt-1">0</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/50 text-sm">Evaluations today</p>
            <p className="text-3xl font-bold text-white mt-1">0</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <p className="text-white/60 mb-4">No flags yet. Start by setting up your first project.</p>
          <Link
            to="/onboarding"
            className="inline-block bg-[#34D399] hover:bg-[#6EE7B7] text-[#0F1A20] font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Set up your first project
          </Link>
        </div>
      </div>
    </div>
  );
}
