import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AutoSeeder } from "../components/cinema/AutoSeeder";
import { CameraDirector } from "../components/cinema/CameraDirector";
import { CinemaController } from "../components/cinema/CinemaController";
import { CinemaOverlay } from "../components/cinema/CinemaOverlay";
import {
  CinemaProvider,
  type CinemaProtagonist,
  useCinema,
} from "../components/cinema/CinemaContext";
import { EventChoreographer } from "../components/cinema/EventChoreographer";
import { ModeIndicator } from "../components/cinema/ModeIndicator";
import { ProtagonistBadge } from "../components/cinema/ProtagonistBadge";
import { ChainBeam } from "../components/cinema/ChainBeam";
import { FlareLand } from "../components/cinema/FlareLand";
import { HeatmapBg } from "../components/cinema/HeatmapBg";
import { ShockWave } from "../components/cinema/ShockWave";
import { TrailDraw } from "../components/cinema/TrailDraw";
import { chooseDemoProtagonist } from "../components/cinema/protagonist";
import { projectTrailPoints } from "../components/cinema/trailGeometry";
import { useAmbientHeatmap } from "../components/cinema/useAmbientHeatmap";
import { useKeyMomentQueue } from "../components/cinema/useKeyMomentQueue";
import { useTrailDraw } from "../components/cinema/useTrailDraw";
import { GlobeMap } from "../components/tower/GlobeMap";
import { RadarSweep } from "../components/tower/RadarSweep";
import { EventFeedSidebar } from "../components/tower/EventFeedSidebar";
import { KPIBand } from "../components/tower/KPIBand";
import { DataStaleBadge } from "../components/tower/DataStaleBadge";
import { useFlights, type FlightPublic } from "../hooks/useFlights";
import {
  hangarAnchorForSize,
  projectMomentPoint,
  type ScreenPoint,
} from "../components/cinema/keyMomentGeometry";
import type { MapViewport, ViewportSize } from "../components/cinema/cameraMath";
import type { ActiveKeyMoment } from "../components/cinema/keyMomentTimeline";
import type { CoordinateLocator, MomentLocator } from "../components/cinema/keyMoments";

export function TowerShell() {
  const navigate = useNavigate();
  const { flights } = useFlights();
  const protagonist = useMemo(() => chooseDemoProtagonist(flights), [flights]);

  return (
    <div style={{ position: "absolute", inset: 0, top: 50, bottom: 32 }}>
      <CinemaProvider
        key={protagonist?.flightId ?? "waiting"}
        initialProtagonist={protagonist}
      >
        <CinemaController />
        <AutoSeeder flights={flights} />
        <TowerCinemaLayers
          flights={flights}
          onSelectFlight={(callsign) => {
            const date = new Date()
              .toISOString()
              .slice(0, 10)
              .replaceAll("-", "");
            navigate(`/flight/${callsign}-${date}`);
          }}
        />
      </CinemaProvider>
    </div>
  );
}

interface TowerCinemaLayersProps {
  flights: FlightPublic[];
  onSelectFlight: (callsign: string) => void;
}

const DEFAULT_OVERLAY_SIZE: ViewportSize = { width: 1200, height: 720 };

function TowerCinemaLayers({
  flights,
  onSelectFlight,
}: TowerCinemaLayersProps) {
  const cinema = useCinema();
  const [mapViewport, setMapViewport] = useState<MapViewport>({ k: 1, x: 0, y: 0 });
  const ambientHeatmap = useAmbientHeatmap();
  const keyMomentQueue = useKeyMomentQueue({
    cycleStartedAt: cinema.cycleStartedAt,
    phase: cinema.phase,
    protagonistFlightId: cinema.protagonist?.flightId ?? null,
  });
  const previousStoryResetIdRef = useRef(cinema.storyResetId);
  const { activeTrail } = useTrailDraw({
    mode: cinema.mode,
    phase: cinema.phase,
    cycleStartedAt: cinema.cycleStartedAt,
    protagonist: cinema.protagonist,
    flights,
    resetToken: cinema.storyResetId,
  });
  const trailPoints = projectTrailPoints(
    activeTrail?.points ?? null,
    DEFAULT_OVERLAY_SIZE,
    mapViewport,
  );
  const atRisk =
    cinema.mode === "cinema" &&
    cinema.phase === "story" &&
    cinema.protagonist !== null;

  useEffect(() => {
    if (previousStoryResetIdRef.current === cinema.storyResetId) return;
    previousStoryResetIdRef.current = cinema.storyResetId;
    keyMomentQueue.clearAllMoments();
  }, [cinema.storyResetId, keyMomentQueue]);

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
          size={DEFAULT_OVERLAY_SIZE}
          viewport={mapViewport}
        />
      </MapAtmosphereLayer>
      <CameraDirector>
        {(cameraTarget) => (
          <GlobeMap
            cameraTarget={cameraTarget}
            onViewportChange={setMapViewport}
            onUserGesture={cinema.interrupt}
            onSelectFlight={onSelectFlight}
            protagonistHighlight={cinema.protagonist}
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
            size={DEFAULT_OVERLAY_SIZE}
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
