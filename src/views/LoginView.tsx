import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import { useEhs } from '../context/EhsContext';

export const LoginView: React.FC = () => {
  const { signIn, authUser } = useEhs();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter both your enterprise email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate('/overview');
    } catch (err: any) {
      setError(err?.message || 'Unable to verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas-app flex flex-col justify-between p-4 sm:p-8 font-sans">
      <div className="max-w-md w-full mx-auto flex items-center justify-between pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink-primary transition-colors focus-ring rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Landing</span>
        </Link>
        <span className="text-[11px] font-mono text-ink-muted">EHS Safety AI</span>
      </div>

      <div className="max-w-md w-full mx-auto my-8 bg-canvas-surface border border-line-subtle rounded-2xl shadow-elevated p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-ink-primary text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">
            Sign in to EHS Safety AI
          </h1>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Access plant safety monitoring, video scenario inspections, and CAPA workflows.
          </p>
        </div>

        {authUser && (
          <div className="p-3 rounded-lg bg-severity-success-bg border border-severity-success-border text-xs text-severity-success-text flex items-center justify-between gap-2">
            <span>
              Signed in as <strong>{authUser.full_name}</strong>
            </span>
            <Link to="/overview" className="font-semibold underline">
              Continue →
            </Link>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-severity-critical-bg border border-severity-critical-border text-xs text-severity-critical-text flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="ehs-login-email" className="block text-xs font-semibold text-ink-primary">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="ehs-login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-line-default bg-canvas-subtle text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-canvas-surface"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ehs-login-password" className="block text-xs font-semibold text-ink-primary">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="ehs-login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-line-default bg-canvas-subtle text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-canvas-surface"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 px-4 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 focus-ring"
          >
            <span>{submitting ? 'Authenticating...' : 'Sign In'}</span>
            {!submitting && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        <div className="pt-4 border-t border-line-subtle flex items-center justify-between text-[11px] text-ink-muted">
          <span>Neon PostgreSQL • ehs_core</span>
          <Link to="/overview" className="font-semibold text-brand-primary hover:underline">
            Explore Platform →
          </Link>
        </div>
      </div>

      <div className="text-center text-[11px] text-ink-muted pb-2">
        Enterprise Workplace Safety Intelligence • Strict Light Workspace
      </div>
    </div>
  );
};

