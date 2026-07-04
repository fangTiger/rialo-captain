import { useEffect, useId, useRef, useState } from "react";
import {
  useEvidenceTimeline,
  type EvidenceEvent,
  type EvidenceSubject,
} from "../../hooks/useEvidenceTimeline";
import {
  CommandPanel,
  MetricDeck,
  SignalPill,
  type CommandMetric,
  type CommandTone,
} from "../../design/commandCenter";
import { CopilotPromptChip } from "../copilot/CopilotPromptChip";
import { useReducedMotion } from "../cinema/useReducedMotion";

interface EvidenceDrawerProps {
  subject: EvidenceSubject;
  onClose: () => void;
}

const evidenceTimeFormatterOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

const EVIDENCE_STORY_ADVANCE_MS = 3_000;
const EVIDENCE_STORY_REDUCED_MOTION_ADVANCE_MS = 4_500;
const EVIDENCE_TYPE_TITLE_MAP: Record<string, string> = {
  "policy.created": "Policy created",
  "contract.watched": "Contract watch established",
  "observation.received": "Delay observation received",
  "condition.matched": "Payout condition matched",
  "claim.triggered": "Claim triggered",
  "claim.settled": "Claim settled",
  "balance.credited": "Balance credited",
  "flight.landed": "Flight landed",
};
const HAN_TEXT_PATTERN = /\p{Script=Han}/u;
let evidenceTimeFormatter: Intl.DateTimeFormat | null = null;

