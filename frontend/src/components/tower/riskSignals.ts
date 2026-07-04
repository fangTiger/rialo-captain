import type { FlightPublic } from "../../hooks/useFlights";

export type WeatherPressureLevel = "low" | "elevated" | "severe";

export interface TowerRiskSubject {
  flightId?: string;
  callsign?: string;
  longitude?: number | null;
  latitude?: number | null;
}

export interface WeatherCell {
  id: string;
  longitude: number;
  latitude: number;
  radiusDeg: number;
  level: WeatherPressureLevel;
  drift: "nw" | "ne" | "sw" | "se";
}

export interface WeatherForecastBand {
  id: string;
  points: [number, number][];
  widthDeg: number;
  level: WeatherPressureLevel;
  drift: WeatherCell["drift"];
  kind: "front" | "rain" | "wind";
}

export interface WeatherCorridor {
  callsign: string;
  from: [number, number];
  to: [number, number];
  pressureLevel: WeatherPressureLevel;
  riskDeltaPct: number;
  segments: WeatherCorridorSegment[];
}

export interface WeatherCorridorSegment {
  id: string;
  from: [number, number];
  to: [number, number];
  level: WeatherPressureLevel;
}

export interface MarketOddsSignal {
  subjectLabel: string;
  marketProbability: number;
  modelProbability: number;
  marketOdds: number;
  spread: number;
  spreadLabel: string;
  insight: string;
  divergence: MarketDivergence;
}

export interface MarketDivergence {
  valuePp: number;
  direction: "market" | "model" | "aligned";
  label: string;
  tone: WeatherPressureLevel;
}

export interface WeatherContribution {
  subjectLabel: string;
  pressureLevel: WeatherPressureLevel;
  contributionPp: number;
  riskDeltaPct: number;
  explanation: string;
}

export interface RiskWatchlistItem {
  id: string;
  callsign: string;
  probability: number;
  odds: number;
  direction: "up" | "down" | "flat";
  pressureLevel: WeatherPressureLevel;
  pressureLabel: string;
}

export interface RiskSignalMetadata {
  source: "simulated";
  sourceLabel: string;
  modelVersion: string;
  forecastWindowMinutes: number;
  forecastWindowStartedAt: string;
  confidence: number;
  confidenceLabel: string;
}

export interface TowerRiskSignal {
  metadata: RiskSignalMetadata;
  weatherCells: WeatherCell[];
  weatherBands: WeatherForecastBand[];
  corridor: WeatherCorridor | null;
  market: MarketOddsSignal;
  weatherContribution: WeatherContribution;
  watchlist: RiskWatchlistItem[];
}

export interface TowerRiskSignalOptions {
  now?: number;
}

const OVERVIEW_SUBJECT = "Sky overview";
const GLOBAL_WEATHER_SEED = "rialo-global-weather-v1";
const MODEL_VERSION = "Rialo demo risk v2";
const FORECAST_WINDOW_MINUTES = 15;
const FORECAST_WINDOW_MS = FORECAST_WINDOW_MINUTES * 60 * 1000;

