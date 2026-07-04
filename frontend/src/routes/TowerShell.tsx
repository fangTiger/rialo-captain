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
  type CameraTarget,
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
  TRAIL_DRAW_TTL_MS,
  useTrailDraw,
  type ActiveTrailDraw,
} from "../components/cinema/useTrailDraw";
import {
  GlobeMap,
  type ProtagonistHighlight,
} from "../components/tower/GlobeMap";
import { RadarSweep } from "../components/tower/RadarSweep";
import { RiskIntelligencePanel } from "../components/tower/RiskIntelligencePanel";
import { EventFeedSidebar } from "../components/tower/EventFeedSidebar";
import { KPIBand } from "../components/tower/KPIBand";
import { DataStaleBadge } from "../components/tower/DataStaleBadge";
import {
  buildTowerRiskSignal,
  type TowerRiskSignal,
  type TowerRiskSubject,
} from "../components/tower/riskSignals";
import { AIBriefing } from "../components/copilot/AIBriefing";
import {
  BuyDrawer,
  type PurchasedPolicy,
} from "../components/drawer/BuyDrawer";
import {
  GUIDED_DEMO_NARROW_BREAKPOINT_PX,
  GuidedDemoRail,
} from "../components/demo/GuidedDemoRail";
import {
  completeGuidedDemoReplay,
  completeGuidedDemoPurchase,
  createIdleGuidedDemoState,
  exitGuidedDemo,
  getGuidedDemoScenario,
  isGuidedDemoActive,
  pauseGuidedDemo,
  requestGuidedDemoReplay,
  resumeGuidedDemo,
  selectGuidedDemoScenario,
  selectGuidedDemoFlight,
  startGuidedDemo,
  type GuidedDemoFlight,
  type GuidedDemoScenarioId,
} from "../components/demo/demoDirector";
import { EvidenceDrawer } from "../components/evidence/EvidenceDrawer";
import { useCopilot } from "../components/copilot/CopilotProvider";
import { useFlights, type FlightPublic } from "../hooks/useFlights";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";
import { useEventStore, type FlareEvent } from "../store/eventStore";
import {
  hangarAnchorForSize,
  projectMomentPoint,
  type ScreenPoint,
} from "../components/cinema/keyMomentGeometry";
import type { MapViewport, ViewportSize } from "../components/cinema/cameraMath";
import type { ActiveKeyMoment } from "../components/cinema/keyMomentTimeline";
import {
  shortTxHash,
  type ChainBeamMoment,
  type CoordinateLocator,
  type FlareLandMoment,
  type MomentLocator,
  type ShockWaveMoment,
} from "../components/cinema/keyMoments";

const TOWER_RIGHT_HUD_HEIGHT =
  "calc(100dvh - var(--top-nav-height, 64px) - 72px)";
const TOWER_RIGHT_HUD_RISK_SLOT_MAX_HEIGHT =
  "min(24rem, calc(100% - 13rem))";

