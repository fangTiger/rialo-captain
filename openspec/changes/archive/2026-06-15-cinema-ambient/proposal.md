## Why

C1 已让 `/` 大屏自动讲故事，C2 已补齐延误、结算、落地三个关键时刻；但画面在非高潮时仍缺少全局保单密度与单航班航迹的氛围信息。C3 用轻量 SVG/CSS 动效补上 HeatmapBg 与 TrailDraw，让 Cinema 大屏在整个 30 秒 cycle 中都有空间叙事。

## What Changes

- 新增 `HeatmapBg`：在地图底层持续显示紫红色保单密度热斑，使用前端累积的 `policy.created` 坐标，5 分钟窗口内重算/清理，不使用 canvas。
- 新增 `TrailDraw`：在 cinema STORY phase 开始后为当前主角绘制 7-10 秒的一笔画航迹，使用 SVG path stroke 动画，reduced motion 下直接显示完整路径。
- 扩展 `EventChoreographer`：继续保留 REAL 主角队列逻辑，同时把 `policy.created` 增量路由给 Heatmap 数据收集；TrailDraw 由 cinema phase/protagonist 触发，不由 WS 事件直接触发。
- 后端补发 `policy.created` WebSocket 事件（若实现现状仍缺失），不改变 `POST /policies` 响应结构，不新增 `/api/policy-density`。
- 修改 `cinema-engine` 现有 “C3 不渲染” 要求，使正式规范允许 C3 渲染 HeatmapBg 与 TrailDraw，同时继续禁止范围外动效。

## Capabilities

### New Capabilities

- `cinema-ambient`: 定义 C3 氛围装饰能力，包括 `policy.created` 数据点、HeatmapBg、TrailDraw、层级、生命周期、性能预算与 reduced motion。

### Modified Capabilities

- `cinema-engine`: 将事件编排与 overlay/layer 规范从 “C3 仍不渲染” 更新为 “C1/C2/C3 八个设计动效均可在对应层级渲染”，并明确 HeatmapBg 底层、TrailDraw overlay 层的交互约束。

## Acceptance Criteria

- 打开 `/` 后无需操作，地图区域持续存在 `HeatmapBg` SVG 热斑层，使用 radial-gradient 多焦点效果并保持 `pointer-events: none`。
- 收到 `policy.created` 事件后，Heatmap 数据点增量加入；超过 5 分钟的点被清理，burst 情况下 DOM/点数有上限。
- cinema 进入 STORY phase 后，当前主角航线在 7-10 秒窗口内出现 `TrailDraw` 一笔画；同一 cycle/protagonist 不重复触发。
- TrailDraw 不阻挡 GlobeMap 点击、wheel、drag、hover，也不影响 C1 manual takeover 或 C2 ShockWave/ChainBeam/FlareLand。
- reduced motion 下 HeatmapBg 不呼吸，TrailDraw 直接显示完整航迹。
- `openspec validate cinema-ambient --strict --no-interactive` 通过。

## Out of Scope

- 不重做 C1/C2 已实现的 CameraDirector、KPI tick、Radar AT RISK、ShockWave、ChainBeam、FlareLand。
- 不新增后端 `/api/policy-density` 聚合 endpoint。
- 不接真实链、不修改 `claim.settled` / `flight.landed` payload。
- 不引入 framer-motion、GSAP、canvas 热力图库或任何新依赖。
- 不动 `openspec/changes/rialo-captain-mvp/*`、`.agents/`、`graphify-out/`。

## Impact

- Affected specs: `cinema-ambient`（新增）、`cinema-engine`（修改事件编排与 overlay/layer 要求）。
- Affected backend code: `backend/ws/broadcaster.py`、`backend/policies/routes.py`、相关 backend tests（仅补 `policy.created` 广播）。
- Affected frontend code: `frontend/src/components/cinema/*`、`frontend/src/routes/TowerShell.tsx`、`frontend/src/store/eventStore.ts`/`useWebSocket` tests、Tower/Cinema integration tests。
- Dependencies: 不新增运行时或动画依赖。
