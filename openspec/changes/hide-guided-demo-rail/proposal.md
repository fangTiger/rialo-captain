# Change: Hide Guided Demo Rail From Default Tower

## Why
当前演示主要由熟悉产品的人手动完成，默认展示 `Start guide` 会让 Tower 首屏显得像教程页，并占用右侧风险预测 HUD 的核心空间。

## What Changes
- 默认 Tower 首页隐藏 Guided Demo Rail 和 `Start guide` 入口。
- 保留内部 guided demo 状态机与组件，可通过显式内部开关回归验证，不从普通 `/` 首屏暴露。
- 右侧风险预测 HUD 不再为 guide 预留第二行空间，桌面端保持风险预测面板自然贴右，窄屏端不再出现底部 guide rail。

## Impact
- Affected specs: `live-dashboard`
- Affected code: `frontend/src/routes/TowerShell.tsx`, `frontend/src/tests/tower-shell.test.tsx`
