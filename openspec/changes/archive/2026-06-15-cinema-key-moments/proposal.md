## Why

C1 已让 TowerShell 具备 cinema 自动播放、主角选择、KPI tick、Radar AT RISK 与 camera timeline，但闭环高潮仍缺少可见的延误触发、链上结算和落地确认。C2 要把 `claim.triggered`、`claim.settled`、`flight.landed` 三个关键事件转成大屏可见动效，让保险闭环在 STORY phase 中被看见。

当前后端已经广播 `claim.settled` 与 `flight.landed`，前端也能把 `claim.triggered` 放入 typed event buffer；但后端尚未发射 `claim.triggered`。因此 C2 需要补最小 `claim.triggered` 广播，并扩展 EventChoreographer 与 CinemaOverlay。

## What Changes

- 新增 `ShockWave`、`ChainBeam`、`FlareLand` 三个 C2 视觉组件，挂载到 C1 留出的 `CinemaOverlay` 中。
- 扩展 `EventChoreographer`：把 `claim.triggered` 路由到 ShockWave，把 `claim.settled` 路由到 ChainBeam，同时保留 C1 KPI tick，把 `flight.landed` 路由到 FlareLand。
- 新增前端 key moments 的解析、坐标投影、生命周期与 reduced motion 处理；动效只使用 CSS `transform` / `opacity`，不引入 framer-motion、GSAP 或新框架。
- 补后端 `claim.triggered` 广播，发射时机为 ClaimEngine 判断延误条件命中后、触发 mock claim 前；payload 至少包含 `flight_id`、`policy_id`、`delay_minutes`、`source` 和可用于 ShockWave 的 `airport_iata` 或经纬度。
- 保持 C1 兼容路径：`flare`、`claim.settled`、`flight.landed` payload 不新增字段、不破坏 Hangar、Claims Feed、KPIBand、TowerShell 点击导航。
- 将 C1 中 “C2/C3 事件不渲染视觉动效” 的正式 spec 通过 delta 改成 “C2 事件渲染 C2 动效，C3 仍不渲染”。

## Capabilities

### New Capabilities

- `cinema-key-moments`: C2 闭环关键时刻能力，覆盖 ShockWave、ChainBeam、FlareLand、事件路由、生命周期、主角关联、性能预算和 reduced motion。

### Modified Capabilities

- `cinema-engine`: 更新 C1 的事件编排与 CinemaOverlay 要求，使 `claim.triggered`、`claim.settled`、`flight.landed` 在 C2 中允许渲染 ShockWave、ChainBeam、FlareLand，同时继续禁止 C3 的 HeatmapBg/TrailDraw。

## Impact

- Affected frontend:
  - `frontend/src/components/cinema/EventChoreographer.tsx`
  - `frontend/src/components/cinema/CinemaOverlay.tsx`
  - `frontend/src/routes/TowerShell.tsx`
  - 新增 `frontend/src/components/cinema/ShockWave.tsx`
  - 新增 `frontend/src/components/cinema/ChainBeam.tsx`
  - 新增 `frontend/src/components/cinema/FlareLand.tsx`
  - 新增 key moments 解析、几何、生命周期 helper 与对应 Vitest 测试
- Affected backend:
  - `backend/ws/broadcaster.py`
  - `backend/claims/engine.py`
  - `backend/tests/unit/test_claim_engine.py`
  - `backend/tests/unit/test_broadcaster.py`
- Affected specs:
  - 新增 `openspec/changes/cinema-key-moments/specs/cinema-key-moments/spec.md`
  - 修改 delta `openspec/changes/cinema-key-moments/specs/cinema-engine/spec.md`
- Dependencies:
  - 不新增运行时依赖或动画框架。

## Acceptance Criteria

- cinema 进入 STORY phase 且当前主角对应的 `claim.triggered` 到达后，机场位置出现 ShockWave 红色冲击波。
- 同一闭环的 `claim.settled` 到达后，约 1 秒内显示从机场到 hangar 视觉锚点的 ChainBeam，并展示 mock `tx_hash` 文字。
- C1 KPI tick 继续由 `claim.settled` / `flare` 触发，累计数与 payout 更新路径不回退。
- `flight.landed` 到达后，在当前主角航班位置显示 FLARE 落地收束与 ping ring。
- 三个 C2 动效均在生命周期结束后清理 DOM，不拦截地图 click / hover / wheel / drag。
- reduced motion 环境下不播放 scale/translate 动画，只显示短暂静态状态并清理。
- 后端 `claim.triggered` 在条件命中时广播，且不改变 `claim.settled`、`flight.landed`、`flare` 既有 payload。

## Out of Scope

- 不实现 C3 `HeatmapBg`、`TrailDraw`。
- 不接真实 Rialo testnet；ChainBeam 继续显示 C1 mock `tx_hash`。
- 不重做地图、投影或 GlobeMap 内部飞机绘制。
- 不新增后台任务、数据库迁移、音效、跨屏同步或历史回放。
- 不修改 `openspec/changes/rialo-captain-mvp/*`。
