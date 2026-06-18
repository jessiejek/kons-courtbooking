import { useNavigate } from 'react-router-dom';
import { Search, Bell, UserCircle, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  backAction?: {
    label: string;
    backPath: string;
  } | null;
}

export default function Header({ searchText, onSearchChange, backAction }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="h-16 flex items-center justify-between px-10 sticky top-0 bg-background/90 backdrop-blur-md z-40 border-b border-outline-variant">
      {/* Left side: Back action OR search bar */}
      <div className="flex-1 flex items-center max-w-md">
        {backAction ? (
          <button
            onClick={() => navigate(backAction.backPath)}
            className="flex items-center gap-2 text-primary hover:text-opacity-85 font-semibold text-sm transition-all focus:outline-none"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="uppercase tracking-wider text-xs">{backAction.label}</span>
          </button>
        ) : (
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Global search..."
              className="w-full pl-10 pr-4 py-2 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-sans transition-all placeholder:text-outline"
            />
          </div>
        )}
      </div>

      {/* Right side: Notifications, separator, user */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => alert('No new notifications')}
          className="relative p-2 text-on-surface-variant hover:text-primary transition-all duration-200"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-600 rounded-full"></span>
        </button>

        <div className="h-6 w-[1px] bg-outline-variant"></div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="font-semibold text-xs text-on-surface leading-tight">Admin User</p>
            <p className="text-[10px] text-outline leading-tight mt-0.5 font-medium">Club Manager</p>
          </div>
          <UserCircle className="w-8 h-8 text-primary group-hover:text-opacity-85 transition-opacity" />
        </div>
      </div>
    </header>
  );
}
