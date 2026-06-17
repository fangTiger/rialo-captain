## Why

项目已经具备前端构建和测试基础，但缺少 Vercel 自动部署所需的入口配置、生产环境变量校验，以及前端连接外部后端的运行时约定。

## What Changes

- 新增 Vercel 前端部署配置，支持从 `frontend/` 目录自动构建 Vite SPA。
- 新增生产环境变量校验脚本，部署前阻止缺少 Google、Mapbox、后端 API/WS 地址等关键配置的构建。
- 让前端 API 与 WebSocket 客户端支持通过 Vite 环境变量指向外部常驻后端。
- 更新示例环境变量，明确本地开发与 Vercel 生产部署的差异。

## Capabilities

### New Capabilities
- `deployment`: 覆盖 Vercel 前端自动部署、生产环境变量校验、SPA fallback 与外部后端连接约定。

### Modified Capabilities

## Impact

- Affected code: `frontend/vercel.json`, `frontend/scripts/ensure-production-env.mjs`, `frontend/src/api/client.ts`, `frontend/src/hooks/useWebSocket.ts`, frontend env examples and tests.
- Affected systems: Vercel front-end deployment, externally hosted FastAPI backend integration.
