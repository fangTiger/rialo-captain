## Why

Vercel 自动部署不应要求在 Vercel UI 手工录入公开前端配置；这些非密钥值应该像 ArcPredict 一样由仓库内文件提供默认值，便于 Git 推送后自动构建。

## What Changes

- 新增仓库内公开部署配置文件，集中保存 Google Client ID、Mapbox public token、API/WS base URL 与 dev-login 开关的生产默认值。
- 生产环境校验脚本优先读取仓库配置，并允许本地/CI env 覆盖，但 Vercel 不再必须配置这些公开变量。
- 前端 production build 使用仓库部署配置连接后端；本地开发未配置 env 时仍保持 `/api`、`/ws` 代理行为。
- 更新部署文档，明确 ArcPredict 配置位置与当前项目配置位置。

## Capabilities

### New Capabilities

### Modified Capabilities
- `deployment`: 生产配置来源从 Vercel 环境变量必填调整为仓库内公开配置优先。

## Impact

- Affected code: `frontend/deploy.config.json`, `frontend/src/config/deployment.ts`, `frontend/scripts/ensure-production-env.mjs`, API/WS client config usage, tests, README, deployment spec.
- Affected systems: Vercel automatic frontend deployment.
