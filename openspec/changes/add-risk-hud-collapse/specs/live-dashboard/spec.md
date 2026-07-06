## ADDED Requirements

### Requirement: Tower 风险预测 HUD 展开与收起
系统 SHALL 允许用户在 Tower 首页展开或收起右侧风险预测 HUD。默认状态 SHALL 为收起。收起时系统 SHALL 保留当前 subject、market odds、model probability 和 weather pressure 摘要，并隐藏天气开关、详情控制、watchlist 和长解释内容。再次展开时系统 SHALL 恢复完整风险预测 HUD。该交互 MUST NOT 渲染 Guided Demo Rail、改变天气图层当前可见性、创建 policy、触发 Copilot 或改变路由。

#### Scenario: 默认收起风险预测 HUD
- **GIVEN** 用户进入 Tower 首页
- **WHEN** 页面渲染右侧风险预测 HUD
- **THEN** 风险预测 HUD SHALL 默认处于收起状态
- **AND** HUD SHALL 显示当前 subject、market odds、model probability 和 weather pressure 摘要
- **AND** HUD SHALL 隐藏 `Weather risk layer`、`DETAILS` 和 watchlist 内容
- **AND** Tower 首页 SHALL NOT 渲染 Guided Demo Rail

#### Scenario: 重新展开风险预测 HUD
- **GIVEN** 风险预测 HUD 已处于收起状态
- **WHEN** 用户点击 `Expand risk panel`
- **THEN** 风险预测 HUD SHALL 恢复展开状态
- **AND** `Weather risk layer` 开关和 `DETAILS` 控制 SHALL 再次可见
- **AND** 天气图层当前可见性 SHALL 保持不变
