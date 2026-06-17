# Design: 登录首页 Tower 风格重设计

## Design Decisions
- Color palette: 只使用 Tower 现有 tokens 为主色，背景为 `--surface-0` / `--surface-1` / `--surface-2`，主强调为 `--accent-radar`，警示与错误仅使用 `--warn-amber` / `--danger-flare`。
- Typography: 标题使用 `--font-display`，导航、状态、输入使用 `--font-mono`，不引入 Inter / Roboto / Arial 或新的品牌字体。
- Spacing system: 使用 4px 基础网格，桌面首屏最大宽度约 1120px，Hero 内容保持大留白和低信息密度。
- Border-radius strategy: 延续项目现有 `--radius-sharp` / `--radius-soft`；页面不使用大圆角营销卡片。
- Shadow hierarchy: 使用暗色层叠、细边框、雷达绿微光和 `backdrop-filter`；避免彩色渐变大背景。
- Motion style: 使用 Tower 语义的持续动态：雷达扫描、航迹漂移、细网格相位、事件脉冲。使用 CSS keyframes + React 状态，不使用 `scrollIntoView`。

## Visual Concept
首页不是营销落地页，而是“进入 Tower 前的一秒”：用户看到同一个黑色雷达空间、同一套绿色状态语言、同一类微弱扫描和航迹运动。页面内容保持极简，重点是品牌名、一个明确动作入口，以及 DEV/正式登录面板的高级感。

## Architecture
- `Login.tsx` 继续负责登录状态、DEV 弹层开关、表单提交和语义结构。
- `Login.css` 负责视觉系统和动画，不在组件内堆 inline style。
- 动态背景拆成可测试的语义层：
  - `login-radar-field`: 雷达/网格背景层。
  - `login-flight-trails`: 航迹线或漂移点层。
  - `login-pulse-layer`: 事件脉冲层。
- `GoogleSignIn` 保持原 API，不修改认证流程。

## Interaction
- 右上角 `Latch APP` 是 DEV 弹层的唯一入口，`aria-expanded` 同步开合状态。
- DEV 卡片为 `role="dialog"`，保留可关闭按钮、输入框、提交按钮、loading 和错误态。
- 打开 DEV 卡片时，桌面端背景/hero 通过轻微位移或景深弱化让出操作层；移动端以清晰叠层为主，不造成横向溢出。

## Testing
- 单元测试先写失败断言：
  - 首页渲染 Tower 风格动态层和主文案。
  - DEV 登录默认隐藏，点击 `Latch APP` 后打开。
  - DEV 登录提交仍调用 `/api/auth/dev-login` 并跳转 Tower。
- 验证命令：
  - `npm test -- src/tests/login.test.tsx`
  - `npm test`
  - `npm run build`
  - 对本次触碰文件运行 legacy ESLint。
- 浏览器验证桌面 1280x720 和移动 390x780，无 console error/warning、无文本溢出。