export function TowerShell() {
  const { flights } = useFlights();
  const { ask } = useCopilot();
  const [drawerFlightId, setDrawerFlightId] = useState<string | null>(null);
  const [drawerGuidedDemoSessionId, setDrawerGuidedDemoSessionId] = useState<
    number | null
  >(null);
  const [electedCallsign, setElectedCallsign] = useState<string | null>(null);
  const [electedCameraTarget, setElectedCameraTarget] =
    useState<CameraTarget | null>(null);
  const [electedTrailToken, setElectedTrailToken] = useState(0);
  const [guidedDemoState, setGuidedDemoState] = useState(
    createIdleGuidedDemoState,
  );
  const [evidenceSubject, setEvidenceSubject] = useState<EvidenceSubject>(null);
  const [purchasedPolicy, setPurchasedPolicy] = useState<PurchasedPolicy | null>(
    null,
  );
  const [weatherLayerVisible, setWeatherLayerVisible] = useState(true);
  const [isCompactTowerHud, setIsCompactTowerHud] = useState(() =>
    readIsCompactTowerHudViewport(),
  );
  const [cinemaFocusProtagonist, setCinemaFocusProtagonist] =
    useState<CinemaProtagonist | null>(null);
  const purchaseCompletedRef = useRef(false);
  const guidedDemoSessionIdRef = useRef(0);
  const demoSelectionOffsetRef = useRef<number | null>(null);
  if (demoSelectionOffsetRef.current === null) {
    demoSelectionOffsetRef.current = Math.floor(Math.random() * 1_000_000_000);
  }
  const demoSelectionOffset = demoSelectionOffsetRef.current;
  const protagonist = useMemo(
    () => chooseDemoProtagonist(flights, demoSelectionOffset),
    [demoSelectionOffset, flights],
  );
  const currentRiskProtagonist = cinemaFocusProtagonist ?? protagonist;
  const electedFlight = useMemo(() => {
    if (!electedCallsign) return null;
    return findFlightByCallsign(flights, electedCallsign);
  }, [electedCallsign, flights]);
  const selectedGuidedDemoFlight = useMemo(() => {
    if (!guidedDemoState.selectedFlight) return null;
    return findFlightByCallsign(flights, guidedDemoState.selectedFlight.callsign);
  }, [flights, guidedDemoState.selectedFlight]);
  const activeRiskSubject = useMemo<TowerRiskSubject | null>(() => {
    if (electedFlight) {
      return riskSubjectFromFlight(
        electedFlight,
        flightIdForCallsign(electedFlight.callsign),
      );
    }
    if (electedCallsign) {
      return {
        callsign: electedCallsign,
        flightId: flightIdForCallsign(electedCallsign),
      };
    }
    if (selectedGuidedDemoFlight && guidedDemoState.selectedFlight) {
      return riskSubjectFromFlight(
        selectedGuidedDemoFlight,
        guidedDemoState.selectedFlight.flightId,
      );
    }
    if (guidedDemoState.selectedFlight) {
      return {
        callsign: guidedDemoState.selectedFlight.callsign,
        flightId: guidedDemoState.selectedFlight.flightId,
      };
    }
    if (currentRiskProtagonist) {
      return {
        callsign: currentRiskProtagonist.callsign,
        flightId: currentRiskProtagonist.flightId,
        longitude: currentRiskProtagonist.longitude,
        latitude: currentRiskProtagonist.latitude,
      };
    }
    return null;
  }, [
    currentRiskProtagonist,
    electedCallsign,
    electedFlight,
    guidedDemoState.selectedFlight,
    selectedGuidedDemoFlight,
  ]);
  const riskSignal = useMemo(
    () => buildTowerRiskSignal(flights, activeRiskSubject),
    [activeRiskSubject, flights],
  );
  const shouldShowWeatherCorridor = Boolean(
    electedCallsign || guidedDemoState.selectedFlight,
  );
  const mapRiskSignal = useMemo<TowerRiskSignal>(() => {
    if (shouldShowWeatherCorridor || !riskSignal.corridor) {
      return riskSignal;
    }
    return {
      ...riskSignal,
      corridor: null,
    };
  }, [riskSignal, shouldShowWeatherCorridor]);
  const recommendedDemoFlight = useMemo(() => {
    if (!protagonist) return null;
    const flight = findFlightByCallsign(flights, protagonist.callsign);
    return toGuidedDemoFlight(flight);
  }, [flights, protagonist]);

  const openManualFlight = useCallback((callsign: string) => {
    const normalized = normalizeCallsign(callsign);
    if (!normalized) return;
    const flight = findFlightByCallsign(flights, normalized);
    purchaseCompletedRef.current = false;
    setElectedCallsign(normalized);
    setElectedCameraTarget(cameraTargetForElectedFlight(flight));
    setPurchasedPolicy(null);
    setEvidenceSubject(null);
    setElectedTrailToken((token) => token + 1);
    setDrawerGuidedDemoSessionId(null);
    setDrawerFlightId(flightIdForCallsign(normalized));
  }, [flights]);

  const openGuidedDemoFlight = useCallback((flight: GuidedDemoFlight) => {
    const liveFlight = findFlightByCallsign(flights, flight.callsign);
    purchaseCompletedRef.current = false;
    setGuidedDemoState((current) => selectGuidedDemoFlight(current, flight));
    setElectedCallsign(flight.callsign);
    setElectedCameraTarget(cameraTargetForElectedFlight(liveFlight));
    setPurchasedPolicy(null);
    setEvidenceSubject(null);
    setElectedTrailToken((token) => token + 1);
    setDrawerGuidedDemoSessionId(guidedDemoSessionIdRef.current);
    setDrawerFlightId(flight.flightId);
  }, [flights]);

  const handleStartGuidedDemo = useCallback(() => {
    guidedDemoSessionIdRef.current += 1;
    purchaseCompletedRef.current = false;
    setDrawerFlightId(null);
    setDrawerGuidedDemoSessionId(null);
    setElectedCallsign(null);
    setElectedCameraTarget(null);
    setPurchasedPolicy(null);
    setEvidenceSubject(null);
    setGuidedDemoState((current) =>
      startGuidedDemo(recommendedDemoFlight, current),
    );
  }, [recommendedDemoFlight]);

  const handleSelectScenario = useCallback(
    (scenarioId: GuidedDemoScenarioId) => {
      setGuidedDemoState((current) =>
        selectGuidedDemoScenario(current, scenarioId),
      );
    },
    [],
  );

  const handleAskScenario = useCallback(() => {
    const scenario = getGuidedDemoScenario(guidedDemoState.selectedScenarioId);
    void ask(
      {
        question: scenario.promptQuestion,
        subjectType: "overview",
      },
      { openPanel: false },
    );
  }, [ask, guidedDemoState.selectedScenarioId]);

  const handleUseRecommendedFlight = useCallback(() => {
    if (!guidedDemoState.recommendedFlight) return;
    openGuidedDemoFlight(guidedDemoState.recommendedFlight);
  }, [guidedDemoState.recommendedFlight, openGuidedDemoFlight]);

  const handleResumeGuidedDemo = useCallback(() => {
    if (!guidedDemoState.selectedFlight) return;
    purchaseCompletedRef.current = false;
    setGuidedDemoState((current) => resumeGuidedDemo(current));
    setDrawerGuidedDemoSessionId(guidedDemoSessionIdRef.current);
    setDrawerFlightId(guidedDemoState.selectedFlight.flightId);
  }, [guidedDemoState.selectedFlight]);

  const handleExitGuidedDemo = useCallback(() => {
    const hasPurchasedPolicy = purchasedPolicy !== null;
    guidedDemoSessionIdRef.current += 1;
    purchaseCompletedRef.current = false;
    setGuidedDemoState((current) => exitGuidedDemo(current));
    setDrawerFlightId(null);
    setDrawerGuidedDemoSessionId(null);
    setElectedCallsign(null);
    setElectedCameraTarget(null);
    setEvidenceSubject(null);
    if (!hasPurchasedPolicy) {
      setPurchasedPolicy(null);
    }
  }, [purchasedPolicy]);

  const handleReplaySettlement = useCallback(() => {
    setGuidedDemoState((current) => requestGuidedDemoReplay(current));
  }, []);

  const handleOpenEvidenceStory = useCallback(() => {
    if (!purchasedPolicy) return;
    setEvidenceSubject({
      kind: "policy",
      id: purchasedPolicy.id,
    });
  }, [purchasedPolicy]);

  const handleSelectFlight = useCallback(
    (callsign: string) => {
      if (
        guidedDemoState.status === "select-flight" ||
        guidedDemoState.status === "buy-cover" ||
        guidedDemoState.status === "paused"
      ) {
        const flight = findFlightByCallsign(flights, callsign);
        const guidedDemoFlight = toGuidedDemoFlight(flight);
        if (!guidedDemoFlight) return;
        openGuidedDemoFlight(guidedDemoFlight);
        return;
      }

      if (
        guidedDemoState.status === "replay" ||
        guidedDemoState.status === "complete"
      ) {
        return;
      }

      openManualFlight(callsign);
    },
    [flights, guidedDemoState.status, openGuidedDemoFlight, openManualFlight],
  );

  useEffect(() => {
    const handleResize = () => {
      setIsCompactTowerHud(readIsCompactTowerHudViewport());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const riskPanel = (
    <RiskIntelligencePanel
      signal={riskSignal}
      weatherLayerVisible={weatherLayerVisible}
      onWeatherLayerVisibleChange={setWeatherLayerVisible}
      viewportMaxHeight={isCompactTowerHud ? undefined : "100%"}
    />
  );
  const guidedDemoRail = (
    <GuidedDemoRail
      embedded
      state={guidedDemoState}
      onExit={handleExitGuidedDemo}
      onResume={handleResumeGuidedDemo}
      onAskScenario={handleAskScenario}
      onOpenEvidenceStory={handleOpenEvidenceStory}
      onReplaySettlement={handleReplaySettlement}
      onSelectScenario={handleSelectScenario}
      onStart={handleStartGuidedDemo}
      onUseRecommendedFlight={handleUseRecommendedFlight}
    />
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        top: "var(--top-nav-height, 64px)",
        bottom: 32,
      }}
    >
      {isCompactTowerHud ? (
        <div
          data-testid="tower-compact-top-stack"
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            right: 20,
            zIndex: 19,
            pointerEvents: "none",
            display: "grid",
            gap: 12,
            justifyItems: "start",
          }}
        >
          <div
            data-testid="tower-ai-briefing-slot"
            style={{ pointerEvents: "auto", maxWidth: "min(100%, 28rem)" }}
          >
            <AIBriefing />
          </div>
          <div
            style={{
              pointerEvents: "auto",
              width: "min(100%, 22rem)",
              maxWidth: "100%",
            }}
          >
            {riskPanel}
          </div>
        </div>
      ) : (
        <>
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
            <div
              data-testid="tower-ai-briefing-slot"
              style={{ pointerEvents: "auto", maxWidth: "min(100%, 28rem)" }}
            >
              <AIBriefing />
            </div>
          </div>
          <div
            data-testid="tower-right-hud-stack"
            data-layout="stacked"
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              zIndex: 19,
              pointerEvents: "none",
              display: "grid",
              gap: 12,
              gridTemplateRows: `minmax(0, ${TOWER_RIGHT_HUD_RISK_SLOT_MAX_HEIGHT}) minmax(12rem, 1fr)`,
              justifyContent: "flex-end",
              justifyItems: "stretch",
              width: "min(calc(100% - 40px), 21rem)",
              height: TOWER_RIGHT_HUD_HEIGHT,
              maxHeight: TOWER_RIGHT_HUD_HEIGHT,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div
              data-testid="tower-risk-panel-slot"
              style={{
                pointerEvents: "auto",
                width: "100%",
                minHeight: 0,
                height: "100%",
                maxHeight: "100%",
                overflow: "hidden",
              }}
            >
              {riskPanel}
            </div>
            {guidedDemoRail}
          </div>
        </>
      )}
      {isCompactTowerHud ? (
        guidedDemoRail
      ) : null}
      <CinemaProvider
        initialProtagonist={protagonist}
      >
        <CinemaFocusSync onFocusChange={setCinemaFocusProtagonist} />
        <CinemaController />
        <AutoSeeder
          demoLocked={Boolean(electedCallsign)}
          demoSelectionOffset={demoSelectionOffset}
          flights={flights}
        />
        <TowerCinemaLayers
          electedCameraTarget={electedCameraTarget}
          electedFlight={electedFlight}
          manualFocusLocked={Boolean(electedCallsign)}
          flights={flights}
          onSelectFlight={handleSelectFlight}
          electedTrailToken={electedTrailToken}
          weatherLayerVisible={weatherLayerVisible}
          riskSignal={mapRiskSignal}
          purchasedPolicy={purchasedPolicy}
          replayToken={guidedDemoState.replayToken}
          onReplayComplete={() =>
            setGuidedDemoState((current) => completeGuidedDemoReplay(current))
          }
        />
      </CinemaProvider>
      {drawerFlightId && (
        <BuyDrawer
          flightId={drawerFlightId}
          onPurchased={(policy) => {
            if (
              drawerGuidedDemoSessionId !== null &&
              drawerGuidedDemoSessionId !== guidedDemoSessionIdRef.current
            ) {
              return;
            }
            purchaseCompletedRef.current = true;
            setPurchasedPolicy(policy);
            setGuidedDemoState((current) => {
              if (current.status === "idle") {
                return current;
              }
              return completeGuidedDemoPurchase(current, {
                id: policy.id,
                flightId: policy.flight_id,
                callsign:
                  current.selectedFlight?.callsign ??
                  normalizeCallsign(policy.flight_id.split("-")[0] ?? ""),
                premium: policy.premium,
                payout: policy.payout,
              });
            });
          }}
          onClose={() => {
            if (
              drawerGuidedDemoSessionId !== null &&
              drawerGuidedDemoSessionId !== guidedDemoSessionIdRef.current
            ) {
              return;
            }
            if (purchaseCompletedRef.current) {
              purchaseCompletedRef.current = false;
              setDrawerFlightId(null);
              setDrawerGuidedDemoSessionId(null);
              return;
            }
            setDrawerFlightId(null);
            setDrawerGuidedDemoSessionId(null);
            if (isGuidedDemoActive(guidedDemoState)) {
              setGuidedDemoState((current) => pauseGuidedDemo(current));
              return;
            }
            setElectedCallsign(null);
            setElectedCameraTarget(null);
            setPurchasedPolicy(null);
          }}
        />
      )}
      <EvidenceDrawer
        subject={evidenceSubject}
        onClose={() => setEvidenceSubject(null)}
      />
    </div>
  );
}

