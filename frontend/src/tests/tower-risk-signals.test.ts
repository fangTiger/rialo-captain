import { describe, expect, it } from "vitest";
import {
  buildTowerRiskSignal,
  type MarketOddsSignal,
  type TowerRiskSubject,
  type WeatherCell,
  type WeatherForecastBand,
} from "../components/tower/riskSignals";
import type { FlightPublic } from "../hooks/useFlights";

const FORECAST_START = Date.parse("2026-07-03T07:00:00.000Z");
const NEXT_FORECAST_WINDOW = FORECAST_START + 16 * 60 * 1000;

const flights: FlightPublic[] = [
  {
    icao24: "a1b2c3",
    callsign: "BA178",
    origin_country: "United Kingdom",
    longitude: -73.78,
    latitude: 40.64,
    velocity: 240,
    heading: 90,
    on_ground: false,
    delay_rate: 0.31,
  },
  {
    icao24: "ua200x",
    callsign: "UA200",
    origin_country: "United States",
    longitude: -0.46,
    latitude: 51.47,
    velocity: 220,
    heading: 270,
    on_ground: false,
    delay_rate: 0.18,
  },
];

const activeSubject: TowerRiskSubject = {
  flightId: "BA178-20260702",
  callsign: "BA178",
  longitude: -73.78,
  latitude: 40.64,
};

const alternateSubject: TowerRiskSubject = {
  flightId: "UA200-20260702",
  callsign: "UA200",
  longitude: -0.46,
  latitude: 51.47,
};

function weatherCellSnapshot(cells: WeatherCell[]) {
  return cells.map((cell) => ({
    id: cell.id,
    longitude: cell.longitude,
    latitude: cell.latitude,
    radiusDeg: cell.radiusDeg,
    level: cell.level,
  }));
}

function weatherBandSnapshot(bands: WeatherForecastBand[]) {
  return bands.map((band) => ({
    id: band.id,
    points: band.points,
    widthDeg: band.widthDeg,
    level: band.level,
    kind: band.kind,
  }));
}

function expectGlobalWeatherCoverage(cells: WeatherCell[]) {
  expect(cells.some((cell) => cell.longitude < -30)).toBe(true);
  expect(
    cells.some(
      (cell) =>
        cell.longitude >= -30 &&
        cell.longitude <= 60 &&
        cell.latitude >= -40 &&
        cell.latitude <= 65,
    ),
  ).toBe(true);
  expect(cells.some((cell) => cell.longitude > 60 || cell.longitude < -150)).toBe(
    true,
  );
  expect(
    cells.some((cell) => Math.abs(cell.longitude - activeSubject.longitude!) > 90),
  ).toBe(true);
}

function expectFiniteCell(cell: WeatherCell) {
  expect(Number.isFinite(cell.longitude)).toBe(true);
  expect(Number.isFinite(cell.latitude)).toBe(true);
  expect(Number.isFinite(cell.radiusDeg)).toBe(true);
  expect(cell.radiusDeg).toBeGreaterThan(0);
}

function expectFiniteMarket(market: MarketOddsSignal) {
  expect(Number.isFinite(market.marketProbability)).toBe(true);
  expect(market.marketProbability).toBeGreaterThanOrEqual(0);
  expect(market.marketProbability).toBeLessThanOrEqual(1);
  expect(Number.isFinite(market.modelProbability)).toBe(true);
  expect(market.modelProbability).toBeGreaterThanOrEqual(0);
  expect(market.modelProbability).toBeLessThanOrEqual(1);
  expect(Number.isFinite(market.marketOdds)).toBe(true);
  expect(market.marketOdds).toBeGreaterThan(0);
  expect(Number.isFinite(market.spread)).toBe(true);
  expect(Number.isFinite(market.divergence.valuePp)).toBe(true);
}

function buildSignal(
  activeSubject?: TowerRiskSubject | null,
  now = FORECAST_START,
) {
  return (
    buildTowerRiskSignal as (
      sourceFlights: FlightPublic[],
      subject?: TowerRiskSubject | null,
      options?: { now?: number },
    ) => ReturnType<typeof buildTowerRiskSignal>
  )(flights, activeSubject, { now });
}

