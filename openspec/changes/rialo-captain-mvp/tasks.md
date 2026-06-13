## 1. 项目骨架与开发环境
- [ ] 1.1 创建 `backend/` 与 `pyproject.toml`，初始化 FastAPI app + uvicorn 入口
- [ ] 1.2 创建 `frontend/` Vite + React 18 + TS 模板（含 ESLint 禁字体规则）
- [ ] 1.3 `scripts/dev.sh` 一键启动前后端 + Vite 代理 `/api`、`/ws` → 8000
- [ ] 1.4 `.env.example` + `pydantic-settings` 配置加载
- [ ] 1.5 删除占位 `main.py`，迁移到 `backend/app.py`

## 2. 数据层
- [ ] 2.1 SQLAlchemy 2.x async 模型：`users` / `flights` / `policies` / `claims` / `failed_triggers`
- [ ] 2.2 数据库初始化脚本（首次启动建表）
- [ ] 2.3 pytest in-memory SQLite 测试基础设施 + factory fixtures

## 3. 认证（auth-and-account）
- [ ] 3.1 Google OAuth ID token 校验端点 `POST /auth/google`
- [ ] 3.2 JWT cookie 中间件 + `GET /me` 端点
- [ ] 3.3 用户首次登录送 1000 RIA + 余额读写 service
- [x] 3.4 前端 Google Sign-In 按钮 + 登录后路由守卫
- [ ] 3.5 端到端 OAuth 集成测试（mock Google verify）

## 4. 航班数据（flight-data）
- [ ] 4.1 OpenSky HTTP client（httpx + 指数退避 + 30s 短缓存）
- [ ] 4.2 in-memory 活跃航班 cache + degraded mode 标记
- [x] 4.3 `GET /flights/live` + `GET /flights/:id` endpoints
- [x] 4.4 历史延误率统计（按 callsign 累积）
- [ ] 4.5 vcrpy 录制 OpenSky 响应做契约测试

## 5. 反应式合约抽象（reactive-insurance-core）
- [x] 5.1 `backend/contracts/base.py`：Protocol + `Condition` + `ContractRef` + `TxResult` 类型
- [x] 5.2 `MockRialoAdapter` 实现（`watch` / `fetch_external` / `trigger_claim` / `get_signature`）
- [x] 5.3 `RealRialoAdapter` 占位（NotImplementedError + 注释 SDK 公开后填）
- [ ] 5.4 Adapter 契约测试集（parametrize Mock 全绿，Real skip-if）
- [x] 5.5 `get_contract_adapter()` factory + `RIALO_MODE` 配置

## 6. 保险产品（reactive-insurance-core）
- [x] 6.1 PolicyService：费率算法（延误率 → 赔付倍率）+ 创建保单
- [x] 6.2 `POST /policies` + `GET /policies` endpoints
- [x] 6.3 ClaimEngine：asyncio 后台循环 + 触发逻辑 + 单失败隔离
- [x] 6.4 `GET /claims/recent` endpoint
- [ ] 6.5 admin endpoint `POST /admin/inject-delay`（手动注入模拟延误，演示用）
- [ ] 6.6 整套保险业务的契约测试（用 MockRialoAdapter）

## 7. 实时推送（live-dashboard）
- [ ] 7.1 WebSocket broadcaster 模块 + 事件类型 enum（state_update / FLARE / toast）
- [ ] 7.2 `WS /ws` endpoint + JWT cookie 鉴权 + hello 帧
- [ ] 7.3 前端 `useWebSocket` hook + 指数退避重连
- [ ] 7.4 底部 StatusBar 三态 LED（绿/黄/红）

## 8. Design System（live-dashboard）
- [ ] 8.1 `frontend/src/design/tokens.css`：全量颜色 / 字体 / 间距 / 圆角 / 阴影 token
- [ ] 8.2 全局 `grain-noise` overlay + `body` 应用
- [ ] 8.3 `radar-sweep` + `flare-burst` 动效 utility 类
- [ ] 8.4 ESLint rule：禁 `Inter` / `Roboto` / `Arial` / `Fraunces` / `system-ui` 字体引用

## 9. 前端页面（live-dashboard）
- [ ] 9.1 The Tower（Mapbox + 飞机光点 + 雷达扫描 + 侧栏事件流）
- [ ] 9.2 FlightDetail slide-up drawer（购买流程 + 历史延误率柱状图）
- [ ] 9.3 My Hangar 我的保单（三栏机库格）
- [ ] 9.4 Claims Feed 实时赔付时间线
- [ ] 9.5 Hot Routes 热门航线排行榜
- [ ] 9.6 Rialo Inside 滚动驱动技术揭秘动画页
- [ ] 9.7 顶部 nav + 底部 StatusBar 全局壳

## 10. 端到端验证与发布
- [ ] 10.1 Playwright E2E：登录 → 买险 → 注入延误 → 看到赔付到账
- [ ] 10.2 README（中英双语，含 demo gif、Google Cloud Console 步骤、OpenSky 注意事项）
- [ ] 10.3 web-design-engineer Pre-delivery Checklist 完整走查
- [ ] 10.4 录制 demo 视频 + Twitter 推文文案最终化
- [ ] 10.5 OpenSpec 归档（delta 合并到 `specs/`）