const GLOBAL_WEATHER_REGIONS: Array<{
  id: string;
  longitude: number;
  latitude: number;
  radiusDeg: number;
  level: WeatherPressureLevel;
  drift: WeatherCell["drift"];
}> = [
  {
    id: "north-pacific",
    longitude: -148,
    latitude: 43,
    radiusDeg: 9.8,
    level: "low",
    drift: "ne",
  },
  {
    id: "western-us",
    longitude: -116,
    latitude: 37,
    radiusDeg: 7.6,
    level: "elevated",
    drift: "se",
  },
  {
    id: "gulf-atlantic",
    longitude: -62,
    latitude: 26,
    radiusDeg: 8.4,
    level: "severe",
    drift: "nw",
  },
  {
    id: "north-atlantic",
    longitude: -34,
    latitude: 49,
    radiusDeg: 10.2,
    level: "elevated",
    drift: "ne",
  },
  {
    id: "western-europe",
    longitude: 8,
    latitude: 50,
    radiusDeg: 7.4,
    level: "low",
    drift: "sw",
  },
  {
    id: "west-africa",
    longitude: 2,
    latitude: 8,
    radiusDeg: 9.6,
    level: "elevated",
    drift: "se",
  },
  {
    id: "south-atlantic",
    longitude: -24,
    latitude: -28,
    radiusDeg: 8.2,
    level: "low",
    drift: "ne",
  },
  {
    id: "indian-ocean",
    longitude: 62,
    latitude: -12,
    radiusDeg: 9.2,
    level: "elevated",
    drift: "sw",
  },
  {
    id: "south-asia",
    longitude: 78,
    latitude: 22,
    radiusDeg: 8.8,
    level: "severe",
    drift: "sw",
  },
  {
    id: "east-asia",
    longitude: 124,
    latitude: 36,
    radiusDeg: 7.8,
    level: "elevated",
    drift: "nw",
  },
  {
    id: "australia",
    longitude: 144,
    latitude: -28,
    radiusDeg: 8.6,
    level: "low",
    drift: "se",
  },
  {
    id: "south-pacific",
    longitude: 166,
    latitude: -18,
    radiusDeg: 10.4,
    level: "elevated",
    drift: "ne",
  },
];

const GLOBAL_FORECAST_BANDS: WeatherForecastBand[] = [
  {
    id: "forecast-band-north-atlantic-front",
    points: [
      [-158, 49],
      [-96, 42],
      [-34, 50],
      [34, 45],
    ],
    widthDeg: 8.6,
    level: "elevated",
    drift: "ne",
    kind: "front",
  },
  {
    id: "forecast-band-equatorial-rain",
    points: [
      [-92, 9],
      [-26, 5],
      [46, 8],
      [120, 12],
    ],
    widthDeg: 10.2,
    level: "low",
    drift: "se",
    kind: "rain",
  },
  {
    id: "forecast-band-asia-pacific-severe",
    points: [
      [66, 24],
      [102, 18],
      [150, 30],
    ],
    widthDeg: 9.4,
    level: "severe",
    drift: "sw",
    kind: "wind",
  },
  {
    id: "forecast-band-southern-ocean-front",
    points: [
      [-150, -42],
      [-72, -38],
      [12, -43],
      [112, -36],
    ],
    widthDeg: 7.8,
    level: "elevated",
    drift: "ne",
    kind: "front",
  },
];

export function buildTowerRiskSignal(
  flights: FlightPublic[],
  activeSubject?: TowerRiskSubject | null,
  options: TowerRiskSignalOptions = {},
): TowerRiskSignal {
  const forecastWindowStartedAtMs = forecastWindowStartMs(options.now ?? Date.now());
  const forecastSeed = `${GLOBAL_WEATHER_SEED}:${forecastWindowStartedAtMs}`;
  const subjectFlight = findSubjectFlight(flights, activeSubject);
  const anchor = resolveAnchor(flights, activeSubject, subjectFlight);
  const subjectLabel = normalizeCallsign(
    activeSubject?.callsign ?? subjectFlight?.callsign ?? "",
  );
  const displayLabel = subjectLabel || OVERVIEW_SUBJECT;
  const subjectSeed = `${displayLabel}:${anchor.longitude.toFixed(3)}:${anchor.latitude.toFixed(3)}`;
  const weatherCells = buildWeatherCells(forecastSeed);
  const weatherBands = buildWeatherBands(forecastSeed);
  const pressureLevel = pressureForSubject(weatherCells, weatherBands, anchor);
  const corridor =
    subjectLabel && anchor.hasCoordinates
      ? buildCorridor(
          subjectSeed,
          subjectLabel,
          anchor,
          subjectFlight,
          pressureLevel,
          weatherCells,
          weatherBands,
        )
      : null;
  const market = buildMarketSignal(
    subjectSeed,
    displayLabel,
    subjectFlight,
    flights,
    pressureLevel,
  );
  const weatherContribution = buildWeatherContribution(
    displayLabel,
    pressureLevel,
    corridor,
  );
  const watchlist = buildWatchlist(
    flights,
    forecastSeed,
    weatherCells,
    weatherBands,
  );

  return {
    metadata: buildMetadata(forecastWindowStartedAtMs),
    weatherCells,
    weatherBands,
    corridor,
    market,
    weatherContribution,
    watchlist,
  };
}

