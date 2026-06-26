import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AutoSeeder } from "../components/cinema/AutoSeeder";
import { CameraDirector } from "../components/cinema/CameraDirector";
import { CinemaController } from "../components/cinema/CinemaController";
import { CinemaOverlay } from "../components/cinema/CinemaOverlay";
import {
  CinemaProvider,
  type CinemaProtagonist,
  useCinema,
} from "../components/cinema/CinemaContext";
import {
  EventChoreographer,
  normalizeCreatedAtMs,
} from "../components/cinema/EventChoreographer";
import { ModeIndicator } from "../components/cinema/ModeIndicator";
import { ProtagonistBadge } from "../components/cinema/ProtagonistBadge";
import { ChainBeam } from "../components/cinema/ChainBeam";
import { FlareLand } from "../components/cinema/FlareLand";
import { HeatmapBg } from "../components/cinema/HeatmapBg";
import { ShockWave } from "../components/cinema/ShockWave";
import { TrailDraw } from "../components/cinema/TrailDraw";
import { chooseDemoProtagonist } from "../components/cinema/protagonist";
import {
  buildTrailPoints,
  projectTrailPoints,
} from "../components/cinema/trailGeometry";
import { useAmbientHeatmap } from "../components/cinema/useAmbientHeatmap";
import { useKeyMomentQueue } from "../components/cinema/useKeyMomentQueue";
import {
  TRAIL_DRAW_START_MS,
  TRAIL_DRAW_TTL_MS,
  useTrailDraw,
  type ActiveTrailDraw,
} from "../components/cinema/useTrailDraw";
import {
  GlobeMap,
  type ProtagonistHighlight,
} from "../components/tower/GlobeMap";
import { RadarSweep } from "../components/tower/RadarSweep";
import { EventFeedSidebar } from "../components/tower/EventFeedSidebar";
import { KPIBand } from "../components/tower/KPIBand";
import { DataStaleBadge } from "../components/tower/DataStaleBadge";
import { AIBriefing } from "../components/copilot/AIBriefing";
import {
  BuyDrawer,
  type PurchasedPolicy,
} from "../components/drawer/BuyDrawer";
import { useFlights, type FlightPublic } from "../hooks/useFlights";
import { useEventStore, type FlareEvent } from "../store/eventStore";
import {
  hangarAnchorForSize,
  projectMomentPoint,
  type ScreenPoint,
} from "../components/cinema/keyMomentGeometry";
import type { MapViewport, ViewportSize } from "../components/cinema/cameraMath";
import type { ActiveKeyMoment } from "../components/cinema/keyMomentTimeline";
import type { CoordinateLocator, MomentLocator } from "../components/cinema/keyMoments";