function CinemaFocusSync({
  onFocusChange,
}: {
  onFocusChange: (protagonist: CinemaProtagonist | null) => void;
}) {
  const cinema = useCinema();

  useEffect(() => {
    onFocusChange(cinema.protagonist);
  }, [cinema.protagonist, onFocusChange]);

  return null;
}

function normalizeCallsign(callsign: string) {
  return callsign.trim().toUpperCase();
}

function flightIdForCallsign(callsign: string) {
  return `${normalizeCallsign(callsign)}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}`;
}

function findFlightByCallsign(
  flights: FlightPublic[],
  callsign: string,
): FlightPublic | null {
  const normalized = normalizeCallsign(callsign);
  if (!normalized) return null;
  return (
    flights.find(
      (flight) => normalizeCallsign(flight.callsign) === normalized,
    ) ?? null
  );
}

function toGuidedDemoFlight(
  flight: FlightPublic | null,
): GuidedDemoFlight | null {
  if (!flight) return null;
  if (flight.longitude === null || flight.latitude === null || flight.on_ground) {
    return null;
  }
  return {
    callsign: normalizeCallsign(flight.callsign),
    flightId: flightIdForCallsign(flight.callsign),
  };
}

function riskSubjectFromFlight(
  flight: FlightPublic,
  flightId: string,
): TowerRiskSubject {
  return {
    callsign: normalizeCallsign(flight.callsign),
    flightId,
    longitude: flight.longitude,
    latitude: flight.latitude,
  };
}