export function EvidenceDrawer({
  subject,
  onClose,
}: EvidenceDrawerProps) {
  const { timeline, events, error, isLoading } = useEvidenceTimeline(subject);
  const prefersReducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const drawerKey = subject ? `${subject.kind}:${subject.id}` : null;
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const [isStoryPlaying, setIsStoryPlaying] = useState(false);
  const hasPlaybackControls = !isLoading && !error && events.length > 1;
  const hasEvents = !isLoading && !error && events.length > 0;
  const lastEventIndex = Math.max(events.length - 1, 0);

  useEffect(() => {
    if (!drawerKey) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const initialFocusTarget = closeButtonRef.current ?? dialogRef.current;
    initialFocusTarget?.focus();

    return () => {
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;

      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [drawerKey]);

  useEffect(() => {
    if (!drawerKey) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true",
      );

      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!activeElement || !dialog.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? dialog : focusableElements[0] ?? dialog).focus();
        return;
      }

      const firstFocusable = focusableElements[0] ?? dialog;
      const lastFocusable =
        focusableElements.length > 0
          ? focusableElements[focusableElements.length - 1]
          : dialog;

      if (event.shiftKey) {
        if (
          activeElement === dialog ||
          activeElement === firstFocusable ||
          activeElement === lastFocusable
        ) {
          event.preventDefault();
          dialog.focus();
          if (activeElement === dialog) {
            lastFocusable.focus();
          }
        }
        return;
      }

      if (activeElement === dialog || activeElement === lastFocusable) {
        event.preventDefault();
        if (activeElement === dialog) {
          firstFocusable.focus();
        } else {
          dialog.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerKey, onClose]);

  useEffect(() => {
    setActiveEventIndex(0);
    setIsStoryPlaying(false);
  }, [drawerKey, events.length]);

  useEffect(() => {
    if (!hasEvents) return;
    setActiveEventIndex((current) => Math.min(current, lastEventIndex));
  }, [hasEvents, lastEventIndex]);

  useEffect(() => {
    if (!hasPlaybackControls || !isStoryPlaying) {
      return;
    }
    if (activeEventIndex >= lastEventIndex) {
      setIsStoryPlaying(false);
      return;
    }

    const timerId = window.setTimeout(() => {
      setActiveEventIndex((current) => Math.min(current + 1, lastEventIndex));
    }, prefersReducedMotion
      ? EVIDENCE_STORY_REDUCED_MOTION_ADVANCE_MS
      : EVIDENCE_STORY_ADVANCE_MS);

    return () => window.clearTimeout(timerId);
  }, [
    activeEventIndex,
    hasPlaybackControls,
    isStoryPlaying,
    lastEventIndex,
    prefersReducedMotion,
  ]);

  if (!subject) {
    return null;
  }

  const title = subject.kind === "claim" ? "Claim Evidence" : "Policy Evidence";
  const activeEventSummary =
    hasEvents && events[activeEventIndex] ? `${activeEventIndex + 1} / ${events.length}` : null;
  const settlementEventCount = events.filter(
    (event) => evidenceKindForEvent(event) === "settlement",
  ).length;
  const contextualSignalCount = Math.max(
    events.length - settlementEventCount,
    0,
  );
  const evidenceMetrics: CommandMetric[] = [
    {
      id: "timeline-events",
      label: "Events",
      value: isLoading ? "..." : events.length,
      detail: error ? "Timeline health alert" : "Ordered evidence feed",
      tone: error ? "severe" : "radar",
    },
    {
      id: "settlement-evidence",
      label: "Settlement evidence",
      value: isLoading ? "..." : settlementEventCount,
      detail: "Observation, contract, claim, ledger",
      tone: "radar",
    },
    {
      id: "contextual-signals",
      label: "Contextual signals",
      value: isLoading ? "..." : contextualSignalCount,
      detail: "Signal-only risk context",
      tone: contextualSignalCount > 0 ? "weather" : "neutral",
    },
  ];

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2, 4, 8, 0.68)",
          backdropFilter: "blur(2px)",
          zIndex: 70,
        }}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="evidence-drawer-panel command-surface command-safe-area"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(100vw, 34rem)",
          background: "var(--surface-1)",
          borderLeft: "1px solid var(--border-emphasis)",
          boxShadow: "var(--elev-2)",
          zIndex: 71,
          display: "grid",
          gridTemplateRows: "auto auto minmax(0, 1fr)",
          animation: "evidence-slide-in 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close evidence drawer"
          className="command-hit-target command-focus-ring"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sharp)",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
          }}
        >
          X
        </button>
        <header
          style={{
            padding: "20px 56px 14px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "grid",
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
            }}
          >
            Evidence Timeline
          </div>
          <h2
            id={titleId}
            style={{
              marginTop: 6,
              marginBottom: 0,
              fontSize: 24,
              color: "var(--text-primary)",
            }}
          >
            {title}
          </h2>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-tertiary)",
              overflowWrap: "anywhere",
            }}
          >
            {subject.kind}: {subject.id}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <CopilotPromptChip
              label="Explain this evidence chain"
              subjectType="evidence"
              subjectId={subject.id}
            />
          </div>
        </header>

        <CommandPanel
          aria-label="Settlement evidence path"
          className="evidence-drawer-path-panel"
          eyebrow="SETTLEMENT ROUTE"
          status={isLoading ? "LOADING" : error ? "ERROR" : "READY"}
          title="Settlement Evidence Path"
        >
          <MetricDeck
            ariaLabel="Settlement evidence metrics"
            metrics={evidenceMetrics}
          />
          <div className="evidence-drawer-subject-grid">
            <MetadataRow
              label="Flight"
              value={timeline?.subject.flight_id ?? "Pending timeline"}
            />
            <MetadataRow
              label="Policy"
              value={timeline?.subject.policy_id ?? "Pending timeline"}
            />
            {timeline?.subject.claim_id ? (
              <MetadataRow label="Claim" value={timeline.subject.claim_id} />
            ) : null}
          </div>
          <div className="evidence-drawer-boundary">
            <SignalPill label="Contextual signal boundary" tone="weather">
              Contextual signal
            </SignalPill>
            <span>
              Contextual signals are not settlement evidence; settlement
              evidence remains observed delay, contract conditions, claim
              events, and credited balance records.
            </span>
          </div>
        </CommandPanel>

        <div
          className="evidence-drawer-scroll"
          data-testid="evidence-drawer-scroll"
          style={{
            overflowY: "auto",
            minHeight: 0,
            paddingBottom: 24,
          }}
        >
          {hasPlaybackControls ? (
            <section
              aria-label="Evidence story controls"
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "grid",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                  }}
                >
                  Evidence story
                </div>
                <div
                  style={{
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                >
                  {activeEventSummary}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <ControlButton
                  disabled={activeEventIndex === 0}
                  label="Previous evidence event"
                  onClick={() => {
                    setIsStoryPlaying(false);
                    setActiveEventIndex((current) => Math.max(current - 1, 0));
                  }}
                />
                <ControlButton
                  label={isStoryPlaying ? "Pause evidence story" : "Play evidence story"}
                  onClick={() => {
                    if (isStoryPlaying) {
                      setIsStoryPlaying(false);
                      return;
                    }
                    if (activeEventIndex >= lastEventIndex) {
                      setActiveEventIndex(0);
                    }
                    setIsStoryPlaying(true);
                  }}
                />
                <ControlButton
                  disabled={activeEventIndex >= lastEventIndex}
                  label="Next evidence event"
                  onClick={() => {
                    setIsStoryPlaying(false);
                    setActiveEventIndex((current) =>
                      Math.min(current + 1, lastEventIndex),
                    );
                  }}
                />
              </div>
            </section>
          ) : null}
          {isLoading ? (
            <StateBlock tone="muted">Loading evidence timeline...</StateBlock>
          ) : error ? (
            <StateBlock tone="danger">
              {error instanceof Error
                ? error.message
                : "Unable to load evidence timeline"}
            </StateBlock>
          ) : events.length === 0 ? (
            <StateBlock tone="muted">No evidence events yet</StateBlock>
          ) : (
            <ol
              data-testid="evidence-event-list"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {events.map((event, index) => (
                <EvidenceRow
                  active={index === activeEventIndex}
                  event={event}
                  key={event.id}
                />
              ))}
            </ol>
          )}
        </div>
      </aside>
      <style>
        {`
          .evidence-drawer-scroll {
            scrollbar-color: var(--accent-radar) rgba(10, 16, 24, 0.56);
            scrollbar-width: thin;
          }

          .evidence-drawer-panel {
            background: var(--command-surface-panel);
            border-left-color: var(--command-border-strong);
          }

          .evidence-drawer-path-panel {
            margin: 14px 16px;
            padding: 14px;
            border-radius: 8px;
          }

          .evidence-drawer-path-panel .command-panel__body {
            display: grid;
            gap: 12px;
          }

          .evidence-drawer-subject-grid {
            display: grid;
            gap: 8px;
            color: var(--text-secondary);
            font-family: var(--font-mono);
            font-size: 12px;
          }

          .evidence-drawer-boundary {
            display: grid;
            gap: 8px;
            color: var(--text-secondary);
            font-size: var(--font-size-caption);
            line-height: var(--line-height-copy);
          }

          .evidence-drawer-scroll::-webkit-scrollbar {
            width: 8px;
          }

          .evidence-drawer-scroll::-webkit-scrollbar-track {
            background: var(--surface-2);
          }

          .evidence-drawer-scroll::-webkit-scrollbar-thumb {
            background: var(--accent-radar);
            border: 2px solid rgba(10, 16, 24, 0.72);
            border-radius: 999px;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
          }

          .evidence-drawer-scroll::-webkit-scrollbar-thumb:hover {
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
          }

          @keyframes evidence-slide-in {
            from {
              transform: translateX(100%);
            }

            to {
              transform: translateX(0);
            }
          }

          @media (max-width: 520px) {
            .evidence-drawer-path-panel {
              margin: 12px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .evidence-drawer-panel {
              animation: none;
            }
          }
        `}
      </style>
    </>
  );
}