function buildMetadata(forecastWindowStartedAtMs: number): RiskSignalMetadata {
  return {
    source: "simulated",
    sourceLabel: "Simulated signal",
    modelVersion: MODEL_VERSION,
    forecastWindowMinutes: FORECAST_WINDOW_MINUTES,
    forecastWindowStartedAt: new Date(forecastWindowStartedAtMs).toISOString(),
    confidence: 0.72,
    confidenceLabel: "Medium confidence",
  };
}

function buildWeatherCells(forecastSeed: string): WeatherCell[] {
  return GLOBAL_WEATHER_REGIONS.map((region) => {
    const seed = `${forecastSeed}:cell:${region.id}`;
    const longitudeJitter = (seededUnit(`${seed}:longitude`) - 0.5) * 4.8;
    const latitudeJitter = (seededUnit(`${seed}:latitude`) - 0.5) * 3.4;
    const radiusJitter = (seededUnit(`${seed}:radius`) - 0.5) * 1.4;
    return {
      id: `weather-${region.id}`,
      longitude: clampLongitude(region.longitude + longitudeJitter),
      latitude: round(clamp(region.latitude + latitudeJitter, -70, 70), 3),
      radiusDeg: round(region.radiusDeg + radiusJitter, 2),
      level: region.level,
      drift: region.drift,
    };
  });
}

function buildWeatherBands(forecastSeed: string): WeatherForecastBand[] {
  return GLOBAL_FORECAST_BANDS.map((band) => ({
    ...band,
    widthDeg: round(
      band.widthDeg + (seededUnit(`${forecastSeed}:band:${band.id}:width`) - 0.5) * 1.1,
      2,
    ),
    points: band.points.map(([longitude, latitude], index) => {
      const pointSeed = `${forecastSeed}:band:${band.id}:point:${index}`;
      const longitudeJitter = (seededUnit(`${pointSeed}:longitude`) - 0.5) * 3.2;
      const latitudeJitter = (seededUnit(`${pointSeed}:latitude`) - 0.5) * 2.4;
      return [
        round(clampLongitude(longitude + longitudeJitter), 3),
        round(clamp(latitude + latitudeJitter, -80, 80), 3),
      ];
    }),
  }));
}

function buildCorridor(
  seed: string,
  callsign: string,
  anchor: { longitude: number; latitude: number },
  flight: FlightPublic | null,
  pressureLevel: WeatherPressureLevel,
  weatherCells: WeatherCell[],
  weatherBands: WeatherForecastBand[],
): WeatherCorridor {
  const heading =
    typeof flight?.heading === "number" && Number.isFinite(flight.heading)
      ? flight.heading
      : seededUnit(`${seed}:heading`) * 360;
  const radians = (heading * Math.PI) / 180;
  const length = 4.8 + seededUnit(`${seed}:corridor:length`) * 3.6;
  const dx = Math.sin(radians) * length;
  const dy = Math.cos(radians) * length;
  const riskBase = pressureLevel === "severe" ? 24 : pressureLevel === "elevated" ? 15 : 8;
  const from: [number, number] = [
    round(clampLongitude(anchor.longitude - dx), 3),
    round(clamp(anchor.latitude - dy, -80, 80), 3),
  ];
  const to: [number, number] = [
    round(clampLongitude(anchor.longitude + dx), 3),
    round(clamp(anchor.latitude + dy, -80, 80), 3),
  ];
  return {
    callsign,
    from,
    to,
    pressureLevel,
    riskDeltaPct: round(riskBase + seededUnit(`${seed}:risk-delta`) * 9, 1),
    segments: buildCorridorSegments(callsign, from, to, weatherCells, weatherBands),
  };
}

