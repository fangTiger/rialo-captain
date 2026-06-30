# Guided Demo Director Implementation Plan

> **For worker:** REQUIRED SUB-SKILL: Use test-driven-development to implement this plan task-by-task. Use model `gpt-5.4` with reasoning effort `xhigh` when available.

**Goal:** 在 Tower 首页加入人工引导的 Demo Director：用户亲自选航班、选保费并确认购买，购买后系统导演式播放结算闭环。

**Architecture:** 新增一个小型前端状态机和 Demo Rail 组件，集成到 `TowerShell`。不新增后端 API，不自动购买，不改变现有 `BuyDrawer`、Cinema 或 ClaimEngine 语义。购买后复用现有 `purchasedPolicy` 触发的 REAL protagonist 和关键时刻 fallback 事件链。

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing Cinema context, existing `BuyDrawer`, existing `chooseDemoProtagonist`.

---

## 约束

- 不回滚或覆盖当前工作区已有未提交改动。
- 只编辑本功能相关文件，优先范围：
  - `frontend/src/routes/TowerShell.tsx`
  - `frontend/src/components/demo/GuidedDemoRail.tsx`
  - `frontend/src/components/demo/demoDirector.ts`
  - `frontend/src/tests/guided-demo-director.test.ts`
  - `frontend/src/tests/guided-demo-rail.test.tsx`
  - `frontend/src/tests/tower-shell.test.tsx`
  - `openspec/changes/add-guided-demo-director/tasks.md`
- 不新增 runtime dependency。
- 页面可见文案继续沿用当前产品英文 UI 风格；代码注释如需新增，用中文。
- 遵守 TDD：先写失败测试，确认失败，再实现。

## Task 1: Demo Director 状态机

**Files:**
- Create: `frontend/src/components/demo/demoDirector.ts`
- Test: `frontend/src/tests/guided-demo-director.test.ts`

**Step 1: Write failing tests**

测试以下行为：
- `startGuidedDemo(recommendedFlight)` 从 `idle` 进入 `select-flight`。
- `selectDemoFlight(state, flight)` 进入 `buy-cover` 并保存 callsign/flightId。
- `pauseBuyCover(state)` 保留 selected flight。
- `resumeBuyCover(state)` 返回 `buy-cover`。
- `completePurchase(state, policy)` 进入 `replay` 并保存 policy/premium/payout。
- `exitGuidedDemo()` 回到 `idle`。

**Step 2: Run RED**

Run:

```bash
cd frontend && pnpm test src/tests/guided-demo-director.test.ts
```

Expected: FAIL because module/functions do not exist.

**Step 3: Implement minimal state helpers**

Use plain TypeScript types and pure functions. Keep data small:
- status: `idle | select-flight | buy-cover | paused | replay`
- recommendedFlight
- selectedFlight
- purchasedPolicy

**Step 4: Run GREEN**

Run the same test and confirm it passes.

## Task 2: Demo Rail 组件

**Files:**
- Create: `frontend/src/components/demo/GuidedDemoRail.tsx`
- Test: `frontend/src/tests/guided-demo-rail.test.tsx`

**Step 1: Write failing tests**

Render-level tests:
- Idle renders `Start guided demo`.
- `select-flight` renders three steps and recommended callsign.
- `buy-cover` renders selected callsign and `Resume` when paused.
- `replay` renders purchased policy summary and `Settlement replay`.
- `Exit demo` invokes callback.

**Step 2: Run RED**

```bash
cd frontend && pnpm test src/tests/guided-demo-rail.test.tsx
```

**Step 3: Implement component**

Use inline style or local CSS consistent with existing components. Keep it compact:
- fixed/absolute overlay near top-right or below AI Briefing without blocking map
- `data-testid="guided-demo-rail"`
- buttons: `Start guided demo`, `Use recommended flight`, `Resume`, `Exit demo`

**Step 4: Run GREEN**

Run the component test.

## Task 3: TowerShell 集成

**Files:**
- Modify: `frontend/src/routes/TowerShell.tsx`
- Modify: `frontend/src/tests/tower-shell.test.tsx`

**Step 1: Add failing TowerShell tests**

Add tests for:
- Clicking `Start guided demo` shows Demo Rail select state, highlights recommended `BA178`, does not open BuyDrawer and does not call policy API.
- Clicking `Use recommended flight` or mock globe opens BuyDrawer and moves rail to `Buy cover`.
- Closing BuyDrawer keeps Demo Rail in paused/buy-cover context and `Resume` reopens same `flightId`.
- Clicking another mocked flight during guided demo replaces selected subject. If existing mock only supports one flight, extend test harness with a second flight and a second button.

**Step 2: Run RED**

```bash
cd frontend && pnpm test src/tests/tower-shell.test.tsx
```

**Step 3: Implement integration**

In `TowerShell`:
- keep `guidedDemoState` via the pure helpers
- derive recommended flight from existing `protagonist` / `chooseDemoProtagonist`
- pass selected/elected flight into existing `onSelectFlight`
- keep `AutoSeeder demoLocked` true when guided demo has selected flight or existing manual focus lock
- do not create policies except through existing `BuyDrawer`
- on BuyDrawer close before purchase, pause guided demo instead of exiting
- on purchase success, move guided demo to `replay`

**Step 4: Run GREEN**

Run TowerShell focused tests.

## Task 4: 购买后和人工操作回归

**Files:**
- Modify: `frontend/src/tests/tower-shell.test.tsx`
- Modify implementation only if tests expose a real gap.

**Step 1: Add failing/regression tests**

Cover:
- `mock user gesture` calls existing `cinema.interrupt` but Demo Rail remains visible.
- Purchase success in guided demo calls `routeRealProtagonist` through existing effect and rail shows replay state.
- CinemaProvider mount count remains 1 when selecting/replacing demo subject.

**Step 2: Run RED/GREEN**

Use:

```bash
cd frontend && pnpm test src/tests/tower-shell.test.tsx
```

If tests already pass after Task 3, keep them as regression coverage.

## Task 5: 任务状态与验证

**Files:**
- Modify: `openspec/changes/add-guided-demo-director/tasks.md`

**Step 1: Mark completed tasks**

Only mark checkboxes `[x]` for work actually implemented and verified.

**Step 2: Run focused verification**

```bash
cd frontend && pnpm test src/tests/guided-demo-director.test.ts src/tests/guided-demo-rail.test.tsx src/tests/tower-shell.test.tsx src/tests/BuyDrawer.test.tsx src/tests/cinema-ui.test.tsx
openspec validate add-guided-demo-director --strict --no-interactive
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

**Step 3: Optional broader verification**

If focused tests pass and time permits:

```bash
cd frontend && pnpm test
```

Document any pre-existing failures separately.
