## ADDED Requirements

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
