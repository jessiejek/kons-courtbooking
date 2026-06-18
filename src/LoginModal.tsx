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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => { setError(null); setSuccessMsg(null); };

  const handleFacebookLogin = async () => {
    reset();
    if (isSupabaseEnabled && supabase) {
      setFacebookLoading(true);
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: window.location.origin },
      });
      setFacebookLoading(false);
      if (oauthErr) setError(oauthErr.message);
      return;
    }
    onLogin('user');
    onClose();
  };

  const handleGoogleLogin = async () => {
    reset();
    if (isSupabaseEnabled && supabase) {
      setGoogleLoading(true);
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      setGoogleLoading(false);
      if (oauthErr) setError(oauthErr.message);
      return;
    }
    onLogin('user');
    onClose();
  };

  const handleEmailSignIn = async () => {
    reset();
    if (!email.trim() || !password.trim()) { setError('Please enter your email and password.'); return; }
    if (isSupabaseEnabled && supabase) {
      setIsLoading(true);
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);
      if (err) { setError(err.message); return; }
      const role: 'user' | 'admin' = data.user?.user_metadata?.role === 'admin' ? 'admin' : 'user';
      onLogin(role);
      onClose();
      if (role === 'admin') navigate('/admin');
      return;
    }
    const role: 'user' | 'admin' = email.toLowerCase().includes('admin') ? 'admin' : 'user';
    onLogin(role);
    onClose();
    if (role === 'admin') navigate('/admin');
  };

  const handleEmailSignUp = async () => {
    reset();
    if (!email.trim() || !password.trim()) { setError('Please enter your email and password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (isSupabaseEnabled && supabase) {
      setIsLoading(true);
      const { error: err } = await supabase.auth.signUp({
        email, password, options: { data: { role: 'user' } },
      });
      setIsLoading(false);
      if (err) { setError(err.message); return; }
      setSuccessMsg('Account created! Check your email to confirm, then sign in.');
      setAuthMode('signin');
      return;
    }
    onLogin('user');
    onClose();
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
        <div className="flex items-start justify-between px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00694c] flex items-center justify-center shadow-md">
              <span className="text-white font-black text-lg leading-none">S</span>
            </div>
            <div>
              <p className="text-sm font-extrabold text-[#1a1c1b] leading-tight">Sunshine Pickleball</p>
              <p className="text-[11px] text-[#6d7a73] font-medium leading-tight mt-0.5">
                {authMode === 'signin' ? 'Welcome back — sign in to continue' : 'Create your player account'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#6d7a73] hover:bg-[#f0f4f1] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">

          {/* Sign-in / Sign-up toggle */}
          <div className="flex bg-[#f0f4f1] rounded-xl p-1 gap-1">
            {(['signin', 'signup'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setAuthMode(mode); reset(); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  authMode === mode
                    ? 'bg-white text-[#00694c] shadow-sm'
                    : 'text-[#6d7a73] hover:text-[#1a1c1b]'
                }`}
              >
                {mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Error / success */}
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

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || googleLoading}
            className="w-full flex items-center justify-center gap-3 border border-[#dde8e2] rounded-xl py-3 px-4 text-sm font-semibold text-[#1a1c1b] hover:bg-[#f0f4f1] transition-colors disabled:opacity-60"
          >
            {googleLoading ? (
              <span className="w-4 h-4 border-2 border-[#dde8e2] border-t-[#00694c] rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Facebook */}
          <button
            type="button"
            onClick={handleFacebookLogin}
            disabled={isLoading || googleLoading || facebookLoading}
            className="w-full flex items-center justify-center gap-3 border border-[#dde8e2] rounded-xl py-3 px-4 text-sm font-semibold text-[#1a1c1b] hover:bg-[#f0f4f1] transition-colors disabled:opacity-60"
          >
            {facebookLoading ? (
              <span className="w-4 h-4 border-2 border-[#dde8e2] border-t-[#1877F2] rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            )}
            Continue with Facebook
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#e8eeeb]" />
            <div className="flex-1 h-px bg-[#e8eeeb]" />
          </div>

          {/* Email / password */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9aada5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#f9faf9] border border-[#dde8e2] rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-[#1a1c1b] placeholder-[#9aada5] focus:outline-none focus:border-[#00694c] focus:ring-1 focus:ring-[#00694c]/20 transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-[#9aada5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={authMode === 'signup' ? 'Password (min. 6 characters)' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#f9faf9] border border-[#dde8e2] rounded-xl pl-10 pr-10 py-2.5 text-sm font-medium text-[#1a1c1b] placeholder-[#9aada5] focus:outline-none focus:border-[#00694c] focus:ring-1 focus:ring-[#00694c]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aada5] hover:text-[#1a1c1b] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {authMode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={async () => {
                    if (!email.trim()) { setError('Enter your email address first.'); return; }
                    if (isSupabaseEnabled && supabase) {
                      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email);
                      if (resetErr) setError(resetErr.message);
                      else setSuccessMsg('Password reset email sent — check your inbox.');
                    }
                  }}
                  className="text-xs text-[#00694c] font-semibold hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#00694c] hover:bg-[#005a40] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-[#00694c]/20 active:scale-[0.98]"
            >
              {isLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
