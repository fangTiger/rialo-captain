## Context

ArcPredict 的 `web/vercel.json` 只声明 build command 与 framework，公开链配置则散落在 `.env.example` 和源码默认值中，例如 `lib/chain.ts` 的 RPC fallback、`lib/addresses.ts` 的合约地址。Rialo-Captain 当前要求 Vercel 提供多个 `VITE_*` 环境变量，部署手工步骤偏多。

## Goals / Non-Goals

**Goals:**
- 把公开生产默认配置落到仓库文件中，Vercel 不配置 env 也能构建。
- 保持本地开发默认代理行为，避免开发环境误连生产后端。
- 继续允许 env 覆盖，方便临时 preview 或 CI 测试。

**Non-Goals:**
- 不把后端私密配置、JWT secret、admin token 写入前端仓库配置。
- 不解决外部后端实际托管域名和 Google OAuth 应用的最终真实值问题。

## Decisions

- **使用 JSON 作为配置源。** `frontend/deploy.config.json` 同时可被 Node 校验脚本读取，也可被 Vite/TypeScript 前端导入，避免 JS/TS 双份常量漂移。
- **生产使用仓库配置，本地保持代理。** `import.meta.env.PROD` 为 true 时 API/WS 默认读 checked-in base URL；dev/test 下未显式设置 env 时继续走 `/api`、当前 host `/ws`。
- **校验公开值格式而非真实性。** Google Client ID、Mapbox token、后端 URL 都是公开运行时值，脚本校验格式和占位值，真实账号有效性由部署后的服务验证。

## Risks / Trade-offs

- 仓库内默认值如果仍是占位域名，Vercel 构建可通过但运行时请求会打到错误后端 → README 明确替换位置，校验脚本阻止明显占位值。
- 前端仓库会包含 public token → 只放 Google Client ID / Mapbox public token 等公开值，不放服务器密钥。
