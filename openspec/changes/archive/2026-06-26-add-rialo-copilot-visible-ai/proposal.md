# Change: Add Rialo Copilot Visible AI

## Why

当前产品已经具备航班、保单、赔付和证据回放能力，但 AI 能力没有成为用户第一眼可感知的产品心智。需要引入基于 DeepSeek V4 的 Rialo Copilot，把“为什么赔、哪里有风险、下一步看什么”直接嵌入 Tower、航班详情、保单和赔付证据链。

## What Changes

- 新增 Rialo Copilot 后端能力：服务端调用 DeepSeek V4，基于当前用户的航班、保单、赔付和证据上下文生成结构化回答、引用来源和追问建议。
- 新增显眼的前端 AI 入口：TopNav 固定 `Ask Rialo` 入口、Tower 首页 AI Briefing、航班/保单/赔付/证据抽屉中的上下文 prompt chips。
- 新增 AI 回答面板：以 drawer/panel 形式展示回答、引用、追问和降级状态，明确标注“基于当前数据和证据”。
- 增强认证与数据边界：Copilot API 必须走 JWT cookie 鉴权，只能读取当前用户可见数据，不向前端暴露 DeepSeek 密钥。
- 增强部署配置：新增 DeepSeek V4 服务端环境变量和本地/生产缺省行为，未配置密钥时前端展示可理解的不可用状态。

## Capabilities

- New: `rialo-copilot`
- Modified: `live-dashboard`
- Modified: `auth-and-account`
- Modified: `deployment`

## Impact

- Affected specs: `rialo-copilot`, `live-dashboard`, `auth-and-account`, `deployment`
- Affected backend: `backend/app.py`, `backend/config.py`, new `backend/copilot/*`, backend tests
- Affected frontend: shell navigation, Tower dashboard, flight detail, policies, claims, evidence drawer, new copilot components/hooks/tests
- External dependency: DeepSeek V4 OpenAI-compatible chat completions via server-side HTTP client
- Security review: required because the change introduces authenticated AI data access and external model calls
