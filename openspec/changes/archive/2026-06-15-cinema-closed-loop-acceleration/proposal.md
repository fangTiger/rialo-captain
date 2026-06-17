## Why

用户实测反馈：

> demo 红色高亮看到了，但是走 seed-demo 太慢了，我觉得延迟 5 秒就够了

> 我 Buy 了任意金额，红色高亮确实有了，但是接下来几秒的动画依然没有

调查确认 REAL path 已经触发 `POST /inject-delay 200`，但该 endpoint 当前只写入内存延误，不会立即运行 ClaimEngine；后台 ClaimEngine 默认 30 秒轮询，且 C2 ShockWave 仍等到 cycle 第 15 秒释放，真实下单最坏约 45 秒才看到动效。这个等待时间不符合“真实下单后几秒内 tx hash 飘过”的杀手锏 demo 目标。

## What Changes

- 后端 `ClaimEngine` 新增 `run_for_flight(flight_id: str)`，只扫描该航班的 ACTIVE policy，保留现有 30 秒后台 `run_once()` 轮询。
- `/admin/inject-delay` 与 `/inject-delay` 在写入 `_DELAY_OVERRIDES` 后立即调用 `run_for_flight(flight_id)`，再返回响应。
- ClaimEngine 增加 INFO 日志：`checking flight=X policies=N`、`triggered policy=X delay=Y`、`settled policy=X tx=Y`、`landed flight=X`，便于 `dev.sh` tail 现场确认链路。
- 前端 DEMO `inject-delay` 时机从 cycle 第 12 秒提前到第 3 秒；`seed-demo` 仍在 establish 阶段立即执行。
- C2 STORY gate 从 cycle 第 15 秒提前到第 5 秒；ChainBeam 仍在 ShockWave 后约 1 秒播放；FlareLand 从 ChainBeam 后约 4 秒改为约 2 秒。
- C3 TrailDraw 从 cycle 第 7 秒提前到第 3 秒，保持比 ShockWave 早 2 秒亮起。
- 30 秒 cycle 总长、phase 名称、Camera spotlight、高亮、REAL 抢占规则、HeatmapBg 数据节奏保持不变。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `cinema-engine`: 修改 AutoSeeder DEMO inject 节奏、REAL 闭环触发后端检测语义、demo API inject-delay 行为。
- `cinema-key-moments`: 修改 ClaimEngine 即时航班扫描与 C2 STORY 时间窗。
- `cinema-ambient`: 修改 TrailDraw STORY 触发窗口，从 7-10 秒提前为 3-6 秒。

## Impact

- Affected backend:
  - `backend/claims/engine.py`
  - `backend/admin/routes.py`
  - `backend/tests/unit/test_claim_engine.py`
  - `backend/tests/integration/test_admin_routes.py`
  - `backend/tests/integration/test_reactive_e2e.py`
- Affected frontend:
  - `frontend/src/components/cinema/AutoSeeder.tsx`
  - `frontend/src/components/cinema/keyMomentTimeline.ts`
  - `frontend/src/components/cinema/useTrailDraw.ts`
  - Timeline/integration tests under `frontend/src/tests/`
- Affected specs:
  - `cinema-engine`
  - `cinema-key-moments`
  - `cinema-ambient`
- Dependencies:
  - 不引入新依赖。
- Out of scope:
  - 不改 30 秒 cycle 总长和 phase 名称。
  - 不改变 `/policies`、`claim.triggered`、`claim.settled`、`flight.landed` payload schema。
  - 不接真实链，不改 C1/C2/C3 视觉组件形态。
  - 不动 `rialo-captain-mvp`。
