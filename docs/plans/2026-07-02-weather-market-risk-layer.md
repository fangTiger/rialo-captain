# Weather Market Risk Layer Implementation Plan

> **For worker:** REQUIRED SUB-SKILL: Use `test-driven-development` for every implementation task. Use model `gpt-5.5` with reasoning `xhigh` as configured by the controller.
> **For reviewer:** Review with model `gpt-5.5` and reasoning `xhigh`. First check OpenSpec compliance, then code quality.

**Goal:** Add a cinematic Tower weather layer toggle and read-only prediction market odds without changing settlement, policy purchase, Copilot write boundaries, dev login, or real AI provider behavior.

**Architecture:** Keep the MVP frontend-only. Add deterministic weather/market signal helpers, render SVG weather radar visuals inside `GlobeMap`, and wire a Tower HUD switch plus market odds panel from `TowerShell`.

**Tech Stack:** React 18, TypeScript, SVG/CSS, Vitest, Testing Library, existing Tower/Cinema components.

---

## Coordination Rules

- Worker and reviewer are not alone in the codebase. The workspace already has unrelated uncommitted edits; do not revert or overwrite them.
- Keep edits scoped to the files named in each task unless a failing test proves a nearby type or fixture update is necessary.
- Do not touch `frontend/src/routes/Login.tsx`, `frontend/src/routes/Login.css`, `frontend/src/tests/login.test.tsx`, backend auth, backend provider config, or `.env` files.
- Do not add runtime dependencies.
- Keep UI-visible copy in English to match the current frontend.
- Code comments, if needed, should be Chinese and short.
- Follow RED-GREEN-REFACTOR. For each task: write failing tests, run and observe failure, implement the minimal code, rerun tests.
- After code edits, run graphify rebuild if importable:

```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

## OpenSpec Change

- Change id: `add-weather-market-risk-layer`
- Proposal: `openspec/changes/add-weather-market-risk-layer/proposal.md`
- Design: `openspec/changes/add-weather-market-risk-layer/design.md`
- Tasks: `openspec/changes/add-weather-market-risk-layer/tasks.md`
- Specs:
  - `openspec/changes/add-weather-market-risk-layer/specs/live-dashboard/spec.md`
  - `openspec/changes/add-weather-market-risk-layer/specs/reactive-insurance-core/spec.md`

## Task 1: Deterministic Weather And Market Signals

**Files:**
- Create: `frontend/src/components/tower/riskSignals.ts`
- Test: `frontend/src/tests/tower-risk-signals.test.ts`

**Step 1: Write failing tests**

Create tests proving:

- `buildTowerRiskSignal(flights, activeSubject)` returns stable results for the same callsign and coordinates.
- At least three weather cells are returned with levels `low`, `elevated`, and `severe`.
- A selected/protagonist flight gets a `weatherCorridor` with projected endpoints and a `pressureLevel`.
- Market odds include `marketProbability`, `modelProbability`, `marketOdds`, `spread`, `spreadLabel`, and `insight`.
- Empty flights return an overview signal without throwing.
- Returned probabilities are clamped between `0` and `1`, and odds are finite.

Suggested API:

```ts
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

export interface WeatherCorridor {
  callsign: string;
  from: [number, number];
  to: [number, number];
  pressureLevel: WeatherPressureLevel;
  riskDeltaPct: number;
}

export interface MarketOddsSignal {
  subjectLabel: string;
  marketProbability: number;
  modelProbability: number;
  marketOdds: number;
  spread: number;
  spreadLabel: string;
  insight: string;
}

export interface TowerRiskSignal {
  weatherCells: WeatherCell[];
  corridor: WeatherCorridor | null;
  market: MarketOddsSignal;
}

export function buildTowerRiskSignal(
  flights: FlightPublic[],
  activeSubject?: TowerRiskSubject | null,
): TowerRiskSignal;
```

**Step 2: Run RED**

```bash
cd frontend && pnpm test src/tests/tower-risk-signals.test.ts
```

Expected: FAIL because the module does not exist.

**Step 3: Implement minimal helper**

Implement pure deterministic helpers only. Use callsign/flight position/delay_rate as seed inputs; do not call network APIs, do not use random values, and do not read browser state.

Implementation guidance:

- Use a small deterministic string hash.
- Derive base model probability from `delay_rate` when available, otherwise a seeded fallback around `0.18` to `0.48`.
- Derive weather pressure from nearby generated cells and active subject position.
- Derive market probability as model probability plus a bounded seeded/weather spread.
- `marketOdds` can be decimal odds: `1 / probability`, rounded to one decimal and clamped.
- `spreadLabel` should use copy such as `Market more bearish`, `Model more cautious`, or `Market aligned`.

**Step 4: Run GREEN**

```bash
cd frontend && pnpm test src/tests/tower-risk-signals.test.ts
```

Expected: PASS.

## Task 2: GlobeMap Weather Overlay

**Files:**
- Modify: `frontend/src/components/tower/GlobeMap.tsx`
- Modify: `frontend/src/components/tower/GlobeMap.css`
- Test: `frontend/src/tests/globe-map-camera.test.tsx`

**Step 1: Write failing tests**

Add tests proving:

- `<GlobeMap weatherLayerVisible riskSignal={signal} />` renders `data-testid="weather-risk-layer"`.
- Weather cells render with stable selectors such as `weather-cell-low`, `weather-cell-elevated`, and `weather-cell-severe`.
- `weatherLayerVisible={false}` hides the weather layer.
- A signal with `corridor` renders `data-testid="weather-risk-corridor"`.
- Weather shapes use `pointerEvents="none"` or equivalent and do not block flight click behavior.

Update the existing test mock fixtures minimally.

**Step 2: Run RED**

```bash
cd frontend && pnpm test src/tests/globe-map-camera.test.tsx
```

Expected: FAIL because props and weather layer rendering do not exist.

**Step 3: Implement SVG layer**

Add optional props to `GlobeMap`:

```ts
import type { TowerRiskSignal } from "./riskSignals";

