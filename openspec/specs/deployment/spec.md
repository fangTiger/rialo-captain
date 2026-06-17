# deployment Specification

## Purpose
TBD - created by archiving change add-vercel-frontend-deploy. Update Purpose after archive.
## Requirements
### Requirement: Vercel 前端自动部署配置
系统 SHALL 提供 Vercel 可识别的部署配置，使 Git 触发的 Vercel 构建能够执行生产环境校验、构建 Vite SPA，并把静态产物发布为单页应用；配置 MUST 同时支持 Vercel 导入仓库根目录或将 Root Directory 设置为 `frontend/`。

#### Scenario: Vercel 构建 Vite SPA
- **WHEN** Vercel 在仓库根目录或 `frontend/` 目录执行项目构建
- **THEN** 构建命令先运行生产环境变量校验，再运行 `pnpm build`
- **AND** 发布目录为 `dist`
- **AND** 未命中静态资源的路由回退到 `/index.html`

### Requirement: 生产环境变量校验
系统 SHALL 在生产构建前校验 Vercel 所需公开环境变量，任何缺失、占位值或非法 URL MUST 使构建失败并输出中文错误说明。

#### Scenario: 关键变量缺失时失败
- **WHEN** `VITE_GOOGLE_CLIENT_ID`、`VITE_MAPBOX_TOKEN`、`VITE_API_BASE_URL` 或 `VITE_WS_BASE_URL` 任一变量缺失
- **THEN** 校验脚本以非零状态退出
- **AND** 输出对应变量缺失的中文说明

#### Scenario: 开发登录未关闭时失败
- **WHEN** `VITE_DEV_LOGIN_ENABLED` 的值不是 `false`
- **THEN** 校验脚本以非零状态退出
- **AND** 输出生产环境必须关闭 dev login 的中文说明

#### Scenario: 生产变量合法时通过
- **WHEN** 所有必需变量存在、不是占位值，且 API/WS 地址格式合法
- **THEN** 校验脚本以 0 状态退出

### Requirement: 前端连接外部后端
系统 SHALL 允许前端通过 `VITE_API_BASE_URL` 与 `VITE_WS_BASE_URL` 连接外部常驻后端，同时在未配置这些变量时保持本地同源代理行为。

#### Scenario: API base URL 已配置
- **WHEN** `VITE_API_BASE_URL` 为 `https://api.example.com`
- **THEN** `apiFetch("/me")` 请求 `https://api.example.com/me`
- **AND** 请求继续携带 `credentials: "include"`

#### Scenario: API base URL 未配置
- **WHEN** `VITE_API_BASE_URL` 为空
- **THEN** `apiFetch("/me")` 请求 `/api/me`

#### Scenario: WebSocket base URL 已配置
- **WHEN** `VITE_WS_BASE_URL` 为 `wss://api.example.com`
- **THEN** `useWebSocket("/ws")` 连接 `wss://api.example.com/ws`

#### Scenario: WebSocket base URL 未配置
- **WHEN** `VITE_WS_BASE_URL` 为空
- **THEN** `useWebSocket("/ws")` 连接当前页面 host 的 `/ws`
