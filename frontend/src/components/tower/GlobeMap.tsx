import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useFlights, type FlightPublic } from "../../hooks/useFlights";

mapboxgl.accessToken = (import.meta.env.VITE_MAPBOX_TOKEN as string) || "";

type PositionedFlight = FlightPublic & {
  longitude: number;
  latitude: number;
};

interface Props {
  onSelectFlight?: (callsign: string) => void;
}

export function GlobeMap({ onSelectFlight }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const { flights } = useFlights();

  useEffect(() => {
    if (!containerRef.current) return;
    if (!mapboxgl.accessToken) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [0, 30],
      zoom: 1.5,
      attributionControl: false,
      projection: "mercator",
    });
    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay as unknown as mapboxgl.IControl);
    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const validFlights = flights.filter(
      (flight): flight is PositionedFlight =>
        flight.longitude !== null && flight.latitude !== null,
    );

    const flightLayer = new ScatterplotLayer<PositionedFlight>({
      id: "flights",
      data: validFlights,
      getPosition: (flight) => [flight.longitude, flight.latitude],
      getRadius: 32000,
      radiusUnits: "meters",
      radiusMinPixels: 2,
      radiusMaxPixels: 6,
      getFillColor: [0, 255, 157, 200],
      pickable: true,
      onClick: (info: { object?: PositionedFlight }) => {
        if (info.object) onSelectFlight?.(info.object.callsign);
      },
    });

    overlay.setProps({ layers: [flightLayer] });
  }, [flights, onSelectFlight]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
      {!mapboxgl.accessToken && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          set VITE_MAPBOX_TOKEN in frontend/.env to enable the radar
        </div>
      )}
    </div>
  );
}
