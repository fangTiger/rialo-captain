## Why

Rialo-Captain 的 Cinema 大屏已经能展示实时航班、人工投保、延误触发和自动赔付动效，但现场演示仍依赖操作者记住步骤。需要一个“人工引导、系统导演”的演示模式，让用户亲手完成投保，同时保证后续闭环稳定、可解释、可复盘。

## What Changes

- 在 Tower 首页新增 Guided Demo Director 入口与 Demo Rail，显示 `Select flight -> Buy cover -> Settlement replay` 的演示进度。
- 启动演示后，系统推荐并高亮一个适合演示的航班；用户可以选择推荐航班，也可以点任意实时航班替换本次演示主角。
- 购买前保持人工主导：用户必须打开购买抽屉、选择保费并亲手确认购买；系统不得自动创建保单或绕过现有购买流程。
- 购买完成后系统进入导演式闭环：锁定本次主角、沿用现有购买后 Cinema 事件链播放 TrailDraw、ShockWave、ChainBeam、FlareLand，并在 Demo Rail 中展示后续状态。
- 人工操作不退出演示：拖拽/缩放地图只进入 manual viewing；点其他飞机可切换主角；关闭购买抽屉暂停在当前步骤；用户可 Resume 或 Exit。
- 保持 dev login、真实 Copilot provider、本地 AI 禁令、现有 Cinema 自动播放、BuyDrawer、Evidence Drawer 和 Copilot 只读边界不变。

## Capabilities

### New Capabilities

- 无。该变更增强现有大屏和 Cinema 能力，不新增独立能力域。

### Modified Capabilities

- `live-dashboard`: 增加 Tower 首页 Guided Demo Director 入口、Demo Rail、人工选择/购买流程和可恢复演示状态。
- `cinema-engine`: 增加演示主角锁定、人工操作兼容和购买后导演式闭环的状态约束。

## Impact

- Affected specs: `live-dashboard`, `cinema-engine`
- Affected frontend: `frontend/src/routes/TowerShell.tsx`, 新增或修改 `frontend/src/components/demo/*`, `frontend/src/components/drawer/BuyDrawer.tsx` 如需演示上下文提示，相关 Tower/Cinema Vitest 测试
- Affected backend: 无预期新增 API；继续复用 `POST /policies`、现有 Cinema fallback 事件链和已有 admin/demo 能力
- Affected tests: `frontend/src/tests/tower-shell.test.tsx`，新增 Demo Director 组件/状态测试，必要时补充 BuyDrawer 回归
- Dependencies: no new runtime dependency expected
