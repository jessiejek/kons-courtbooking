import { AlertTriangle, Trash2, LogOut, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', variant = 'default', onConfirm, onCancel }: ConfirmOptions) {
  const Icon = variant === 'danger' ? Trash2 : variant === 'warning' ? LogOut : AlertTriangle;

  const iconBg = variant === 'danger' ? 'bg-red-50' : variant === 'warning' ? 'bg-amber-50' : 'bg-[#e8f5ee]';
  const iconColor = variant === 'danger' ? 'text-red-500' : variant === 'warning' ? 'text-amber-500' : 'text-[#00694c]';
  const btnColor = variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#00694c] hover:bg-[#005a40]';

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="font-extrabold text-[#1a1c1b] text-base leading-tight">{title}</h3>
              <p className="text-sm text-[#6d7a73] mt-1.5 leading-relaxed">{message}</p>
            </div>
            <button onClick={onCancel} className="text-[#9aada5] hover:text-[#1a1c1b] transition-colors shrink-0 -mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[#dde8e2] text-sm font-semibold text-[#3d4943] hover:bg-[#f0f4f1] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${btnColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
