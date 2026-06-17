# Login Tower Landing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 将 `/login` 重设计为与 Tower 大屏同色系、极简高端、强动态的入口页面，并保留 `Latch APP` DEV 登录流程。

**Architecture:** `Login.tsx` 保持认证行为和语义结构，新增动态背景层节点；`Login.css` 统一承担视觉和动画；`login.test.tsx` 先覆盖行为和关键结构。不得修改后端认证 API、GoogleSignIn API 或 Tower 大屏逻辑。

**Tech Stack:** React 18、Vite、Vitest、Testing Library、CSS custom properties、CSS keyframes。

---

## Context

当前 Tower 视觉语言：
- 颜色：`--surface-0 #050608`、`--surface-1 #0B0E12`、`--surface-2 #14181F`、`--accent-radar #00FF9D`。
- 字体：`--font-display` 用于标题，`--font-mono` 用于状态、导航、输入。
- 动态：Tower 使用 radar sweep、globe map、heatmap、trail draw、flare/shockwave 等语义。
- 登录页现状：已有 `Latch APP` 按钮和 DEV dialog，但需要更强 Tower 一致性、更极简、更高级、更动态。

## Task 1: 登录页测试先行

**Files:**
- Modify: `frontend/src/tests/login.test.tsx`

**Step 1: Write failing tests**

Add assertions:
- `/login` renders `data-testid="login-radar-field"` and `data-testid="login-flight-trails"` dynamic layers.
- Main heading remains concise and product-like, e.g. contains `Latch` and `Tower`.
- `Latch APP` still defaults `aria-expanded=false`.
- DEV dialog opens and submit flow still posts `/api/auth/dev-login`.

**Step 2: Run RED**

Run:
```bash
npm test -- src/tests/login.test.tsx
```

Expected: FAIL before implementation because new dynamic layer test ids or copy do not exist.

## Task 2: 重构登录页结构

**Files:**
- Modify: `frontend/src/routes/Login.tsx`

**Step 1: Add semantic layers**

Add background elements:
- `data-testid="login-radar-field"`
- `data-testid="login-flight-trails"`
- `data-testid="login-pulse-layer"`

Keep them `aria-hidden="true"`.

**Step 2: Tighten content**

Use minimal copy:
- Brand: `RIALO · CAPTAIN`
- Heading should connect Latch and Tower without long marketing text.
- Keep one production access panel and one DEV dialog trigger.

**Step 3: Preserve auth behavior**

Do not modify:
- `apiFetch("/auth/dev-login", ...)`
- `refresh()`
- `navigate("/", { replace: true })`
- `GoogleSignIn`

## Task 3: 重写登录页 CSS

**Files:**
- Modify: `frontend/src/routes/Login.css`

**Step 1: Align colors with Tower**

Use CSS variables:
- `var(--surface-0)`
- `var(--surface-1)`
- `var(--surface-2)`
- `var(--accent-radar)`
- `var(--accent-radar-dim)`
- `var(--warn-amber)`
- `var(--danger-flare)`
- `var(--text-primary/secondary/tertiary)`

Avoid new rogue hue families and purple/blue gradients.

**Step 2: Add dynamic field**

Implement:
- slow radar sweep field;
- animated flight trail lines/dots;
- subtle pulse rings;
- reduced-motion fallback.

Use CSS animations. No `scrollIntoView`. No new animation dependency.

**Step 3: Polish responsive states**

Cover:
- Desktop 1280x720;
- Mobile 390x780;
- hover/focus/active/disabled/loading states;
- no text overlap or overflow.

## Task 4: Verify and update OpenSpec tasks

**Files:**
- Modify: `openspec/changes/update-login-tower-landing/tasks.md`
- Potential generated update: `graphify-out/*`

**Step 1: Run verification**

Run:
```bash
npm test -- src/tests/login.test.tsx
npm test
npm run build
ESLINT_USE_FLAT_CONFIG=false npx eslint src/routes/Login.tsx src/tests/login.test.tsx --max-warnings=0
```

**Step 2: Browser QA**

Start Vite if needed:
```bash
npm run dev -- --host 127.0.0.1
```

Check:
- `http://127.0.0.1:5173/login`
- Desktop 1280x720;
- Mobile 390x780;
- DEV dialog open/close;
- browser console no errors/warnings caused by login page.

**Step 3: Refresh graphify**

Run from repo root:
```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

**Step 4: Mark tasks**

Update `openspec/changes/update-login-tower-landing/tasks.md` checkboxes to match actual completion.
