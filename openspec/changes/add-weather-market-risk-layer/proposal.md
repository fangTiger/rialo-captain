# Change: Add weather and market risk layer
## Why
Rialo-Captain already shows live flights, policies, claims, evidence, and guided settlement replay, but the Tower still lacks an immediate sense of why risk is building before a delay happens. A visual weather layer and read-only prediction market odds can make the product feel richer, more cinematic, and more like a real-world risk intelligence desk while keeping settlement rules deterministic.

## What Changes
- Add a Tower weather visibility switch that toggles a high-impact weather risk overlay on the globe without remounting the cinema, map, or guided demo flow.
- Add a weather risk corridor visual for the highlighted or selected flight, including storm cells, wind/pressure bands, airport pressure rings, and a clear "risk context only" boundary.
- Add read-only prediction market odds for the active Tower subject, showing market implied delay probability, odds, model-vs-market spread, and a short insight.
- Add deterministic frontend signal helpers for demo-safe weather and market data derived from flight identity/position/risk fields when real providers are unavailable.
- Keep policy purchase, ClaimEngine, Evidence, Copilot write boundaries, dev login, and real AI provider behavior unchanged.

## Impact
- Affected specs: `live-dashboard`, `reactive-insurance-core`
- Affected frontend: `frontend/src/routes/TowerShell.tsx`, `frontend/src/components/tower/GlobeMap.tsx`, `frontend/src/components/tower/GlobeMap.css`, new tower risk-signal helpers/components, focused Tower/GlobeMap tests
- Affected backend: none expected for MVP
- Dependencies: no new runtime dependency expected