function readIsCompactTowerHudViewport() {
  return window.innerWidth < GUIDED_DEMO_NARROW_BREAKPOINT_PX;
}

interface TowerCinemaLayersProps {
  electedCameraTarget: CameraTarget | null;
  electedFlight: FlightPublic | null;
  manualFocusLocked: boolean;
  flights: FlightPublic[];
  onSelectFlight: (callsign: string) => void;
  electedTrailToken: number;
  weatherLayerVisible: boolean;
  riskSignal: TowerRiskSignal;
  purchasedPolicy: PurchasedPolicy | null;
  replayToken: number;
  onReplayComplete: () => void;
}

const DEFAULT_OVERLAY_SIZE: ViewportSize = { width: 1200, height: 720 };
const PURCHASE_TRAIL_START_MS = 2_000;
const PURCHASE_TRAIL_TTL_MS = 3_000;
const PURCHASE_SHOCKWAVE_AT_MS = 3_000;
const PURCHASE_CHAIN_AT_MS = 4_000;
const PURCHASE_LANDED_AT_MS = 5_000;
const REPLAY_TRAIL_START_MS = 250;
const REPLAY_TRAIL_TTL_MS = 3_000;
const REPLAY_SHOCKWAVE_AT_MS = 1_000;
const REPLAY_CHAIN_AT_MS = 2_000;
const REPLAY_LANDED_AT_MS = 3_000;
const PURCHASE_DELAY_MINUTES = 45;
const PURCHASE_SETTLE_DURATION_MS = 1_400;
const PURCHASE_PLAYBACK_LOCK_MS = 6_000;
const REPLAY_PLAYBACK_LOCK_MS = 3_500;
const ELECTED_CAMERA_ZOOM = 5;
const ELECTED_CAMERA_DURATION_MS = 2_000;
const ELECTED_TRAIL_TTL_MS = 8_000;
const ELECTED_CAMERA_DESKTOP_SAFE_AREA_INSETS: NonNullable<
  CameraTarget["safeAreaInsets"]
