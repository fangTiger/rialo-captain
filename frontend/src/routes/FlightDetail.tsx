import { useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { Breadcrumb } from "../components/flight/Breadcrumb";
import { FlightHero } from "../components/flight/FlightHero";
import { FlightKPIBand } from "../components/flight/FlightKPIBand";
import { InsureBlock } from "../components/flight/InsureBlock";
import { RelatedClaims } from "../components/flight/RelatedClaims";
import { RelatedPolicies } from "../components/flight/RelatedPolicies";
import { multiplierFor } from "../components/flight/multiplier";
import { DelayHistogram } from "../components/drawer/DelayHistogram";
import { useFlight } from "../hooks/useFlight";
import { usePolicies } from "../hooks/usePolicies";

function statusFor(liveDelayMinutes: number | null) {
  if (liveDelayMinutes !== null && liveDelayMinutes >= 30) return "DELAYED";
  return "IN-FLIGHT";
}

export function FlightDetail() {
  const { id } = useParams();
  const flightId = id ?? "";
  const { flight, error, isLoading } = useFlight(flightId);
  const { policies } = usePolicies();
  const isNotFound = error instanceof ApiError && error.status === 404;
  const activePolicyCount = policies.filter(
    (policy) => policy.flight_id === flightId && policy.status === "active",
  ).length;

  if (isLoading && !flight && !isNotFound) {
    return (
      <main
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "32px 24px 96px",
          display: "grid",
          gap: 18,
        }}
      >
        <Breadcrumb />
        <div style={{ color: "var(--text-secondary)" }}>loading...</div>
      </main>
    );
  }

  const delayRate = flight?.delay_rate ?? null;
  const samples = flight?.samples ?? null;
  const liveDelayMinutes = flight?.live_delay_minutes ?? null;
  const multiplier = delayRate === null ? null : multiplierFor(delayRate);
  const callsign = flight?.callsign ?? flightId;
  const origin = flight?.origin ?? "";
  const destination = flight?.destination ?? "";

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 24px 96px",
        display: "grid",
        gap: 18,
      }}
    >
      <Breadcrumb />
      {isNotFound && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            border: "1px solid var(--danger-flare)",
            background: "var(--surface-1)",
            color: "var(--danger-flare)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          Flight no longer tracked · ID: {flightId}
        </div>
      )}
      <FlightHero
        callsign={callsign}
        origin={origin}
        destination={destination}
        status={statusFor(liveDelayMinutes)}
      />
      <FlightKPIBand
        delayRate={delayRate}
        samples={samples}
        multiplier={multiplier}
        liveDelayMinutes={liveDelayMinutes}
      />
      <DelayHistogram delayRate={delayRate ?? 0} samples={samples ?? 0} />
      <InsureBlock
        flightId={flightId}
        callsign={callsign}
        delayRate={delayRate ?? 0}
        hasActivePolicy={activePolicyCount > 0}
        activePolicyCount={activePolicyCount}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        <RelatedPolicies flightId={flightId} />
        <RelatedClaims flightId={flightId} />
      </div>
    </main>
  );
}
