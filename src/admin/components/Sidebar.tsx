import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  CreditCard,
  Calendar,
  Settings,
  HelpCircle,
  Plus
} from 'lucide-react';

interface SidebarProps {
  onNewBookingClick: () => void;
}

export default function Sidebar({ onNewBookingClick }: SidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { id: 'locations', label: 'Locations', icon: MapPin, path: '/admin/locations' },
    { id: 'courts', label: 'Courts & Pricing', icon: CreditCard, path: '/admin/courts' },
    { id: 'bookings', label: 'Bookings', icon: Calendar, path: '/admin/bookings' },
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
              onClick={() => navigate(item.path)}
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
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Nav & Profile */}
      <div className="mt-auto space-y-1.5 pt-4 border-t border-outline-variant">
        <button
          onClick={() => alert('Settings module opened (Simulated)')}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-all rounded-lg text-left"
        >
          <Settings className="w-[18px] h-[18px] text-outline" />
          <span>Settings</span>
        </button>
        <button
          onClick={() => alert('Support module opened (Simulated)')}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-all rounded-lg text-left"
        >
          <HelpCircle className="w-[18px] h-[18px] text-outline" />
          <span>Support</span>
        </button>

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
        <div className="flex items-center gap-3 px-3 py-3 mt-4 border-t border-outline-variant/60">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-high border border-outline-variant">
            <img
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCTCIeJS5lKK-FKucivb-pbiWrgm4_31KiecnhxzjXAAZgIELT5aZN_ApjGb7F7Zz9uf1I5714bK3KZdPfLRyKfPMMAarhcXB9TuZtW3w-UjrRCIS8Tj2KEuyMhA2rh6MSkims_kNCcwvlvE2SHOegW_qJ-ay-twEeSbRCgIn02sQ7BfcsetWa7mZaCteAiZLmy-CyaVlHrzfuTdFnZ5IUwxOdlHaoIp_wnC-1WpZR5lcW8OHNzaLfP0YE6N9l-vAIltcz44gsc6cEQ"
              alt="Alex Rivera headshot"
            />
          </div>
          <div className="overflow-hidden">
            <p className="font-semibold text-xs text-on-surface leading-tight truncate">
              Alex Rivera
            </p>
            <p className="text-[10px] uppercase font-bold text-outline leading-tight mt-0.5 tracking-wider">
              Club Manager
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
