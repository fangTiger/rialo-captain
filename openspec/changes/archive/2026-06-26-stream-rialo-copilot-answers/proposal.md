## Why

当前 Rialo Copilot 已能调用 DeepSeek V4，但回答必须等完整 JSON 返回后才渲染，用户在等待期间感知弱；同时 overview 上下文主要来自当前用户已有保单和赔付，未覆盖 Tower 地图正在展示的 live flights，容易让 AI 给出“当前没有航班/没有风险”的误导性回答。

本变更让 Copilot 像 `arc-lepton` research 一样把推理过程和答案逐步呈现在页面上，并把 Tower 实时航班快照纳入 overview 上下文，使 AI 能力更显眼、更可信。

## What Changes

- 新增 Rialo Copilot 流式回答 API，服务端通过 SSE 事件输出 context、answer delta、suggestions、done 和 error。
- 保留现有 `POST /copilot/ask` 非流式端点作为兼容 fallback。
- 增强 overview 上下文：纳入 live tower 航班快照、数据新鲜度、样本航班和用户已承保风险摘要。
- 调整 DeepSeek prompt，要求在没有用户保单时明确区分“无承保敞口”和“Tower 仍有 live flights”，并禁止建议不存在的业务动作。
- 首页 AI Briefing 改为内嵌流式回答舱位，用户不需要打开弹框即可在 Tower 第一屏提问并看到实时回答。
- 深层航班、保单、赔付和证据入口可继续使用现有 Copilot 侧栏，但推荐问题和模型建议 MUST 限制为最多 5 条。
- 后端发送给 DeepSeek 的 overview 上下文 MUST 控制体量，只发送摘要和最多 5 条代表性 live flights。
- 增加流式解析、取消/关闭、错误降级和 live context 的测试覆盖。

## Capabilities

### New Capabilities
- `rialo-copilot`: DeepSeek V4 backed Copilot question answering, including streaming answers, scoped product context, source citations, and UI-visible AI state.

### Modified Capabilities
- `live-dashboard`: Tower overview data can be summarized for Copilot without exposing provider secrets or unrelated user-owned records.
- `deployment`: Local and production runtime configuration documents DeepSeek key loading, stream timeout, and safe fallback behavior.

## Impact

- Affected backend: `backend/copilot/*`, `backend/flights/*`, `backend/app.py`, backend Copilot and flight tests.
- Affected frontend: `frontend/src/api/copilot.ts`, `frontend/src/components/copilot/*`, Copilot panel/provider tests.
- API changes: add `POST /copilot/ask/stream` with `text/event-stream`; keep `POST /copilot/ask`.
- External dependency: DeepSeek V4 OpenAI-compatible streaming chat completions.
- Security: DeepSeek API key remains server-side only; streamed events must use the same JWT cookie authentication and user data boundary as non-streaming Copilot.
