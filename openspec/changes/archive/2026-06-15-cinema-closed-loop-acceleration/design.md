## Context

Cinema 已完成 C1/C2/C3 与后续 REAL 抢占闭环触发。当前真实下单链路为：

```text
POST /policies
  -> policy.created WS
  -> REAL protagonist 抢占
  -> AutoSeeder 立即 POST /inject-delay
  -> 等后台 ClaimEngine 30 秒轮询
  -> claim.triggered / claim.settled / flight.landed
  -> C2 timeline 等 cycle 第 15 秒释放 ShockWave
```

用户实测能看到 REAL 红色高亮和 `/inject-delay 200`，但几秒内看不到 ShockWave/ChainBeam/FlareLand。根因是后端 inject endpoint 没有立即驱动 ClaimEngine，加上前端关键时刻 gate 偏晚。

## Goals / Non-Goals

**Goals:**

- `/inject-delay` 成功后立即对目标航班运行 ClaimEngine 检测，真实下单无需等待 30 秒后台轮询。
- 保留后台 30 秒 `run_once()`，自然延误和旧 demo 路径仍能被周期检测。
- 把 DEMO 和 REAL 闭环视觉压缩到约 8 秒：ShockWave 5s、ChainBeam 6s、FlareLand 8s。
- TrailDraw 3s 开始，提前 2 秒铺垫 ShockWave。
- 增加 INFO 日志，让 `dev.sh` tail 能看到 checking / triggered / settled / landed。

**Non-Goals:**

- 不新增 API 或 payload 字段。
- 不改变 REAL 任意 phase 立即抢占、1 秒 burst、dedup、失败提示规则。
- 不缩短 30 秒 cycle，不重命名 phase。
- 不改变 HeatmapBg 5 分钟数据窗口。
- 不动 `rialo-captain-mvp`。

## Decisions

### 1. `run_for_flight(flight_id)` 做航班级即时扫描

在 `backend/claims/engine.py` 新增：

```py
async def run_for_flight(self, flight_id: str) -> RunSummary:
    ...
```

行为：

- 只查询 `Policy.status == ACTIVE` 且 `Policy.flight_id == flight_id` 的 policy。
- 使用与 `run_once()` 相同的 `_process()` 逻辑，确保 condition、adapter、广播、mock tx、block height 和 `flight.landed` 完全一致。
- 返回 `RunSummary`，便于 endpoint 测试断言立即触发数量。
- `run_once()` 保留全量 ACTIVE 扫描，但可内部复用同一个 `_run_policies()` helper，避免重复逻辑。

选择航班级扫描而不是直接在 `/inject-delay` 调 `run_once()`：当前 demo seed 已累积大量 ACTIVE policy，全量扫描会拖慢现场体验；而用户下单后的目标就是单个航班闭环。

### 2. 两个 inject endpoint 共享即时检测

`/admin/inject-delay` 与 `/inject-delay` 都通过 `_inject_delay_impl()` 写 `_DELAY_OVERRIDES`。实现阶段在该共享 impl 中拿到 `request.app.state.claim_engine`，写入 delay 后执行：

```py
summary = await engine.run_for_flight(body.flight_id)
```

然后返回原有 `InjectDelayResponse`，不改响应 schema。若未来测试 app 缺少 `claim_engine`，应显式失败并在测试中补齐 app state，而不是静默跳过；否则会重新制造“200 但没有闭环”的隐性失败。

### 3. ClaimEngine INFO 日志放在状态转换点

日志用于现场诊断，不参与业务逻辑：

- `checking flight=X policies=N`：`run_for_flight()` 查询出目标 policy 后输出。
- `triggered policy=X delay=Y`：condition 命中并准备 trigger claim 时输出。
- `settled policy=X tx=Y`：`claim.settled` payload 生成后输出。
- `landed flight=X`：`flight.landed` 广播前输出。

日志级别使用 INFO，保持 `LOG_LEVEL=INFO` 的 dev.sh 可见。异常日志继续保留现有 `logger.exception`。

### 4. 时间线压缩但保留 30 秒 cycle

本 change 只调整关键闭环的播放窗口：

```text
t=0s   establish + seed-demo / REAL inject
t=3s   DEMO inject-delay；TrailDraw 开始
t=5s   ShockWave STORY gate
t=6s   ChainBeam
t=8s   FlareLand
t=30s  cycle 结束
```

保留 `establish`、`zoom-in`、`story`、`zoom-out`、`rest` phase 名称和 30 秒总长，避免大范围回归 C1/C2/C3 状态机。`story` 仍从 7 秒开始作为 phase 名称，但 C2/C3 关键视觉允许基于 cycle elapsed 提前调度；测试应明确这是一条“关键时刻 gate”，不是 phase 边界重命名。

### 5. AutoSeeder DEMO inject 提前到 3 秒

`seed-demo` 仍在 establish 阶段立即运行。前端 DEMO `/inject-delay` 从第 12 秒改为第 3 秒：

- 2999ms 不调用。
- 3000ms 调用一次。
- 单 cycle 节流、manual/hidden/degraded gating 仍保持。

虽然当前 `/seed-demo` 后端会立即 run ClaimEngine，保留第 3 秒 DEMO inject 作为显式兜底，避免未来 seed-demo 改轻量后闭环断链。

### 6. C2/C3 gate 常量集中更新

`keyMomentTimeline.ts` 更新：

- `STORY_TRIGGER_AT_MS = 5_000`
- `CHAIN_AFTER_SHOCKWAVE_MS = 1_000`
- `FLARE_AFTER_CHAIN_MS = 2_000`

`useTrailDraw.ts` 更新：

- TrailDraw start 从 `7_000` 改为 `3_000`
- 生命周期窗口从 `7_000-10_000` 调整为 `3_000-6_000`

Reduced Motion 语义不变：仅影响动画表现，不影响调度时机。

## Risks / Trade-offs

- 即时 `run_for_flight()` 可能让 `/inject-delay` 响应等待 ClaimEngine 完整结算；目标是 demo 体验确定性，接受这点。若后续真实链变慢，可改为 background task，但本 change 使用 mock adapter。
- 如果目标航班已有大量 ACTIVE policy，仍可能触发多个 claim；这是现有业务模型行为。实现阶段测试应覆盖只扫描该 flight，不扫描其他 flight。
- STORY gate 提前到 5s 后，部分“story phase 7s”语义会与视觉 gate 分离；设计上接受，以用户体验优先，phase 名称留作兼容。
- `/seed-demo` 仍会持续创建 demo policy，数据卫生问题不在本 change 范围，但 run_for_flight 降低了 REAL 下单链路受其影响的风险。

## Migration Plan

1. 后端先写 RED：`run_for_flight()` 只处理指定航班 ACTIVE policy，非目标航班不触发。
2. 后端写 RED：`/inject-delay` 与 `/admin/inject-delay` 返回 200 前已触发真实 policy claim，无需测试再手动 `engine.run_once()`。
3. 后端实现 `run_for_flight()`、共享 helper、endpoint 接线和 INFO 日志到 GREEN。
4. 前端先写 RED：AutoSeeder 第 2999ms 不 inject，第 3000ms inject。
5. 前端写 RED：C2 4999ms 不显示 ShockWave，5000ms 显示；Chain 6000ms，Flare 8000ms。
6. 前端写 RED：TrailDraw 2999ms 不显示，3000ms 显示，6000ms 生命周期清理。
7. 更新常量到 GREEN，跑全量 pytest、vitest、build、OpenSpec validate。

## Open Questions

无阻塞问题。默认按用户确认的 5s / 3s / 2s 压缩方案执行。
