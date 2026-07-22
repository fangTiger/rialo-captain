import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoEquirectangular, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import { apiFetch } from "../../api/client";
import { useFlights, type FlightPublic } from "../../hooks/useFlights";
import type { CameraTarget } from "../cinema/CinemaContext";
import {
  cameraTargetToViewport,
  type ViewportSize,
} from "../cinema/cameraMath";
import {
  estimateLivePosition,
  FLIGHT_TIME_ACCEL,
  matchesFlightIdentity,
} from "../cinema/flightMotion";
import type {
  TowerRiskSignal,
  WeatherCell,
  WeatherForecastBand,
} from "./riskSignals";
import { usePoolStore } from "../../store/pool";
import "./GlobeMap.css";

interface Props {
  cameraTarget?: CameraTarget | null;
  onUserGesture?: () => void;
  onSelectFlight?: (callsign: string) => void;
  onViewportChange?: (viewport: Viewport, size: ViewportSize) => void;
  protagonistHighlight?: ProtagonistHighlight | null;
  weatherLayerVisible?: boolean;
  riskSignal?: TowerRiskSignal | null;
}

type PositionedFlight = FlightPublic & {
  longitude: number;
  latitude: number;
};

export interface ProtagonistHighlight {
  flightId: string;
  callsign: string;
}

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
const CAMERA_COMMIT_INTERVAL_MS = 50;
const DEFAULT_MAP_SIZE = { width: 1200, height: 720 };
const MIN_MAP_HEIGHT = 400;
const protagonistRingStyle: CSSProperties = {
  animationName: "protagonist-spotlight-ring-breathe",
};
const protagonistPulseStyle: CSSProperties = {
  animationName: "protagonist-spotlight-pulse-expand",
};
const UNDERWRITER_FLARE_TTL_MS = 1_400;

interface UnderwriterFlare {
  callsign: string;
  token: string;
}