export function TowerShell() {
  const { flights } = useFlights();
  const [drawerFlightId, setDrawerFlightId] = useState<string | null>(null);
  const [electedCallsign, setElectedCallsign] = useState<string | null>(null);
  const [electedTrailToken, setElectedTrailToken] = useState(0);
  const [purchasedPolicy, setPurchasedPolicy] = useState<PurchasedPolicy | null>(
    null,
  );
  const purchaseCompletedRef = useRef(false);
  const demoSelectionOffsetRef = useRef<number | null>(null);
  if (demoSelectionOffsetRef.current === null) {
    demoSelectionOffsetRef.current = Math.floor(Math.random() * 1_000_000_000);
  }
  const demoSelectionOffset = demoSelectionOffsetRef.current;
  const protagonist = useMemo(
    () => chooseDemoProtagonist(flights, demoSelectionOffset),
    [demoSelectionOffset, flights],
  );
  const electedFlight = useMemo(() => {
    if (!electedCallsign) return null;
    const callsign = electedCallsign.trim().toUpperCase();
    if (!callsign) return null;
    return (
      flights.find((flight) => flight.callsign.trim().toUpperCase() === callsign) ??
      null
    );
  }, [electedCallsign, flights]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        top: "var(--top-nav-height, 64px)",
        bottom: 32,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          right: 20,
          zIndex: 18,
          pointerEvents: "none",
          display: "flex",
        }}
      >
        <div style={{ pointerEvents: "auto", maxWidth: "min(100%, 28rem)" }}>
          <AIBriefing />
        </div>
      </div>
      <CinemaProvider
        initialProtagonist={protagonist}
      >
        <CinemaController />
        <AutoSeeder
          demoLocked={Boolean(electedCallsign)}
          demoSelectionOffset={demoSelectionOffset}
          flights={flights}
        />
        <TowerCinemaLayers
          electedFlight={electedFlight}
          manualFocusLocked={Boolean(electedCallsign)}
          flights={flights}
          onSelectFlight={(callsign) => {
            const normalized = callsign.trim();
            if (!normalized) return;
            const date = new Date()
              .toISOString()
              .slice(0, 10)
              .replaceAll("-", "");
            setElectedCallsign(normalized);
            setPurchasedPolicy(null);
            setElectedTrailToken((token) => token + 1);
            setDrawerFlightId(`${normalized}-${date}`);
          }}
          electedTrailToken={electedTrailToken}
          purchasedPolicy={purchasedPolicy}
        />
      </CinemaProvider>
      {drawerFlightId && (
        <BuyDrawer
          flightId={drawerFlightId}
          onPurchased={(policy) => {
            purchaseCompletedRef.current = true;
            setPurchasedPolicy(policy);
          }}
          onClose={() => {
            if (purchaseCompletedRef.current) {
              purchaseCompletedRef.current = false;
              setDrawerFlightId(null);
              return;
            }
            setDrawerFlightId(null);
            setElectedCallsign(null);
            setPurchasedPolicy(null);
          }}
        />
      )}
    </div>
  );
}

interface TowerCinemaLayersProps {
  electedFlight: FlightPublic | null;
  manualFocusLocked: boolean;
  flights: FlightPublic[];
  onSelectFlight: (callsign: string) => void;
  electedTrailToken: number;
  purchasedPolicy: PurchasedPolicy | null;
}

const DEFAULT_OVERLAY_SIZE: ViewportSize = { width: 1200, height: 720 };
const PURCHASE_SHOCKWAVE_AT_MS = 6_000;
const PURCHASE_CHAIN_AT_MS = 8_000;
const PURCHASE_LANDED_AT_MS = 10_000;
const PURCHASE_DELAY_MINUTES = 45;
const PURCHASE_SETTLE_DURATION_MS = 1_400;
const PURCHASE_PLAYBACK_LOCK_MS = 12_000;

function fallbackSignature(policyId: string) {
  const material = Array.from(policyId)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  return `0x${material.padEnd(64, "0").slice(0, 64)}`;
}

function fallbackTxHash(policyId: string) {
  const material = Array.from(`tx:${policyId}`)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  return `0x${material.padEnd(40, "0").slice(0, 40)}`;
}

function hasPolicyEvent(type: string, policyId: string) {
  return useEventStore
    .getState()
    .events.some(
      (event) => event.type === type && event.payload.policy_id === policyId,
    );
}