function EvidenceRow({
  active,
  event,
}: {
  active: boolean;
  event: EvidenceEvent;
}) {
  const eventTone = toneForEvent(event.type);
  const createdAt = normalizeTimestamp(event.created_at);
  const eventTitle = normalizeEvidenceTitle(event);
  const evidenceKind = evidenceKindForEvent(event);
  const payloadEntries = Object.entries(event.payload).filter(
    ([, value]) => value !== undefined && value !== null,
  );

  return (
    <li
      aria-current={active ? "step" : undefined}
      data-active-story-event={active ? "true" : "false"}
      data-evidence-kind={evidenceKind}
      data-testid={`evidence-row-${event.id}`}
      style={{
        padding: "18px 20px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "grid",
        gap: 12,
        background: active
          ? "rgba(111, 255, 200, 0.08)"
          : evidenceKind === "contextual-signal"
            ? "rgba(65, 216, 255, 0.06)"
            : undefined,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: eventTone,
                boxShadow:
                  eventTone === "var(--accent-radar)"
                    ? "var(--glow-radar)"
                    : "none",
                flexShrink: 0,
              }}
            />
            <strong
              style={{
                color: "var(--text-primary)",
                fontSize: 16,
                overflowWrap: "anywhere",
              }}
            >
              {eventTitle}
            </strong>
          </div>
          <time
            dateTime={new Date(createdAt).toISOString()}
            style={{
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            {getEvidenceTimeFormatter().format(createdAt)}
          </time>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          <SignalPill tone={toneForEvidenceKind(evidenceKind)}>
            {labelForEvidenceKind(evidenceKind)}
          </SignalPill>
          <span
            style={{
              padding: "4px 8px",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-pill)",
              background: "var(--surface-2)",
              color: eventTone,
              overflowWrap: "anywhere",
            }}
          >
            {event.type}
          </span>
          <span
            style={{
              padding: "4px 8px",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-pill)",
              background: "var(--surface-2)",
              color: "var(--text-secondary)",
              overflowWrap: "anywhere",
            }}
          >
            {event.source}
          </span>
        </div>
      </div>

      <dl
        style={{
          margin: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}
      >
        {payloadEntries.length > 0 ? (
          payloadEntries.slice(0, 6).map(([key, value]) => (
            <div
              key={`${event.id}-${key}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(88px, 120px) minmax(0, 1fr)",
                gap: 10,
              }}
            >
              <dt style={{ margin: 0, color: "var(--text-tertiary)" }}>{key}</dt>
              <dd
                style={{
                  margin: 0,
                  color: "var(--text-primary)",
                  overflowWrap: "anywhere",
                }}
              >
                {summarizeValue(value)}
              </dd>
            </div>
          ))
        ) : (
          <div style={{ color: "var(--text-tertiary)" }}>No payload details</div>
        )}
      </dl>
    </li>
  );
}

function ControlButton({
  disabled = false,
  label,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 34,
        padding: "8px 12px",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-pill)",
        background: disabled ? "transparent" : "var(--surface-2)",
        color: disabled ? "var(--text-tertiary)" : "var(--text-primary)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px minmax(0, 1fr)",
        gap: 10,
      }}
    >
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)", overflowWrap: "anywhere" }}>
        {value}
      </span>
    </div>
  );
}

function StateBlock({
  children,
  tone,
}: {
  children: string;
  tone: "muted" | "danger";
}) {
  return (
    <div
      style={{
        padding: "28px 20px",
        color:
          tone === "danger" ? "var(--danger-flare)" : "var(--text-secondary)",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function normalizeTimestamp(value: number) {
  return value >= 1_000_000_000_000 ? value : value * 1000;
}

function getEvidenceTimeFormatter() {
  if (evidenceTimeFormatter === null) {
    evidenceTimeFormatter = new Intl.DateTimeFormat(
      "en-US",
      evidenceTimeFormatterOptions,
    );
  }

  return evidenceTimeFormatter;
}

function normalizeEvidenceTitle(event: Pick<EvidenceEvent, "type" | "title">) {
  const title = typeof event.title === "string" ? event.title.trim() : "";
  const fallbackTitle = EVIDENCE_TYPE_TITLE_MAP[event.type];

  if (!fallbackTitle) {
    return title;
  }

  if (!title || HAN_TEXT_PATTERN.test(title)) {
    return fallbackTitle;
  }

  return title;
}

type EvidenceKind = "settlement" | "contextual-signal";

function evidenceKindForEvent(
  event: Pick<EvidenceEvent, "type" | "source">,
): EvidenceKind {
  const marker = `${event.type} ${event.source}`.toLowerCase();

  if (/(weather|market|risk|forecast|prediction|signal|odds|model)/.test(marker)) {
    return "contextual-signal";
  }

  return "settlement";
}

function labelForEvidenceKind(kind: EvidenceKind) {
  return kind === "contextual-signal"
    ? "Contextual signal"
    : "Settlement evidence";
}

function toneForEvidenceKind(kind: EvidenceKind): CommandTone {
  return kind === "contextual-signal" ? "weather" : "radar";
}

function summarizeValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.length === 0
      ? "[]"
      : value.map((item) => summarizeValue(item)).join(", ");
  }

  if (!value) {
    return "null";
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    return keys.length === 0 ? "{}" : `{ ${keys.slice(0, 3).join(", ")} }`;
  }

  return String(value);
}

function toneForEvent(type: string) {
  if (/(settled|credited)/i.test(type)) {
    return "var(--accent-radar)";
  }

  if (/(triggered|failed|error)/i.test(type)) {
    return "var(--danger-flare)";
  }

  if (/(matched|observed|watched|landed)/i.test(type)) {
    return "var(--warn-amber)";
  }

  return "var(--text-secondary)";
}
