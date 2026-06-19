import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import CustomerApp from './customer/CustomerApp';
import AdminApp from './admin/AdminApp';
import { supabase, isSupabaseEnabled } from './lib/supabase';

export interface CurrentUser {
  name: string;
  email: string;
  avatar?: string;
}

interface RoutesProps {
  role: 'user' | 'admin' | null;
  onLogin: (role: 'user' | 'admin') => void;
  onLogout: () => Promise<void>;
  currentUser: CurrentUser | null;
}

function AppRoutes({ role, onLogin, onLogout, currentUser }: RoutesProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await onLogout();
    navigate('/');
  };

  // Redirect admin → /admin
  if (role === 'admin' && !pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />;
  }
  // Redirect non-admin away from /admin after logout
  if (role !== 'admin' && pathname.startsWith('/admin')) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="/admin/*" element={
        <AdminApp role={role} onLogin={onLogin} onLogout={handleLogout} currentUser={currentUser} />
      } />
      <Route path="*" element={
        <CustomerApp role={role} onLogin={onLogin} onLogout={handleLogout} currentUser={currentUser} />
      } />
    </Routes>
  );
}

export default function App() {
  const [role, setRole] = useState<'user' | 'admin' | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseEnabled);

  const applySession = (session: any) => {
    if (session?.user) {
      const meta = session.user.user_metadata ?? {};
      const r: 'user' | 'admin' = meta.role === 'admin' ? 'admin' : 'user';
      setRole(r);
      setCurrentUser({
        name: meta.full_name ?? meta.name ?? session.user.email?.split('@')[0] ?? 'Player',
        email: session.user.email ?? '',
        avatar: meta.avatar_url ?? meta.picture ?? undefined,
      });
    } else {
      setRole(null);
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (isSupabaseEnabled && supabase) await supabase.auth.signOut();
    setRole(null);
    setCurrentUser(null);
  };


  if (!authReady) return null;

  return (
    <BrowserRouter>
      <AppRoutes role={role} onLogin={setRole} onLogout={handleLogout} currentUser={currentUser} />
    </BrowserRouter>
  );
}
