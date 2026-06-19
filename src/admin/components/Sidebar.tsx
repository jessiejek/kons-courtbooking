import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  CreditCard,
  Calendar,
  UserPlus,
  Plus,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  onNewBookingClick: () => void;
  newBookingCount?: number;
  onClearNewBookingCount?: () => void;
  currentUser?: { name: string; email: string; avatar?: string; } | null;
  onLogout?: () => void;
}

export default function Sidebar({ onNewBookingClick, newBookingCount = 0, onClearNewBookingCount, currentUser, onLogout }: SidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin', badge: 0 },
    { id: 'locations', label: 'Locations', icon: MapPin, path: '/admin/locations', badge: 0 },
    { id: 'courts', label: 'Courts & Pricing', icon: CreditCard, path: '/admin/courts', badge: 0 },
    { id: 'bookings', label: 'Bookings', icon: Calendar, path: '/admin/bookings', badge: newBookingCount },
    { id: 'walkin', label: 'Walk-in', icon: UserPlus, path: '/admin/walkin', badge: 0 },
  ] as const;

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin' || pathname === '/admin/';
    return pathname.startsWith(path);
  };

  return (
    <aside id="sidebar-container" className="fixed left-0 top-0 h-full w-64 bg-surface border-r border-outline-variant flex flex-col p-4 z-50">
      {/* Brand Header */}
      <div className="mb-8 px-2 py-1">
        <h1 className="font-headline-md text-2xl font-extrabold text-primary tracking-tight">
          Court &amp; Co.
        </h1>
        <p className="text-xs text-on-surface-variant font-label-sm uppercase tracking-widest mt-1 opacity-75">
          Admin Terminal
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.path);
                if (item.id === 'bookings') onClearNewBookingCount?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg group text-left ${
                active
                  ? 'text-primary font-bold border-r-2 border-primary bg-surface-container-low'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              <IconComponent
                className={`w-[18px] h-[18px] transition-colors ${
                  active ? 'text-primary' : 'text-outline group-hover:text-primary'
                }`}
              />
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

      {/* Footer Nav & Profile */}
      <div className="mt-auto space-y-1.5 pt-4 border-t border-outline-variant">
        {/* Settings and Support hidden — not yet implemented */}

        {/* Quick Booking CTA */}
        <div className="mt-3 px-1">
          <button
            onClick={onNewBookingClick}
            className="w-full bg-primary text-on-primary font-semibold text-sm py-2.5 px-4 rounded-lg hover:bg-opacity-95 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Book Now</span>
          </button>
        </div>

        {/* Club Manager Profile Section */}
        <div className="mt-3 border-t border-outline-variant/60 pt-3 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 overflow-hidden">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-container-high border border-outline-variant shrink-0">
              {currentUser?.avatar
                ? <img className="w-full h-full object-cover" referrerPolicy="no-referrer" src={currentUser.avatar} alt="avatar" />
                : <div className="w-full h-full flex items-center justify-center bg-primary text-on-primary font-bold text-sm">{currentUser?.name?.[0]?.toUpperCase() ?? 'A'}</div>
              }
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="font-semibold text-xs text-on-surface leading-tight truncate">
                {currentUser?.name ?? 'Admin'}
              </p>
              <p className="text-[10px] text-outline leading-tight mt-0.5 truncate">
                {currentUser?.email ?? 'Club Manager'}
              </p>
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
    </aside>
  );
}
