## Why

用户实测反馈暴露了两个 C1 follow-up 问题：

- “我刷新浏览器后每次看到的都是一个红色点，可能是我之前选的？”
- “我在其他点新增一个事件后，并没有从我这个点有动画效果，而还是在刚才那个点中有动画且一直是那个”

根因分别是 DEMO 主角选择固定取第一架可用航班，以及后端 `policy.created.created_at` 使用 Unix 秒而前端按毫秒判断 60 秒 lookback，导致真实下单事件被当作旧事件丢弃。

## What Changes

- 修改 DEMO 主角选择：从可定位且未落地候选列表中按 index 轮转，不能永远固定第一架。
- 引入页面挂载级 session-only seed：刷新后首次 DEMO 主角应有机会不同，但不写入 localStorage/sessionStorage/cookie。
- 让 AutoSeeder 选择的 DEMO protagonist 写回 `CinemaState`，确保视觉高亮、Badge、seed-demo 使用同一主角。
- 增加 `setDemoProtagonist` cinema action，用于 establish cycle 设置当前 DEMO 主角。
- 修复 REAL `policy.created` 时间戳归一化：秒级 Unix timestamp 转毫秒，毫秒级保持不变。
- 检查并保持 ambient heatmap / key moments / protagonist queue 的时间单位处理一致性。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `cinema-engine`: DEMO 主角选择从固定第一候选改为候选轮转，并保持 REAL `policy.created` 抢占语义对后端秒级 timestamp 可用。

## Impact

- Affected specs: `cinema-engine`
- Affected frontend code:
  - `frontend/src/components/cinema/protagonist.ts`
  - `frontend/src/components/cinema/cinemaMachine.ts`
  - `frontend/src/components/cinema/CinemaContext.tsx`
  - `frontend/src/components/cinema/AutoSeeder.tsx`
  - `frontend/src/components/cinema/EventChoreographer.tsx`
  - `frontend/src/routes/TowerShell.tsx`
- Affected tests:
  - `frontend/src/tests/protagonist-queue.test.ts`
  - `frontend/src/tests/auto-seeder.test.tsx`
  - `frontend/src/tests/cinema-controller.test.tsx`
  - `frontend/src/tests/event-choreographer.test.tsx`
  - `frontend/src/tests/tower-shell.test.tsx`
- No backend API/schema change. Existing `policy.created` payload remains valid.
