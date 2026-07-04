## ADDED Requirements

### Requirement: Evidence 结算路径终端化展示
Evidence Drawer 和证据时间线 SHALL 采用 Command Center 风格展示结算路径、事实事件、签名、完整性和上下文风险信号。视觉升级 MUST NOT 改变证据来源、事件顺序、签名语义或结算事实。

#### Scenario: Evidence Drawer 展示结算路径
- **WHEN** 用户打开 Evidence Drawer
- **THEN** Drawer SHALL 以终端化时间线展示 condition matched、claim triggered、claim settled、balance credited 等事件
- **AND** 每个事件 SHALL 显示可读状态、时间、签名或证据标识

#### Scenario: 上下文信号不冒充证据
- **GIVEN** Evidence Drawer 展示天气或市场上下文
- **WHEN** 用户查看证据
- **THEN** 天气和市场 SHALL 标记为 contextual signal
- **AND** 实际 settlement evidence SHALL 仍基于观测延误、合约条件和 claim/evidence 事件

#### Scenario: Evidence 交互保持
- **WHEN** 用户从 policy、claim、Copilot 或 Flight Detail 打开 Evidence Drawer
- **THEN** Drawer SHALL 保持现有打开/关闭、路由和引用行为
- **AND** 视觉装饰 SHALL 不阻挡关闭按钮、证据链接或滚动
