import { useMemo, useState } from "react";
import { apiFetch } from "../../api/client";
import { resolvePublicDeployConfig } from "../../config/deployment";
import { usePoolStore } from "../../store/pool";

interface DevInjectDelayButtonProps {
  poolId: string;
}

interface InjectDelayResponse {
  flight_id: string;
  delay_minutes: number;
}

export function DevInjectDelayButton({ poolId }: DevInjectDelayButtonProps) {
  const [status, setStatus] = useState<"idle" | "injecting" | "done" | "error">(
    "idle",
  );
  const ticker = usePoolStore((state) => state.ticker);
  const devLoginEnabled = resolvePublicDeployConfig().devLoginEnabled;
  const latestFlightId = useMemo(() => {
    const event = ticker.find(
      (item) =>
        item.type === "bound" &&
        item.payload.pool_id === poolId &&
        typeof item.payload.flight_id === "string",
    );
    return typeof event?.payload.flight_id === "string"
      ? event.payload.flight_id
      : null;
  }, [poolId, ticker]);

  if (!devLoginEnabled) return null;

  async function injectDelay() {
    if (!latestFlightId) return;
    setStatus("injecting");
    try {
      await apiFetch<InjectDelayResponse>("/inject-delay", {
        method: "POST",
        body: JSON.stringify({
          flight_id: latestFlightId,
          delay_minutes: 45,
        }),
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <button
        className="command-focus-ring"
        disabled={!latestFlightId || status === "injecting"}
        onClick={injectDelay}
        style={{
          minHeight: 34,
          padding: "0 12px",
          color: "var(--accent-radar)",
          background: "var(--command-surface-glass)",
          border: "1px solid var(--command-border-strong)",
          borderRadius: "var(--radius-pill)",
          cursor: latestFlightId && status !== "injecting" ? "pointer" : "not-allowed",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--font-size-caption)",
          textTransform: "uppercase",
        }}
        type="button"
      >
        Inject demo delay
      </button>
      {status !== "idle" ? (
        <span
          style={{
            color: status === "error" ? "var(--warn-amber)" : "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-caption)",
            textTransform: "uppercase",
          }}
        >
          {status === "injecting"
            ? "Injecting"
            : status === "done"
              ? "Delay injected"
              : "Inject failed"}
        </span>
      ) : null}
    </div>
  );
}
