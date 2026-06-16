# Rialo-Captain · 全局搜索 (cmdK 命令面板) 设计文档

**日期**: 2026-06-16
**作者**: Claude (设计) / Codex (实现)
**范围**: 中任务
**前置**: card-navigation-and-flight-detail (并行无冲突, P0-3 已完成代码实现, 待 smoke)

---

## 1. 背景与动机

当前 demo 要找一架特定航班只能在地图上肉眼扫 300+ 飞机点，或者在 HotRoutes 列表里翻。演示时如果观众问 "能找一下飞 SFO→JFK 的吗?" 没有任何快路径。

本设计补一个全局 / 快捷键弹出的 cmdK 风格命令面板，让 demo 中的"找航班"动作变成 2 秒内的事。

## 2. 目标与非目标

### 目标

1. 任意页面（除 `/login`）按 `/` 或 `Cmd+K` (Mac) / `Ctrl+K` (Win) 立刻弹出搜索面板
2. 按 callsign、origin 机场代码、destination 机场代码做实时大小写不敏感子串匹配
3. 结果列表 ↑↓ 选择、Enter 跳转 `/flight/:id`、Esc 关闭
4. 结果跳转携带 `location.state.from = 当前页面 pathname`（继承 P0-3 面包屑回跳协议）
5. 全屏 mono font + ATC/雷达风格，与 cinema 大屏调性一致

### 非目标 (Out of Scope)

- 搜 claims / policies / hot routes / users (本次只搜 flights)
- 模糊匹配 / 拼写纠错 / 同义词 (只做 substring)
- 历史航班 / 已落地航班 (搜索范围 = `useFlights()` 当前 cache, 即 `/flights/live`)
- 搜索快捷打开 admin 命令 (cmdK 不是命令调用面板，是搜索面板)
- 移动端深度适配

## 3. 触发与生命周期

| 触发 | 行为 |
|---|---|
| 按 `/` 或 `Cmd+K` (Mac) / `Ctrl+K` (Win) | 全屏覆盖 modal，输入框获焦 |
| `/login` 页 | hotkey 不挂载，不响应 |
| 输入框已聚焦时按 `/` | 作为字面字符输入，**不**触发面板（避免冲突） |
| 按 `Esc` | 关闭面板，焦点返回触发前元素 |
| 点击 modal 背景 (overlay) | 同 Esc |
| 选中一条结果按 `Enter` 或鼠标点击 | `navigate('/flight/:id', { state: { from: location.pathname } })` 并关闭面板 |
| 关闭后再按 `/` | 重新打开，输入框清空 |

**初始选中态**：每次结果列表更新时，`selectedIndex` 重置为 `0`（首行自动选中），用户直接按 Enter 即跳第一个结果。

**鼠标 / 键盘混用**：鼠标 hover 任一行时同步更新 `selectedIndex` 到该行；之后按 ↑↓ 从鼠标位置继续移动。

TopNav 右侧 `BAL · email` 之前永久显示 hint：`PRESS /` 灰字 11px font-mono。

## 4. 视觉布局

```
┌──────────────────────────────────────────────────────────────────┐
│ (page content, dimmed with rgba(0,0,0,0.5) overlay)              │
│                                                                   │
│        ┌──────────────────────────────────────────────────┐      │
│        │  > Search flights                          esc   │      │
│        │  ┌────────────────────────────────────────────┐  │      │
│        │  │ UAL2351_                                   │  │      │
│        │  └────────────────────────────────────────────┘  │      │
│        │                                                   │      │
│        │  UAL2351   SFO → JFK    32%   IN-FLIGHT   ←     │      │
│        │  UAL2360   LAX → BOS    18%   IN-FLIGHT          │      │
│        │  UAL2415   SFO → SEA     6%   IN-FLIGHT          │      │
│        │  UAL2502   SFO → ORD    44%   DELAYED            │      │
│        │  ─────────────                                    │      │
│        │  ↑↓ navigate   ↵ open   esc close                │      │
│        └──────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

**视觉规则：**

- modal 宽 **640px**，居中，距顶 **15vh**
- 背景 `--surface-1`，1px `--border-emphasis` 边框
- overlay `rgba(0,0,0,0.5)`，z-index 90 (在 BuyDrawer z-index 51 之上, 在 toast 之下)
- 输入框 `--surface-0` 内陷，48px 高，font-mono 18px，placeholder `--text-tertiary`
- 结果行高 44px，5 列 grid: callsign(120px) / route(1fr) / delay_rate(80px) / status chip(120px) / selected indicator(24px)
- hover / arrow-key focus 状态：`--surface-2` 背景 + 左侧 2px `--accent-radar` 竖条（与 P0-3 卡片导航 hover 一致）
- 当前 keyboard-selected 行始终有 `←` 字符提示，鼠标移入时切换到鼠标所在行
- 底部 keyboard hint 区高 32px，灰字 11px font-mono：`↑↓ navigate   ↵ open   esc close`

## 5. 搜索算法

```ts
function matches(flight: FlightPublic, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const haystack = [
    flight.callsign,
    flight.origin ?? "",
    flight.destination ?? "",
    `${flight.origin}->${flight.destination}`,
    `${flight.origin}→${flight.destination}`,
  ].join(" ").toLowerCase();
  return haystack.includes(q);
}
```

- 大小写不敏感
- 子串匹配（不做模糊 / 前缀 / 正则）
- 至少 1 字符才执行搜索
- 结果按 `callsign` 字母升序排序
- 截取前 **10** 条；超过时底部显示 `+{N} more · refine your query`
- 输入为空时不显示结果区，仅显示 placeholder 文案

## 6. 数据流与后端改动

### 6.a `FlightPublic` 扩展

`backend/flights/routes.py`:
```python
class FlightPublic(BaseModel):
    icao24: str
    callsign: str
    origin_country: str
    longitude: float | None
    latitude: float | None
    velocity: float | None
    heading: float | None
    on_ground: bool
    origin: str | None = None        # 新增, 例: "SFO"
    destination: str | None = None   # 新增, 例: "JFK"
