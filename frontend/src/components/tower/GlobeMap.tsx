import { useEffect, useMemo, useRef, useState } from "react";
import { geoEquirectangular, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import { apiFetch } from "../../api/client";
import { useFlights, type FlightPublic } from "../../hooks/useFlights";

interface Props {
  onSelectFlight?: (callsign: string) => void;
}

type PositionedFlight = FlightPublic & {
  longitude: number;
  latitude: number;
};

interface Viewport {
  k: number;
  x: number;
  y: number;
}

const WORLD_TOPOJSON_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const MIN_K = 0.6;
const MAX_K = 12;
const TICK_INTERVAL_MS = 500;
// Demo 时间加速 - 真实飞机 240 m/s 在全球 zoom 下每秒只动 0.007 像素, 肉眼不可见.
// 加速 10× 让飞机以"分钟"为单位被看到, 同时跳变控制在 < 1 像素 (SWR 每 15s 拉新数据).
const TIME_ACCEL = 10;

export function GlobeMap({ onSelectFlight }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [world, setWorld] = useState<FeatureCollection<Geometry> | null>(null);
  const [worldErr, setWorldErr] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 720 });
  const [hovered, setHovered] = useState<PositionedFlight | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ k: 1, x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);
  const { flights, stale, staleSeconds } = useFlights();
  const [tick, setTick] = useState(0);
  const lastFetchTickRef = useRef(0);
  // Hover 时拉的 OpenSky 历史航迹缓存. value 类型:
  // - undefined: 未加载
  // - "loading": fetch 中
  // - "failed": 后端失败
  // - [number, number][]: 路径点 (lon, lat) 数组
  type TrackResult = "loading" | "failed" | [number, number][];
  const [tracks, setTracks] = useState<Record<string, TrackResult>>({});

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

  // 动画 tick (节流 2 FPS, 用于飞机位置外推)
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + TICK_INTERVAL_MS / 1000);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // 当 SWR 拿到新数据，重置外推基准时间
  useEffect(() => {
    lastFetchTickRef.current = tick;
    // 故意只依赖 flights 引用变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flights]);

  // Hover 一个飞机 → 拉它的 OpenSky 历史航迹 (有缓存)
  useEffect(() => {
    if (!hovered) return;
    const icao24 = hovered.icao24;
    if (!icao24) return;
    if (tracks[icao24] !== undefined) return;
    setTracks((t) => ({ ...t, [icao24]: "loading" }));
    apiFetch<{
      icao24: string;
      points: { longitude: number; latitude: number }[];
    }>(`/flights/track/${icao24}`)
      .then((res) => {
        const path: [number, number][] = res.points.map((p) => [
          p.longitude,
          p.latitude,
        ]);
        setTracks((t) => ({ ...t, [icao24]: path }));
      })
      .catch(() => {
        setTracks((t) => ({ ...t, [icao24]: "failed" }));
      });
  }, [hovered, tracks]);

  const projection: GeoProjection = useMemo(() => {
    return geoEquirectangular()
      .scale(size.width / (2 * Math.PI))
      .translate([size.width / 2, size.height / 2]);
  }, [size.width, size.height]);

  const pathFn = useMemo(() => geoPath(projection), [projection]);

  // 当前 hover 飞机的历史航迹 polyline (屏幕坐标, 在 viewport transform 内)
  const hoverTrackPath = useMemo<string | null>(() => {
    if (!hovered) return null;
    const result = tracks[hovered.icao24];
    if (!Array.isArray(result) || result.length < 2) return null;
    const parts: string[] = [];
    for (const [lon, lat] of result) {
      const proj = projection([lon, lat]);
      if (!proj) continue;
      parts.push(`${proj[0]},${proj[1]}`);
    }
    return parts.length >= 2 ? parts.join(" ") : null;
  }, [hovered, tracks, projection]);

  const hoverTrackStatus = hovered ? tracks[hovered.icao24] : undefined;

  const validFlights = useMemo<PositionedFlight[]>(
    () =>
      flights.filter(
        (f): f is PositionedFlight => f.longitude !== null && f.latitude !== null,
      ),
    [flights],
  );

  // 飞机当前应处位置 (OpenSky 数据 + velocity × 已过秒数 × TIME_ACCEL 沿 heading 方向外推)
  const livePosition = (f: PositionedFlight): [number, number] => {
    const dtSec = Math.max(0, tick - lastFetchTickRef.current) * TIME_ACCEL;
    if (!f.velocity || f.heading === null || f.heading === undefined) {
      return [f.longitude, f.latitude];
    }
    const v = f.velocity; // m/s
    const headingRad = ((f.heading) * Math.PI) / 180;
    const dxM = v * Math.sin(headingRad) * dtSec;
    const dyM = v * Math.cos(headingRad) * dtSec;
    const dLat = dyM / 111_000;
    const cosLat = Math.cos((f.latitude * Math.PI) / 180);
    const dLon = dxM / (111_000 * Math.max(0.1, cosLat));
    return [f.longitude + dLon, f.latitude + dLat];
  };

  // 缩放：以鼠标位置为中心
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    setViewport((v) => {
      const newK = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
      if (newK === v.k) return v;
      const ratio = newK / v.k;
      return {
        k: newK,
        x: mx - (mx - v.x) * ratio,
        y: my - (my - v.y) * ratio,
      };
    });
  };

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      vx: viewport.x,
      vy: viewport.y,
      moved: false,
    };
  };

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setViewport((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const resetView = () => setViewport({ k: 1, x: 0, y: 0 });

  // 点击 circle 时，如果在拖拽中（已移动），不触发 onSelectFlight
  const handleFlightClick = (callsign: string) => {
    if (dragRef.current?.moved) return;
    onSelectFlight?.(callsign);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "var(--surface-0)",
        userSelect: "none",
      }}
    >
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        style={{
          display: "block",
          cursor: dragRef.current ? "grabbing" : "grab",
        }}
        role="img"
        aria-label="Global flight radar"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <defs>
          <radialGradient id="flight-dot" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,255,157,1)" />
            <stop offset="60%" stopColor="rgba(0,255,157,0.6)" />
            <stop offset="100%" stopColor="rgba(0,255,157,0)" />
          </radialGradient>
        </defs>

        <g
          transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.k})`}
        >
          <g
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={0.5 / viewport.k}
            fill="none"
          >
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
              {world.features.map(
                (feat: GeoJSON.Feature<Geometry>, i: number) => (
                  <path
                    key={i}
                    d={pathFn(feat) ?? ""}
                    fill="rgba(255,255,255,0.025)"
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth={0.5 / viewport.k}
                  />
                ),
              )}
            </g>
          )}

          {hoverTrackPath && (
            <polyline
              points={hoverTrackPath}
              fill="none"
              stroke="rgba(0,255,157,0.7)"
              strokeWidth={1.4 / viewport.k}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={`${6 / viewport.k} ${4 / viewport.k}`}
              pointerEvents="none"
            />
          )}

          <g>
            {validFlights.map((f) => {
              const [lon, lat] = livePosition(f);
              const proj = projection([lon, lat]);
              if (!proj) return null;
              const [x, y] = proj;
              const isHover = hovered?.callsign === f.callsign;
              const baseR = isHover ? 4 : 2.2;
              const r = baseR / viewport.k;

              // 航迹尾迹: 反向用 velocity × N 秒推位置, 形成可见的"过去走过的痕迹".
              // 全球 zoom 下 1 像素 = 33 km, 10 分钟 × 240 m/s = 144 km = 约 4 像素.
              const trailSeconds = isHover ? 1800 : 600;
              let tail: [number, number] | null = null;
              if (f.velocity && f.heading !== null && f.heading !== undefined) {
                const v = f.velocity;
                const headingRad = (f.heading * Math.PI) / 180;
                const dxM = -v * Math.sin(headingRad) * trailSeconds;
                const dyM = -v * Math.cos(headingRad) * trailSeconds;
                const dLat = dyM / 111_000;
                const cosLat = Math.cos((lat * Math.PI) / 180);
                const dLon = dxM / (111_000 * Math.max(0.1, cosLat));
                const projTrail = projection([lon + dLon, lat + dLat]);
                if (projTrail) tail = [projTrail[0], projTrail[1]];
              }

              return (
                <g key={f.callsign}>
                  {tail && (
                    <line
                      x1={tail[0]}
                      y1={tail[1]}
                      x2={x}
                      y2={y}
                      stroke={
                        isHover
                          ? "rgba(0,255,157,0.55)"
                          : "rgba(0,255,157,0.22)"
                      }
                      strokeWidth={(isHover ? 1.2 : 0.8) / viewport.k}
                      strokeLinecap="round"
                      pointerEvents="none"
                    />
                  )}
                  {isHover && (
                    <circle
                      cx={x}
                      cy={y}
                      r={10 / viewport.k}
                      fill="url(#flight-dot)"
                      pointerEvents="none"
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={
                      isHover
                        ? "rgba(0,255,157,1)"
                        : "rgba(0,255,157,0.7)"
                    }
                    stroke="rgba(0,255,157,0.95)"
                    strokeWidth={0.5 / viewport.k}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHovered(f)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleFlightClick(f.callsign)}
                  />
                </g>
              );
            })}
          </g>
        </g>

        {hovered &&
          (() => {
            const [lon, lat] = livePosition(hovered);
            const proj = projection([lon, lat]);
            if (!proj) return null;
            // tooltip 跟随 transform
            const screenX = proj[0] * viewport.k + viewport.x;
            const screenY = proj[1] * viewport.k + viewport.y;
            const flip = screenX > size.width - 180;
            const tx = flip ? screenX - 168 : screenX + 10;
            const ty = Math.max(8, Math.min(size.height - 56, screenY - 56));
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
                  {hoverTrackStatus === "loading"
                    ? "loading track…"
                    : hoverTrackStatus === "failed"
                    ? "track unavailable"
                    : Array.isArray(hoverTrackStatus) && hoverTrackStatus.length > 1
                    ? `${hoverTrackStatus.length} pts · click to insure`
                    : "click to insure"}
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

      <div
        style={{
          position: "absolute",
          bottom: 88,
          left: 16,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setViewport((v) => ({
              ...v,
              k: Math.min(MAX_K, v.k * 1.4),
            }))
          }
          style={zoomBtn}
        >
          +
        </button>
        <button
          type="button"
          onClick={() =>
            setViewport((v) => ({
              ...v,
              k: Math.max(MIN_K, v.k / 1.4),
            }))
          }
          style={zoomBtn}
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          style={{ ...zoomBtn, fontSize: 9 }}
          aria-label="reset view"
          title="reset view"
        >
          ⌂
        </button>
        <div
          style={{
            marginTop: 6,
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
          }}
        >
          {viewport.k.toFixed(1)}×
        </div>
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

const zoomBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  background: "var(--surface-1)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  borderRadius: "var(--radius-sharp)",
  fontFamily: "var(--font-mono)",
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};
