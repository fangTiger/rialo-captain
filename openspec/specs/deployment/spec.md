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
系统 SHALL 在生产构建前校验仓库内公开部署配置，任何缺失、占位值或非法 URL MUST 使构建失败并输出中文错误说明；系统 MAY 允许本地或 CI 环境变量覆盖仓库配置，但 Vercel 自动部署 MUST NOT 依赖手工配置这些公开变量。

#### Scenario: 仓库配置缺失时失败
- **WHEN** `frontend/deploy.config.json` 中的 `googleClientId`、`mapboxToken`、`apiBaseUrl` 或 `wsBaseUrl` 任一配置缺失
- **THEN** 校验脚本以非零状态退出
- **AND** 输出对应配置缺失的中文说明

#### Scenario: 临时登录模式允许缺省 Google OAuth
- **WHEN** 解析后的生产配置 `devLoginEnabled` 为 `true`
- **THEN** 校验脚本允许 `googleClientId` 为空
- **AND** 前端渲染 Dev Login 入口

#### Scenario: 仓库配置合法时通过
- **WHEN** 所有必需配置存在、不是占位值，且 API/WS 地址格式合法
- **THEN** 校验脚本以 0 状态退出

#### Scenario: 环境变量覆盖仓库配置
- **WHEN** CI 显式传入 `VITE_API_BASE_URL=https://preview-api.example.com`
- **THEN** 校验脚本使用该覆盖值校验 API base URL

### Requirement: 前端连接外部后端
系统 SHALL 允许前端 production build 通过 `frontend/deploy.config.json` 连接外部常驻后端，并允许 `VITE_API_BASE_URL` 与 `VITE_WS_BASE_URL` 覆盖仓库配置；本地开发和测试未配置这些变量时 MUST 保持同源代理行为。

#### Scenario: Production build 使用仓库 API base URL
- **WHEN** `frontend/deploy.config.json` 的 `apiBaseUrl` 为 `https://api.example.com`
- **THEN** production build 中 `apiFetch("/me")` 请求 `https://api.example.com/me`
- **AND** 请求继续携带 `credentials: "include"`

#### Scenario: 本地 API base URL 未配置
- **WHEN** 本地开发或测试中 `VITE_API_BASE_URL` 为空
- **THEN** `apiFetch("/me")` 请求 `/api/me`

#### Scenario: Production build 使用仓库 WebSocket base URL
- **WHEN** `frontend/deploy.config.json` 的 `wsBaseUrl` 为 `wss://api.example.com`
- **THEN** production build 中 `useWebSocket("/ws")` 连接 `wss://api.example.com/ws`

#### Scenario: 本地 WebSocket base URL 未配置
- **WHEN** 本地开发或测试中 `VITE_WS_BASE_URL` 为空
- **THEN** `useWebSocket("/ws")` 连接当前页面 host 的 `/ws`
