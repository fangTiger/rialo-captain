import { useId, useState, type CSSProperties } from "react";
import {
  CommandPanel,
  DivergenceMeter,
  MetricDeck,
  RiskTicker,
  SignalPill,
  type CommandMetric,
  type CommandTone,
  type RiskTickerItem,
} from "../../design/commandCenter";
import type { TowerRiskSignal } from "./riskSignals";
import "./RiskIntelligencePanel.css";

interface RiskIntelligencePanelProps {
  signal: TowerRiskSignal;
  weatherLayerVisible: boolean;
  onWeatherLayerVisibleChange: (visible: boolean) => void;
  viewportMaxHeight?: string;
}

const panelViewportStyle: CSSProperties = {
  maxHeight: "min(28rem, calc(100dvh - var(--top-nav-height, 64px) - 72px))",
  overflowX: "hidden",
  overflowY: "hidden",
};

const summaryViewportStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  overflow: "visible",
};

const detailsScrollViewportStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: "min(12rem, calc(100dvh - var(--top-nav-height, 64px) - 272px))",
  minHeight: 0,
  overflowY: "auto",
  overscrollBehavior: "contain",
  paddingRight: 4,
  scrollbarGutter: "stable",
};

const weatherDetailsScrollViewportStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: "min(11rem, calc(100dvh - var(--top-nav-height, 64px) - 300px))",
  minHeight: 0,
  overflowY: "auto",
  overscrollBehavior: "contain",
  paddingRight: 4,
  scrollbarGutter: "stable",
};

