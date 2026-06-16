# Tasks: global-search-palette

每个 task bite-sized (2-5 分钟级), 含文件路径 + 代码要点 + 验证命令. Codex 按顺序实现, 每个 task 完成后打 `[x]`.

## 1. 后端 · FlightPublic 加 origin/destination 字段

- [x] 1.1 修改 `backend/flights/routes.py` 的 `FlightPublic` pydantic 模型新增 `origin: str | None = None` 与 `destination: str | None = None` 字段
- [x] 1.2 修改 `/flights/live` handler: 取出 cache 中所有 callsign, 一次性 `SELECT callsign, origin, destination FROM flights WHERE callsign IN (...)` 构造 dict, 然后在构造 FlightPublic 时按 callsign 查 dict 填充 origin/destination; 未命中保持 None
- [x] 1.3 实现路径有两个选项, Codex 选最低改动者:
  - 选项 A: 直接在 `/flights/live` route handler 内做 batch join (依赖注入 session)
  - 选项 B: 扩展 `FlightCache` 在出口时做 enrichment, 注入 sessionmaker
- [x] 1.4 新建 `backend/tests/integration/test_flights_live_search.py`: seed 2 flight 各 1 live state, 验证 `GET /flights/live` 响应每项含 origin/destination; 一个已知 callsign 字段有值, 一个未知 callsign 字段为 null
- [x] 1.5 同测试文件加 N+1 验证: 用 SQLAlchemy `before_cursor_execute` event listener 记 SQL 次数, 调 `/flights/live` 后断言 Flight 表 SELECT 计数 ≤ 1
- [x] 1.6 验证: `pytest backend/tests/integration/test_flights_live_search.py -v`

## 2. 前端 · FlightPublic 类型同步 + searchMatch 工具

- [x] 2.1 修改 `frontend/src/hooks/useFlights.ts`: `FlightPublic` interface 加 `origin?: string; destination?: string;`
- [x] 2.2 新建 `frontend/src/components/search/searchMatch.ts`: 导出 `matches(flight: FlightPublic, query: string): boolean` 函数 (实现见设计文档 §5), 大小写不敏感子串匹配 callsign + origin + destination + 组合字符串
- [x] 2.3 新建 `frontend/src/tests/search-match.test.ts`: 覆盖 callsign 命中 / origin 命中 / destination 命中 / "SFO->JFK" 组合 / "SFO→JFK" 箭头 / 大小写不敏感 / 空 query 返回 false / origin null callsign 仍可命中
- [x] 2.4 验证: `cd frontend && pnpm test search-match -- --run`

## 3. 前端 · useSearchFlights hook

- [x] 3.1 新建 `frontend/src/hooks/useSearchFlights.ts`: 包装 `useFlights()`, 用 `useMemo` 计算 `results` (filter + sort by callsign + slice 10) 与 `totalMatches` (filter 后的长度)
- [x] 3.2 hook 返回 `{ results, totalMatches, isLoading }`; 空 query 时 results 和 totalMatches 都为 0/空数组
- [x] 3.3 新建 `frontend/src/tests/use-search-flights.test.ts`: 覆盖空 query / 命中排序 / 截 10 / totalMatches 反映真实总数
- [x] 3.4 验证: `cd frontend && pnpm test use-search-flights -- --run`

## 4. 前端 · SearchPalette 组件 (静态结构)

- [x] 4.1 新建 `frontend/src/components/search/SearchPalette.tsx`: props `{ open: boolean; onClose: () => void }`; open=false 时不渲染
- [x] 4.2 渲染结构: overlay (rgba(0,0,0,0.5), 全屏, z-index 90) + modal (640px 宽, 距顶 15vh, 居中, surface-1 + border-emphasis)
- [x] 4.3 modal 内 3 区: header (title "Search flights" + "esc" 提示), input (48px 高, font-mono 18px, surface-0), results 区, footer hint ("↑↓ navigate   ↵ open   esc close")
- [x] 4.4 内部 useState `query` 与 `selectedIndex`; open 变 true 时 query 清空、selectedIndex=0、输入框 autoFocus
- [x] 4.5 点击 overlay 调 `onClose`; 点击 modal 内不冒泡到 overlay

## 5. 前端 · SearchPalette 结果渲染

- [x] 5.1 在 SearchPalette 内调用 `useSearchFlights(query)` 取 `results / totalMatches / isLoading`
- [x] 5.2 空 query 时 results 区显示 `Type a callsign or airport code · e.g. SFO, JFK, UAL2351`
- [x] 5.3 非空 query 但 results 空时显示 `No flight matches "{query}"`
- [x] 5.4 isLoading 时输入框 placeholder 显示 `Loading flights...`, results 区灰显
- [x] 5.5 渲染每行 5 列 grid: callsign(120px) / route "{origin} → {destination}" 或 "—" (1fr) / delay_rate% (80px) / status chip (120px) / selected indicator "←" (24px, 仅 selectedIndex 行显示)
- [x] 5.6 选中行视觉: surface-2 背景 + 左侧 2px accent-radar 竖条; 鼠标 hover 同步设置 selectedIndex
- [x] 5.7 totalMatches > 10 时 results 列表底部追加灰字 `+{totalMatches - 10} more · refine your query`

