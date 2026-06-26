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
- **AND** 解析后的生产配置 `devLoginEnabled` 不是 `true`
- **THEN** 校验脚本以非零状态退出
- **AND** 输出对应配置缺失的中文说明

#### Scenario: 临时登录模式允许缺省 Google OAuth
- **WHEN** 解析后的生产配置 `devLoginEnabled` 为 `true`
- **THEN** 校验脚本允许 `googleClientId` 为空
- **AND** 校验脚本允许 `apiBaseUrl` 为空以使用同源 `/api`
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

#### Scenario: 临时登录 Production build 使用同源 Vercel API
- **WHEN** production build 的 `devLoginEnabled` 为 `true`
- **AND** `frontend/deploy.config.json` 的 `apiBaseUrl` 为空
- **THEN** production build 中 `apiFetch("/auth/dev-login")` 请求 `/api/auth/dev-login`

#### Scenario: Production build 使用仓库 WebSocket base URL
- **WHEN** `frontend/deploy.config.json` 的 `wsBaseUrl` 为 `wss://api.example.com`
- **THEN** production build 中 `useWebSocket("/ws")` 连接 `wss://api.example.com/ws`

#### Scenario: 本地 WebSocket base URL 未配置
- **WHEN** 本地开发或测试中 `VITE_WS_BASE_URL` 为空
- **THEN** `useWebSocket("/ws")` 连接当前页面 host 的 `/ws`

### Requirement: DeepSeek V4 服务端配置

系统 SHALL 通过服务端环境变量配置 Rialo Copilot 的 DeepSeek V4 provider。前端构建配置 MUST NOT 包含 DeepSeek API key，生产和本地开发在未配置 key 时 MUST 以可理解方式降级。

#### Scenario: 服务端配置 DeepSeek key 后启用 Copilot
- **GIVEN** 后端环境设置 `DEEPSEEK_API_KEY`
- **AND** `DEEPSEEK_MODEL` 未设置
- **WHEN** 后端启动并处理 Copilot 请求
- **THEN** 系统使用默认 DeepSeek V4 模型 `deepseek-v4-pro`
- **AND** API key 仅在服务端使用，不出现在前端 bundle 或 REST 响应中

#### Scenario: 服务端配置自定义 DeepSeek 模型
- **GIVEN** 后端环境设置 `DEEPSEEK_API_KEY` 与 `DEEPSEEK_MODEL=deepseek-v4-flash`
- **WHEN** 后端处理 Copilot 请求
- **THEN** 系统调用配置的 `deepseek-v4-flash`
- **AND** Copilot 响应中的 `model` 字段反映实际使用模型

#### Scenario: 前端生产构建不要求 DeepSeek key
- **GIVEN** 前端执行 production build
- **WHEN** 构建环境没有 `DEEPSEEK_API_KEY`
- **THEN** 前端构建不得失败
- **AND** 构建产物不得包含 DeepSeek API key 占位值

#### Scenario: 本地未配置 key 时可继续 demo
- **GIVEN** 本地开发后端未配置 `DEEPSEEK_API_KEY`
- **WHEN** 用户使用 dev login 进入产品并点击 Ask Rialo
- **THEN** Copilot 面板显示 AI provider 未配置的降级状态
- **AND** dev login、航班、保单、赔付和证据回放仍正常工作

### Requirement: DeepSeek Copilot 服务端运行时配置

系统 SHALL 通过服务端运行时环境变量或服务端 `.env` 配置 Rialo Copilot 的 DeepSeek V4 provider。前端构建配置 MUST NOT 包含 DeepSeek API key，生产和本地开发在未配置 key 时 MUST 以可理解方式降级。

#### Scenario: 服务端环境变量启用 Copilot
- **GIVEN** 后端进程环境变量包含 `DEEPSEEK_API_KEY`
- **WHEN** 服务启动并处理 Copilot 问题
- **THEN** 系统使用该 key 调用 DeepSeek V4
- **AND** 默认模型为 `deepseek-v4-pro`
- **AND** 前端响应或构建产物不包含该 key

#### Scenario: 服务端 .env 启用 Copilot
- **GIVEN** 服务端 `.env` 包含 `DEEPSEEK_API_KEY`
- **WHEN** 后端 Settings 初始化
- **THEN** 系统从 `.env` 读取 key
- **AND** `.env` 保持 git ignored
- **AND** 前端不读取该配置

#### Scenario: 未配置 key 时流式降级
- **GIVEN** 后端未配置 `DEEPSEEK_API_KEY`
- **WHEN** 已登录用户提交 `POST /copilot/ask/stream`
- **THEN** 后端返回可展示的 unavailable 或 `error` 事件
- **AND** 事件不泄漏密钥值
- **AND** 原页面功能保持可用

#### Scenario: 流式响应禁用代理缓冲
- **GIVEN** 后端返回 Copilot SSE 响应
- **WHEN** 客户端开始读取 stream
- **THEN** 响应 header 包含 `Content-Type: text/event-stream`
- **AND** 包含 `Cache-Control: no-cache, no-transform`
- **AND** 服务端按 DeepSeek chunk 到达顺序刷新事件
