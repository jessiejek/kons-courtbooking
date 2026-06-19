import { Bell, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  onEnable: () => Promise<void>;
}

export default function NotificationBanner({ onEnable }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (dismissed) return null;
  if (typeof Notification === 'undefined') return null;
  if (Notification.permission !== 'default') return null;

  const handle = async () => {
    setLoading(true);
    await onEnable();
    setLoading(false);
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 z-[90] bg-white border border-outline-variant rounded-2xl shadow-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Bell className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface">Enable notifications</p>
        <p className="text-xs text-on-surface-variant mt-0.5">Get alerted when new bookings come in or payments need review.</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handle}
            disabled={loading}
            className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-60 transition-all"
          >
            {loading ? 'Enabling…' : 'Enable'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-on-surface-variant hover:text-on-surface px-3 py-2"
          >
            Not now
          </button>
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="text-on-surface-variant hover:text-on-surface shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
