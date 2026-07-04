## 1. Spec And Planning

- [x] 1.1 创建 OpenSpec proposal、design、spec delta 和 tasks。
- [x] 1.2 运行 `openspec validate add-demo-scenario-replay --strict --no-interactive`。
- [x] 1.3 写实现计划并按 disjoint ownership 拆分 worker/reviewer 任务。

## 2. Demo Scenario Picker

- [x] 2.1 先写失败测试：Guided Demo director 支持场景选择、场景文案和默认场景。
- [x] 2.2 实现 demo scenario 类型、默认列表和状态转换，保持现有 idle/select/buy/replay 兼容。
- [x] 2.3 先写失败测试：GuidedDemoRail 渲染场景选择、场景目标、下一步动作，且 narrow layout 不遮挡地图。
- [x] 2.4 实现 Rail UI，使用现有样式系统，不新增依赖。

## 3. Settlement Replay Controls

- [x] 3.1 先写失败测试：购买成功后 Demo Rail 显示 `Replay settlement`，点击后重新安排 demo visual replay。
- [x] 3.2 提取或扩展 TowerShell 购买后时间线调度逻辑，支持 replay token 幂等重放。
- [x] 3.3 先写失败测试：replay 期间不重复已有真实同类事件，不退出 Guided Demo，不打开真实业务 API。
- [x] 3.4 实现 replay 状态展示和完成状态更新。

## 4. Evidence Story Playback

- [x] 4.1 先写失败测试：Evidence Drawer 显示 story 控制、当前事件序号和高亮事件。
- [x] 4.2 实现 Previous/Next/Play/Pause 控制，默认停在第一条事件。
- [x] 4.3 先写失败测试：空态、错误态、关闭焦点恢复不受 story controls 影响。
- [x] 4.4 实现 story playback timer 清理和 reduced-motion 友好行为。

## 5. Demo Copilot Prompts

- [x] 5.1 先写失败测试：Demo Rail 或 Evidence Drawer 提供 demo-only Copilot prompt chips，点击只调用 Copilot ask。
- [x] 5.2 实现 prompt chips，确保不创建 policy、不触发赔付、不改 replay 状态。

## 6. Verification And Review

- [x] 6.1 worker 运行 focused Vitest：`guided-demo-director`、`guided-demo-rail`、`tower-shell`、`evidence-drawer`。
- [x] 6.2 reviewer 做 spec compliance review 和 code quality review，所有 Critical/Important 必须修复。
- [x] 6.3 运行 broader frontend test 或记录 pre-existing failure。
- [x] 6.4 运行 `openspec validate add-demo-scenario-replay --strict --no-interactive`。
- [x] 6.5 修改代码后重建 graphify code graph。

## 7. Experience Polish

- [x] 7.1 清理 Guided rail 可见文案中的 `DEMO/demo` 字样，仅保留内部命名不变。
- [x] 7.2 缩短购买后的轨迹启动和选中镜头聚焦时长，避免演示等待过长。
- [x] 7.3 将购买后 TrailDraw、ShockWave、ChainBeam、FlareLand 的节奏压缩到 2-5 秒窗口，并同步更新测试与 spec 描述。