function TowerCinemaLayers({
  electedFlight,
  electedTrailToken,
  flights,
  manualFocusLocked,
  onSelectFlight,
  purchasedPolicy,
}: TowerCinemaLayersProps) {
  const cinema = useCinema();
  const setCyclePromotionLocked = cinema.setCyclePromotionLocked;
  const [mapViewport, setMapViewport] = useState<MapViewport>({ k: 1, x: 0, y: 0 });
  const [mapSize, setMapSize] = useState<ViewportSize>(DEFAULT_OVERLAY_SIZE);
  const ambientHeatmap = useAmbientHeatmap();
  const keyMomentProtagonistFlightId =
    electedFlight?.callsign ?? cinema.protagonist?.flightId ?? null;
  const keyMomentQueue = useKeyMomentQueue({
    cycleStartedAt: cinema.cycleStartedAt,
    phase: cinema.phase,
    protagonistFlightId: keyMomentProtagonistFlightId,
  });
  const clearKeyMoments = keyMomentQueue.clearAllMoments;
  const previousStoryResetIdRef = useRef(cinema.storyResetId);
  const previousElectedCallsignRef = useRef<string | null>(null);
  const routedPurchasedPolicyRef = useRef<string | null>(null);
  const purchaseTimelineTimersRef = useRef<number[]>([]);
  const [purchasedTrail, setPurchasedTrail] = useState<ActiveTrailDraw | null>(
    null,
  );
  const clearPurchaseTimelineTimers = useCallback(() => {
    for (const timerId of purchaseTimelineTimersRef.current) {
      window.clearTimeout(timerId);
    }
    purchaseTimelineTimersRef.current = [];
  }, []);
  const { activeTrail } = useTrailDraw({
    mode: cinema.mode,
    phase: cinema.phase,
    cycleStartedAt: cinema.cycleStartedAt,
    protagonist: cinema.protagonist,
    flights,
    userElectedFlight: purchasedPolicy ? null : electedFlight,
    userElectedTrailToken: electedTrailToken,
    resetToken: cinema.storyResetId,
  });
  const displayedTrail = activeTrail ?? purchasedTrail;
  const trailPoints = projectTrailPoints(
    displayedTrail?.points ?? null,
    mapSize,
    mapViewport,
  );
  const protagonistHighlight = useMemo<ProtagonistHighlight | null>(() => {
    if (!electedFlight) return cinema.protagonist;
    return {
      flightId: electedFlight.callsign,
      callsign: electedFlight.callsign,
    };
  }, [cinema.protagonist, electedFlight]);
  const atRisk =
    (cinema.mode === "cinema" || cinema.playbackLockedUntil !== null) &&
    cinema.phase === "story" &&
    cinema.protagonist !== null;

  const handleSelectFlight = useCallback(
    (callsign: string) => {
      clearKeyMoments();
      onSelectFlight(callsign);
    },
    [clearKeyMoments, onSelectFlight],
  );

  useEffect(() => {
    setCyclePromotionLocked(manualFocusLocked);
    return () => setCyclePromotionLocked(false);
  }, [manualFocusLocked, setCyclePromotionLocked]);

  useEffect(() => {
    return () => clearPurchaseTimelineTimers();
  }, [clearPurchaseTimelineTimers]);

  useEffect(() => {
    if (purchasedPolicy) return;
    routedPurchasedPolicyRef.current = null;
    clearPurchaseTimelineTimers();
    setPurchasedTrail(null);
  }, [clearPurchaseTimelineTimers, purchasedPolicy]);

  useEffect(() => {
    if (!purchasedPolicy || !electedFlight) return;
    if (routedPurchasedPolicyRef.current === purchasedPolicy.id) return;
    if (
      typeof electedFlight.longitude !== "number" ||
      typeof electedFlight.latitude !== "number"
    ) {
      return;
    }

    routedPurchasedPolicyRef.current = purchasedPolicy.id;
    const now = Date.now();
    const policyId = purchasedPolicy.id;
    const flightId = purchasedPolicy.flight_id;
    cinema.routeRealProtagonist(
      {
        id: `manual-buy:${policyId}`,
        flightId,
        callsign: electedFlight.callsign,
        longitude: electedFlight.longitude,
        latitude: electedFlight.latitude,
        createdAt: normalizeCreatedAtMs(purchasedPolicy.created_at, now),
        policyId,
        source: "real",
      },
      {
        playbackLockMs: PURCHASE_PLAYBACK_LOCK_MS,
      },
    );

    clearPurchaseTimelineTimers();
    setPurchasedTrail(null);
    const schedule = (targetMs: number, callback: () => void) => {
      const timerId = window.setTimeout(() => {
        callback();
      }, Math.max(0, targetMs - (Date.now() - now)));
      purchaseTimelineTimersRef.current.push(timerId);
    };

    schedule(TRAIL_DRAW_START_MS, () => {
      const points = buildTrailPoints({
        longitude: electedFlight.longitude,
        latitude: electedFlight.latitude,
        heading: electedFlight.heading,
        velocity: electedFlight.velocity,
      });
      if (!points) return;

      const startedAt = Date.now();
      const trail: ActiveTrailDraw = {
        id: `manual-buy:${policyId}:traildraw`,
        flightId,
        startedAt,
        expiresAt: startedAt + TRAIL_DRAW_TTL_MS,
        points,
      };
      setPurchasedTrail(trail);
      const clearTimerId = window.setTimeout(() => {
        setPurchasedTrail((current) =>
          current?.id === trail.id ? null : current,
        );
      }, TRAIL_DRAW_TTL_MS);
      purchaseTimelineTimersRef.current.push(clearTimerId);
    });

    schedule(PURCHASE_SHOCKWAVE_AT_MS, () => {
      if (hasPolicyEvent("claim.triggered", policyId)) return;
      useEventStore.getState().addEvent({
        id: `manual-buy:${policyId}:claim-triggered`,
        type: "claim.triggered",
        payload: {
          flight_id: flightId,
          policy_id: policyId,
          delay_minutes: PURCHASE_DELAY_MINUTES,
          source: "real-fallback",
          airport_iata: "UNKNOWN",
        },
      });
    });

    schedule(PURCHASE_CHAIN_AT_MS, () => {
      if (hasPolicyEvent("claim.settled", policyId)) return;
      const signature = fallbackSignature(policyId);
      const flare: FlareEvent = {
        flight_id: flightId,
        policy_id: policyId,
        payout: purchasedPolicy.payout,
        delay_minutes: PURCHASE_DELAY_MINUTES,
        signature,
        settle_duration_ms: PURCHASE_SETTLE_DURATION_MS,
      };
      const store = useEventStore.getState();
      store.addEvent({
        id: `manual-buy:${policyId}:claim-settled`,
        type: "claim.settled",
        payload: {
          ...flare,
          tx_hash: fallbackTxHash(policyId),
          block_height: 9001,
          source: "real-fallback",
        },
      });
      store.addFlare(flare);
      store.addEvent({
        id: `manual-buy:${policyId}:flare`,
        type: "flare",
        payload: { ...flare },
      });
    });

    schedule(PURCHASE_LANDED_AT_MS, () => {
      if (hasPolicyEvent("flight.landed", policyId)) return;
      useEventStore.getState().addEvent({
        id: `manual-buy:${policyId}:flight-landed`,
        type: "flight.landed",
        payload: {
          flight_id: flightId,
          policy_id: policyId,
          landed_at: Date.now(),
          source: "real-fallback",
        },
      });
    });
  }, [
    cinema,
    clearPurchaseTimelineTimers,
    electedFlight,
    purchasedPolicy,
  ]);

  useEffect(() => {
    const currentCallsign = electedFlight?.callsign ?? null;
    if (
      currentCallsign &&
      previousElectedCallsignRef.current !== currentCallsign
    ) {
      keyMomentQueue.clearAllMoments();
    }
    previousElectedCallsignRef.current = currentCallsign;
  }, [electedFlight?.callsign, keyMomentQueue]);

  useEffect(() => {
    if (previousStoryResetIdRef.current === cinema.storyResetId) return;
    previousStoryResetIdRef.current = cinema.storyResetId;
    keyMomentQueue.resetForProtagonist({
      flightId: cinema.protagonist?.flightId ?? null,
      policyId: cinema.protagonist?.policyId,
    });
  }, [
    cinema.protagonist?.flightId,
    cinema.protagonist?.policyId,
    cinema.storyResetId,
    keyMomentQueue,
  ]);

  return (
    <>
      <EventChoreographer
        onFlightLanded={keyMomentQueue.enqueue}
        onClaimSettled={keyMomentQueue.enqueue}
        onClaimTriggered={keyMomentQueue.enqueue}
        onPolicyCreated={ambientHeatmap.addPolicyEvent}
      />
      <MapAtmosphereLayer>
        <HeatmapBg
          points={ambientHeatmap.points}
          size={mapSize}
          viewport={mapViewport}
        />
      </MapAtmosphereLayer>
      <CameraDirector>
        {(cameraTarget) => (
          <GlobeMap
            cameraTarget={cameraTarget}
            onViewportChange={(viewport, size = DEFAULT_OVERLAY_SIZE) => {
              setMapViewport((current) =>
                current.k === viewport.k &&
                current.x === viewport.x &&
                current.y === viewport.y
                  ? current
                  : viewport,
              );
              setMapSize((current) =>
                current.width === size.width && current.height === size.height
                  ? current
                  : size,
              );
            }}
            onUserGesture={cinema.interrupt}
            onSelectFlight={handleSelectFlight}
            protagonistHighlight={protagonistHighlight}
          />
        )}
      </CameraDirector>
      <RadarSweep
        atRisk={atRisk}
        protagonistCallsign={cinema.protagonist?.callsign}
      />
      <DataStaleBadge />
      <EventFeedSidebar />
      <KPIBand tickId={cinema.kpiTickId} />
      <CinemaOverlay>
        <div
          data-testid="traildraw-layer"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          {trailPoints ? <TrailDraw points={trailPoints} /> : null}
        </div>
        <div
          data-testid="key-moment-layer"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <KeyMomentLayer
            activeMoments={keyMomentQueue.activeMoments}
            mapViewport={mapViewport}
            protagonist={cinema.protagonist}
            size={mapSize}
          />
        </div>
        <ProtagonistBadge />
      </CinemaOverlay>
      <ModeIndicator />
    </>
  );
}

