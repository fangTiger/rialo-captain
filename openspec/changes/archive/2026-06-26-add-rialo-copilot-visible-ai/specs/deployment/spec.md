## ADDED Requirements

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
