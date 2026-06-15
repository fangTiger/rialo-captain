## 1. 回归测试

- [x] 1.1 新增前端测试，证明当前主角存在且 `claim.triggered` 无 locator 时仍渲染 ShockWave
- [x] 1.2 保留或确认无主角坐标时 ShockWave 安全不渲染
- [x] 1.3 新增 timeline 测试，证明后端 dated flight id 可匹配 callsign protagonist
- [x] 1.4 新增集成测试，证明不可解析 `airport_iata` 会回退到 protagonist 坐标
- [x] 1.5 新增 store 测试，证明重复 WebSocket payload 不会重复计入 C2/KPI

## 2. 实现修复

- [x] 2.1 调整 key moment 类型与解析逻辑，允许 ShockWave moment 缺少 locator
- [x] 2.2 复用现有 protagonist fallback 渲染路径，不改变 ChainBeam、FlareLand、KPI tick 行为
- [x] 2.3 调整 C2 timeline 主角匹配，兼容 `CALLSIGN-YYYYMMDD` 与 `CALLSIGN`
- [x] 2.4 调整 key moment 投影逻辑，不可解析事件 locator 时回退 protagonist 坐标
- [x] 2.5 调整 event store，对重复 flare 与 typed cinema payload 幂等入库

## 3. 验证

- [x] 3.1 运行相关 Vitest 覆盖 C2 回归
- [x] 3.2 重新运行 Playwright dashboard smoke 并确认 C1/C2/C3 截图生成
