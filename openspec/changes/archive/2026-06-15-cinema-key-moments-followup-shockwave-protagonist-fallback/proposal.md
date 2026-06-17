## Why

Playwright smoke 暴露出 C2 闭环中 `claim.triggered` 已经到达前端，但 mock/live Flight 的 `origin`/`destination` 不是可解析 IATA，导致 ShockWave 被前端解析阶段丢弃。当前主角本身已有可投影坐标，应该作为 C2 ShockWave 的兜底定位来源。

## What Changes

- 允许 `claim.triggered` 在缺少经纬度或可解析 `airport_iata` 时进入 key moment queue。
- 允许 C2 timeline 将后端 `CALLSIGN-YYYYMMDD` flight id 与前端 DEMO protagonist callsign 视为同一航班。
- ShockWave 渲染时复用现有 `KeyMomentLayer` 的 protagonist 坐标兜底，不影响 ChainBeam、FlareLand 或 KPI tick。
- 增加回归测试覆盖当前主角坐标兜底路径，并保留无坐标时安全丢弃的降级行为。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `cinema-key-moments`: 明确 ShockWave 在事件缺少 locator 但当前主角可投影时 SHALL 使用当前主角坐标渲染，并兼容后端 dated flight id 与前端 callsign protagonist 匹配。

## Impact

- Affected specs: `cinema-key-moments`
- Affected code: `frontend/src/components/cinema/keyMoments.ts`, `frontend/src/routes/TowerShell.tsx`, C2 相关前端测试与 Playwright smoke
- APIs/dependencies: 无新增 API 或依赖
