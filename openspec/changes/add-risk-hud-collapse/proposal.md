# Change: Add Risk HUD Collapse Control

## Why
隐藏 Guided Demo 后，右侧风险预测 HUD 成为主要信息卡片；演示时有时需要释放地图视野，因此预测卡片需要一键收起/展开，而不是只能永久占据完整右侧空间。

## What Changes
- 在 Tower 风险预测卡片内增加展开/收起按钮。
- 收起状态保留关键摘要：当前 subject、market odds、model probability、weather pressure。
- 展开状态恢复现有天气开关、分歧仪表、weather/details 控制和滚动详情。
- 不改变预测数据来源、天气图层开关语义、购买/赔付/证据/Copilot 行为。

## Impact
- Affected specs: `live-dashboard`
- Affected code: `frontend/src/components/tower/RiskIntelligencePanel.tsx`, `frontend/src/components/tower/RiskIntelligencePanel.css`, `frontend/src/tests/tower-shell.test.tsx`
