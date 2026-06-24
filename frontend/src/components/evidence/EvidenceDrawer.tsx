import { useEffect } from "react";
import {
  useEvidenceTimeline,
  type EvidenceEvent,
  type EvidenceSubject,
} from "../../hooks/useEvidenceTimeline";

interface EvidenceDrawerProps {
  subject: EvidenceSubject;
  onClose: () => void;
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function EvidenceDrawer({
  subject,
  onClose,
}: EvidenceDrawerProps) {
  const { timeline, events, error, isLoading } = useEvidenceTimeline(subject);

  useEffect(() => {
    if (!subject) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, subject]);

  if (!subject) {
    return null;
  }

  const title = subject.kind === "claim" ? "Claim Evidence" : "Policy Evidence";

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
        aria-label={title}
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
        <header
          style={{
            padding: "20px 56px 14px 20px",
            borderBottom: "1px solid var(--border-subtle)",
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
          <div
            style={{
              marginTop: 6,
              fontSize: 24,
              color: "var(--text-primary)",
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-tertiary)",
              overflowWrap: "anywhere",
            }}
          >
            {subject.kind}: {subject.id}
          </div>
        </header>

        <section
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-secondary)",
            display: "grid",
            gap: 8,
          }}
        >
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
        </section>

        <div
          style={{
            overflowY: "auto",
            minHeight: 0,
            paddingBottom: 24,
          }}
        >
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
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {events.map((event) => (
                <EvidenceRow event={event} key={event.id} />
              ))}
            </ol>
          )}
        </div>

        <button
          type="button"
          aria-label="Close evidence drawer"
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
      </aside>
      <style>
        {`
          @keyframes evidence-slide-in {
            from {
              transform: translateX(100%);
            }

            to {
              transform: translateX(0);
            }
          }
        `}
      </style>
    </>
  );
}

function EvidenceRow({ event }: { event: EvidenceEvent }) {
  const eventTone = toneForEvent(event.type);
  const createdAt = normalizeTimestamp(event.created_at);
  const payloadEntries = Object.entries(event.payload).filter(
    ([, value]) => value !== undefined && value !== null,
  );

  return (
    <li
      style={{
        padding: "18px 20px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "grid",
        gap: 12,
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
              {event.title}
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
            {timeFormatter.format(createdAt)}
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
