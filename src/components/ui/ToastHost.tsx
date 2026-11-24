import { useEffect } from 'react';
import { useUiStore, type Toast } from '@/store/uiStore';

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <div className="animate-toast-in pointer-events-auto flex min-h-12 items-center gap-3 rounded-2xl bg-ink px-4 py-2 text-sm text-canvas shadow-lg">
      <span className="flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            dismiss(toast.id);
          }}
          className="min-h-11 rounded-lg px-2 font-semibold text-brand-soft underline-offset-2 hover:underline"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

/** Toast stack pinned above the bottom bar inside the phone screen. */
export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-3 bottom-[calc(5rem+var(--safe-bottom))] z-40 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
