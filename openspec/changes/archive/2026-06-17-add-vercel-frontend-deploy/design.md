## Context

当前项目是 `frontend/` Vite SPA 加 `backend/` FastAPI。前端可以静态构建，但生产部署缺少 Vercel 配置；后端包含 WebSocket、SQLite 和后台轮询任务，不适合直接作为 Vercel 静态站的一部分部署。因此本变更把 Vercel 自动部署范围限定为前端，并通过环境变量连接外部常驻后端。

## Goals / Non-Goals

**Goals:**
- Vercel 从仓库根目录或 `frontend/` 目录自动构建并发布 Vite SPA。
- 生产构建前校验关键公开环境变量，避免占位值进入部署。
- 前端 API 与 WebSocket 客户端可通过 `VITE_API_BASE_URL`、`VITE_WS_BASE_URL` 指向外部后端。
- 保持本地开发默认行为不变，继续使用 Vite `/api`、`/ws` 代理。

**Non-Goals:**
- 不把 FastAPI 后端迁入 Vercel Functions。
- 不在本变更中迁移 SQLite 到 Postgres。
- 不改变认证、保单、赔付或影院大屏业务行为。

## Decisions

- **前端优先部署到 Vercel，后端外部托管。** Vercel 负责静态前端，后端另行使用支持常驻进程和 WebSocket 的平台。这样不会牺牲当前后台轮询和实时推送模型。
- **构建时强校验生产环境变量。** 参考 ArcPredict 的做法，在 `pnpm build` 前运行 Node 脚本，缺少 Google Client ID、Mapbox token、API/WS base URL 或 dev login 未关闭时直接失败。
- **客户端保留同源默认值。** 未设置 `VITE_API_BASE_URL` 时请求仍走 `/api`，未设置 `VITE_WS_BASE_URL` 时 WebSocket 仍走当前 host 的 `/ws`，从而兼容现有本地开发代理和测试。
- **Vercel 配置只处理 SPA fallback。** 根目录 `vercel.json` 支持直接导入仓库，`frontend/vercel.json` 支持把 Root Directory 设置为 `frontend/`；跨域 API/WS 不通过 Vercel rewrite 绑定，避免把后端域名写死进配置。

## Risks / Trade-offs

- 生产后端域名配置错误会导致页面可打开但数据不可用 → 构建脚本校验 URL 格式，并通过 `.env.example` 明确填写方式。
- 跨域 cookie 登录需要后端 CORS 和 cookie 域配置配合 → 本变更只准备前端连接能力，后续后端部署时必须配置允许的 Vercel origin。
- Mapbox token 是公开前端变量 → 校验仅保证不是占位值，不把它当密钥处理。