describe("buildTowerRiskSignal", () => {
  it("returns stable weather and market signals for the same active flight", () => {
    const first = buildSignal(activeSubject);
    const second = buildSignal(activeSubject);

    expect(second).toEqual(first);
    expect(first.weatherCells.length).toBeGreaterThanOrEqual(10);
    expect(first.weatherCells.length).toBeLessThanOrEqual(14);
    expect(first.weatherCells.map((cell) => cell.id)).toEqual(
      Array.from(new Set(first.weatherCells.map((cell) => cell.id))),
    );
  });

  it("keeps global weather systems stable when active focus changes", () => {
    const baSignal = buildSignal(activeSubject);
    const uaSignal = buildSignal(alternateSubject);

    expect(weatherCellSnapshot(uaSignal.weatherCells)).toEqual(
      weatherCellSnapshot(baSignal.weatherCells),
    );
    expect(weatherBandSnapshot(uaSignal.weatherBands)).toEqual(
      weatherBandSnapshot(baSignal.weatherBands),
    );
  });

  it("returns low, elevated, and severe weather cells with finite geography", () => {
    const signal = buildSignal(activeSubject);
    const levels = signal.weatherCells.map((cell) => cell.level);

    expect(levels).toEqual(
      expect.arrayContaining(["low", "elevated", "severe"]),
    );
    signal.weatherCells.forEach(expectFiniteCell);
  });

  it("covers multiple world regions instead of clustering around the active subject", () => {
    const signal = buildSignal(activeSubject);

    expectGlobalWeatherCoverage(signal.weatherCells);
    expect(signal.weatherBands.length).toBeGreaterThanOrEqual(3);
    expect(signal.weatherBands.length).toBeLessThanOrEqual(5);
    expect(signal.weatherBands.map((band) => band.level)).toEqual(
      expect.arrayContaining(["low", "elevated", "severe"]),
    );
    expect(
      signal.weatherBands.some((band) =>
        band.points.some(([longitude]) => longitude < -30),
      ),
    ).toBe(true);
    expect(
      signal.weatherBands.some((band) =>
        band.points.some(([, latitude]) => latitude < 0),
      ),
    ).toBe(true);
    expect(
      signal.weatherBands.some((band) =>
        band.points.some(([longitude]) => longitude > 60),
      ),
    ).toBe(true);
  });

  it("builds a weather corridor for the selected or protagonist subject", () => {
    const signal = buildSignal({
      callsign: "BA178",
      flightId: "BA178-20260702",
    });

    expect(signal.corridor).toMatchObject({
      callsign: "BA178",
      pressureLevel: expect.stringMatching(/low|elevated|severe/),
    });
    expect(signal.corridor?.from).toHaveLength(2);
    expect(signal.corridor?.to).toHaveLength(2);
    expect(signal.corridor?.from).not.toEqual(signal.corridor?.to);
    expect(Number.isFinite(signal.corridor?.riskDeltaPct)).toBe(true);
  });

  it("derives active weather corridor segment levels from nearby pressure fields", () => {
    const signal = buildSignal(activeSubject);

    expect(signal.corridor?.segments).toHaveLength(3);
    expect(signal.corridor?.segments.map((segment) => segment.level)).not.toEqual([
      "low",
      "elevated",
      "severe",
    ]);
    signal.corridor?.segments.forEach((segment) => {
      expect(segment.id).toContain("BA178");
      expect(segment.from).toHaveLength(2);
      expect(segment.to).toHaveLength(2);
      expect(segment.from).not.toEqual(segment.to);
      expect(segment.level).toMatch(/low|elevated|severe/);
    });
  });

  it("updates only corridor subject geometry when active focus changes", () => {
    const baSignal = buildSignal(activeSubject);
    const uaSignal = buildSignal(alternateSubject);

    expect(baSignal.corridor?.callsign).toBe("BA178");
    expect(uaSignal.corridor?.callsign).toBe("UA200");
    expect(uaSignal.corridor?.from).not.toEqual(baSignal.corridor?.from);
    expect(uaSignal.corridor?.to).not.toEqual(baSignal.corridor?.to);
    expect(uaSignal.corridor?.segments.map((segment) => segment.id)).toEqual([
      "UA200-corridor-0",
      "UA200-corridor-1",
      "UA200-corridor-2",
    ]);
  });

  it("returns read-only prediction market odds for the active subject", () => {
    const signal = buildSignal(activeSubject);

    expect(signal.market.subjectLabel).toBe("BA178");
    expect(signal.market.spreadLabel).toMatch(
      /Market more bearish|Model more cautious|Market aligned/,
    );
    expect(signal.market.insight).toContain("BA178");
    expectFiniteMarket(signal.market);
  });

  it("falls back to finite active-subject market odds when delay rate is not finite", () => {
    const badDelayFlight: FlightPublic = {
      ...flights[0],
      delay_rate: Number.NaN,
    };
    const signal = buildTowerRiskSignal([badDelayFlight], activeSubject, {
      now: FORECAST_START,
    });

    expect(signal.market.subjectLabel).toBe("BA178");
    expectFiniteMarket(signal.market);
  });

  it("preserves signed model-cautious spread when market probability prices below the model", () => {
    const cautiousFlight: FlightPublic = {
      ...flights[0],
      icao24: "neg0006",
      callsign: "NEG6",
      delay_rate: 0.31,
    };
    const signal = buildTowerRiskSignal(
      [cautiousFlight],
      {
        callsign: "NEG6",
        flightId: "NEG6-20260702",
        longitude: cautiousFlight.longitude,
        latitude: cautiousFlight.latitude,
      },
      { now: FORECAST_START },
    );

    expect(signal.market.marketProbability).toBeLessThan(
      signal.market.modelProbability,
    );
    expect(signal.market.spread).toBeLessThan(-0.04);
    expect(signal.market.spreadLabel).toBe("Model more cautious");
    expect(signal.market.divergence.direction).toBe("model");
    expect(signal.market.divergence.valuePp).toBeLessThan(0);
    expectFiniteMarket(signal.market);
  });

  it("derives deterministic weather contribution, divergence, and watchlist signals", () => {
    const signal = buildSignal(activeSubject);
    const repeated = buildSignal(activeSubject);

    expect(signal.weatherContribution).toMatchObject({
      subjectLabel: "BA178",
      pressureLevel: expect.stringMatching(/low|elevated|severe/),
    });
    expect(signal.weatherContribution.explanation).toContain("BA178");
    expect(signal.weatherContribution.explanation).toMatch(
      /weather|pressure|corridor/i,
    );
    expect(Number.isFinite(signal.weatherContribution.contributionPp)).toBe(true);
    expect(Number.isFinite(signal.weatherContribution.riskDeltaPct)).toBe(true);
    expect(signal.weatherContribution).toEqual(repeated.weatherContribution);

    expect(signal.market.divergence).toMatchObject({
      label: expect.stringMatching(
        /Market more bearish|Model more cautious|Market aligned/,
      ),
      direction: expect.stringMatching(/market|model|aligned/),
    });
    expect(Number.isFinite(signal.market.divergence.valuePp)).toBe(true);

    expect(signal.watchlist).toHaveLength(2);
    expect(signal.watchlist.map((item) => item.callsign)).toEqual([
      "BA178",
      "UA200",
    ]);
    signal.watchlist.forEach((item) => {
      expect(Number.isFinite(item.probability)).toBe(true);
      expect(item.probability).toBeGreaterThanOrEqual(0);
      expect(item.probability).toBeLessThanOrEqual(1);
      expect(Number.isFinite(item.odds)).toBe(true);
      expect(item.odds).toBeGreaterThan(0);
      expect(item.direction).toMatch(/up|down|flat/);
      expect(item.pressureLabel).toMatch(/low|elevated|severe/i);
    });
    expect(signal.watchlist).toEqual(repeated.watchlist);
  });

  it("labels deterministic MVP data with simulated provenance metadata", () => {
    const signal = buildSignal(activeSubject) as ReturnType<
      typeof buildTowerRiskSignal
    > & {
      metadata?: {
        source: string;
        sourceLabel: string;
        modelVersion: string;
        forecastWindowMinutes: number;
        forecastWindowStartedAt: string;
        confidence: number;
        confidenceLabel: string;
      };
    };

    expect(signal.metadata).toMatchObject({
      source: "simulated",
      sourceLabel: "Simulated signal",
      modelVersion: "Rialo demo risk v2",
      forecastWindowMinutes: 15,
      confidenceLabel: "Medium confidence",
    });
    expect(signal.metadata?.forecastWindowStartedAt).toBe(
      "2026-07-03T07:00:00.000Z",
    );
    expect(signal.metadata?.confidence).toBeGreaterThan(0);
    expect(signal.metadata?.confidence).toBeLessThanOrEqual(1);
  });

  it("keeps weather stable inside a forecast window and drifts after the window advances", () => {
    const first = buildSignal(activeSubject, FORECAST_START);
    const sameWindow = buildSignal(alternateSubject, FORECAST_START + 4 * 60 * 1000);
    const nextWindow = buildSignal(activeSubject, NEXT_FORECAST_WINDOW);

    expect(weatherCellSnapshot(sameWindow.weatherCells)).toEqual(
      weatherCellSnapshot(first.weatherCells),
    );
    expect(weatherBandSnapshot(sameWindow.weatherBands)).toEqual(
      weatherBandSnapshot(first.weatherBands),
    );
    expect(weatherCellSnapshot(nextWindow.weatherCells)).not.toEqual(
      weatherCellSnapshot(first.weatherCells),
    );
  });

  it("updates the market subject when active focus changes", () => {
    const baSignal = buildSignal(activeSubject);
    const uaSignal = buildSignal(alternateSubject);

    expect(baSignal.market.subjectLabel).toBe("BA178");
    expect(uaSignal.market.subjectLabel).toBe("UA200");
    expect(uaSignal.market.insight).toContain("UA200");
  });

  it("returns an overview signal for an empty sky without throwing", () => {
    const signal = (
      buildTowerRiskSignal as (
        sourceFlights: FlightPublic[],
        subject?: TowerRiskSubject | null,
        options?: { now?: number },
      ) => ReturnType<typeof buildTowerRiskSignal>
    )([], null, { now: FORECAST_START });

    expect(signal.corridor).toBeNull();
    expect(signal.weatherCells.length).toBeGreaterThanOrEqual(10);
    expect(signal.weatherBands.length).toBeGreaterThanOrEqual(3);
    expect(signal.market.subjectLabel).toBe("Sky overview");
    expect(signal.market.insight).toContain("Sky overview");
    expect(signal.weatherContribution.explanation).toContain("Sky overview");
    expect(Array.isArray(signal.watchlist)).toBe(true);
    expect(signal.market.divergence.label).toMatch(
      /Market more bearish|Model more cautious|Market aligned/,
    );
    expectFiniteMarket(signal.market);
  });
});
