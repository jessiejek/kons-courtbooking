import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, X, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseEnabled } from './lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (role: 'user' | 'admin') => void;
}

type AuthMode = 'signin' | 'signup';

export default function LoginModal({ isOpen, onClose, onLogin }: Props) {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setError(null);
    setSuccessMsg(null);
  };

  // ── Social OAuth ────────────────────────────────────────────
  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    reset();
    if (isSupabaseEnabled && supabase) {
      setSocialLoading(provider);
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      setSocialLoading(null);
      if (oauthErr) { setError(oauthErr.message); return; }
      // Redirect handled by Supabase — modal stays open briefly
      return;
    }
    // Demo fallback
    setSocialLoading(provider);
    setTimeout(() => {
      setSocialLoading(null);
      onLogin('user');
      onClose();
    }, 1000);
  };

  // ── Email / password sign-in ────────────────────────────────
  const handleEmailSignIn = async () => {
    reset();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    if (isSupabaseEnabled && supabase) {
      setIsLoading(true);
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);

      if (signInErr) { setError(signInErr.message); return; }

      // Determine role from user metadata or profiles table
      const userMeta = data.user?.user_metadata;
      const role: 'user' | 'admin' = userMeta?.role === 'admin' ? 'admin' : 'user';
      onLogin(role);
      onClose();
      if (role === 'admin') navigate('/admin');
      return;
    }

    // Demo fallback — infer admin by email
    const role: 'user' | 'admin' = email.toLowerCase().includes('admin') ? 'admin' : 'user';
    onLogin(role);
    onClose();
    if (role === 'admin') navigate('/admin');
  };

  // ── Email / password sign-up ────────────────────────────────
  const handleEmailSignUp = async () => {
    reset();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (isSupabaseEnabled && supabase) {
      setIsLoading(true);
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: 'user' } },
      });
      setIsLoading(false);

      if (signUpErr) { setError(signUpErr.message); return; }

      setSuccessMsg('Account created! Check your email to confirm, then sign in.');
      setAuthMode('signin');
      return;
    }

    // Demo fallback
    onLogin('user');
    onClose();
  };

  // ── Demo one-click role cards ───────────────────────────────
  const handleRoleLogin = (role: 'user' | 'admin') => {
    onLogin(role);
    onClose();
    if (role === 'admin') navigate('/admin');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'signin') handleEmailSignIn();
    else handleEmailSignUp();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0 14.5c-3.33 0-6.29-1.7-8-4.3.04-2.65 5.33-4.1 8-4.1s7.96 1.45 8 4.1c-1.71 2.6-4.67 4.3-8 4.3z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-extrabold text-on-surface leading-tight">Court &amp; Co.</p>
              <p className="text-[11px] text-on-surface-variant font-medium leading-tight">
                {authMode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">

          {/* Sign-in / Sign-up toggle */}
          <div className="flex bg-surface-container-low rounded-xl p-1 gap-1">
            {(['signin', 'signup'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setAuthMode(mode); reset(); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  authMode === mode ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Error / success banners */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl p-3">
              {successMsg}
            </div>
          )}

          {/* Social buttons */}
          <button
            type="button"
            onClick={() => handleSocialLogin('google')}
            disabled={isLoading || socialLoading !== null}
            className="w-full flex items-center justify-center gap-3 border border-outline-variant rounded-xl py-2.5 px-4 text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-60"
          >
            {socialLoading === 'google' ? (
              <span className="w-4 h-4 border-2 border-outline border-t-primary rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => handleSocialLogin('facebook')}
            disabled={isLoading || socialLoading !== null}
            className="w-full flex items-center justify-center gap-3 border border-outline-variant rounded-xl py-2.5 px-4 text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-60"
          >
            {socialLoading === 'facebook' ? (
              <span className="w-4 h-4 border-2 border-outline border-t-primary rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            )}
            Continue with Facebook
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-xs text-outline font-semibold uppercase tracking-wider">or email</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-surface-container-low border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={authMode === 'signup' ? 'Password (min 6 chars)' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-surface-container-low border border-outline-variant rounded-xl pl-10 pr-10 py-2.5 text-sm font-medium focus:outline-none focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {authMode === 'signin' && (
              <div className="text-right -mt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!email.trim()) { setError('Enter your email first.'); return; }
                    if (isSupabaseEnabled && supabase) {
                      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email);
                      if (resetErr) setError(resetErr.message);
                      else setSuccessMsg('Password reset email sent — check your inbox.');
                    }
                  }}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Demo quick-access — always visible */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-xs text-outline font-semibold uppercase tracking-wider">demo access</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          <div className="grid grid-cols-2 gap-3 pb-2">
            <button
              type="button"
              onClick={() => handleRoleLogin('user')}
              className="flex flex-col items-center gap-2 border-2 border-outline-variant hover:border-primary rounded-xl py-4 px-3 text-center transition-all group"
            >
              <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center group-hover:bg-primary transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-on-secondary-container group-hover:fill-white transition-colors" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">Player</p>
                <p className="text-[11px] text-on-surface-variant font-medium leading-tight mt-0.5">Book courts &amp; reservations</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleRoleLogin('admin')}
              className="flex flex-col items-center gap-2 border-2 border-outline-variant hover:border-primary rounded-xl py-4 px-3 text-center transition-all group"
            >
              <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center group-hover:bg-primary transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-on-secondary-container group-hover:fill-white transition-colors" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5zm-1 4v2H9v2h2v2h2v-2h2v-2h-2V9h-2z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">Admin</p>
                <p className="text-[11px] text-on-surface-variant font-medium leading-tight mt-0.5">Courts, pricing &amp; bookings</p>
              </div>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
