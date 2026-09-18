import { useCallback, useRef, useState } from 'react';

type ToastKind = 'info' | 'success' | 'error';
/** An optional outbound link rendered beside the message. */
export interface ToastAction { label: string; href: string }
interface ToastState { id: number; message: string; kind: ToastKind; action?: ToastAction }

const KIND_STYLE: Record<ToastKind, string> = {
  info: 'bg-ink text-white',
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
};

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pointer and keyboard focus hold the toast independently: ending one must
  // not restart the dismiss timer while the other still holds it.
  const hovered = useRef(false);
  const focused = useRef(false);

  // A toast nobody can reach in time is not a CTA: the ones carrying a link
  // stay long enough to notice it and move the pointer there.
  const schedule = useCallback((hasAction: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), hasAction ? 7000 : 2600);
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info', action?: ToastAction) => {
      // A new toast is a new element that never fires leave/blur for the old one.
      hovered.current = false;
      focused.current = false;
      setToast({ id: Date.now(), message, kind, action });
      schedule(Boolean(action));
    },
    [schedule],
  );

  // Hold the toast open while someone is pointing at or focused on it, so the
  // link is never pulled out from under a click or a focused keyboard user.
  const hold = (source: typeof hovered) => {
    source.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const release = (source: typeof hovered) => {
    source.current = false;
    if (toast && !hovered.current && !focused.current) schedule(Boolean(toast.action));
  };

  const ToastViewport = (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"
    >
      {toast && (
        <div
          key={toast.id}
          onMouseEnter={() => hold(hovered)}
          onMouseLeave={() => release(hovered)}
          onFocus={() => hold(focused)}
          onBlur={() => release(focused)}
          className={`pointer-events-auto flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-medium shadow-xl animate-fade-in ${KIND_STYLE[toast.kind]}`}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <a
              href={toast.action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-ink transition-colors hover:bg-slate-100 focus-visible:outline-white"
            >
              {toast.action.label}
            </a>
          )}
        </div>
      )}
    </div>
  );

  return { showToast, ToastViewport };
}
