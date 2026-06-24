import { useCallback, useRef, useState } from 'react';

type ToastKind = 'info' | 'success' | 'error';
interface ToastState { id: number; message: string; kind: ToastKind }

const KIND_STYLE: Record<ToastKind, string> = {
  info: 'bg-ink text-white',
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
};

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const ToastViewport = (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"
    >
      {toast && (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl px-5 py-3 text-sm font-medium shadow-xl animate-fade-in ${KIND_STYLE[toast.kind]}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );

  return { showToast, ToastViewport };
}
