import { useState, FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function PasswordStrength({ password }: { password: string }) {
  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);

  if (!password) return null;

  const score = [hasLength, hasNumber, hasUpper].filter(Boolean).length;
  const label = score === 3 ? 'Strong' : score === 2 ? 'Fair' : 'Weak';
  const color = score === 3 ? 'text-green-400' : score === 2 ? 'text-yellow-400' : 'text-red-400';
  const barColor = score === 3 ? 'bg-green-400' : score === 2 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? barColor : 'bg-white/10'}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span className={`text-xs ${hasLength ? 'text-green-400' : 'text-white/30'}`}>
          {hasLength ? '✓' : '○'} 8+ characters
        </span>
        <span className={`text-xs ${hasNumber ? 'text-green-400' : 'text-white/30'}`}>
          {hasNumber ? '✓' : '○'} Contains number
        </span>
        <span className={`text-xs ${hasUpper ? 'text-green-400' : 'text-white/30'}`}>
          {hasUpper ? '✓' : '○'} Uppercase letter
        </span>
      </div>
      <p className={`text-xs font-medium ${color}`}>{label}</p>
    </div>
  );
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Reset failed');
      }
      navigate('/login?reset=1');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired')) {
        setError('Invalid or expired reset link. Please request a new one.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1A20] px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <p className="text-red-400">Invalid or expired reset link.</p>
          <Link to="/forgot-password" className="text-pf-primary hover:underline text-sm">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1A20] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Set new password</h1>
          <p className="text-white/60 mt-2">Choose a strong password for your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}{' '}
              {error.includes('Invalid or expired') && (
                <Link to="/forgot-password" className="underline">
                  Request a new link
                </Link>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">New password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pf-primary transition-colors"
              placeholder="••••••••"
            />
            <PasswordStrength password={newPassword} />
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-pf-primary hover:bg-pf-primary-light disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {isLoading ? 'Resetting…' : 'Reset password'}
          </button>

          <p className="text-center text-sm text-white/50">
            <Link to="/login" className="text-pf-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