function buildCorridorSegments(
  callsign: string,
  from: [number, number],
  to: [number, number],
  weatherCells: WeatherCell[],
  weatherBands: WeatherForecastBand[],
): WeatherCorridorSegment[] {
  const segmentCount = 3;
  return Array.from({ length: segmentCount }, (_, index) => {
    const segmentFrom = interpolateCoordinate(from, to, index / segmentCount);
    const segmentTo = interpolateCoordinate(from, to, (index + 1) / segmentCount);
    const midpoint = interpolateCoordinate(from, to, (index + 0.5) / segmentCount);
    const level = pressureForSubject(weatherCells, weatherBands, {
      longitude: midpoint[0],
      latitude: midpoint[1],
    });
    return {
      id: `${callsign}-corridor-${index}`,
      from: segmentFrom,
      to: segmentTo,
      level,
    };
  });
}

function buildMarketSignal(
  seed: string,
  subjectLabel: string,
  subjectFlight: FlightPublic | null,
  flights: FlightPublic[],
  pressureLevel: WeatherPressureLevel,
): MarketOddsSignal {
  const delayRate =
    finiteNumber(subjectFlight?.delay_rate) ?? averageDelayRate(flights);
  const fallbackModel = 0.18 + seededUnit(`${seed}:model`) * 0.3;
  const pressureBump =
    pressureLevel === "severe" ? 0.1 : pressureLevel === "elevated" ? 0.055 : 0.02;
  const modelProbability = roundProbability(
    clamp(delayRate ?? fallbackModel, 0.03, 0.82) + pressureBump,
  );
  const seededSpread = (seededUnit(`${seed}:market-spread`) - 0.48) * 0.18;
  const marketProbability = roundProbability(
    clamp(modelProbability + seededSpread, 0.03, 0.92),
  );
  const spread = roundSignedProbabilitySpread(
    marketProbability - modelProbability,
  );
  const spreadLabel = labelSpread(spread);

  return {
    subjectLabel,
    marketProbability,
    modelProbability,
    marketOdds: round(1 / Math.max(0.03, marketProbability), 1),
    spread,
    spreadLabel,
    divergence: buildDivergence(spread, spreadLabel),
    insight: `${subjectLabel} ${insightForSpread(spread)}; weather and market stay signal-only.`,
  };
}

function buildDivergence(spread: number, spreadLabel: string): MarketDivergence {
  const absoluteSpread = Math.abs(spread);
  const direction =
    spread > 0.04 ? "market" : spread < -0.04 ? "model" : "aligned";
  const tone =
    absoluteSpread >= 0.08 ? "severe" : absoluteSpread >= 0.04 ? "elevated" : "low";

  return {
    valuePp: round(spread * 100, 1),
    direction,
    label: spreadLabel,
    tone,
  };
}

function buildWeatherContribution(
  subjectLabel: string,
  pressureLevel: WeatherPressureLevel,
  corridor: WeatherCorridor | null,
): WeatherContribution {
  const contributionPp = pressureContributionPp(pressureLevel);
  const riskDeltaPct = round(corridor?.riskDeltaPct ?? contributionPp, 1);
  const pressureLabel = formatPressureLabel(pressureLevel);

  return {
    subjectLabel,
    pressureLevel,
    contributionPp,
    riskDeltaPct,
    explanation: `${subjectLabel} ${pressureLabel.toLowerCase()} weather pressure adds +${contributionPp.toFixed(
      1,
    )}pp corridor model risk; signal-only context.`,
  };
}

