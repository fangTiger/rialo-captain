## MODIFIED Requirements

### Requirement: Evidence Drawer 证据链回放
系统 SHALL 在前端提供 Evidence Drawer，用于按需加载并展示 policy 或 claim timeline。Drawer MUST 使用持久化 API 数据，不得依赖仅存在于前端内存中的 WebSocket event store。Drawer SHALL 支持 demo story playback 模式，用于逐步播放和高亮 timeline 中的证据事件。

#### Scenario: 从 claim 打开证据链
- **GIVEN** 用户在 Claims Feed 中看到一条赔付记录
- **WHEN** 用户点击该行的 Evidence 操作
- **THEN** Evidence Drawer SHALL 打开
- **AND** 前端 SHALL 请求 `GET /claims/{claim_id}/timeline`
- **AND** Drawer SHALL 渲染 timeline 事件标题、时间、source 与摘要

#### Scenario: 从 policy 打开证据链
- **GIVEN** 用户在 My Hangar 或 Flight Detail 中看到一张保单
- **WHEN** 用户点击该保单的 Evidence 操作
- **THEN** Evidence Drawer SHALL 打开
- **AND** 前端 SHALL 请求 `GET /policies/{policy_id}/timeline`

#### Scenario: 播放证据故事
- **GIVEN** Evidence Drawer 已加载至少 2 条 timeline events
- **WHEN** 用户点击 `Play evidence story`
- **THEN** Drawer SHALL 高亮当前 evidence event
- **AND** Drawer SHALL 显示当前序号，如 `1 / N`
- **AND** Drawer SHALL 按事件顺序推进当前高亮
- **AND** 用户 SHALL 可以点击 `Pause evidence story` 暂停推进

#### Scenario: 手动切换证据故事事件
- **GIVEN** Evidence Drawer 已加载 timeline events
- **WHEN** 用户点击 `Next evidence event` 或 `Previous evidence event`
- **THEN** Drawer SHALL 更新当前高亮事件
- **AND** Drawer SHALL NOT 重新请求 timeline API
- **AND** Drawer SHALL NOT 关闭当前页面或影响原列表导航

#### Scenario: 证据链空态
- **GIVEN** timeline API 返回空 events 数组
- **WHEN** Evidence Drawer 渲染
- **THEN** Drawer SHALL 显示空态文案 `No evidence events yet`
- **AND** Drawer SHALL 不显示 story playback 控制
- **AND** Drawer SHALL 保持可关闭

#### Scenario: 证据链请求失败
- **GIVEN** timeline API 返回 404 或网络错误
- **WHEN** Evidence Drawer 渲染
- **THEN** Drawer SHALL 显示错误状态
- **AND** Drawer SHALL 不显示 story playback 控制
- **AND** Drawer SHALL NOT 关闭当前页面或破坏原有列表导航
