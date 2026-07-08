import { useEffect, useRef } from "react";
import type { Pool } from "../../api/pool";
import { useCopilot } from "../copilot/CopilotProvider";
import { CommandPanel, SignalPill } from "../../design/commandCenter";
import { usePoolStore } from "../../store/pool";

interface PoolCopilotPanelProps {
  pool: Pool | null;
}

function poolSubject(poolId: string, question: string) {
  return {
    question,
    subjectType: "pool" as const,
    subjectId: poolId,
  };
}

export function PoolCopilotPanel({ pool }: PoolCopilotPanelProps) {
  const { ask, errorMessage, isLoading, response } = useCopilot();
  const hits24h = usePoolStore((state) => state.hits24h);
  const paidOut = usePoolStore((state) => state.paidOut);
  const ticker = usePoolStore((state) => state.ticker);
  const emptyBriefingAskedRef = useRef(false);
  const lastHitsRef = useRef(hits24h);
  const lastPaidOutRef = useRef(paidOut);
  const seenClosedEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (pool || emptyBriefingAskedRef.current) return;
    emptyBriefingAskedRef.current = true;
    void ask(
      {
        question: "Recommend a starter underwriting preset for Underwriter Studio.",
        subjectType: "overview",
      },
      { openPanel: false },
    );
  }, [ask, pool]);

  useEffect(() => {
    if (!pool) return undefined;
    const timer = window.setTimeout(() => {
      void ask(
        poolSubject(pool.id, "Brief this underwriting pool now that it is live."),
        { openPanel: false },
      );
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [ask, pool]);

  useEffect(() => {
    if (!pool) {
      lastHitsRef.current = hits24h;
      return;
    }
    if (hits24h > lastHitsRef.current) {
      if (lastHitsRef.current === 0 && hits24h >= 1) {
        void ask(
          poolSubject(pool.id, "Report the first simulator policy bound to my pool."),
          { openPanel: false },
        );
      }
      if (hits24h > 0 && hits24h % 5 === 0) {
        void ask(
          poolSubject(pool.id, "Brief the latest 5 bound policies and forward exposure."),
          { openPanel: false },
        );
      }
    }
    lastHitsRef.current = hits24h;
  }, [ask, hits24h, pool]);

  useEffect(() => {
    if (!pool) {
      lastPaidOutRef.current = paidOut;
      return;
    }
    if (paidOut > lastPaidOutRef.current) {
      void ask(
        poolSubject(pool.id, "Explain the latest payout from my underwriting pool."),
        { openPanel: false },
      );
    }
    lastPaidOutRef.current = paidOut;
  }, [ask, paidOut, pool]);

  useEffect(() => {
    for (const event of ticker) {
      if (
        event.type !== "closed" ||
        event.payload.reason !== "bankrupt" ||
        seenClosedEventsRef.current.has(event.id)
      ) {
        continue;
      }
      seenClosedEventsRef.current.add(event.id);
      const poolId =
        typeof event.payload.pool_id === "string" ? event.payload.pool_id : pool?.id;
      if (!poolId) continue;
      void ask(
        poolSubject(poolId, "Explain why this underwriting pool closed after drawdown."),
        { openPanel: false },
      );
    }
  }, [ask, pool?.id, ticker]);

  const visibleAnswer =
    errorMessage ??
    response?.answer ??
    "Copilot is watching underwriting events, binds, payouts, and rule changes.";

  return (
    <CommandPanel
      aria-label="Studio copilot briefing"
      eyebrow="COPILOT"
      status={isLoading ? "STREAMING" : "READY"}
      title="Pool briefing"
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <SignalPill tone={pool ? "radar" : "weather"}>
            subject {pool ? "pool" : "overview"}
          </SignalPill>
          {pool ? <SignalPill tone="guarded">pool {pool.id}</SignalPill> : null}
        </div>
        <p
          style={{
            margin: 0,
            color: errorMessage ? "var(--warn-amber)" : "var(--text-secondary)",
            fontSize: "var(--font-size-body)",
            lineHeight: "var(--line-height-copy)",
          }}
        >
          {visibleAnswer}
        </p>
      </div>
    </CommandPanel>
  );
}
