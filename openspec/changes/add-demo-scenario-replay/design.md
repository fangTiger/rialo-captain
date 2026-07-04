## Context

当前 Tower 首页已经具备实时航班大屏、Guided Demo Rail、BuyDrawer 人工购买、购买后压缩时间线、Cinema key moments、Evidence Drawer 和首页 AI Briefing。`TowerShell` 在购买成功后会把 policy 路由为 REAL protagonist，并在缺少真实事件时用本地 fallback visual events 保障演示闭环。Evidence Drawer 已能加载持久化 timeline 并展示事件列表。

本变更只增强 demo 页面体验，不新增真实结算、真实支付、生产登录或真实多数据源能力。所有新增行为都应以 `demo-only` 的前端状态和现有 mock/demo 链路实现。

## Goals / Non-Goals

**Goals:**

- 让操作者在 Tower 首页选择一个演示场景，并看到场景目标、推荐动作和当前状态。
- 让购买后的 settlement 闭环可重放，避免现场只能等一次事件链。
- 让 Evidence Drawer 从静态事件列表升级为可逐步播放的故事化 timeline。
- 提供与场景相关的 Copilot prompt chips，但保持 Copilot 只读。
- 维持地图可操作、Demo Rail 不拦截地图、购买流程仍由用户亲手确认。

**Non-Goals:**

- 不新增后端 API。
- 不自动替用户购买保单。
- 不关闭或弱化 dev login。
- 不把 Copilot 改成 fake/mock/offline provider。
- 不引入动画库、全局状态库或大规模页面重构。

## Decisions

1. **Scenario Picker 作为 Demo Rail 的局部状态。**
   Guided Demo 已有 `demoDirector.ts` 状态机。场景选择只影响 rail 文案、推荐操作和购买后的 replay 控制，不需要持久化到后端。

2. **Settlement Replay 复用购买后事件链。**
   `TowerShell` 已经有购买后 fallback visual events。实现应提取或扩展现有调度逻辑，通过 replay token 重新安排同一 policy 的本地视觉事件，并在添加新 fallback 前继续检查 event store 幂等状态。

3. **Evidence Story 是 Drawer 内的展示模式。**
   Evidence API 仍返回同一 timeline。Drawer 本地维护 `activeEventIndex` 和播放状态，按 events 顺序高亮当前事件。空态、错误态和焦点管理保持现有行为。

4. **Copilot Prompt 只触发解释。**
   Demo prompt chips 只能询问或解释当前场景、购买、证据链，不得调用任何会改变 policy、claim、balance 或 replay 状态的业务方法。

## Risks / Trade-offs

- **Replay 与真实事件重复。** 使用 replay token 只重放视觉层事件；已存在同 policy/type 的真实事件时不覆盖业务状态。
- **Rail 太拥挤。** 场景选择使用紧凑按钮或 select-like 分段控件，保持 21rem 宽度和 narrow bottom layout。
- **Evidence 自动播放影响可访问性。** 默认不自动播放；用户点击 `Play evidence story` 后才轮播，且提供 Pause/Previous/Next。
- **测试脆弱。** 优先在 director helper 和组件层覆盖状态，再用 TowerShell 集成测试验证核心路径。
