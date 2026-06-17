# Change: 登录首页 Tower 风格重设计

## Why
当前 `/login` 已有右上角 `Latch APP` 入口和 DEV 登录弹层，但整体仍缺少与 Tower 大屏一致的产品气质。登录首页需要成为进入 Tower 前的高端、极简、动态入口，而不是独立于主应用视觉系统的营销页。

## What Changes
- 将登录首页视觉系统收敛到 Tower 现有色彩：`--surface-*` 暗色层、`--accent-radar` 雷达绿、少量 `--warn-amber` 和 `--danger-flare`。
- 将首页构图改为极简高端的动态仪表面：少文字、大留白、雷达/航迹/热力动态背景，保留 `Latch APP` 右上角入口。
- 重做 DEV 登录卡片，使其像 Tower 操作面板：深色玻璃层、雷达绿状态反馈、清晰输入/按钮状态。
- 强化响应式与交互状态：桌面、移动端均不溢出，按钮/输入/弹层具备 hover/focus/active/disabled/loading 状态。
- 更新登录页测试，覆盖首页的 Tower 风格结构、动态层语义入口、DEV 弹层行为和登录提交。

## Impact
- Affected specs: `auth-and-account`
- Affected code:
  - `frontend/src/routes/Login.tsx`
  - `frontend/src/routes/Login.css`
  - `frontend/src/tests/login.test.tsx`
- Non-goals:
  - 不修改 `/auth/google`、`/auth/dev-login` 或 JWT/cookie 后端行为。
  - 不修改 Tower 大屏运行逻辑。
  - 不引入新外部动画库，优先使用 React/CSS 动画和现有设计 tokens。