function buildWatchlist(
  flights: FlightPublic[],
  forecastSeed: string,
  weatherCells: WeatherCell[],
  weatherBands: WeatherForecastBand[],
): RiskWatchlistItem[] {
  return flights
    .map((flight, index) => {
      const callsign = normalizeCallsign(flight.callsign);
      if (!callsign) return null;
      const longitude = finiteNumber(flight.longitude);
      const latitude = finiteNumber(flight.latitude);
      const pressureLevel =
        longitude !== null && latitude !== null
          ? pressureForSubject(weatherCells, weatherBands, { longitude, latitude })
          : "low";
      const delayRate =
        typeof flight.delay_rate === "number" && Number.isFinite(flight.delay_rate)
          ? flight.delay_rate
          : 0.18 + seededUnit(`${forecastSeed}:watchlist:${callsign}:delay`) * 0.24;
      const modelProbability = roundProbability(
        clamp(delayRate + pressureContributionPp(pressureLevel) / 100, 0.03, 0.86),
      );
      const marketSkew =
        (seededUnit(`${forecastSeed}:watchlist:${callsign}:market`) - 0.48) * 0.12;
      const probability = roundProbability(
        clamp(modelProbability + marketSkew, 0.03, 0.92),
      );
      const spread = probability - modelProbability;

      return {
        id: `${callsign}-${index}`,
        callsign,
        probability,
        odds: round(1 / Math.max(0.03, probability), 1),
        direction: watchlistDirection(spread),
        pressureLevel,
        pressureLabel: `${formatPressureLabel(pressureLevel)} pressure`,
      };
    })
    .filter((item): item is RiskWatchlistItem => item !== null)
    .slice(0, 4);
}

function findSubjectFlight(
  flights: FlightPublic[],
  activeSubject?: TowerRiskSubject | null,
): FlightPublic | null {
  const subjectCallsign = normalizeCallsign(activeSubject?.callsign ?? "");
  if (subjectCallsign) {
    const byCallsign = flights.find(
      (flight) => normalizeCallsign(flight.callsign) === subjectCallsign,
    );
    if (byCallsign) return byCallsign;
  }

  const subjectFlightId = normalizeCallsign(activeSubject?.flightId ?? "");
  if (!subjectFlightId) return null;
  return (
    flights.find((flight) =>
      subjectFlightId.startsWith(normalizeCallsign(flight.callsign)),
    ) ?? null
  );
}

function resolveAnchor(
  flights: FlightPublic[],
  activeSubject: TowerRiskSubject | null | undefined,
  subjectFlight: FlightPublic | null,
) {
  const subjectLongitude = finiteNumber(activeSubject?.longitude);
  const subjectLatitude = finiteNumber(activeSubject?.latitude);
  if (subjectLongitude !== null && subjectLatitude !== null) {
    return {
      longitude: subjectLongitude,
      latitude: subjectLatitude,
      hasCoordinates: true,
    };
  }

  const flightLongitude = finiteNumber(subjectFlight?.longitude);
  const flightLatitude = finiteNumber(subjectFlight?.latitude);
  if (flightLongitude !== null && flightLatitude !== null) {
    return {
      longitude: flightLongitude,
      latitude: flightLatitude,
      hasCoordinates: true,
    };
  }

  const positioned = flights.filter(
    (flight) =>
      finiteNumber(flight.longitude) !== null &&
      finiteNumber(flight.latitude) !== null,
  );
  if (positioned.length > 0) {
    return {
      longitude: round(
        positioned.reduce((sum, flight) => sum + (flight.longitude ?? 0), 0) /
          positioned.length,
        3,
      ),
      latitude: round(
        positioned.reduce((sum, flight) => sum + (flight.latitude ?? 0), 0) /
          positioned.length,
        3,
      ),
      hasCoordinates: false,
    };
  }

  return {
    longitude: 0,
    latitude: 28,
    hasCoordinates: false,
  };
}

function pressureForSubject(
  cells: WeatherCell[],
  bands: WeatherForecastBand[],
  anchor: { longitude: number; latitude: number },
): WeatherPressureLevel {
  const candidates = [
    ...cells.map((cell) => ({
      level: cell.level,
      score: coordinateDistance(anchor, cell) - cell.radiusDeg,
    })),
    ...bands.map((band) => ({
      level: band.level,
      score: distanceToBand(anchor, band) - band.widthDeg,
    })),
  ].sort(
    (left, right) =>
      left.score - right.score ||
      pressureRank(right.level) - pressureRank(left.level),
  );
  return candidates[0]?.level ?? "low";
}

