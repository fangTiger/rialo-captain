## Why

当前 The Tower 已能展示全球航班与赔付事件，但需要人工操作才能讲完整故事。C1 Cinema 引擎把 `/` 升级为默认自动播放的大屏：无人操作时自动选主角航班、推镜头、造 demo 流量并循环，让评委 30 秒内看懂保险闭环的起点和关键态势。

## What Changes

- **ADDED** `CinemaProvider` / `CinemaController` 状态机，管理 `cinema`、`interactive`、`paused-hidden`、`degraded` 等播放状态。
- **ADDED** `CameraDirector` 与现有 `GlobeMap` viewport 整合，按 30s cycle 在 5s 后自动 zoom 到主角航班，25s 后 zoom out。
- **ADDED** `AutoSeeder` 在 cinema 态节流调用前端可安全访问的 `/api/seed-demo` 与 `/api/inject-delay`，每 cycle 最多各 1 次，pause/hidden/degraded 时停止。
- **ADDED** `EventChoreographer` 的 C1 路由：识别 `claim.settled` / 现有 `flare` 事件并触发 KPI tick；保留 C2/C3 动效挂载点但不实现 ShockWave、ChainBeam、FlareLand、HeatmapBg、TrailDraw。
- **ADDED** `CinemaOverlay` 空容器、`ModeIndicator`、`ProtagonistBadge`，显示 cinema/manual/degraded 状态、倒计时与 REAL/DEMO 主角身份。
- **MODIFIED** `TowerShell` 包装 Cinema provider/controller，并把 cinema 状态传给 `GlobeMap`、`RadarSweep`、`KPIBand`。
- **MODIFIED** `GlobeMap` 接收 `cameraTarget`，在 cinema 态由 `CameraDirector` 控制 viewport；用户 click/wheel/drag/keydown 接管时停止自动镜头。
- **MODIFIED** `RadarSweep` 在主角处于 at-risk 阶段时显示 `AT RISK` 高亮标签。
- **MODIFIED** `KPIBand` 支持 settled 事件的数字 tick 动效，不改变现有 flare 统计兼容性。
- **MODIFIED** demo seed API 请求支持 `protagonist_name`，响应返回主角保单/航班信息供 AutoSeeder 后续注入延误；保留现有 `/api/admin/seed-demo` 兼容路径。
- **MODIFIED** ClaimEngine 广播结算时新增 `claim.settled` 事件，payload 含 mock `tx_hash` 与递增 `block_height`；继续广播现有 `flare` 事件以兼容当前前端。
- **ADDED** `flight.landed` WebSocket 事件基础广播能力，C1 只定义 payload 与发射时机，不实现 C2 落地动效。

## Capabilities

### New Capabilities

- `cinema-engine`: 覆盖 `/` 默认 cinema 自动播放、用户接管/恢复、主角选择与抢占、AutoSeeder 节流、C1 事件编排、后端 demo seed 与 settled/landed payload 扩展。

### Modified Capabilities

- 当前 `openspec/specs/` 为空；无已归档 capability 可修改。与 MVP 中 `live-dashboard`、`reactive-insurance-core` 相关的行为变更统一记录在新增 `cinema-engine` delta 中，归档时形成独立 spec。

## Impact

- Affected frontend:
  - `frontend/src/routes/TowerShell.tsx`
  - `frontend/src/components/tower/GlobeMap.tsx`
  - `frontend/src/components/tower/RadarSweep.tsx`
  - `frontend/src/components/tower/KPIBand.tsx`
  - `frontend/src/components/tower/EventFeedSidebar.tsx`
  - 新增 `frontend/src/components/cinema/*`
  - `frontend/src/store/eventStore.ts`
  - `frontend/src/hooks/useWebSocket.ts`
  - 相关 Vitest 与 Playwright smoke
- Affected backend:
  - `backend/admin/routes.py`
  - `backend/claims/engine.py`
  - `backend/claims/service.py`
  - `backend/contracts/base.py`
  - `backend/contracts/mock_rialo.py`
  - `backend/models.py`（仅在必须持久化 block height 时触碰，否则避免迁移）
  - `backend/ws/broadcaster.py`
  - 相关 pytest
- APIs/events:
  - 新增前端代理路径 `POST /api/seed-demo` 与 `POST /api/inject-delay`，不暴露 `ADMIN_TOKEN`
  - 保留 `POST /api/admin/seed-demo` 与 `POST /api/admin/inject-delay` 兼容路径
  - seed-demo body 增加可选 `protagonist_name`
  - WebSocket 新增 `claim.settled`、`flight.landed`，保留 `flare`/`toast`
- Dependencies:
  - 不新增前端框架或后端依赖；使用 React、Vitest、FastAPI、pytest 现有栈。

## Acceptance Criteria

- 打开 `/` 且 5s 内无操作时，系统保持 cinema 态并自动选择 DEMO 主角航班，5s 后镜头开始 zoom 到主角。
- 30s 一个 cycle：ESTABLISH 0-5s、ZOOM-IN 5-7s、STORY 7-25s、ZOOM-OUT 25-27s、REST 27-30s，并循环。
- settled/flare 事件到达后，KPIBand 数字出现 tick 动效且统计值正确。
- RadarSweep 在主角 STORY at-risk 阶段显示 `AT RISK`。
- 用户点击任意飞机、滚轮或拖拽地图后，cinema 立即暂停，角落显示 `MANUAL · 30s` 倒计时。
- interactive 态 30s 无 click/wheel/keydown/drag 后自动恢复 cinema。
- interactive 态按 `Esc` 立即恢复 cinema。
- `document.visibilityState === "hidden"` 时暂停 cinema 和 AutoSeeder；回到 visible 后恢复 cinema。
- AutoSeeder 在每个 active cycle 最多调用 1 次 seed-demo 和 1 次 inject-delay，失败时进入可见 degraded/offline 状态且不刷屏重试。
- `claim.settled` payload 包含 `tx_hash`、`block_height`，`flight.landed` 事件会在结算闭环后发出。

## Out of Scope

- 不实现 ShockWave、ChainBeam、FlareLand、HeatmapBg、TrailDraw 的可视动效。
- 不接真实 Rialo 链，不产生真实 RIA tx；`tx_hash` 与 `block_height` 均为 mock。
- 不做多屏同步、音效、历史回放、cinema 偏好持久化。
- 不修改 `openspec/changes/rialo-captain-mvp/*`。
