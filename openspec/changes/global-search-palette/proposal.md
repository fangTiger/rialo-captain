# Change: global-search-palette

## Why

Demo 当前找一架特定航班只能在地图上扫 300+ 飞机点或翻 HotRoutes 列表。演示时观众问 "能找一下飞 SFO→JFK 的吗?" 没有快路径。

本提案补一个全局快捷键弹出的 cmdK 命令面板，把 "找航班" 动作缩到 2 秒内。

完整设计文档见 `docs/superpowers/specs/2026-06-16-global-search-design.md` (commit `069f156`).

## What Changes

- **ADDED** 全局搜索面板 `SearchPalette` 组件: 全屏覆盖 modal + 输入框 + 结果列表 + 键盘 hint
- **ADDED** 全局快捷键 `SearchHotkey` 监听: `/` 或 `Cmd+K` / `Ctrl+K` 触发, `Esc` 关闭, `/login` 页不挂载
- **ADDED** `useSearchFlights(query)` hook: 客户端 substring filter + 字母排序 + 截前 10 + totalMatches 计数
- **ADDED** TopNav 右侧 `PRESS /` hint
- **MODIFIED** `GET /flights/live` 响应 `FlightPublic` 模型新增 `origin: str | None` 与 `destination: str | None` 字段
- **MODIFIED** Cache enrichment: cache 出口或写入处按 callsign 一次性 batch join `Flight` 表, 避免 N+1
- **ADDED** 搜索结果跳转 `/flight/:id` 携带 `location.state.from = location.pathname` (复用 P0-3 面包屑回跳协议)

## Impact

- Affected specs:
  - `live-dashboard` (ADDED 全局搜索面板与快捷键; MODIFIED `/flights/live` 响应字段)
- Affected code:
  - `backend/flights/routes.py` (FlightPublic 加 2 字段)
  - `backend/flights/cache.py` 或 `backend/flights/fetcher.py` (cache enrichment, Codex 自选实现路径)
  - `frontend/src/App.tsx` (挂载 SearchHotkey)
  - `frontend/src/components/shell/TopNav.tsx` (加 PRESS / hint)
  - `frontend/src/components/search/SearchPalette.tsx` (新增)
  - `frontend/src/components/search/SearchHotkey.tsx` (新增)
  - `frontend/src/components/search/searchMatch.ts` (新增)
  - `frontend/src/hooks/useSearchFlights.ts` (新增)
  - `frontend/src/hooks/useFlights.ts` (FlightPublic 类型补字段)
  - 对应 test 文件

## Acceptance Criteria (Clarify Gate 产物)

- 任意页面 (非 `/login`) 按 `/` 或 `Cmd+K`/`Ctrl+K` 弹出搜索面板
- 输入 `'UAL'` / `'SFO'` / `'JFK'` 都能命中对应航班
- ↑↓ Enter Esc 全键盘可用; 鼠标 hover 同步 selectedIndex
- 选中结果 Enter 跳转 `/flight/:id`, FlightDetail 面包屑显示 `← 来源页`
- TopNav 右侧显示 `PRESS /` hint
- 输入框已聚焦时按 `/` 作字面输入, 不弹面板
- `/login` 页 hotkey 不响应, 无 hint
- 后端 `/flights/live` 响应耗时不退化 (无 N+1 query)
- 所有新增 test 全绿; 现有 test 不退化
- 桌面 Chrome console 无 error 无 warning

## Out of Scope

- 搜 claims / policies / hot routes / users (本次只搜 flights)
- 模糊匹配 / 拼写纠错 / 同义词 (只做 substring)
- 历史航班 / 已落地航班 (搜索范围 = `useFlights()` 当前 cache)
- 命令面板形态的其它命令 (admin / nav / theme 切换都不在范围)
- 移动端深度适配

## Risks

| 风险 | 缓解 |
|---|---|
| Cache enrichment 引入 N+1 query 拖慢 `/flights/live` | 强制一次性 batch join, 测试用 SQLAlchemy event listener 计数 SQL 次数验证 |
| `/` 与字面输入冲突 (登录框、buyDrawer 输入框中按 /) | hotkey 判 `document.activeElement.tagName` 为 INPUT/TEXTAREA 时不响应 |
| `Cmd+K` 与浏览器默认快捷键冲突 | Chrome 默认 `Cmd+L` 聚焦地址栏, `Cmd+K` 无默认; 仍调 `e.preventDefault()` 保险 |
| Modal 弹出与 cinema 背景动画并存 | overlay 50% 透明黑遮罩足够; cinema 不需暂停, Esc 关闭后即恢复 |
| `/flights/live` payload 增大 | 300 flight × ~12 字符 ≈ 4KB, 可忽略 |
| 搜索结果指向 callsign 与 today 不存在的 flight_id | 由 FlightDetail 404 处理保底 (P0-3 已实现) |
