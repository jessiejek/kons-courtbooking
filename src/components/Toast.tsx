import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const styles = {
  success: 'bg-white border-l-4 border-[#00694c]',
  error: 'bg-white border-l-4 border-red-500',
  warning: 'bg-white border-l-4 border-amber-500',
  info: 'bg-white border-l-4 border-blue-500',
};

const iconStyles = {
  success: 'text-[#00694c]',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);
  const Icon = icons[toast.type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onRemove, 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl shadow-xl min-w-[300px] max-w-sm transition-all duration-300 ${styles[toast.type]} ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
    }`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconStyles[toast.type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1a1c1b]">{toast.title}</p>
        {toast.message && <p className="text-xs text-[#6d7a73] mt-0.5">{toast.message}</p>}
      </div>
      <button onClick={() => { setVisible(false); setTimeout(onRemove, 300); }} className="text-[#9aada5] hover:text-[#1a1c1b] transition-colors shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 items-end">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} />)}
    </div>
  );
}

// Hook
import { useState as useStateHook, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useStateHook<ToastMessage[]>([]);

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, title, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, toast, removeToast };
}
