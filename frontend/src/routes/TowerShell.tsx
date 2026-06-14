import { useNavigate } from "react-router-dom";
import { GlobeMap } from "../components/tower/GlobeMap";
import { RadarSweep } from "../components/tower/RadarSweep";
import { EventFeedSidebar } from "../components/tower/EventFeedSidebar";
import { KPIBand } from "../components/tower/KPIBand";
import { DataStaleBadge } from "../components/tower/DataStaleBadge";

export function TowerShell() {
  const navigate = useNavigate();

  return (
    <div style={{ position: "absolute", inset: 0, top: 50, bottom: 32 }}>
      <GlobeMap
        onSelectFlight={(callsign) => {
          const date = new Date()
            .toISOString()
            .slice(0, 10)
            .replaceAll("-", "");
          navigate(`/flight/${callsign}-${date}`);
        }}
      />
      <RadarSweep />
      <DataStaleBadge />
      <EventFeedSidebar />
      <KPIBand />
    </div>
  );
}
