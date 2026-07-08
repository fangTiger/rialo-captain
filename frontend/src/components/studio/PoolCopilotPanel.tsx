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

const BRIEFING_COOLDOWN_MS = 30_000;

export function PoolCopilotPanel({ pool }: PoolCopilotPanelProps) {
  const { ask, errorMessage, isLoading, response } = useCopilot();
  const hits24h = usePoolStore((state) => state.hits24h);
  const paidOut = usePoolStore((state) => state.paidOut);
  const ticker = usePoolStore((state) => state.ticker);
  const emptyBriefingAskedRef = useRef(false);
  const lastHitsRef = useRef(hits24h);
  const lastPaidOutRef = useRef(paidOut);
  const seenClosedEventsRef = useRef<Set<string>>(new Set());
  const lastBriefingAtRef = useRef(0);

  function askIfIdle(input: Parameters<typeof ask>[0]) {
    const now = Date.now();
    if (isLoading) return;
    if (now - lastBriefingAtRef.current < BRIEFING_COOLDOWN_MS) return;
    lastBriefingAtRef.current = now;
    void ask(input, { openPanel: false });
  }

  useEffect(() => {
    if (pool || emptyBriefingAskedRef.current) return;
    emptyBriefingAskedRef.current = true;
    lastBriefingAtRef.current = Date.now();
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
      lastBriefingAtRef.current = Date.now();
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
    if (hits24h > lastHitsRef.current && lastHitsRef.current === 0 && hits24h >= 1) {
      askIfIdle(
        poolSubject(pool.id, "Report the first simulator policy bound to my pool."),
      );
    }
    lastHitsRef.current = hits24h;
  }, [hits24h, pool]);

  useEffect(() => {
    if (!pool) {
      lastPaidOutRef.current = paidOut;
      return;
    }
    if (paidOut > lastPaidOutRef.current) {
      askIfIdle(
        poolSubject(pool.id, "Explain the latest payout from my underwriting pool."),
      );
    }
    lastPaidOutRef.current = paidOut;
  }, [paidOut, pool]);

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
      askIfIdle(
        poolSubject(poolId, "Explain why this underwriting pool closed after drawdown."),
      );
    }
  }, [pool?.id, ticker]);

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
