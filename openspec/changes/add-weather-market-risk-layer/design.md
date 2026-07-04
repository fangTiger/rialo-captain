# Design: Weather and Market Risk Layer

## Overview
The feature adds a visually rich but demo-safe risk intelligence layer to the Tower homepage. Weather and prediction market odds are presented as contextual signals that help users understand why a flight looks risky, while existing delay-based settlement remains the only claim trigger.

## Architecture
The MVP is frontend-only. `TowerShell` owns the weather visibility state and the currently active flight subject. It passes `weatherLayerVisible` and `marketRiskSignal` into a compact Tower HUD, and passes weather overlay props into `GlobeMap`.

`GlobeMap` renders the weather visuals as SVG layers inside the existing viewport group so they pan and zoom with the world map. Non-interactive HUD controls live outside the SVG viewport. The overlay uses deterministic synthetic cells and route corridors generated from flight identity and position, avoiding provider keys and network fragility during demos.

## Weather Visuals
The weather layer is not a generic weather-app icon set. It should feel like an aviation risk radar:

- Animated storm cells with translucent cyan/amber/red fields.
- Wind shear bands or pressure ribbons near the active route.
- Airport pressure rings around likely departure/arrival anchors when coordinates are available.
- A highlighted weather corridor for the selected, elected, or demo protagonist flight.
- Reduced-motion mode disables pulsing/flow animation while preserving visibility.

## Prediction Market Odds
Prediction market odds are read-only. The UI shows:

- `Market odds`, such as `2.6x`.
- Market implied delay probability.
- Rialo/model probability.
- Spread label, such as `Market more bearish`.
- A one-line insight explaining the divergence.

The values are deterministic demo projections derived from flight callsign, delay rate, and weather pressure. They MUST NOT create a trade, order, policy, claim, balance update, or any backend mutation.

## Optimization Pass
The risk signal contract should make demo provenance explicit. `TowerRiskSignal` carries metadata such as simulated source, model version, forecast window, and confidence so the HUD can say what kind of signal is being shown without suggesting real exchange liquidity.

Global weather remains deterministic, but it now drifts by forecast window instead of being permanently static. Same-window builds remain stable for React rerenders and tests; advancing the window produces a new deterministic weather snapshot that still needs no provider key.

The active corridor should stop hard-coding a low/elevated/severe progression. Segment levels are derived from nearby weather cells and forecast bands at each segment midpoint. This keeps the visual drama tied to the same synthetic weather context used by market odds.

## Boundaries
Weather and market signals are context. They do not change claim thresholds, payout calculations, policy status, evidence integrity, or Copilot write boundaries. UI copy must make the boundary visible where a user might otherwise infer that weather or markets trigger settlement.

## Testing
Use focused TDD:

- Unit tests for deterministic signal helpers.
- GlobeMap tests for visible/hidden weather layer, active corridor, reduced-motion-safe classes, and unchanged flight click behavior.
- TowerShell tests for weather toggle state, no map/cinema remount side effects, and read-only market odds display.
- Provenance tests for simulated-source labeling, forecast-window stability/drift, and weather-derived corridor segment levels.
- OpenSpec strict validation before implementation completion.
