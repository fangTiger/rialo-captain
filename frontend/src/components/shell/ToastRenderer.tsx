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
      onClick={() => onDismiss(toast.id)}
      style={{
        display: "block",
        width: "100%",
        maxWidth: 360,
        marginBottom: 12,
        padding: "12px 16px",
        border: "1px solid var(--border-emphasis)",
        borderLeft: "3px solid var(--accent-radar)",
        background: "var(--surface-1)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.4,
        textAlign: "left",
        cursor: "pointer",
        animation: "slideRight 200ms cubic-bezier(0.22, 1, 0.36, 1)",
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
        style={{
          position: "fixed",
          top: 60,
          right: 24,
          zIndex: 100,
          display: "grid",
          justifyItems: "end",
          pointerEvents: "auto",
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
        {`@keyframes slideRight { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }`}
      </style>
    </>
  );
}
