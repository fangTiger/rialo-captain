import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSearchFlights, type SearchFlightResult } from "../../hooks/useSearchFlights";

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function routeLabel(flight: SearchFlightResult): string {
  if (!flight.origin || !flight.destination) return "—";
  return `${flight.origin} → ${flight.destination}`;
}

function delayLabel(flight: SearchFlightResult): string {
  const value = typeof flight.delay_rate === "number" ? flight.delay_rate : 0;
  return `${Math.round(value * 100)}%`;
}

function statusLabel(flight: SearchFlightResult): string {
  return flight.on_ground ? "ON GROUND" : "IN-FLIGHT";
}

export function SearchPalette({ open, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { results, totalMatches, isLoading } = useSearchFlights(query);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setSelectedIndex(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, totalMatches]);

  useEffect(() => {
    if (results.length === 0) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex((current) => clamp(current, 0, results.length - 1));
  }, [results.length]);

  if (!open) return null;

  const closePalette = () => {
    onClose();
    previousFocusRef.current?.focus();
  };

  const openFlight = (flight: SearchFlightResult | undefined) => {
    if (!flight) return;
    navigate(`/flight/${flight.flight_id}`, { state: { from: location.pathname } });
    closePalette();
  };

  const selectedFlight = results[selectedIndex];

  return (
    <div
      data-testid="search-overlay"
      onClick={closePalette}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0, 0, 0, 0.5)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-palette-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(640px, calc(100vw - 32px))",
          margin: "15vh auto 0",
          border: "1px solid var(--border-emphasis)",
          background: "var(--surface-1)",
          color: "var(--text-primary)",
          boxShadow: "var(--glow-radar)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px 12px",
          }}
        >
          <h2
            id="search-palette-title"
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: 0,
              color: "var(--text-primary)",
            }}
          >
            Search flights
          </h2>
          <span
            style={{
              color: "var(--text-tertiary)",
              fontSize: 11,
              letterSpacing: "0.18em",
            }}
          >
            esc
          </span>
        </header>

        <div style={{ padding: "0 20px 14px" }}>
          <input
            ref={inputRef}
            aria-label="Flight search query"
            value={query}
            placeholder={isLoading ? "Loading flights..." : "Callsign or airport code"}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (results.length === 0) return;
                setSelectedIndex((current) => clamp(current - 1, 0, results.length - 1));
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (results.length === 0) return;
                setSelectedIndex((current) => clamp(current + 1, 0, results.length - 1));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                openFlight(selectedFlight);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closePalette();
              }
            }}
            style={{
              width: "100%",
              height: 48,
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sharp)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: 18,
              letterSpacing: 0,
              outline: "none",
              padding: "0 14px",
            }}
          />
        </div>

        <div
          style={{
            minHeight: 132,
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          {!query.trim() ? (
            <div
              style={{
                padding: "22px 20px",
                color: "var(--text-tertiary)",
                fontSize: 12,
              }}
            >
              Type a callsign or airport code · e.g. SFO, JFK, UAL2351
            </div>
          ) : results.length === 0 ? (
            <div
              style={{
                padding: "22px 20px",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
            >
              No flight matches "{query}"
            </div>
          ) : (
            <>
              {results.map((flight, index) => {
                const selected = index === selectedIndex;
                return (
                  <button
                    key={`${flight.icao24}-${flight.callsign}`}
                    type="button"
                    aria-label={`Open flight ${flight.callsign}`}
                    aria-selected={selected}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => openFlight(flight)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 80px 120px 24px",
                      alignItems: "center",
                      width: "100%",
                      minHeight: 44,
                      padding: "0 20px",
                      border: 0,
                      borderLeft: `2px solid ${
                        selected ? "var(--accent-radar)" : "transparent"
                      }`,
                      borderBottom: "1px solid var(--border-subtle)",
                      background: selected ? "var(--surface-2)" : "var(--surface-1)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      letterSpacing: 0,
                      textAlign: "left",
                    }}
                  >
                    <span style={{ color: "var(--accent-radar)", fontSize: 14 }}>
                      {flight.callsign}
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>{routeLabel(flight)}</span>
                    <span>{delayLabel(flight)}</span>
                    <span
                      style={{
                        justifySelf: "start",
                        padding: "3px 8px",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-pill)",
                        background: "var(--surface-2)",
                        color: flight.on_ground
                          ? "var(--text-tertiary)"
                          : "var(--accent-radar)",
                        fontSize: 10,
                        letterSpacing: "0.18em",
                      }}
                    >
                      {statusLabel(flight)}
                    </span>
                    <span style={{ color: "var(--accent-radar)" }}>
                      {selected ? "←" : ""}
                    </span>
                  </button>
                );
              })}
              {totalMatches > 10 && (
                <div
                  style={{
                    padding: "10px 22px",
                    color: "var(--text-tertiary)",
                    fontSize: 11,
                  }}
                >
                  +{totalMatches - 10} more · refine your query
                </div>
              )}
            </>
          )}
        </div>

        <footer
          style={{
            minHeight: 32,
            padding: "10px 20px 14px",
            borderTop: "1px solid var(--border-subtle)",
            color: "var(--text-tertiary)",
            fontSize: 11,
            letterSpacing: 0,
          }}
        >
          ↑↓ navigate&nbsp;&nbsp;&nbsp;↵ open&nbsp;&nbsp;&nbsp;esc close
        </footer>
      </section>
    </div>
  );
}