export function GlobeMap({
  cameraTarget = null,
  onUserGesture,
  onSelectFlight,
  onViewportChange,
  protagonistHighlight = null,
  weatherLayerVisible = false,
  riskSignal = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [world, setWorld] = useState<FeatureCollection<Geometry> | null>(null);
  const [worldErr, setWorldErr] = useState<string | null>(null);
  const [size, setSize] = useState(DEFAULT_MAP_SIZE);
  const [hovered, setHovered] = useState<PositionedFlight | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ k: 1, x: 0, y: 0 });
  const viewportRef = useRef<Viewport>(viewport);
  const cameraRafRef = useRef<number | null>(null);
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
  // 客户端真实历史 buffer: 每次 SWR 拉新数据时, 给每个 icao24 push 当前位置.
  // 开 demo 时每架飞机 1-2 个点, 累积 N 分钟后每架 N×4 个点.
  // 用 ref 避免无谓 re-render (hover state 变化时 render 自动读最新).
  const historyRef = useRef<Map<string, [number, number][]>>(new Map());
  const MAX_HISTORY = 240; // 最多保留 240 点 ≈ 1 小时 @ 15s
  // Hover 拉 OpenSky 后端 track (备用, 未来如果 OpenSky 重开 tracks endpoint)
  type TrackResult = "loading" | "failed" | [number, number][];
  const [tracks, setTracks] = useState<Record<string, TrackResult>>({});
  const activePoolId = usePoolStore((state) => state.activePool?.id ?? null);
  const underwrittenFlightIds = usePoolStore(
    (state) => state.underwrittenFlightIds,
  );
  const poolTicker = usePoolStore((state) => state.ticker);
  const seenPoolTickerRef = useRef<Set<string>>(new Set());
  const [underwriterFlares, setUnderwriterFlares] = useState<
    Record<string, UnderwriterFlare>
  >({});

  useEffect(() => {
    viewportRef.current = viewport;
    onViewportChange?.(viewport, size);
  }, [size, viewport, onViewportChange]);

  const cancelCameraAnimation = useCallback(() => {
    if (cameraRafRef.current !== null) {
      window.cancelAnimationFrame(cameraRafRef.current);
      cameraRafRef.current = null;
    }
  }, []);

  const notifyUserGesture = useCallback(() => {
    cancelCameraAnimation();
    onUserGesture?.();
  }, [cancelCameraAnimation, onUserGesture]);

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
      setSize({
        width: positiveDimension(r.width, el.clientWidth || DEFAULT_MAP_SIZE.width),
        height: Math.max(
          MIN_MAP_HEIGHT,
          positiveDimension(r.height, el.clientHeight || DEFAULT_MAP_SIZE.height),
        ),
      });
    });
    ro.observe(el);
    setSize({
      width: positiveDimension(el.clientWidth, DEFAULT_MAP_SIZE.width),
      height: Math.max(
        MIN_MAP_HEIGHT,
        positiveDimension(el.clientHeight, DEFAULT_MAP_SIZE.height),
      ),
    });
    return () => ro.disconnect();
  }, []);

  // 动画 tick (节流 2 FPS, 用于飞机位置外推)
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + TICK_INTERVAL_MS / 1000);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    for (const event of poolTicker) {
      if (event.type !== "paid" || seenPoolTickerRef.current.has(event.id)) {
        continue;
      }
      seenPoolTickerRef.current.add(event.id);
      const callsign =
        typeof event.payload.callsign === "string" && event.payload.callsign
          ? event.payload.callsign
          : event.label.replace(/^Paid out\s+/i, "");
      if (!callsign) continue;

      const token = `${event.id}-${Date.now()}`;
      setUnderwriterFlares((current) => ({
        ...current,
        [callsign]: { callsign, token },
      }));
      timers.push(
        window.setTimeout(() => {
          setUnderwriterFlares((current) => {
            if (current[callsign]?.token !== token) return current;
            const next = { ...current };
            delete next[callsign];
            return next;
          });
        }, UNDERWRITER_FLARE_TTL_MS),
      );
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [poolTicker]);

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

  // 当前 hover 飞机的历史航迹 polyline.
  // 优先用后端 track (OpenSky), 失败/未加载时 fallback 用客户端 history.
  const hoverTrackInfo = useMemo<{ path: string; source: "opensky" | "client"; pointCount: number } | null>(() => {
    void tick;
    if (!hovered) return null;
    const backendResult = tracks[hovered.icao24];
    const useBackend = Array.isArray(backendResult) && backendResult.length >= 2;
    const points: [number, number][] = useBackend
      ? (backendResult as [number, number][])
      : historyRef.current.get(hovered.icao24) ?? [];
    if (points.length < 2) return null;
    const parts: string[] = [];
    for (const [lon, lat] of points) {
      const proj = projection([lon, lat]);
      if (!proj) continue;
      parts.push(`${proj[0]},${proj[1]}`);
    }
    if (parts.length < 2) return null;
    return {
      path: parts.join(" "),
      source: useBackend ? "opensky" : "client",
      pointCount: points.length,
    };
  }, [hovered, tracks, projection, tick]);

  const hoverTrackStatus = hovered ? tracks[hovered.icao24] : undefined;

  const validFlights = useMemo<PositionedFlight[]>(
    () =>
      flights.filter(
        (f): f is PositionedFlight => f.longitude !== null && f.latitude !== null,
      ),
    [flights],
  );

  useEffect(() => {
    cancelCameraAnimation();
    if (!cameraTarget) return;

    const targetViewport = cameraTargetToViewport(cameraTarget, size);
    const durationMs = Math.max(0, cameraTarget.durationMs);
    const commitViewport = (nextViewport: Viewport) => {
      setViewport((current) =>
        current.k === nextViewport.k &&
        current.x === nextViewport.x &&
        current.y === nextViewport.y
          ? current
          : nextViewport,
      );
    };
    if (durationMs === 0) {
      commitViewport(targetViewport);
      return;
    }

    const from = viewportRef.current;
    let startedAt: number | null = null;
    let lastCommittedElapsedMs = Number.NEGATIVE_INFINITY;

    const step = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const elapsed = Math.max(0, timestamp - startedAt);
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeInOutCubic(t);
      const nextViewport =
        t === 1
          ? targetViewport
          : interpolateViewport(from, targetViewport, eased);
      if (
        t === 1 ||
        elapsed - lastCommittedElapsedMs >= CAMERA_COMMIT_INTERVAL_MS
      ) {
        lastCommittedElapsedMs = elapsed;
        commitViewport(nextViewport);
      }

      if (t < 1) {
        cameraRafRef.current = window.requestAnimationFrame(step);
      } else {
        cameraRafRef.current = null;
      }
    };

    cameraRafRef.current = window.requestAnimationFrame(step);
    return cancelCameraAnimation;
  }, [
    cameraTarget,
    cancelCameraAnimation,
    size,
  ]);

  // 每次拿到新 flights 数据, 给每个 icao24 累积历史点
  useEffect(() => {
    if (validFlights.length === 0) return;
    for (const f of validFlights) {
      const list = historyRef.current.get(f.icao24) || [];
      const last = list[list.length - 1];
      if (!last || last[0] !== f.longitude || last[1] !== f.latitude) {
        list.push([f.longitude, f.latitude]);
        if (list.length > MAX_HISTORY) list.shift();
        historyRef.current.set(f.icao24, list);
      }
    }
  }, [validFlights]);

  // 飞机当前应处位置 (OpenSky 数据 + velocity × 已过秒数 × TIME_ACCEL 沿 heading 方向外推)
  const livePosition = (f: PositionedFlight): [number, number] => {
    const position = estimateLivePosition(
      f,
      Math.max(0, tick - lastFetchTickRef.current),
      FLIGHT_TIME_ACCEL,
    );
    return position
      ? [position.longitude, position.latitude]
      : [f.longitude, f.latitude];
  };

  // 缩放：以鼠标位置为中心
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    notifyUserGesture();
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
    if (Math.abs(dx) + Math.abs(dy) > 3 && !d.moved) {
      d.moved = true;
      notifyUserGesture();
    }
    setViewport((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const resetView = () => {
    notifyUserGesture();
    setViewport({ k: 1, x: 0, y: 0 });
  };

  // 点击 circle 时，如果在拖拽中（已移动），不触发 onSelectFlight
  const handleFlightClick = (callsign: string) => {
    if (dragRef.current?.moved) return;
    notifyUserGesture();
    onSelectFlight?.(callsign);
  };

  return (
    <div
      ref={containerRef}
      data-testid="globe-map-frame"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "var(--surface-0)",
        border: "1px solid rgba(0, 255, 157, 0.28)",
        outline: "1px solid rgba(255, 255, 255, 0.08)",
        outlineOffset: "-2px",
        boxSizing: "border-box",
        boxShadow:
          "inset 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 0 28px rgba(0, 255, 157, 0.08)",
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
          data-testid="globe-viewport"
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

          {weatherLayerVisible && riskSignal && (
            <WeatherRiskLayer
              projection={projection}
              riskSignal={riskSignal}
              size={size}
              viewport={viewport}
            />
          )}

          {hoverTrackInfo && (
            <polyline
              points={hoverTrackInfo.path}
              fill="none"
              stroke={
                hoverTrackInfo.source === "opensky"
                  ? "rgba(0,255,157,0.7)"
                  : "rgba(0,255,157,0.55)"
              }
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
              const isProtagonist = matchesProtagonistHighlight(
                f,
                protagonistHighlight,
              );
              const isMine =
                Boolean(f.underwritten_by_pool_id) ||
                (activePoolId !== null && f.underwritten_by_pool_id === activePoolId) ||
                underwrittenFlightIds.has(f.callsign);
              const underwriterFlare = underwriterFlares[f.callsign];
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
                  {isProtagonist && (
                    <g
                      data-testid={`protagonist-ring-${f.callsign}`}
                      pointerEvents="none"
                      style={{ pointerEvents: "none" }}
                    >
                      <circle
                        className="protagonist-spotlight-ring protagonist-spotlight-ring-animated"
                        cx={x}
                        cy={y}
                        r={12 / viewport.k}
                        fill="none"
                        stroke="rgba(255, 68, 128, 0.95)"
                        strokeWidth={1.4 / viewport.k}
                        opacity={0.9}
                        pointerEvents="none"
                        style={protagonistRingStyle}
                      />
                      <circle
                        className="protagonist-spotlight-pulse protagonist-spotlight-pulse-animated"
                        cx={x}
                        cy={y}
                        r={18 / viewport.k}
                        fill="rgba(255, 68, 128, 0.08)"
                        stroke="rgba(255, 68, 128, 0.35)"
                        strokeWidth={0.8 / viewport.k}
                        pointerEvents="none"
                        style={protagonistPulseStyle}
                      />
                    </g>
                  )}
                  {underwriterFlare && (
                    <circle
                      className="underwriter-flare"
                      data-testid={`underwriter-flare-${f.callsign}`}
                      cx={x}
                      cy={y}
                      r={16 / viewport.k}
                      pointerEvents="none"
                    />
                  )}
                  <circle
                    className={isMine ? "flight-dot flight-dot--mine" : "flight-dot"}
                    data-testid={`flight-dot-${f.callsign}`}
                    data-underwritten={isMine ? "true" : undefined}
                    data-protagonist={isProtagonist ? "true" : undefined}
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
                  {hoverTrackInfo
                    ? `${hoverTrackInfo.pointCount} pts ${
                        hoverTrackInfo.source === "opensky" ? "opensky" : "client log"
                      } · click to insure`
                    : hoverTrackStatus === "loading"
                    ? "loading track…"
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
          onClick={() => {
            notifyUserGesture();
            setViewport((v) => ({
              ...v,
              k: Math.min(MAX_K, v.k * 1.4),
            }));
          }}
          style={zoomBtn}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            notifyUserGesture();
            setViewport((v) => ({
              ...v,
              k: Math.max(MIN_K, v.k / 1.4),
            }));
          }}
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

function WeatherRiskLayer({
  projection,
  riskSignal,
  size,
  viewport,
}: {
  projection: GeoProjection;
  riskSignal: TowerRiskSignal;
  size: ViewportSize;
  viewport: Viewport;
}) {
  const corridorEndpointPoints = riskSignal.corridor
    ? [projection(riskSignal.corridor.from), projection(riskSignal.corridor.to)]
    : null;
  const corridorSegments =
    riskSignal.corridor?.segments
      .map((segment) => {
        const from = projection(segment.from);
        const to = projection(segment.to);
        if (!from || !to) return null;
        return {
          ...segment,
          path: `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`,
          fromPoint: from,
          toPoint: to,
          midpoint: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2] as [
            number,
            number,
          ],
        };
      })
      .filter((segment): segment is NonNullable<typeof segment> => segment !== null) ??
    [];
  const interceptSegment =
    corridorSegments
      .slice()
      .sort(
        (left, right) =>
          weatherLevelRank(right.level) - weatherLevelRank(left.level),
      )[0] ?? null;

  return (
    <g
      className="weather-risk-layer"
      data-testid="weather-risk-layer"
      pointerEvents="none"
      style={{ pointerEvents: "none" }}
    >
      {riskSignal.weatherBands.map((band) => (
        <WeatherForecastBandShape
          key={band.id}
          band={band}
          projection={projection}
          widthScale={size.width / 360}
          viewport={viewport}
        />
      ))}
      {riskSignal.weatherCells.map((cell) => (
        <WeatherCellShape
          key={cell.id}
          cell={cell}
          projection={projection}
          radiusScale={size.width / 360}
          viewport={viewport}
        />
      ))}
      {riskSignal.corridor && corridorSegments.length > 0 && (
        <g
          className={`weather-risk-corridor-group weather-risk-corridor-${riskSignal.corridor?.pressureLevel ?? "low"}`}
          data-testid="weather-risk-corridor"
          pointerEvents="none"
        >
          <g
            className="weather-active-corridor"
            data-testid="weather-active-corridor"
            pointerEvents="none"
          >
            {corridorSegments.map((segment) => (
              <g
                key={segment.id}
                className={`weather-risk-corridor-segment weather-risk-corridor-segment-${segment.level}`}
                pointerEvents="none"
              >
                <path
                  className="weather-risk-corridor weather-risk-corridor-segment-halo"
                  d={segment.path}
                  fill="none"
                  strokeWidth={12 / viewport.k}
                  pointerEvents="none"
                />
                <path
                  className="weather-risk-corridor weather-risk-corridor-segment-core"
                  data-testid={`weather-risk-corridor-segment-${segment.level}`}
                  d={segment.path}
                  fill="none"
                  strokeWidth={3.4 / viewport.k}
                  strokeDasharray={`${10 / viewport.k} ${7 / viewport.k}`}
                  pointerEvents="none"
                />
              </g>
            ))}
            {corridorEndpointPoints?.map((point, index) =>
              point ? (
                <circle
                  key={index}
                  className="weather-risk-pressure-ring"
                  cx={point[0]}
                  cy={point[1]}
                  r={14 / viewport.k}
                  fill="none"
                  strokeWidth={1.1 / viewport.k}
                  pointerEvents="none"
                />
              ) : null,
            )}
            {interceptSegment ? (
              <>
                <g
                  className={`weather-corridor-intercept-marker weather-corridor-intercept-marker-${interceptSegment.level}`}
                  data-testid="weather-corridor-intercept-marker"
                  transform={`translate(${interceptSegment.midpoint[0]},${interceptSegment.midpoint[1]})`}
                  pointerEvents="none"
                >
                  <circle
                    r={7 / viewport.k}
                    fill="none"
                    strokeWidth={1.4 / viewport.k}
                    pointerEvents="none"
                  />
                  <path
                    d={`M ${-10 / viewport.k} 0 L ${10 / viewport.k} 0 M 0 ${-10 / viewport.k} L 0 ${10 / viewport.k}`}
                    fill="none"
                    strokeWidth={0.9 / viewport.k}
                    pointerEvents="none"
                  />
                </g>
                <g
                  className="weather-pressure-label"
                  data-testid="weather-pressure-label"
                  transform={`translate(${interceptSegment.midpoint[0] + 12 / viewport.k},${interceptSegment.midpoint[1] - 20 / viewport.k})`}
                  pointerEvents="none"
                >
                  <rect
                    width={132 / viewport.k}
                    height={30 / viewport.k}
                    rx={3 / viewport.k}
                    pointerEvents="none"
                  />
                  <text
                    fontSize={10 / viewport.k}
                    lengthAdjust="spacingAndGlyphs"
                    textLength={118 / viewport.k}
                    x={7 / viewport.k}
                    y={12 / viewport.k}
                    pointerEvents="none"
                  >
                    {riskSignal.corridor.callsign}{" "}
                    {interceptSegment.level.toUpperCase()}
                  </text>
                  <text
                    fontSize={9 / viewport.k}
                    lengthAdjust="spacingAndGlyphs"
                    textLength={118 / viewport.k}
                    x={7 / viewport.k}
                    y={24 / viewport.k}
                    pointerEvents="none"
                  >
                    +{riskSignal.corridor.riskDeltaPct.toFixed(1)}pp pressure
                  </text>
                </g>
              </>
            ) : null}
          </g>
        </g>
      )}
    </g>
  );
}

function WeatherForecastBandShape({
  band,
  projection,
  widthScale,
  viewport,
}: {
  band: WeatherForecastBand;
  projection: GeoProjection;
  widthScale: number;
  viewport: Viewport;
}) {
  const points = band.points
    .map((point) => projection(point))
    .filter((point): point is [number, number] => point !== null);
  if (points.length < 2) return null;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point[0]} ${point[1]}`)
    .join(" ");
  const width = Math.max(12, band.widthDeg * widthScale);
  return (
    <g
      className={`weather-forecast-band weather-forecast-band-${band.level} weather-forecast-band-${band.kind} weather-forecast-band-drift-${band.drift}`}
      data-testid={
        band.level === "severe"
          ? "weather-forecast-band-severe"
          : "weather-forecast-band"
      }
      pointerEvents="none"
      style={{ pointerEvents: "none" }}
    >
      <path
        className="weather-forecast-band-halo"
        d={path}
        fill="none"
        strokeWidth={(width * 1.7) / viewport.k}
        pointerEvents="none"
      />
      <path
        className="weather-forecast-band-core"
        d={path}
        fill="none"
        strokeWidth={width / viewport.k}
        pointerEvents="none"
      />
      <path
        className="weather-forecast-band-radar-line"
        d={path}
        fill="none"
        strokeWidth={1.2 / viewport.k}
        strokeDasharray={`${12 / viewport.k} ${8 / viewport.k}`}
        pointerEvents="none"
      />
    </g>
  );
}

function WeatherCellShape({
  cell,
  projection,
  radiusScale,
  viewport,
}: {
  cell: WeatherCell;
  projection: GeoProjection;
  radiusScale: number;
  viewport: Viewport;
}) {
  const projected = projection([cell.longitude, cell.latitude]);
  if (!projected) return null;
  const viewportScale = Math.max(0.001, viewport.k);
  const radius = Math.max(10, cell.radiusDeg * radiusScale) / viewportScale;
  const squash = cell.drift === "ne" || cell.drift === "sw" ? 0.64 : 0.78;
  return (
    <g
      className={`weather-risk-cell weather-risk-cell-${cell.level} weather-risk-cell-drift-${cell.drift}`}
      data-testid={`weather-cell-${cell.level}`}
      transform={`translate(${projected[0]},${projected[1]}) rotate(${
        cell.drift === "ne" || cell.drift === "sw" ? -18 : 18
      })`}
      pointerEvents="none"
    >
      <ellipse
        className="weather-storm-mass"
        data-testid={`weather-storm-mass-${cell.level}`}
        rx={radius * 1.32}
        ry={radius * squash * 1.2}
        pointerEvents="none"
      />
      <ellipse
        className="weather-risk-cell-field"
        rx={radius}
        ry={radius * squash}
        pointerEvents="none"
      />
      <ellipse
        className="weather-risk-cell-core"
        rx={radius * 0.46}
        ry={radius * squash * 0.42}
        pointerEvents="none"
      />
      <ellipse
        className="weather-risk-cell-lobe weather-risk-cell-lobe-a"
        cx={radius * 0.22}
        cy={-radius * squash * 0.12}
        rx={radius * 0.34}
        ry={radius * squash * 0.32}
        pointerEvents="none"
      />
      <ellipse
        className="weather-risk-cell-lobe weather-risk-cell-lobe-b"
        cx={-radius * 0.28}
        cy={radius * squash * 0.18}
        rx={radius * 0.28}
        ry={radius * squash * 0.26}
        pointerEvents="none"
      />
      <ellipse
        className="weather-risk-cell-radar-line"
        rx={Math.max(6 / viewport.k, radius * 0.74)}
        ry={Math.max(4 / viewport.k, radius * squash * 0.7)}
        fill="none"
        strokeWidth={1 / viewport.k}
        pointerEvents="none"
      />
      {cell.level === "severe" ? (
        <circle
          className="weather-severe-cell-pulse"
          data-testid="weather-severe-cell-pulse"
          r={Math.max(8 / viewport.k, radius * 0.86)}
          fill="none"
          strokeWidth={1.2 / viewport.k}
          pointerEvents="none"
        />
      ) : null}
    </g>
  );
}

function weatherLevelRank(level: WeatherCell["level"]) {
  if (level === "severe") return 3;
  if (level === "elevated") return 2;
  return 1;
}

function positiveDimension(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function interpolateViewport(from: Viewport, to: Viewport, t: number): Viewport {
  return {
    k: from.k + (to.k - from.k) * t,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function matchesProtagonistHighlight(
  flight: FlightPublic,
  protagonist: ProtagonistHighlight | null,
) {
  if (!protagonist) return false;
  return (
    matchesFlightIdentity(flight.callsign, protagonist.callsign) ||
    matchesFlightIdentity(flight.callsign, protagonist.flightId)
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