function averageDelayRate(flights: FlightPublic[]) {
  const rates = flights
    .map((flight) => flight.delay_rate)
    .filter((rate): rate is number => typeof rate === "number" && Number.isFinite(rate));
  if (rates.length === 0) return null;
  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
}

function labelSpread(spread: number) {
  if (spread > 0.04) return "Market more bearish";
  if (spread < -0.04) return "Model more cautious";
  return "Market aligned";
}

function insightForSpread(spread: number) {
  if (spread > 0.04) return "trades richer than the Rialo model";
  if (spread < -0.04) return "model risk runs ahead of market pricing";
  return "market and model are broadly aligned";
}

function normalizeCallsign(callsign: string) {
  return callsign.trim().toUpperCase();
}

function pressureContributionPp(level: WeatherPressureLevel) {
  if (level === "severe") return 10;
  if (level === "elevated") return 5.5;
  return 2;
}

function formatPressureLabel(level: WeatherPressureLevel) {
  if (level === "severe") return "Severe";
  if (level === "elevated") return "Elevated";
  return "Low";
}

function watchlistDirection(spread: number): RiskWatchlistItem["direction"] {
  if (spread > 0.025) return "up";
  if (spread < -0.025) return "down";
  return "flat";
}

function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function seededUnit(seed: string) {
  return stableHash(seed) / 0xffffffff;
}

function forecastWindowStartMs(now: number) {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  return Math.floor(safeNow / FORECAST_WINDOW_MS) * FORECAST_WINDOW_MS;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function roundProbability(value: number) {
  return round(clamp(value, 0, 1), 3);
}

function roundSignedProbabilitySpread(value: number) {
  return round(clamp(value, -1, 1), 3);
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function interpolateCoordinate(
  from: [number, number],
  to: [number, number],
  t: number,
): [number, number] {
  return [
    round(clampLongitude(from[0] + (to[0] - from[0]) * t), 3),
    round(from[1] + (to[1] - from[1]) * t, 3),
  ];
}

function distanceToBand(
  anchor: { longitude: number; latitude: number },
  band: WeatherForecastBand,
) {
  const distances = band.points.slice(0, -1).map((point, index) =>
    distanceToSegment(anchor, point, band.points[index + 1]),
  );
  return Math.min(...distances);
}

function distanceToSegment(
  anchor: { longitude: number; latitude: number },
  from: [number, number],
  to: [number, number],
) {
  const ax = longitudeDelta(anchor.longitude, from[0]);
  const ay = anchor.latitude - from[1];
  const bx = longitudeDelta(to[0], from[0]);
  const by = to[1] - from[1];
  const lengthSquared = bx * bx + by * by;
  if (lengthSquared === 0) return Math.hypot(ax, ay);
  const t = clamp((ax * bx + ay * by) / lengthSquared, 0, 1);
  return Math.hypot(ax - bx * t, ay - by * t);
}

function coordinateDistance(
  left: { longitude: number; latitude: number },
  right: { longitude: number; latitude: number },
) {
  return Math.hypot(
    longitudeDelta(left.longitude, right.longitude),
    left.latitude - right.latitude,
  );
}

function longitudeDelta(left: number, right: number) {
  let delta = left - right;
  while (delta < -180) delta += 360;
  while (delta > 180) delta -= 360;
  return delta;
}

function pressureRank(level: WeatherPressureLevel) {
  if (level === "severe") return 3;
  if (level === "elevated") return 2;
  return 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampLongitude(longitude: number) {
  if (!Number.isFinite(longitude)) return 0;
  let normalized = longitude;
  while (normalized < -180) normalized += 360;
  while (normalized > 180) normalized -= 360;
  return round(normalized, 3);
}
