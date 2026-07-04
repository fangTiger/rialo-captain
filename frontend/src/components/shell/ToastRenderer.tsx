import { useEffect } from "react";
import { useEventStore, type ToastEvent } from "../../store/eventStore";

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastEvent;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 3000);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast.id]);

  return (
    <button
      type="button"
      className="toast-item command-surface command-focus-ring"
      onClick={() => onDismiss(toast.id)}
      style={{
        display: "block",
        width: "100%",
        maxWidth: 360,
        marginBottom: 12,
        padding: "12px 16px",
        border: "1px solid var(--command-border-strong)",
        borderLeft: "3px solid var(--accent-radar)",
        background: "var(--command-surface-panel)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.4,
        textAlign: "left",
        cursor: "pointer",
        boxShadow: "var(--glow-command)",
        backdropFilter: "blur(18px) saturate(135%)",
        animation: "commandToastEnter 200ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {toast.message}
    </button>
  );
}

export function ToastRenderer() {
  const toasts = useEventStore((state) => state.toasts);
  const dismissToast = useEventStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <>
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="toast-stack command-safe-area"
        style={{
          position: "fixed",
          top: 60,
          right: 0,
          zIndex: 100,
          display: "grid",
          justifyItems: "end",
          pointerEvents: "auto",
          paddingTop: 0,
          paddingBottom: 0,
          paddingLeft: 16,
        }}
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
          />
        ))}
      </div>
      <style>
        {`@keyframes commandToastEnter { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
@media (prefers-reduced-motion: reduce) { .toast-item { animation: none !important; } }`}
      </style>
    </>
  );
}
