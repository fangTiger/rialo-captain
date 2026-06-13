## ADDED Requirements

### Requirement: 全球控制塔大屏（The Tower）

系统 SHALL 在 `/` 路径渲染基于 Mapbox dark style 的全球地图，实时显示飞机雷达光点与航迹尾迹。

#### Scenario: 大屏初始加载
- **GIVEN** 用户访问 `/`
- **WHEN** 页面挂载
- **THEN** 后端 `/flights/live` 拉取数据 + WS 连接建立 + 渲染至少 50 个飞机光点

#### Scenario: 光点 hover 高亮航线
- **GIVEN** 大屏正在显示飞机光点
- **WHEN** 用户 hover 一个光点
- **THEN** 该航线高亮显示起点-终点 + 浮出迷你 Flight Card（callsign + ETA + 历史延误率）

#### Scenario: 赔付时光点闪绿
- **GIVEN** 收到 WS FLARE 事件 `{flight_id, payout, signature}`
- **WHEN** 该飞机的光点在视口内
- **THEN** 光点 400ms 内炸开为 `--accent-radar` (#00FF9D) 颜色 + glow 扩散至 32px，并触发 toast "+X RIA settled in Y.Yms"

#### Scenario: 雷达扫描动效
- **GIVEN** 大屏挂载完成
- **WHEN** 渲染稳定
- **THEN** 左上角持续运行 `radar-sweep` 动画（6 秒一圈），不阻塞地图交互

### Requirement: 6 页 SPA 信息架构

系统 SHALL 提供 6 个路由（`/` `/flight/:id` `/policies` `/claims` `/routes` `/rialo-inside`），桌面端 1280px+ 全部可达，浏览器 console 无 error、无 warning。

#### Scenario: 直接访问受保护路由
- **GIVEN** 用户直接打开 `/policies` 但未登录
- **WHEN** 页面挂载
- **THEN** 路由守卫跳转 `/login`，登录后回跳 `/policies`

#### Scenario: Flight Detail 以 drawer 形式呈现
- **GIVEN** 用户在 `/` 大屏上点击一个飞机光点
- **WHEN** 触发 navigation
- **THEN** 路由变为 `/flight/:id` 但底层大屏不卸载，详情以 slide-up drawer 浮在大屏之上

#### Scenario: Rialo Inside 滚动驱动动画
- **GIVEN** 用户访问 `/rialo-inside`
- **WHEN** 向下滚动
- **THEN** "传统多角色架构 vs Rialo 单合约架构" 对比动画按 5 个分段触发，每段 viewport 占比 100vh

### Requirement: WebSocket 实时事件总线

系统 SHALL 通过 `WS /ws` 广播三类事件：`state_update` / `FLARE` / `toast`，所有大屏组件 SHALL 订阅同一连接。

#### Scenario: 连接建立携带鉴权
- **GIVEN** 用户已登录、浏览器持有 JWT cookie
- **WHEN** 前端连接 `/ws`
- **THEN** 服务端校验 cookie、加入广播组、发送 `{type: "hello", server_time}` 帧

#### Scenario: 断线指数退避重连
- **GIVEN** WS 连接因网络断开
- **WHEN** 客户端检测到 close
- **THEN** 按 1s → 2s → 4s → ... → 30s 上限退避重连；底部 LED 显示重连中（黄色）

#### Scenario: state_update 节流广播
- **GIVEN** 后端航班 state 高频更新
- **WHEN** 广播给前端
- **THEN** 同一 flight_id 的 state_update 最少 1 秒一次（避免淹没大屏）

### Requirement: 全局 Design System

所有 UI 组件 MUST 仅使用 `frontend/src/design/tokens.css` 中声明的颜色与字体；ESLint 配置 MUST 阻止 Inter / Roboto / Arial / Fraunces / system-ui 字体的引入。

#### Scenario: 违规字体被 lint 阻止
- **GIVEN** 开发者在 CSS 或 JSX style 中写入 `font-family: "Inter"`
- **WHEN** 运行 `pnpm lint`
- **THEN** 报错并指明位置："禁用字体: Inter（来自 web-design-engineer skill 规约）"

#### Scenario: 颜色值必须使用 token
- **GIVEN** 开发者写入硬编码 `color: #00FF9D`
- **WHEN** 运行 stylelint
- **THEN** 警告："请使用 var(--accent-radar) 替代硬编码颜色"

#### Scenario: Pre-delivery Checklist 走查
- **GIVEN** 任一页面被认为 "完成"
- **WHEN** 走查 web-design-engineer skill 的 Pre-delivery Checklist
- **THEN** ≥ 90% 项打勾（console / 响应式 / 交互状态 / 字体 / 颜色 / 无 AI cliché）
