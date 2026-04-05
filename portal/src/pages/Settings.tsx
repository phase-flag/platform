import { useState, FormEvent, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Skeleton from '../components/Skeleton';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 text-sm">
      {message}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
      {message}
    </div>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md bg-[#132029] border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Delete account</h3>
        <p className="text-white/60 text-sm">
          Account deletion requires contacting our support team. We'll verify your identity and
          process your request within 5 business days.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70">
          To delete your account, email{' '}
          <a href="mailto:support@phaseflag.com" className="text-pf-primary hover:underline">
            support@phaseflag.com
          </a>{' '}
          from your registered address.
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, token, logout } = useAuth();

  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Billing state
  const [currentTier, setCurrentTier] = useState('free');

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Page loading state
  const [pageLoading, setPageLoading] = useState(true);

  // Sync user into form fields when user object changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  // Fetch org tier
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/v1/organizations/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((orgs: { subscription_tier?: string }[]) => {
        if (orgs.length > 0 && orgs[0].subscription_tier) {
          setCurrentTier(orgs[0].subscription_tier);
        }
      })
      .catch(() => {})
      .finally(() => setPageLoading(false));
  }, [token]);

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Update failed');
      }
      setProfileSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Password change failed');
      }
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setPasswordLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Skeleton variant="card" count={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] px-6 py-8">
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-white/50 text-sm mt-1">Manage your account preferences</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-sm text-white/50 hover:text-white transition-colors px-4 py-2 border border-white/10 rounded-lg"
            >
              Dashboard
            </Link>
            <button
              onClick={logout}
              className="text-sm text-white/50 hover:text-white transition-colors px-4 py-2 border border-white/10 rounded-lg"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Profile section */}
        <Section title="Profile">
          <form onSubmit={handleProfileSave} className="space-y-4">
            {profileSuccess && <SuccessBanner message={profileSuccess} />}
            {profileError && <ErrorBanner message={profileError} />}

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pf-primary transition-colors"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pf-primary transition-colors"
                placeholder="you@company.com"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={profileLoading}
                className="bg-pf-primary hover:bg-pf-primary-light disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
              >
                {profileLoading ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Section>

        {/* Password section */}
        <Section title="Password">
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {passwordSuccess && <SuccessBanner message={passwordSuccess} />}
            {passwordError && <ErrorBanner message={passwordError} />}

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Current password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pf-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pf-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm new password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pf-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={passwordLoading}
                className="bg-pf-primary hover:bg-pf-primary-light disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
              >
                {passwordLoading ? 'Updating…' : 'Change password'}
              </button>
            </div>
          </form>
        </Section>

        {/* Account section */}
        <Section title="Account">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Subscription plan</p>
              <p className="text-white font-semibold capitalize mt-0.5">
                {currentTier}{' '}
                <span className="text-pf-primary text-xs font-normal ml-1">Active</span>
              </p>
            </div>
            <Link
              to="/billing"
              className="px-4 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
            >
              Manage billing
            </Link>
          </div>
        </Section>

        {/* Danger zone */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-red-400">Danger zone</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Delete account</p>
              <p className="text-xs text-white/40 mt-0.5">
                Permanently remove your account and all associated data.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
            >
              Delete account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