> = {
  left: 500,
  right: 380,
  top: 260,
  bottom: 320,
};
const ELECTED_CAMERA_BOTTOM_RAIL_SAFE_AREA_INSETS: NonNullable<
  CameraTarget["safeAreaInsets"]
> = {
  left: 500,
  right: 0,
  top: 0,
  bottom: 520,
};

function safeAreaInsetsForElectedCamera(): NonNullable<
  CameraTarget["safeAreaInsets"]
> {
  if (
    typeof window !== "undefined" &&
    window.innerWidth < GUIDED_DEMO_NARROW_BREAKPOINT_PX
  ) {
    return ELECTED_CAMERA_BOTTOM_RAIL_SAFE_AREA_INSETS;
  }

  return ELECTED_CAMERA_DESKTOP_SAFE_AREA_INSETS;
}

function cameraTargetForElectedFlight(
  flight: FlightPublic | null,
): CameraTarget | null {
  if (!flight) return null;
  if (
    typeof flight.longitude !== "number" ||
    typeof flight.latitude !== "number" ||
    !Number.isFinite(flight.longitude) ||
    !Number.isFinite(flight.latitude)
  ) {
    return null;
  }

  return {
    longitude: flight.longitude,
    latitude: flight.latitude,
    zoom: ELECTED_CAMERA_ZOOM,
    durationMs: ELECTED_CAMERA_DURATION_MS,
    reason: "protagonist",
    safeAreaInsets: safeAreaInsetsForElectedCamera(),
  };
}

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
  electedCameraTarget,
  electedFlight,
  electedTrailToken,
  flights,
  manualFocusLocked,
  onSelectFlight,
  purchasedPolicy,
  weatherLayerVisible,
  riskSignal,
  replayToken,
  onReplayComplete,
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
    suppressProtagonistTrail: Boolean(electedFlight) || Boolean(purchasedPolicy),
    resetToken: cinema.storyResetId,
    ttlMs: purchasedPolicy
      ? TRAIL_DRAW_TTL_MS
      : electedFlight
        ? ELECTED_TRAIL_TTL_MS
        : TRAIL_DRAW_TTL_MS,
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
  const handleViewportChange = useCallback(
    (viewport: MapViewport, size: ViewportSize = DEFAULT_OVERLAY_SIZE) => {
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
    },
    [],
  );

  useEffect(() => {
    setCyclePromotionLocked(manualFocusLocked);
    return () => setCyclePromotionLocked(false);
  }, [manualFocusLocked, setCyclePromotionLocked]);

  useEffect(() => {
    return () => clearPurchaseTimelineTimers();
  }, [clearPurchaseTimelineTimers]);

  useEffect(() => {
    if (!purchasedPolicy) {
      routedPurchasedPolicyRef.current = null;
      clearPurchaseTimelineTimers();
      setPurchasedTrail(null);
      return;
    }

    if (electedFlight) return;
    clearPurchaseTimelineTimers();
    setPurchasedTrail(null);
  }, [clearPurchaseTimelineTimers, electedFlight, purchasedPolicy]);

  useEffect(() => {
    if (!purchasedPolicy || !electedFlight) return;
    const replayKey = `${purchasedPolicy.id}:${replayToken}`;
    if (routedPurchasedPolicyRef.current === replayKey) return;
    if (
      typeof electedFlight.longitude !== "number" ||
      typeof electedFlight.latitude !== "number"
    ) {
      return;
    }

    routedPurchasedPolicyRef.current = replayKey;
    const now = Date.now();
    const policyId = purchasedPolicy.id;
    const flightId = purchasedPolicy.flight_id;
    const isReplayRequest = replayToken > 1;
    const trailStartMs = isReplayRequest
      ? REPLAY_TRAIL_START_MS
      : PURCHASE_TRAIL_START_MS;
    const trailTtlMs = isReplayRequest
      ? REPLAY_TRAIL_TTL_MS
      : PURCHASE_TRAIL_TTL_MS;
    const shockwaveAtMs = isReplayRequest
      ? REPLAY_SHOCKWAVE_AT_MS
      : PURCHASE_SHOCKWAVE_AT_MS;
    const chainAtMs = isReplayRequest ? REPLAY_CHAIN_AT_MS : PURCHASE_CHAIN_AT_MS;
    const landedAtMs = isReplayRequest
      ? REPLAY_LANDED_AT_MS
      : PURCHASE_LANDED_AT_MS;
    const playbackLockMs = isReplayRequest
      ? REPLAY_PLAYBACK_LOCK_MS
      : PURCHASE_PLAYBACK_LOCK_MS;

    clearPurchaseTimelineTimers();
    setPurchasedTrail(null);
    if (isReplayRequest) {
      clearKeyMoments();
    }

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
        playbackLockMs,
        force: isReplayRequest,
      },
    );
    const schedule = (targetMs: number, callback: () => void) => {
      const timerId = window.setTimeout(() => {
        callback();
      }, Math.max(0, targetMs - (Date.now() - now)));
      purchaseTimelineTimersRef.current.push(timerId);
    };

    schedule(trailStartMs, () => {
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
        expiresAt: startedAt + trailTtlMs,
        points,
      };
      setPurchasedTrail(trail);
      const clearTimerId = window.setTimeout(() => {
        setPurchasedTrail((current) =>
          current?.id === trail.id ? null : current,
        );
      }, trailTtlMs);
      purchaseTimelineTimersRef.current.push(clearTimerId);
    });

    schedule(shockwaveAtMs, () => {
      if (isReplayRequest) {
        keyMomentQueue.enqueue(
          replayShockwaveMoment(policyId, flightId, electedFlight, replayToken),
        );
        return;
      }
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

    schedule(chainAtMs, () => {
      if (isReplayRequest) {
        keyMomentQueue.enqueue(
          replayChainBeamMoment(
            policyId,
            flightId,
            electedFlight,
            replayToken,
          ),
        );
        return;
      }
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

    schedule(landedAtMs, () => {
      if (isReplayRequest) {
        keyMomentQueue.enqueue(
          replayFlareLandMoment(policyId, flightId, electedFlight, replayToken),
        );
        return;
      }
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

    schedule(playbackLockMs, () => {
      onReplayComplete();
    });
  }, [
    cinema,
    clearPurchaseTimelineTimers,
    electedFlight,
    onReplayComplete,
    purchasedPolicy,
    replayToken,
    clearKeyMoments,
    keyMomentQueue,
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
            cameraTarget={electedCameraTarget ?? cameraTarget}
            onViewportChange={handleViewportChange}
            onUserGesture={cinema.interrupt}
            onSelectFlight={handleSelectFlight}
            protagonistHighlight={protagonistHighlight}
            weatherLayerVisible={weatherLayerVisible}
            riskSignal={riskSignal}
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

function replayShockwaveMoment(
  policyId: string,
  flightId: string,
  flight: FlightPublic,
  replayToken: number,
): ShockWaveMoment {
  return {
    id: `manual-replay:${policyId}:${replayToken}:shockwave`,
    eventId: `manual-replay:${policyId}:${replayToken}:claim-triggered`,
    kind: "shockwave",
    flightId,
    policyId,
    delayMinutes: PURCHASE_DELAY_MINUTES,
    receivedAt: Date.now(),
    source: "demo-replay",
    locator: {
      kind: "coordinates",
      longitude: flight.longitude ?? 0,
      latitude: flight.latitude ?? 0,
    },
  };
}

function replayChainBeamMoment(
  policyId: string,
  flightId: string,
  flight: FlightPublic,
  replayToken: number,
): ChainBeamMoment {
  const txHash = fallbackTxHash(policyId);
  return {
    id: `manual-replay:${policyId}:${replayToken}:chainbeam`,
    eventId: `manual-replay:${policyId}:${replayToken}:claim-settled`,
    kind: "chainbeam",
    flightId,
    policyId,
    txHash,
    shortTxHash: shortTxHash(txHash),
    receivedAt: Date.now(),
    source: "demo-replay",
    locator: {
      kind: "coordinates",
      longitude: flight.longitude ?? 0,
      latitude: flight.latitude ?? 0,
    },
  };
}

function replayFlareLandMoment(
  policyId: string,
  flightId: string,
  flight: FlightPublic,
  replayToken: number,
): FlareLandMoment {
  return {
    id: `manual-replay:${policyId}:${replayToken}:flareland`,
    eventId: `manual-replay:${policyId}:${replayToken}:flight-landed`,
    kind: "flareland",
    flightId,
    policyId,
    landedAt: Date.now(),
    receivedAt: Date.now(),
    source: "demo-replay",
    locator: {
      kind: "coordinates",
      longitude: flight.longitude ?? 0,
      latitude: flight.latitude ?? 0,
    },
  };
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
