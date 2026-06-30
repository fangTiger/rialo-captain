## Context

Tower 首页当前已经包含 Cinema 自动播放、主角高亮、BuyDrawer 人工投保、购买后本地 fallback 关键时刻播放、AI Briefing、事件热斑和 ModeIndicator。用户在大屏上点击飞机会打开 BuyDrawer，确认购买后 `TowerShell` 已能把本次购买路由为 REAL protagonist，并按压缩时间线播放 TrailDraw、ShockWave、ChainBeam 和 FlareLand。

本变更不新增后端结算语义，也不绕过现有购买 API。它把已有能力包装为 Guided Demo Director：系统推荐、提示和锁定演示上下文；用户仍亲手完成购买；购买后由系统稳定播放闭环。

## Goals / Non-Goals

**Goals:**

- 在 Tower 首页提供可见的 Demo Director 入口与 Demo Rail。
- 把演示流程拆成可理解的人工步骤：选择航班、购买保障、观看结算回放。
- 允许用户在演示过程中点任意实时航班替换推荐主角。
- 在关闭购买抽屉、拖拽/缩放地图、进入 manual viewing 时保留演示上下文。
- 购买完成后复用现有 REAL protagonist 路由和购买后关键时刻播放，不重复实现结算动画。

**Non-Goals:**

- 不自动替用户创建保单。
- 不新增后端 API、不改变 `POST /policies`、`GET /flights/:id`、WebSocket 或 ClaimEngine 语义。
- 不新增动画库、状态管理库或大型页面重构。
- 不改变 dev login 默认可用能力。
- 不让 Copilot 执行买险、改保单或改变赔付结果。

## Decisions

1. **Demo Director 是前端状态机，不是后端演示任务。**
   - Rationale: 当前闭环演示所需的选择航班、打开 BuyDrawer、购买后播放关键时刻都在 Tower 首页可完成。前端状态机足以管理 `idle`、`select-flight`、`buy-cover`、`replay`、`paused`、`complete` 等 UI 状态。
   - Alternative considered: 新增后端 demo session。放弃，因为会扩大权限和持久化范围，并让“人工购买”的产品感变弱。

2. **购买前人工主导，购买后系统导演。**
   - Rationale: 用户亲自点击航班、选择保费并确认购买，能证明购买流是真实产品能力；购买后的压缩回放由系统导演，保证现场节奏稳定。
   - Alternative considered: 一键全自动购买。放弃，因为容易被理解为预制动画或后台脚本。

3. **推荐航班使用现有 DEMO protagonist / live flights 选择逻辑。**
   - Rationale: `chooseDemoProtagonist` 已经封装可定位、未落地和轮转语义。Demo Director 只消费推荐，不额外定义候选算法。
   - Alternative considered: 新建独立候选排序。暂不做，避免与 Cinema 主角选择产生双套规则。

4. **Demo Rail 不阻挡地图操作。**
   - Rationale: 演示要支持人工探索。拖拽、缩放、点击其它航班不应直接退出演示；只有 `Exit demo` 明确清理演示上下文。
   - Alternative considered: 用户任意操作退出 demo。放弃，因为这与“人工操作着更好”的方向相反。

5. **复用购买后事件链并增加可观测状态。**
   - Rationale: `TowerShell` 已经对 purchased policy 安排 TrailDraw、ShockWave、ChainBeam、FlareLand fallback 事件。Demo Director 只需要在购买完成后把 Rail 推到 replay/completed 状态，并展示用户可理解的进度。

## Risks / Trade-offs

- **Risk: Demo Rail 与 AI Briefing/地图控件重叠。** → 使用紧凑固定区域、响应式宽度和 `pointer-events` 控制，移动端下转为底部/顶部条。
- **Risk: 用户关闭 BuyDrawer 后不知道下一步。** → Demo Rail 保持在 `Buy cover` 并显示 Resume，可重新打开当前演示航班。
- **Risk: 用户点了其它航班导致状态错乱。** → 选择其它航班视为替换 demo subject，清理旧未完成购买上下文，但不退出 director。
- **Risk: 后端真实事件比 fallback 事件先到。** → 沿用现有 `hasPolicyEvent` 幂等判断，真实事件存在时不重复注入 fallback 视觉事件。
- **Risk: 测试受现有脏工作区影响。** → worker 必须限定写入 Demo Director 相关文件和 Tower 测试，不回滚现有未提交改动。
