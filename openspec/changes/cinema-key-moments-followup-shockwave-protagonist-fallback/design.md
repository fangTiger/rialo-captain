## Context

C2 的 `ShockWaveMoment` 当前要求 `locator` 必填；`parseMomentFromEvent()` 在 `claim.triggered` 缺少经纬度、可解析机场坐标时直接返回 `missing-coordinates`。但 `TowerShell` 的 `KeyMomentLayer` 已经提供 `activeMoment.moment.locator ?? protagonistLocator` 逻辑，理论上可以用当前主角坐标兜底，只是 ShockWave moment 在进入队列前被丢弃了。

## Approach

最小修复放在前端 key moment 归一化层：

- 将 `ShockWaveMoment.locator` 调整为可选字段。
- `claim.triggered` 仍优先解析 payload 中的 `longitude/latitude`、`airport_longitude/airport_latitude` 或 `airport_iata`。
- 如果 payload 没有 locator，不再在 `parseMomentFromEvent()` 阶段丢弃，而是创建不带 locator 的 ShockWave moment。
- 渲染层继续使用现有 fallback：moment locator 存在则用事件坐标，否则用当前 protagonist 坐标；两者都没有时 `projectMomentPoint()` 返回 null，DOM 不渲染且不抛错。
- `advanceKeyMomentTimeline()` 在匹配当前主角时，将 `CALLSIGN-YYYYMMDD` 形式归一为 `CALLSIGN` 参与比较；精确 full id 匹配仍保持不变。

## Alternatives

- 后端在 `claim.triggered` payload 中补经纬度：这也合理，但需要 ClaimEngine 拿到 flight cache 或先修 FlightFetcher 的 `last_state` 持久化，范围超过本次 smoke 暴露的前端兜底缺口。
- 在 Playwright 中只断言 ChainBeam：这会降低 C2 验收强度，不能证明 ShockWave 路径真实可用。
- 让 Playwright 伪造 `flight_id: "BA178"`：这会绕过真实后端 schema，不能覆盖真实 smoke 暴露的 dated flight id 接缝。

## Verification

- 新增或扩展 Vitest：当前主角存在、`claim.triggered` 无 locator 时仍渲染 `shockwave`。
- 新增 timeline Vitest：后端 full flight id 可以匹配 callsign protagonist。
- 保持现有 key moment parser/集成测试通过。
- 重新运行指定 Playwright smoke，确认 C2 三个截图全部生成。