## 6. 前端 · SearchPalette 键盘交互

- [x] 6.1 SearchPalette 内监听输入框 keydown: ↑ 减 selectedIndex (clamp ≥0), ↓ 加 selectedIndex (clamp ≤ results.length-1)
- [x] 6.2 Enter 触发跳转: `navigate('/flight/' + results[selectedIndex].id, { state: { from: location.pathname } })`; 然后调 onClose
- [x] 6.3 注意: results 中航班 id 需后端 callsign + date 构造, 但 useFlights 返回的 FlightPublic 当前没 id 字段 (只有 icao24/callsign), 需要确认 navigate 目标 - 用 callsign 作为 id 或要求 hook 额外提供 flight_id
- [x] 6.4 (关键) 在 useSearchFlights 中, 对每个 result 追加 `flight_id` 字段: `${callsign}-${YYYYMMDD today}`, 与 RouteRow 原逻辑一致 - 因 P0-3 已修 RouteRow 用真实后端 flight_id, 此处可暂用 today 拼接, 或如有 `/flights/known` 等待补; **默认用 today 拼接, FlightDetail 已能 fail-soft 404**
- [x] 6.5 Esc 触发 onClose
- [x] 6.6 新建 `frontend/src/tests/search-palette.test.tsx`: 覆盖 open/close / 输入触发结果渲染 / ↑↓ 改 selectedIndex / Enter 触发 navigate (mock useLocation 返回 pathname='/policies' 验证 state.from) / 点击行触发 navigate / Esc 关闭 / overlay 点击关闭 / 空态 / no-match / 溢出 +N more
- [x] 6.7 验证: `cd frontend && pnpm test search-palette -- --run`

## 7. 前端 · SearchHotkey 全局监听

- [x] 7.1 新建 `frontend/src/components/search/SearchHotkey.tsx`: 无 props; 内部 useState `open`; useEffect 注册全局 window keydown 监听
- [x] 7.2 keydown handler 逻辑:
  - 若 `useLocation().pathname === '/login'` 不处理 (return)
  - 若 `document.activeElement.tagName === 'INPUT' || 'TEXTAREA'`, 不响应 `/` (允许字面输入); `Cmd+K`/`Ctrl+K` 仍响应
  - 按 `/` (e.key === '/') 或 `(e.metaKey || e.ctrlKey) && e.key === 'k'`: `e.preventDefault()` + `setOpen(true)`
- [x] 7.3 渲染 `<SearchPalette open={open} onClose={() => setOpen(false)} />`
- [x] 7.4 新建 `frontend/src/tests/search-hotkey.test.tsx`: 覆盖 / 触发 / Cmd+K 触发 / Ctrl+K 触发 / 输入框聚焦时 / 不响应但 Cmd+K 仍响应 / /login pathname 不响应任何 hotkey
- [x] 7.5 验证: `cd frontend && pnpm test search-hotkey -- --run`

## 8. 前端 · App 集成 + TopNav hint

- [x] 8.1 修改 `frontend/src/App.tsx`: 在 `<BrowserRouter>` 内、`<Routes>` 之后挂载 `<SearchHotkey />` (确保它能用 useLocation, 且在 Routes 同级渲染)
- [x] 8.2 修改 `frontend/src/components/shell/TopNav.tsx`: 在右侧 `BAL` 之前插入 `<span>` 显示 `PRESS /`, 样式 `var(--text-tertiary)` + font-mono 11px + letterSpacing 0.18em + marginRight 12px
- [x] 8.3 现有 `tower-shell.test.tsx` 等如挂载 App, 可能需要兼容 SearchHotkey 的存在 (不应破坏现有测试; 如有 break 调整 mock 或 test setup)
- [x] 8.4 验证: `cd frontend && pnpm tsc --noEmit && pnpm test -- --run`

## 9. 整体验证

- [ ] 9.1 后端全量测试: `pytest backend/tests -v`
- [ ] 9.2 前端全量测试 + 类型检查: `cd frontend && pnpm tsc --noEmit && pnpm test -- --run`
- [ ] 9.3 本地启动 `./scripts/dev.sh` 手工冒烟: 登录 → 在 Tower 按 / 弹出 → 输 'UAL' 看结果 → ↓ 选第 2 个 → Enter 跳转 → 面包屑回 Tower → 按 / 再次打开 → 输 'SFO' → 点击鼠标某行 → 跳转 → Esc 测试关闭 → 在 BuyDrawer 输入框中按 / 应作字面输入 → /login 页按 / 不响应
- [ ] 9.4 桌面 Chrome console 检查无 error/warning

## 10. OpenSpec 归档前置

- [ ] 10.1 `openspec validate global-search-palette --strict --no-interactive` 全绿
- [ ] 10.2 等用户确认演示效果后, 由 Claude 执行归档流程 (合并 delta 到 `openspec/specs/live-dashboard/spec.md`, 与 card-navigation-and-flight-detail 的 delta 共同合并)