function MapAtmosphereLayer({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="map-atmosphere-layer"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}

interface KeyMomentLayerProps {
  activeMoments: ActiveKeyMoment[];
  mapViewport: MapViewport;
  protagonist: CinemaProtagonist | null;
  size: ViewportSize;
}

function KeyMomentLayer({
  activeMoments,
  mapViewport,
  protagonist,
  size,
}: KeyMomentLayerProps) {
  const protagonistLocator = locatorFromProtagonist(protagonist);
  return (
    <>
      {activeMoments.map((activeMoment) => {
        const point: ScreenPoint | null =
          projectMomentPoint(activeMoment.moment.locator, size, mapViewport) ??
          projectMomentPoint(protagonistLocator, size, mapViewport);
        if (!point) return null;

        if (activeMoment.moment.kind === "chainbeam") {
          return (
            <ChainBeam
              from={point}
              key={activeMoment.moment.id}
              shortTxHash={activeMoment.moment.shortTxHash}
              to={hangarAnchorForSize(size)}
              txHash={activeMoment.moment.txHash}
            />
          );
        }

        if (activeMoment.moment.kind === "flareland") {
          return (
            <FlareLand
              key={activeMoment.moment.id}
              x={point.x}
              y={point.y}
            />
          );
        }

        if (activeMoment.moment.kind !== "shockwave") return null;

        return (
          <ShockWave
            delayMinutes={activeMoment.moment.delayMinutes}
            key={activeMoment.moment.id}
            x={point.x}
            y={point.y}
          />
        );
      })}
    </>
  );
}

function locatorFromProtagonist(
  protagonist: CinemaProtagonist | null,
): MomentLocator | null {
  if (!protagonist) return null;
  const locator: CoordinateLocator = {
    kind: "coordinates",
    longitude: protagonist.longitude,
    latitude: protagonist.latitude,
  };
  return locator;
}
