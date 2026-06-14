import { useEffect, useMemo, useRef, useState } from "react";
import { geoEquirectangular, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import { useFlights, type FlightPublic } from "../../hooks/useFlights";

interface Props {
  onSelectFlight?: (callsign: string) => void;
}

type PositionedFlight = FlightPublic & {
  longitude: number;
  latitude: number;
};

const WORLD_TOPOJSON_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function GlobeMap({ onSelectFlight }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [world, setWorld] = useState<FeatureCollection<Geometry> | null>(null);
  const [worldErr, setWorldErr] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 720 });
  const [hovered, setHovered] = useState<PositionedFlight | null>(null);
  const { flights, stale, staleSeconds } = useFlights();

  useEffect(() => {
    let cancelled = false;
    fetch(WORLD_TOPOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`world-atlas ${r.status}`);
        return r.json();
      })
      .then((topo: { objects: { countries: unknown } }) => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const collection = feature(topo as any, (topo as any).objects.countries) as unknown as FeatureCollection<Geometry>;
        setWorld(collection);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setWorldErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ width: Math.max(800, r.width), height: Math.max(400, r.height) });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth || 1200, height: el.clientHeight || 720 });
    return () => ro.disconnect();
  }, []);

  const projection: GeoProjection = useMemo(() => {
    return geoEquirectangular()
      .scale(size.width / (2 * Math.PI))
      .translate([size.width / 2, size.height / 2]);
  }, [size.width, size.height]);

  const pathFn = useMemo(() => geoPath(projection), [projection]);

  const validFlights = useMemo<PositionedFlight[]>(
    () =>
      flights.filter(
        (f): f is PositionedFlight => f.longitude !== null && f.latitude !== null,
      ),
    [flights],
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "var(--surface-0)",
      }}
    >
      <svg
        width={size.width}
        height={size.height}
        style={{ display: "block" }}
        role="img"
        aria-label="Global flight radar"
      >
        <defs>
          <radialGradient id="flight-dot" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,255,157,1)" />
            <stop offset="60%" stopColor="rgba(0,255,157,0.6)" />
            <stop offset="100%" stopColor="rgba(0,255,157,0)" />
          </radialGradient>
        </defs>

        <g stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} fill="none">
          {Array.from({ length: 7 }).map((_, i) => {
            const lat = -60 + i * 20;
            const proj = projection([0, lat]);
            if (!proj) return null;
            return (
              <line
                key={`h${i}`}
                x1={0}
                x2={size.width}
                y1={proj[1]}
                y2={proj[1]}
              />
            );
          })}
          {Array.from({ length: 13 }).map((_, i) => {
            const lon = -180 + i * 30;
            const proj = projection([lon, 0]);
            if (!proj) return null;
            return (
              <line
                key={`v${i}`}
                x1={proj[0]}
                x2={proj[0]}
                y1={0}
                y2={size.height}
              />
            );
          })}
        </g>

        {world && (
          <g>
            {world.features.map((feat: GeoJSON.Feature<Geometry>, i: number) => (
              <path
                key={i}
                d={pathFn(feat) ?? ""}
                fill="rgba(255,255,255,0.025)"
                stroke="rgba(255,255,255,0.10)"
                strokeWidth={0.5}
              />
            ))}
          </g>
        )}

        <g>
          {validFlights.map((f) => {
            const proj = projection([f.longitude, f.latitude]);
            if (!proj) return null;
            const [x, y] = proj;
            const isHover = hovered?.callsign === f.callsign;
            return (
              <g key={f.callsign}>
                {isHover && (
                  <circle
                    cx={x}
                    cy={y}
                    r={10}
                    fill="url(#flight-dot)"
                    pointerEvents="none"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isHover ? 4 : 2.2}
                  fill={isHover ? "rgba(0,255,157,1)" : "rgba(0,255,157,0.65)"}
                  stroke="rgba(0,255,157,0.9)"
                  strokeWidth={0.5}
                  style={{ cursor: "pointer", transition: "r 120ms ease-out" }}
                  onMouseEnter={() => setHovered(f)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelectFlight?.(f.callsign)}
                />
              </g>
            );
          })}
        </g>

        {hovered &&
          (() => {
            const proj = projection([hovered.longitude, hovered.latitude]);
            if (!proj) return null;
            const [x, y] = proj;
            const flip = x > size.width - 180;
            const tx = flip ? x - 168 : x + 10;
            const ty = Math.max(8, y - 56);
            return (
              <g transform={`translate(${tx},${ty})`} pointerEvents="none">
                <rect
                  width={158}
                  height={48}
                  rx={2}
                  fill="rgba(11,14,18,0.96)"
                  stroke="rgba(0,255,157,0.5)"
                  strokeWidth={1}
                />
                <text
                  x={10}
                  y={18}
                  fill="rgb(0,255,157)"
                  fontFamily="JetBrains Mono, ui-monospace, monospace"
                  fontSize={12}
                  letterSpacing="0.05em"
                >
                  {hovered.callsign}
                </text>
                <text
                  x={10}
                  y={32}
                  fill="rgba(232,227,213,0.6)"
                  fontFamily="JetBrains Mono, ui-monospace, monospace"
                  fontSize={10}
                >
                  {hovered.origin_country || "—"}
                </text>
                <text
                  x={10}
                  y={42}
                  fill="rgba(232,227,213,0.45)"
                  fontFamily="JetBrains Mono, ui-monospace, monospace"
                  fontSize={9}
                >
                  click to insure
                </text>
              </g>
            );
          })()}
      </svg>

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 88,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.18em",
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          pointerEvents: "none",
        }}
      >
        TRACKING{" "}
        <span style={{ color: "var(--accent-radar)" }}>{validFlights.length}</span>{" "}
        AIRCRAFT
        {stale && (
          <span style={{ marginLeft: 12, color: "var(--warn-amber)" }}>
            · STALE {staleSeconds}s
          </span>
        )}
      </div>

      {worldErr && (
        <div
          style={{
            position: "absolute",
            bottom: 48,
            right: 16,
            padding: "6px 10px",
            background: "rgba(255,180,0,0.18)",
            border: "1px solid var(--warn-amber)",
            color: "var(--warn-amber)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          world atlas failed: {worldErr}
        </div>
      )}
    </div>
  );
}