```

### 6.b Cache enrichment

`/flights/live` 当前从 `flight_cache` 直接构造 `FlightPublic`。需要在 cache 出口或写入处按 callsign join `Flight` 表，把 `origin` / `destination` 拼上。

实现选项（由 Codex 在实现时选最低改动路径）：
1. 扩展 `FlightState` dataclass 加 `origin` / `destination` 字段，`FlightFetcher` 写 cache 时一次性 join
2. 在 `/flights/live` route handler 内一次 `Flight.callsign IN (...)` 批查 + 内存 dict 映射

**约束：** 不能为每条 state 单独查 DB（300 个 N+1 query 不可接受）。

### 6.c 前端 hook

修改 `frontend/src/hooks/useFlights.ts`: `FlightPublic` 类型补 `origin?: string` / `destination?: string`。

新增 `frontend/src/hooks/useSearchFlights.ts`:
```ts
export function useSearchFlights(query: string) {
  const { flights, isLoading } = useFlights();
  const results = useMemo(() => {
    if (!query.trim()) return [];
    return flights
      .filter((f) => matches(f, query))
      .sort((a, b) => a.callsign.localeCompare(b.callsign))
      .slice(0, 10);
  }, [flights, query]);
  const totalMatches = useMemo(() => {
    if (!query.trim()) return 0;
    return flights.filter((f) => matches(f, query)).length;
  }, [flights, query]);
  return { results, totalMatches, isLoading };
}
```

## 7. 组件设计

### 新增

**`frontend/src/components/search/SearchPalette.tsx`**
- Props: `{ open: boolean; onClose: () => void }`
- 内部：useState `query`、useState `selectedIndex`、useEffect 监听 ↑↓ Enter Esc
- 渲染 overlay + modal + 输入框 + 结果列表 + 底部 hint
- 关闭时 `query` 清空，`selectedIndex` 重置

**`frontend/src/components/search/SearchHotkey.tsx`**
- 无渲染（returns `null` 或 SearchPalette 本体）
- useEffect 全局监听 keydown：`/` 或 `Cmd+K` / `Ctrl+K` 触发 `setOpen(true)`
- 输入框已聚焦时不响应 `/`（检查 `document.activeElement.tagName === 'INPUT' || 'TEXTAREA'`）
- 渲染 `<SearchPalette open={open} onClose={...} />`

**`frontend/src/hooks/useSearchFlights.ts`** — 见 §6.c

### 修改

**`frontend/src/App.tsx`**
- 在 `<BrowserRouter>` 内部、`<Routes>` 之后挂载 `<SearchHotkey />`
- 路由守卫：SearchHotkey 内部自己判 `useLocation().pathname === '/login'` 不挂载监听

**`frontend/src/components/shell/TopNav.tsx`**
- 右侧 `BAL` 之前插入 `PRESS /` hint span

**`frontend/src/hooks/useFlights.ts`**
- `FlightPublic` 类型补 `origin?: string; destination?: string`

## 8. 边界与错误

| 场景 | 行为 |
|---|---|
| 输入为空 | 结果区显示 hint：`Type a callsign or airport code · e.g. SFO, JFK, UAL2351` |
| 无匹配 | 显示 `No flight matches "{query}"` |
| 匹配 > 10 | 截前 10 + 底部 `+{N} more · refine your query` |
| `useFlights()` 仍在加载 | 输入框 placeholder 显示 `Loading flights...`，结果区灰显 |
| `useFlights()` 出错 (data_stale) | 结果区底部加灰字 `Data may be stale (last update: ...)` |
| `origin/destination` 为 null（未知航班） | 结果行仍能按 callsign 命中；route 列显示 `—` |
| 在 `/login` 页 | hotkey 不挂载，无 PRESS / hint |
| 已打开搜索面板时点击页面其它区域 | 视为 overlay click → 关闭 |
| 搜索结果指向的 flight_id 在 `/flight/:id` 处 404 | 由 FlightDetail 自己处理（红 banner，P0-3 已实现） |

## 9. 测试策略

### 后端 (pytest)

- `backend/tests/integration/test_flights_routes.py`
  - `/flights/live` 响应每项含 `origin` 与 `destination` 字段
  - 已知航班 callsign 对应项有非空 origin/destination
  - 未知航班 callsign 对应项 origin/destination 为 null
  - 验证 300 条数据返回耗时合理（不存在 N+1 query，可通过 SQL log 计数确认）

### 前端 (Vitest + RTL)

- `frontend/src/tests/use-search-flights.test.ts`
  - 空 query 返回空数组
  - substring 大小写不敏感（`'ual'` 匹配 `'UAL2351'`）
  - origin/destination 子串可命中
  - 按 callsign 字母排序
  - 结果截 10，`totalMatches` 返回真实总数
- `frontend/src/tests/search-palette.test.tsx`
  - open=true 时渲染输入框 + 结果列表
  - 输入 `'UAL'` 后渲染对应行
  - ↑↓ 改变 `selectedIndex`
  - Enter 触发 `navigate('/flight/' + id, { state: { from: '/policies' } })`（mock useLocation）
  - Esc 触发 `onClose`
  - 点击 overlay 触发 `onClose`
  - 无匹配显示 no-match 文案
  - 溢出 10 时显示 `+N more` 文案
- `frontend/src/tests/search-hotkey.test.tsx`
  - 按 `/` 触发 open
  - 按 `Cmd+K` 触发 open
  - 输入框已聚焦时按 `/` 不响应（mock activeElement）
  - `/login` pathname 时不响应任何 hotkey

## 10. 文件改动清单（给 Codex 的参考）

**新增：**
- `frontend/src/components/search/SearchPalette.tsx`
- `frontend/src/components/search/SearchHotkey.tsx`
- `frontend/src/components/search/searchMatch.ts` (matches 函数与类型, 便于单元测试)
- `frontend/src/hooks/useSearchFlights.ts`
- 对应 test 文件 3 个

**修改：**
- `frontend/src/App.tsx` (挂载 SearchHotkey)
- `frontend/src/components/shell/TopNav.tsx` (加 PRESS / hint)
- `frontend/src/hooks/useFlights.ts` (FlightPublic 加 origin/destination)
- `backend/flights/routes.py` (FlightPublic 模型 + handler 拼字段)
- `backend/flights/cache.py` 或 `backend/flights/fetcher.py` (enrichment, Codex 自选)
- 对应 test 文件

**保留不动：**
- `BuyDrawer.tsx` / FlightDetail 相关 (P0-3 工作)
- 所有 cinema 组件 (大屏不变)

## 11. 工作量估算

| 阶段 | 工时 |
|---|---|
| 后端 FlightPublic 扩展 + cache enrichment + 测试 | 3-4h |
| 前端 SearchPalette + Hotkey + useSearchFlights | 4-5h |
| TopNav hint + App.tsx 集成 | 1h |
| 前端测试 3 套 | 2h |
| **合计** | **1 天** |

## 12. 风险

| 风险 | 缓解 |
|---|---|
| Cache enrichment 引入 N+1 query 拖慢 `/flights/live` | 强制一次性 batch join，测试中通过 SQLAlchemy event listener 计数验证 |
| `/` 与字面输入冲突 (用户在搜索框、登录框、buyDrawer 输入框中按 `/`) | hotkey 判 `document.activeElement` 是 INPUT/TEXTAREA 时不响应 |
| `Cmd+K` 与 Chrome 默认快捷键冲突 (Chrome 用 Cmd+K 聚焦地址栏？) | 实际 Chrome 默认是 `Cmd+L` 聚焦地址栏，`Cmd+K` 无默认。但仍调用 `e.preventDefault()` 保险 |
| Modal 弹出时 cinema 还在跑动 (大屏页面背景动画) | overlay 50% 透明黑遮罩足够，cinema 不需暂停（按 Esc 关闭后即恢复可见） |
| `/flights/live` payload 增大 | 300 flight × 6 字符 origin + 6 字符 destination ≈ 4KB，可忽略 |
| 搜索结果指向 mock 数据 callsign 与 today 不存在的 flight_id | 与 P0-3 同样问题，由 FlightDetail 404 处理保底 |

## 13. 验收标准 (Clarify Gate 产物)

- [ ] 任意页面（非 `/login`）按 `/` 或 `Cmd+K`/`Ctrl+K` 弹出搜索面板
- [ ] 输入 `'UAL'` / `'SFO'` / `'JFK'` 都能命中对应航班
- [ ] ↑↓ Enter Esc 全键盘可用
- [ ] 选中结果 Enter 跳转到 `/flight/:id`，并在 FlightDetail 面包屑显示 `← 来源页` 标签
- [ ] TopNav 右侧显示 `PRESS /` hint
- [ ] 输入框聚焦时按 `/` 作字面输入，不弹面板
- [ ] `/login` 页 hotkey 不响应
- [ ] 后端 `/flights/live` 响应耗时不退化（无 N+1）
- [ ] 所有新增 test 全绿；现有 test 不退化
- [ ] 桌面 Chrome console 无 error 无 warning