interface Props {
  // existing props...
  weatherLayerVisible?: boolean;
  riskSignal?: TowerRiskSignal | null;
}
```

Render the weather layer inside `globe-viewport`, after countries and before flight dots:

- Each cell projects longitude/latitude and renders two or three layered circles/ellipses with classes by pressure level.
- Corridor renders a thick translucent path/polyline between `corridor.from` and `corridor.to`.
- Use `pointerEvents="none"` on layer groups.
- Add `<defs>` filters or gradients only if they remain deterministic and testable.
- Keep existing protagonist and hover behavior unchanged.

CSS direction:

- `low`: cyan/teal field.
- `elevated`: amber pressure field.
- `severe`: controlled red/magenta pulse.
- Use `mix-blend-mode: screen`, soft blur/filter, and radar-like dashed corridor.
- Respect `prefers-reduced-motion: reduce`.
- Do not create a one-note purple/blue gradient theme.

**Step 4: Run GREEN**

```bash
cd frontend && pnpm test src/tests/globe-map-camera.test.tsx
```

Expected: PASS.

## Task 3: Tower Switch And Market Odds HUD

**Files:**
- Modify: `frontend/src/routes/TowerShell.tsx`
- Create: `frontend/src/components/tower/RiskIntelligencePanel.tsx`
- Test: `frontend/src/tests/tower-shell.test.tsx`

**Step 1: Write failing tests**

Extend the `GlobeMap` mock in `tower-shell.test.tsx` so it records:

- `weatherLayerVisible`
- whether `riskSignal` exists
- `riskSignal.market.subjectLabel`

Add tests proving:

- Tower renders a visible `Weather` switch and market odds panel by default.
- GlobeMap receives `weatherLayerVisible=true` by default.
- Clicking the weather switch toggles it to false and GlobeMap receives false.
- Toggling weather does not open BuyDrawer, call Copilot, navigate routes, or remount CinemaProvider.
- The market panel displays market odds, implied probability, model probability, spread label, and `Signal only`.
- Selecting a flight updates the market panel subject without creating a policy.

**Step 2: Run RED**

```bash
cd frontend && pnpm test src/tests/tower-shell.test.tsx
```

Expected: FAIL because the HUD and props do not exist.

**Step 3: Implement Tower wiring**

In `TowerShell`:

- Add local state: `const [weatherLayerVisible, setWeatherLayerVisible] = useState(true);`
- Derive active subject from selected/elected flight first, then guided demo selected flight, then protagonist.
- Use `buildTowerRiskSignal(flights, activeSubject)`.
- Pass `weatherLayerVisible` and `riskSignal` to `GlobeMap`.
- Render `RiskIntelligencePanel` in the Tower overlay, positioned so it does not cover the guided demo rail, AI Briefing, or primary flight interaction.

`RiskIntelligencePanel` should:

- Use a checkbox/toggle-style control with `role="switch"` and accessible label like `Weather risk layer`.
- Show compact market odds:
  - `MARKET ODDS`
  - decimal odds like `2.6x`
  - `Market implied 38%`
  - `Rialo model 31%`
  - spread label
  - `Signal only · not settlement trigger`
- Use restrained but high-impact styling consistent with the radar terminal aesthetic.
- Avoid card-inside-card composition.

**Step 4: Run GREEN**

```bash
cd frontend && pnpm test src/tests/tower-shell.test.tsx
```

Expected: PASS.

## Task 4: Focused Verification And Spec Closure

**Files:**
- Modify: `openspec/changes/add-weather-market-risk-layer/tasks.md`

**Step 1: Run focused verification**

```bash
cd frontend && pnpm test src/tests/tower-risk-signals.test.ts src/tests/globe-map-camera.test.tsx src/tests/tower-shell.test.tsx
openspec validate add-weather-market-risk-layer --strict --no-interactive
```

Expected: PASS.

**Step 2: Run broader frontend safety check if focused tests pass**

```bash
cd frontend && pnpm test src/tests/BuyDrawer.test.tsx src/tests/copilot-panel.test.tsx src/tests/top-nav.test.tsx
```

Expected: PASS or document unrelated pre-existing failures with exact output.

**Step 3: Update tasks**

Mark only completed verified items in `openspec/changes/add-weather-market-risk-layer/tasks.md`.

**Step 4: Rebuild graphify if available**

```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

If graphify is unavailable, document the failure and continue.

## Completion Criteria

- Weather layer toggle is visible, accessible, and default-on.
- Weather overlay is visually rich and non-blocking.
- Market odds are visible and read-only.
- Tests prove no policy, claim, Copilot ask, navigation, or Cinema remount side effect from toggling weather.
- OpenSpec validation passes.
- Worker reports changed files and test output.
- Reviewer approves spec compliance and code quality, or worker fixes every blocking issue.
