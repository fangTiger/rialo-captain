import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CommandPanel,
  DivergenceMeter,
  MetricDeck,
  RiskTicker,
  SignalPill,
} from "../design/commandCenter";

describe("Command Center primitives", () => {
  it("renders CommandPanel as a labelled reusable surface", () => {
    render(
      <CommandPanel eyebrow="OPS" title="Route Risk" status="LIVE">
        <button type="button">Open evidence</button>
      </CommandPanel>,
    );

    const panel = screen.getByRole("region", { name: "Route Risk" });
    expect(panel).toHaveClass("command-panel", "command-surface");
    expect(screen.getByText("OPS")).toHaveClass("command-panel__eyebrow");
    expect(screen.getByText("LIVE")).toHaveClass("command-panel__status");
    expect(screen.getByRole("button", { name: "Open evidence" })).toBeInTheDocument();
    expect(screen.getByTestId("command-panel-decor")).toHaveClass("command-decorative-layer");
    expect(screen.getByTestId("command-panel-decor")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders MetricDeck as stable metric list items", () => {
    render(
      <MetricDeck
        ariaLabel="Risk metrics"
        metrics={[
          {
            id: "model",
            label: "Model probability",
            value: "68%",
            detail: "+12 vs market",
            tone: "radar",
          },
          {
            id: "weather",
            label: "Weather pressure",
            value: "Severe",
            detail: "convective cell",
            tone: "severe",
          },
        ]}
      />,
    );

    const deck = screen.getByRole("list", { name: "Risk metrics" });
    expect(deck).toHaveClass("metric-deck");
    expect(within(deck).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Model probability")).toHaveClass("metric-deck__label");
    expect(screen.getByText("68%")).toHaveClass("metric-deck__value");
    expect(screen.getByText("Weather pressure").closest(".metric-deck__item")).toHaveClass(
      "risk-level--severe",
    );
  });

  it("renders SignalPill and DivergenceMeter with accessible risk semantics", () => {
    render(
      <>
        <SignalPill tone="severe" label="Contextual signal">
          Severe weather
        </SignalPill>
        <DivergenceMeter label="Model vs market divergence" value={42} tone="elevated" />
      </>,
    );

    const pill = screen.getByLabelText("Contextual signal");
    expect(pill).toHaveClass("signal-pill", "signal-pill--severe", "risk-level--severe");
    expect(pill).toHaveTextContent("Severe weather");

    const meter = screen.getByRole("meter", { name: "Model vs market divergence" });
    expect(meter).toHaveClass("divergence-meter", "risk-level--elevated");
    expect(meter).toHaveAttribute("aria-valuemin", "-100");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(meter).toHaveAttribute("aria-valuenow", "42");
    expect(meter).toHaveStyle({ "--divergence-value": "42%" });
  });

  it("can render SignalPill as a block wrapper for interactive references", () => {
    render(
      <SignalPill as="div" tone="weather" label="Flight source" role="group">
        <span>flight</span>
        <button type="button">Flight BA178</button>
      </SignalPill>,
    );

    const pill = screen.getByRole("group", { name: "Flight source" });
    expect(pill.tagName).toBe("DIV");
    expect(pill).toHaveClass("signal-pill", "signal-pill--weather");
    expect(within(pill).getByRole("button", { name: "Flight BA178" })).toBeInTheDocument();
  });

  it("sanitizes DivergenceMeter invalid and out-of-range values", () => {
    render(
      <>
        <DivergenceMeter label="Unavailable divergence" value={Number.NaN} />
        <DivergenceMeter label="High divergence" value={142} />
        <DivergenceMeter label="Low divergence" value={-170} />
      </>,
    );

    const unavailable = screen.getByRole("meter", { name: "Unavailable divergence" });
    expect(unavailable).toHaveAttribute("aria-valuenow", "0");
    expect(unavailable).toHaveStyle({
      "--divergence-value": "0%",
      "--divergence-extent": "0%",
      "--divergence-offset": "0%",
    });

    const high = screen.getByRole("meter", { name: "High divergence" });
    expect(high).toHaveAttribute("aria-valuenow", "100");
    expect(high).toHaveStyle({
      "--divergence-value": "100%",
      "--divergence-extent": "50%",
      "--divergence-offset": "0%",
    });

    const low = screen.getByRole("meter", { name: "Low divergence" });
    expect(low).toHaveAttribute("aria-valuenow", "-100");
    expect(low).toHaveStyle({
      "--divergence-value": "-100%",
      "--divergence-extent": "50%",
      "--divergence-offset": "-100%",
    });
  });

  it("renders RiskTicker as signal-only watchlist rows", () => {
    render(
      <RiskTicker
        ariaLabel="Market watchlist"
        items={[
          {
            id: "BA178",
            label: "BA178",
            value: "72%",
            direction: "up",
            tone: "elevated",
            detail: "weather pressure",
          },
          {
            id: "NH7",
            label: "NH7",
            value: "31%",
            direction: "flat",
            tone: "low",
            detail: "stable corridor",
          },
        ]}
      />,
    );

    const ticker = screen.getByRole("group", { name: "Market watchlist" });
    expect(ticker).toHaveClass("risk-ticker");

    const boundary = screen.getByText("signal-only");
    expect(boundary).toHaveClass("risk-ticker__boundary");
    expect(ticker).toHaveAttribute("aria-describedby", boundary.id);

    const track = within(ticker).getByRole("list", { name: "Market watchlist signals" });
    expect(track).toHaveClass("risk-ticker__track");
    expect(within(track).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("BA178").closest(".risk-ticker__item")).toHaveClass(
      "risk-level--elevated",
    );
    expect(screen.getByLabelText("BA178 risk direction up")).toHaveClass("risk-ticker__direction");
  });
});