export function RiskIntelligencePanel({
  signal,
  weatherLayerVisible,
  onWeatherLayerVisibleChange,
  viewportMaxHeight,
}: RiskIntelligencePanelProps) {
  const reactDetailsId = useId();
  const reactWeatherDetailsId = useId();
  const reactPanelBodyId = useId();
  const detailsId = `risk-intelligence-details-${reactDetailsId.replace(/:/g, "")}`;
  const weatherDetailsId = `risk-intelligence-weather-details-${reactWeatherDetailsId.replace(/:/g, "")}`;
  const panelBodyId = `risk-intelligence-body-${reactPanelBodyId.replace(/:/g, "")}`;
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [weatherDetailsExpanded, setWeatherDetailsExpanded] = useState(false);
  const market = signal.market;
  const metadata = signal.metadata;
  const weatherContribution = signal.weatherContribution;
  const detailToggleLabel = detailsExpanded ? "HIDE" : "DETAILS";
  const watchlistItems = signal.watchlist.map(toRiskTickerItem);
  const weatherWatchlistItems: RiskTickerItem[] = signal.watchlist
    .filter((item) => item.pressureLevel !== "low")
    .map(toRiskTickerItem);
  const displayedWeatherWatchlist =
    weatherWatchlistItems.length > 0 ? weatherWatchlistItems : watchlistItems;
  const weatherDetailsButtonLabel = weatherDetailsExpanded
    ? "Hide weather"
    : "Weather";
  const panelToggleLabel = panelCollapsed
    ? "Expand risk panel"
    : "Collapse risk panel";
  const panelToggleText = panelCollapsed ? "Expand" : "Collapse";
  const handlePanelToggle = () => {
    setPanelCollapsed((collapsed) => {
      const nextCollapsed = !collapsed;
      if (nextCollapsed) {
        setDetailsExpanded(false);
        setWeatherDetailsExpanded(false);
      }
      return nextCollapsed;
    });
  };
  const weatherForecastStartedAt = new Date(
    metadata.forecastWindowStartedAt,
  ).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
  const metrics: CommandMetric[] = [
    {
      id: "market-odds",
      label: "Market odds",
      value: `${market.marketOdds.toFixed(1)}x`,
      detail: "Delay price",
      tone: "elevated",
    },
    {
      id: "market-implied",
      label: "Market implied",
      value: `${formatProbability(market.marketProbability)}%`,
      detail: "Probability priced by market",
      tone: "guarded",
    },
    {
      id: "rialo-model",
      label: "Rialo model",
      value: `${formatProbability(market.modelProbability)}%`,
      detail: "Model delay probability",
      tone: pressureTone(weatherContribution.pressureLevel),
    },
  ];
  const isViewportConstrained = Boolean(viewportMaxHeight);

  return (
    <CommandPanel
      eyebrow="RISK INTELLIGENCE"
      title="MARKET ODDS"
      status={market.subjectLabel}
      className={`risk-intelligence-panel risk-intelligence-panel--simulated${
        isViewportConstrained ? " risk-intelligence-panel__themed-scrollbar" : ""
      }`}
      data-testid="risk-intelligence-panel"
      data-collapsed={panelCollapsed}
      aria-label="Risk intelligence"
      style={{
        ...panelViewportStyle,
        maxHeight: viewportMaxHeight ?? panelViewportStyle.maxHeight,
        overflowY: isViewportConstrained ? "auto" : panelViewportStyle.overflowY,
      }}
    >
      <div className="risk-intelligence-panel__panel-control">
        <button
          type="button"
          aria-controls={panelBodyId}
          aria-expanded={!panelCollapsed}
          aria-label={panelToggleLabel}
          className="risk-intelligence-panel__panel-toggle"
          onClick={handlePanelToggle}
        >
          {panelToggleText}
        </button>
      </div>
      <div
        id={panelBodyId}
        className="risk-intelligence-panel__summary"
        data-testid="risk-intelligence-panel-summary"
        style={summaryViewportStyle}
      >
        {panelCollapsed ? (
          <div
            aria-label="Collapsed risk intelligence summary"
            className="risk-intelligence-panel__collapsed-summary"
            data-testid="risk-intelligence-collapsed-summary"
          >
            <div className="risk-intelligence-panel__collapsed-grid">
              <div className="risk-intelligence-panel__collapsed-metric">
                <span>Subject</span>
                <strong>{market.subjectLabel}</strong>
              </div>
              <div className="risk-intelligence-panel__collapsed-metric">
                <span>Odds</span>
                <strong>{market.marketOdds.toFixed(1)}x</strong>
              </div>
              <div className="risk-intelligence-panel__collapsed-metric">
                <span>Model</span>
                <strong>{formatProbability(market.modelProbability)}%</strong>
              </div>
              <div className="risk-intelligence-panel__collapsed-metric">
                <span>Weather</span>
                <strong>+{weatherContribution.contributionPp.toFixed(1)}pp</strong>
              </div>
            </div>
            <SignalPill tone={pressureTone(weatherContribution.pressureLevel)}>
              {weatherContribution.pressureLevel} pressure
            </SignalPill>
          </div>
        ) : (
          <>
        <div className="risk-intelligence-panel__topline">
          <button
            type="button"
            className="risk-intelligence-panel__switch"
            data-active={weatherLayerVisible}
            role="switch"
            aria-checked={weatherLayerVisible}
            aria-label="Weather risk layer"
            onClick={() => onWeatherLayerVisibleChange(!weatherLayerVisible)}
          >
            <span aria-hidden="true" className="risk-intelligence-panel__switch-dot" />
            Weather risk layer
          </button>
          <SignalPill tone="weather">Signal-only boundary</SignalPill>
        </div>

        <MetricDeck
          ariaLabel="Risk intelligence market metrics"
          className="risk-intelligence-panel__metric-deck"
          metrics={metrics}
        />

        <div className="risk-intelligence-panel__divergence">
          <div className="risk-intelligence-panel__divergence-copy">
            <strong>{market.divergence.label}</strong>
            <span>{formatSignedProbability(market.spread)} pp model-vs-market spread</span>
          </div>
          <DivergenceMeter
            label="Model-vs-market divergence"
            value={market.divergence.valuePp}
            tone={pressureTone(market.divergence.tone)}
          />
        </div>

        <button
          type="button"
          aria-controls={weatherDetailsId}
          aria-expanded={weatherDetailsExpanded}
          aria-label="Weather pressure contribution"
          className="risk-intelligence-panel__weather-contribution"
          onClick={() =>
            setWeatherDetailsExpanded((expanded) => {
              const nextExpanded = !expanded;
              if (nextExpanded) {
                setDetailsExpanded(false);
              }
              return nextExpanded;
            })
          }
        >
          <span className="risk-intelligence-panel__weather-copy">
            <SignalPill tone={pressureTone(weatherContribution.pressureLevel)}>
              {weatherContribution.pressureLevel} pressure
            </SignalPill>
            <strong>
              +{weatherContribution.contributionPp.toFixed(1)}pp weather contribution
            </strong>
            <span>{weatherContribution.subjectLabel} corridor model-risk summary.</span>
          </span>
          <span className="risk-intelligence-panel__weather-action">
            {weatherDetailsButtonLabel}
          </span>
        </button>

        <div
          className="risk-intelligence-panel__weather-details"
          data-testid="risk-intelligence-weather-details"
          hidden={!weatherDetailsExpanded}
          id={weatherDetailsId}
        >
          {weatherDetailsExpanded ? (
            <div
              aria-label="Weather risk details"
              className="risk-intelligence-panel__weather-details-scroll risk-intelligence-panel__themed-scrollbar"
              style={weatherDetailsScrollViewportStyle}
              tabIndex={0}
            >
              <div
                className="risk-intelligence-panel__source"
                aria-label="Weather signal provenance"
              >
                <span>{metadata.sourceLabel}</span>
                <span>{metadata.confidenceLabel}</span>
                <span>{metadata.forecastWindowMinutes}m forecast window</span>
                <span>{weatherForecastStartedAt}</span>
              </div>

              <div className="risk-intelligence-panel__weather-explanation">
                <span>{weatherContribution.explanation}</span>
                <span>
                  Source: {metadata.modelVersion}; confidence{" "}
                  {formatProbability(metadata.confidence)}%.
                </span>
              </div>

              <RiskTicker
                ariaLabel="Weather risk watchlist"
                className="risk-intelligence-panel__watchlist"
                items={displayedWeatherWatchlist}
              />

              <div className="risk-intelligence-panel__insight">
                <span>{market.insight}</span>
                <span className="risk-intelligence-panel__boundary">
                  Weather insight · signal only
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="risk-intelligence-panel__details-control">
          <button
            type="button"
            aria-controls={detailsId}
            aria-expanded={detailsExpanded}
            className="risk-intelligence-panel__detail-toggle"
            onClick={() =>
              setDetailsExpanded((expanded) => {
                const nextExpanded = !expanded;
                if (nextExpanded) {
                  setWeatherDetailsExpanded(false);
                }
                return nextExpanded;
              })
            }
          >
            {detailToggleLabel}
          </button>
        </div>

        <div
          className="risk-intelligence-panel__details"
          data-testid="risk-intelligence-panel-details"
          hidden={!detailsExpanded}
          id={detailsId}
        >
          {detailsExpanded ? (
            <div
              aria-label="Risk intelligence details"
              className="risk-intelligence-panel__details-scroll risk-intelligence-panel__themed-scrollbar"
              data-testid="risk-intelligence-panel-details-scroll"
              style={detailsScrollViewportStyle}
              tabIndex={0}
            >
              <div
                className="risk-intelligence-panel__source"
                aria-label="Risk signal provenance"
              >
                <span>{metadata.sourceLabel}</span>
                <span>{metadata.modelVersion}</span>
                <span>{metadata.confidenceLabel}</span>
                <span>{metadata.forecastWindowMinutes}m forecast window</span>
              </div>

              <RiskTicker
                ariaLabel="Read-only odds watchlist"
                className="risk-intelligence-panel__watchlist"
                items={watchlistItems}
              />

              <div className="risk-intelligence-panel__insight">
                <span>{market.insight}</span>
                <span className="risk-intelligence-panel__boundary">
                  Signal only · not settlement trigger
                </span>
              </div>
            </div>
          ) : null}
        </div>
          </>
        )}
      </div>
    </CommandPanel>
  );
}

function toRiskTickerItem(item: TowerRiskSignal["watchlist"][number]): RiskTickerItem {
  return {
    id: item.id,
    label: item.callsign,
    value: `${formatProbability(item.probability)}%`,
    direction: item.direction,
    detail: `${item.odds.toFixed(1)}x · ${item.pressureLabel}`,
    tone: pressureTone(item.pressureLevel),
  };
}

function formatProbability(probability: number) {
  return Math.round(probability * 100);
}

function formatSignedProbability(probability: number) {
  const value = Math.round(probability * 100);
  return value > 0 ? `+${value}` : `${value}`;
}

function pressureTone(level: string): CommandTone {
  if (level === "severe") return "severe";
  if (level === "elevated") return "elevated";
  if (level === "low") return "low";
  return "weather";
}
