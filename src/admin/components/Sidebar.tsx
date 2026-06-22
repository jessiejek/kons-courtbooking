import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  Calendar,
  UserPlus,
  LogOut,
  Banknote,
  Menu,
  X,
  Users,
  Swords,
  Trophy,
} from 'lucide-react';

interface SidebarProps {
  onNewBookingClick: () => void;
  newBookingCount?: number;
  onClearNewBookingCount?: () => void;
  pendingPaymentsCount?: number;
  currentUser?: { name: string; email: string; avatar?: string; } | null;
  onLogout?: () => void;
}

export default function Sidebar({ onNewBookingClick, newBookingCount = 0, onClearNewBookingCount, pendingPaymentsCount = 0, currentUser, onLogout }: SidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin', badge: 0 },
    { id: 'courts', label: 'Courts & Pricing', icon: CreditCard, path: '/admin/courts', badge: 0 },
    { id: 'bookings', label: 'Bookings', icon: Calendar, path: '/admin/bookings', badge: newBookingCount },
    { id: 'walkin', label: 'Walk-in', icon: UserPlus, path: '/admin/walkin', badge: 0 },
    { id: 'payments', label: 'Payments', icon: Banknote, path: '/admin/payments', badge: pendingPaymentsCount },
    { id: 'users', label: 'Users', icon: Users, path: '/admin/users', badge: 0 },
    { id: 'openplay', label: 'Open Play', icon: Swords, path: '/admin/openplay', badge: 0 },
    { id: 'tournament', label: 'Tournament', icon: Trophy, path: '/admin/tournament', badge: 0 },
  ] as const;

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin' || pathname === '/admin/';
    return pathname.startsWith(path);
  };

  const handleNav = (item: typeof menuItems[number]) => {
    navigate(item.path);
    if (item.id === 'bookings') onClearNewBookingCount?.();
    setMobileOpen(false);
  };

  const NavContent = () => (
    <>
      {/* Brand */}
      <div className="mb-8 px-2 py-1">
        <h1 className="font-headline-md text-2xl font-extrabold text-primary tracking-tight">Court &amp; Co.</h1>
        <p className="text-xs text-on-surface-variant font-label-sm uppercase tracking-widest mt-1 opacity-75">Admin Terminal</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1.5">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg group text-left ${
                active
                  ? 'text-primary font-bold border-r-2 border-primary bg-surface-container-low'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              <IconComponent className={`w-[18px] h-[18px] transition-colors ${active ? 'text-primary' : 'text-outline group-hover:text-primary'}`} />
              <span className="flex-1">{item.label}</span>
              {item.badge > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto space-y-1.5 pt-4 border-t border-outline-variant">
        <div className="mt-3 border-t border-outline-variant/60 pt-3 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 overflow-hidden">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-container-high border border-outline-variant shrink-0">
              {currentUser?.avatar
                ? <img className="w-full h-full object-cover" referrerPolicy="no-referrer" src={currentUser.avatar} alt="avatar" />
                : <div className="w-full h-full flex items-center justify-center bg-primary text-on-primary font-bold text-sm">{currentUser?.name?.[0]?.toUpperCase() ?? 'A'}</div>
              }
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="font-semibold text-xs text-on-surface leading-tight truncate">{currentUser?.name ?? 'Admin'}</p>
              <p className="text-[10px] text-outline leading-tight mt-0.5 truncate">{currentUser?.email ?? 'Club Manager'}</p>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-all rounded-lg text-left"
            >
              <LogOut className="w-[18px] h-[18px]" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-surface border-r border-outline-variant flex-col p-4 z-50">
        <NavContent />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-outline-variant flex items-center justify-between px-4 z-50">
        <h1 className="font-extrabold text-lg text-primary tracking-tight">Court &amp; Co.</h1>
        <div className="flex items-center gap-3">
          {/* Badges summary */}
          {(newBookingCount + pendingPaymentsCount) > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {newBookingCount + pendingPaymentsCount}
            </span>
          )}
          <button onClick={() => setMobileOpen(true)} className="p-2 text-on-surface-variant hover:text-primary">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <aside className="relative w-72 max-w-[85vw] h-full bg-surface flex flex-col p-4 shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low"
            >
              <X className="w-5 h-5" />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      {/* ── Mobile bottom nav bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant z-50 flex pb-[env(safe-area-inset-bottom)]">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors ${
                active ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              <IconComponent className="w-5 h-5" />
              <span className="text-[9px] font-semibold leading-tight">{item.label.split(' ')[0]}</span>
              {item.badge > 0 && (
                <span className="absolute top-1 right-[calc(50%-14px)] min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
