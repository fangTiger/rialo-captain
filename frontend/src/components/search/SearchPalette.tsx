import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSearchFlights, type SearchFlightResult } from "../../hooks/useSearchFlights";

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

const SEARCH_RESULTS_LISTBOX_ID = "search-flight-results";

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

function resultOptionId(flight: SearchFlightResult): string {
  return `search-flight-result-${flight.flight_id}`;
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
  const selectedOptionId = selectedFlight ? resultOptionId(selectedFlight) : undefined;

  return (
    <div
      data-testid="search-overlay"
      className="search-palette-overlay"
      onClick={closePalette}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background:
          "radial-gradient(circle at 50% 16%, rgba(0, 255, 157, 0.1), transparent 32%), rgba(0, 0, 0, 0.62)",
        backdropFilter: "blur(10px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-palette-title"
        className="search-palette command-panel command-surface"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(640px, calc(100vw - 32px))",
          margin: "15vh auto 0",
          padding: 0,
          border: "1px solid var(--command-border-strong)",
          background: "var(--command-surface-panel)",
          color: "var(--text-primary)",
          boxShadow: "var(--glow-command)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <div
          aria-hidden="true"
          className="command-decorative-layer command-scanline"
        />
        <header
          style={{
            position: "relative",
            zIndex: 1,
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

        <div style={{ position: "relative", zIndex: 1, padding: "0 20px 14px" }}>
          <input
            ref={inputRef}
            aria-label="Flight search query"
            aria-activedescendant={selectedOptionId}
            aria-controls={SEARCH_RESULTS_LISTBOX_ID}
            aria-expanded={results.length > 0}
            autoComplete="off"
            className="command-focus-ring"
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
              border: "1px solid var(--command-border)",
              borderRadius: "var(--radius-sharp)",
              background: "var(--command-surface-inset)",
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
            position: "relative",
            zIndex: 1,
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
              <div
                id={SEARCH_RESULTS_LISTBOX_ID}
                aria-label="Flight search results"
                className="search-palette__results"
                role="listbox"
              >
                {results.map((flight, index) => {
                  const selected = index === selectedIndex;
                  return (
                    <button
                      key={`${flight.icao24}-${flight.callsign}`}
                      id={resultOptionId(flight)}
                      type="button"
                      role="option"
                      className="search-palette__result command-focus-ring"
                      aria-label={`Open flight ${flight.callsign}`}
                      aria-selected={selected}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => openFlight(flight)}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(0, 1.12fr) minmax(0, 1fr) max-content max-content 16px",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        minWidth: 0,
                        minHeight: 44,
                        padding: "10px 16px",
                        border: 0,
                        borderLeft: `2px solid ${
                          selected ? "var(--accent-radar)" : "transparent"
                        }`,
                        borderBottom: "1px solid var(--border-subtle)",
                        background: selected
                          ? "var(--command-surface-raised)"
                          : "rgba(10, 14, 18, 0.66)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        letterSpacing: 0,
                        overflowWrap: "anywhere",
                        textAlign: "left",
                        whiteSpace: "normal",
                      }}
                    >
                      <span
                        className="search-palette__callsign"
                        style={{ color: "var(--accent-radar)", fontSize: 14, minWidth: 0 }}
                      >
                        {flight.callsign}
                      </span>
                      <span
                        className="search-palette__route"
                        style={{ color: "var(--text-primary)", minWidth: 0 }}
                      >
                        {routeLabel(flight)}
                      </span>
                      <span className="search-palette__delay">{delayLabel(flight)}</span>
                      <span
                        className="search-palette__status"
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
                          whiteSpace: "nowrap",
                        }}
                      >
                        {statusLabel(flight)}
                      </span>
                      <span
                        className="search-palette__pointer"
                        style={{ color: "var(--accent-radar)" }}
                      >
                        {selected ? "←" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
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
            position: "relative",
            zIndex: 1,
            minHeight: 32,
            padding: "10px 20px 14px",
            borderTop: "1px solid var(--command-border)",
            color: "var(--text-tertiary)",
            fontSize: 11,
            letterSpacing: 0,
          }}
        >
          ↑↓ navigate&nbsp;&nbsp;&nbsp;↵ open&nbsp;&nbsp;&nbsp;esc close
        </footer>
        <style data-testid="search-palette-responsive-rules">
          {`
            .search-palette__result > span {
              min-width: 0;
              overflow-wrap: anywhere;
            }

            @media (max-width: 520px) {
              .search-palette {
                width: min(100vw - 20px, 640px) !important;
                margin-top: 10vh !important;
              }

              .search-palette__result {
                grid-template-columns: 1fr !important;
                align-items: start !important;
                gap: 6px !important;
                padding: 12px 14px !important;
              }

              .search-palette__delay,
              .search-palette__route,
              .search-palette__status {
                justify-self: start !important;
              }

              .search-palette__status {
                white-space: normal !important;
              }

              .search-palette__pointer {
                display: none;
              }
            }
          `}
        </style>
      </section>
    </div>
  );
}
