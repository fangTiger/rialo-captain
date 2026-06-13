# Rialo-Captain · 设计文档

> 状态：Brainstorming 阶段产出 · 待用户最终审批 → 进入 writing-plans
> 日期：2026-06-13
> 工作名：Rialo-Captain
> Tagline：*Reactive insurance for the real sky · Built for Rialo*

---

## 0. 一句话定位

Rialo-Captain 是一个跑在 Rialo 上的航班延误险产品：用户在全球航空雷达大屏上选一条真实航线、用 RIA 积分买延误险，然后离开。Rialo 反应式合约自己读 OpenSky 实时数据、自己结算、自动把赔付打回账户——没有 oracle、没有 keeper bot、没有管理员审核。

## 1. 决策摘要（brainstorming 收敛结果）

| 项 | 决策 |
| --- | --- |
| 项目方向 | 现实事件触发的预测/保险市场 → **聚焦航班延误险** |
| 项目定位 | Testnet-Ready Hybrid（架构按 Rialo 原生设计，实现层 Adapter 抽象，MVP 用 Mock，SDK 公开后切真 testnet） |
| 核心叙事 | 全局 "Rialo Live" 控制塔大屏 |
| MVP 范围 | Standard - 6 个页面 |
| 用户/账号 | Google OAuth + 1000 RIA 模拟积分（贴合 Rialo "社交账号登录" 哲学） |
| 实时数据源 | OpenSky Network（开源免费、无密钥） |
| 视觉气质 | 航空控制塔 / 雷达塔台风 |
| 后端 | Python 3.11 + FastAPI + SQLite + asyncio |
| 前端 | Vite + React + TypeScript + Mapbox GL JS |
| 字体 | Geist / Söhne (UI) + JetBrains Mono (data) — **严禁 Inter / Roboto** |
| 实时推送 | WebSocket (FastAPI 原生) |

## 2. 信息架构（6 页面）

| 路径 | 页面名 | 核心元素 | 关键交互 |
| --- | --- | --- | --- |
| `/` | **The Tower** | 全球暗色地图 + 飞机雷达光点 + 航迹尾迹 + 侧栏事件流 + 左下角承保/赔付统计带 | hover 高亮航线，点光点 → Flight Card |
| `/flight/:id` | **Flight Detail / Buy** | slide-up drawer：航线截面图 + 实时状态 + 历史延误率柱状 + 保费档位 | 选档 → 估算赔付 → 下单 → 大屏对应光点 flare 一次 |
| `/policies` | **My Hangar** | 三栏机库格：active / paid / expired，每张卡显示航班号 + 倒计时 + 当前状态 | 点卡 → 完整轨迹 + 合约执行日志 |
| `/claims` | **Claims Feed** | "今日已自动赔付 $X" 大数字 + 瀑布流时间线（航班/分钟数/金额/合约签名前 8 位/结算用时） | hover 高亮，点 → 跳 flight detail |
| `/routes` | **Hot Routes** | 航线排行榜 + sparkline (30 天延误率) + 今日承保 / 平均赔付率 | 点 → 预购下一班 |
| `/rialo-inside` | **About / Rialo Inside** | 技术揭秘动画：传统多角色 vs Rialo 单合约对比 + 滚动驱动 + 数字指标 | scroll-triggered 动画 |

**全局元素**：极细顶部 nav（路径 + 余额 + 头像）+ 底部状态栏（WebSocket 心跳 LED）+ 全屏 grain 噪点叠层。

**响应式**：桌面优先；移动端只精修 `/policies` 与 `/claims`，大屏页 fallback 为单屏简化版。

## 3. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND  · Vite + React + TS + Mapbox GL + JetBrains Mono │
│   6 routes (见 §2)                                          │
└────────────────────────┬────────────────────────────────────┘
                         │  REST + WebSocket
┌────────────────────────┴────────────────────────────────────┐
│  BACKEND · FastAPI + SQLite + asyncio                       │
│   auth/  flights/  policies/  claims/  ws/                  │
│   ┌─────────────────────────────────────────┐              │
│   │  ReactiveContract Adapter (抽象层)        │              │
│   │  ├─ MockRialoAdapter  ← MVP 用            │              │
│   │  └─ RealRialoAdapter  ← SDK 公开后        │              │
│   └─────────────────────────────────────────┘              │
└────────────┬────────────────────┬───────────────────────────┘
             │                    │
       OpenSky API           SQLite DB
       (实时位置 + 状态)        (users, policies, claims)
```

## 4. 核心数据流

### 4.1 买险流程

1. 用户在 The Tower 点航线 → drawer 弹出
2. 选保费档位（如 5 / 10 / 20 RIA），系统按延误率算赔付倍率
3. POST `/policies` → `PolicyService.create()`：
   - 校验余额、写入 `policies` 表、扣账户
   - 调用 `adapter.watch(policy_id, flight_id, condition)`
4. drawer 关闭，大屏对应光点 flare 一次（绿光扩散 400ms）

### 4.2 自动赔付循环（后台 asyncio task）

每 30 秒：
1. 拉取所有 `watched` 状态的 policy
2. 对每个 policy：`adapter.fetch_external(opensky_url)` 拉真实状态
3. 判断 `actual_arrival > scheduled + 30min`：
   - 若是 → `adapter.trigger_claim(...)`：写 `claims`、UPDATE `user.balance`、生成 mock 签名
   - 通过 WebSocket 广播 `{type: "FLARE", policy_id, payout, signature}`
4. 大屏接收 FLARE 事件 → 对应光点炸开绿色 flare + 事件流新增一条
5. 用户端如在线 → toast 通知

### 4.3 关键设计点

- 观察周期 30 秒（OpenSky 免费层友好）；高优航班可降至 10 秒
- 触发条件抽象为 `Condition` 对象，便于扩展（不只延误，可触发取消/转降）
- Mock 签名用 `sha256(policy_id + ts + nonce)` 生成 0x… 风格串，前端展示用
- 大屏全部走 WS 推送，不轮询

## 5. Reactive Contract Adapter（核心抽象）

```python
# backend/contracts/base.py
class ReactiveContractAdapter(Protocol):
    """Rialo 反应式合约的抽象接口 - Mock 与 Real 共用"""

    async def watch(self, policy_id: str, flight_id: str,
                    condition: Condition) -> ContractRef: ...

    async def fetch_external(self, url: str) -> dict:
        """Rialo native HTTPS call"""

    async def trigger_claim(self, contract_ref: ContractRef,
                            payload: ClaimPayload) -> TxResult: ...

    async def get_signature(self, tx: TxResult) -> str: ...


class MockRialoAdapter(ReactiveContractAdapter):
    """MVP 实现：asyncio + httpx + SQLite 模拟反应式合约"""

class RealRialoAdapter(ReactiveContractAdapter):
    """SDK 公开后实现，目前 NotImplementedError 占位"""
```

**承诺**：所有业务代码只依赖 `ReactiveContractAdapter` 接口，切换实现时业务代码零修改。

## 6. Design System

### 6.1 配色

```
--surface-0        #050608    雷达黑（主背景）
--surface-1        #0B0E12    面板
--surface-2        #14181F    卡片
--border-subtle    rgba(255,255,255,0.06)
--border-emphasis  rgba(0,255,157,0.24)

--accent-radar     #00FF9D    雷达青绿
--accent-radar-dim #00FF9D33  尾迹 / glow
--warn-amber       #FFB400    预警
--danger-flare     #FF3D5C    取消/严重延误
--info-beige       #E8E3D5    主要文本 (致敬 Rialo)

--text-primary     rgba(232,227,213,0.95)
--text-secondary   rgba(232,227,213,0.60)
--text-tertiary    rgba(232,227,213,0.35)
```

### 6.2 排版

- **Display / UI**: `Geist`, `Söhne`, sans-serif
- **Mono**: `JetBrains Mono`, `IBM Plex Mono`
- **严禁**：Inter / Roboto / Arial / Fraunces / system-ui
- **Scale**: 12 / 14 / 16 / 20 / 28 / 40 / 64 / 96（比例 ≈ 1.4）

### 6.3 间距 / 圆角 / 阴影

- Spacing (4px base): 1·2·3·4·6·8·12·16·24
- Radius: `sharp 2px`（主导）/ `soft 8px`（仅卡片）/ `pill 999`（徽章）
- Shadow（低层级，靠 border 撑深度）:
  - `elev-1`: `0 0 0 1px var(--border-subtle)`
  - `elev-2`: `0 0 0 1px var(--border-subtle), 0 1px 0 rgba(0,0,0,0.4)`
  - `glow`: `0 0 16px var(--accent-radar-dim)`

### 6.4 动效

- `ease-out`: `cubic-bezier(0.22, 1, 0.36, 1)`
- `ease-radar`: `cubic-bezier(0.65, 0, 0.35, 1)`
- durations: fast 160ms / mid 280ms / slow 600ms

### 6.5 招牌效果

- `radar-sweep`: 6s linear infinite，大屏左上角扫描圈
- `flare-burst`: 赔付时光点 0.4s 变 `--accent-radar` + glow 扩散
- `grain-noise`: 全屏 `::after`，opacity 0.03

## 7. 数据模型（SQLite）

```sql
-- users
id TEXT PK, google_sub TEXT UNIQUE, email TEXT, name TEXT,
avatar_url TEXT, balance INTEGER, created_at INTEGER

-- flights (cache - 不存历史，只存活跃监控)
id TEXT PK,   -- flight_id (e.g. "BA178-20260613")
callsign TEXT, origin TEXT, destination TEXT,
scheduled_dep INTEGER, scheduled_arr INTEGER,
last_state TEXT,  -- JSON: lat, lon, vel, status
last_seen INTEGER

-- policies
id TEXT PK, user_id FK, flight_id FK,
premium INTEGER, payout INTEGER, condition_json TEXT,
status TEXT,  -- active | paid | expired
contract_ref TEXT, created_at INTEGER

-- claims
id TEXT PK, policy_id FK, payout INTEGER,
delay_minutes INTEGER, signature TEXT,
settled_at INTEGER, settle_duration_ms INTEGER

-- failed_triggers (调试 / 审计)
id TEXT PK, policy_id FK, error_text TEXT, occurred_at INTEGER
```

## 8. API 概要

```
POST   /auth/google                   交换 Google ID token → JWT cookie
GET    /me                            当前用户信息
GET    /flights/live                  当前监控中的所有航班 (大屏首次加载)
GET    /flights/:id                   单航班详情 + 历史延误率
POST   /policies                      买险
GET    /policies                      我的保单
GET    /claims/recent?limit=50        Claims Feed
GET    /routes/hot?limit=20           Hot Routes
WS     /ws                            实时事件总线 (state_update | flare | toast)
```

## 9. 验收标准（Clarify Gate 产物）

### 9.1 In Scope

- 6 个页面全部可达、桌面端无 console error
- Google OAuth 登录可走通完整流程
- 大屏至少同时显示 50+ 真实在飞航班（来自 OpenSky）
- 用户能买险、查看保单、看到自己保单状态变化
- 至少 1 个端到端"买险 → 模拟延误 → 自动赔付"流程可演示（可通过 admin endpoint 注入模拟延误）
- 视觉严格符合 §6 Design System，至少 90% 满足 web-design-engineer skill 的"Pre-delivery Checklist"
- 后端 pytest 通过，前端 vitest 通过，至少 1 个 Playwright E2E smoke 通过

### 9.2 Out of Scope（明确排除）

- 真实金钱 / 真钱包 / 真 Web3 交易
- 真实 Rialo testnet 部署（等 SDK 公开后单独立项）
- 用户创建自定义市场（v2 功能）
- 多种保险产品（航班外的事件类型，v2）
- 移动端深度优化（仅 fallback）
- 多语言（先英文 + 中文双语 README，UI 暂仅英文）
- 国家级合规审查（这是 demo，不是金融产品）

### 9.3 风险

| 风险 | 应对 |
| --- | --- |
| OpenSky API 限频或挂掉 | 短 cache + degraded mode + "DATA STALE" 徽章 |
| Mapbox 免费层超额 | 监控用量；超额降级用 MapLibre + 自建瓦片 |
| Rialo SDK 长期不开放 | 项目本身在 MVP 完成后即可独立演示价值；Adapter 抽象保证未来零改动切换 |
| OAuth 凭证配置门槛 | README 提供详细 Google Cloud Console 步骤截图 |

## 10. 测试策略

| 层 | 工具 | 重点 |
| --- | --- | --- |
| 后端单元 | pytest + pytest-asyncio | PolicyService 费率、ClaimEngine 条件、Adapter 契约 |
| 后端集成 | pytest + httpx.AsyncClient | REST + WS；OpenSky 用 vcrpy 录制重放 |
| Adapter 契约 | parametrize Mock/Real | 同一组契约测试，Real adapter 暂 skip-if |
| 前端组件 | Vitest + Testing Library | Flight Card / Buy Drawer / Tower 光点 |
| E2E 烟测 | Playwright | 登录 → 买险 → 模拟延误 → 赔付到账 |

**所有 integration 测试用真 SQLite（in-memory 或临时文件），禁 mock DB**（CLAUDE.md 0.4）。

## 11. 错误处理

| 边界 | 策略 |
| --- | --- |
| 用户输入 | Pydantic + 前端 zod，双层校验 |
| OpenSky 外部 API | 指数退避 + 30s cache + degraded mode + "DATA STALE" 显眼徽章 |
| 自动赔付引擎 | 每个 policy trigger try/except 单独包，失败入 `failed_triggers` 表 |
| WebSocket 断连 | 客户端指数退避重连；底部状态栏 LED 三态 |
| Google OAuth 失败 | 不静默，直接挡门提示 |

内部代码信任内部代码，只在系统边界做防御。

## 12. 部署形态（开发期）

- 本地开发：FastAPI `uvicorn` 8000 + Vite dev server 5173 + Vite 代理 `/api`、`/ws` 到 8000
- 单命令启动：`scripts/dev.sh` 起 backend + frontend + 后台 watcher
- 生产形态（v2 才考虑）：Docker compose + Caddy + 持久 SQLite 卷

## 13. 文件结构（计划骨架）

```
rialo-captain/
├── backend/
│   ├── app.py                 # FastAPI app
│   ├── config.py              # pydantic-settings
│   ├── db.py                  # SQLite + SQLAlchemy 2.x async
│   ├── auth/
│   │   ├── routes.py          # /auth/google, /me
│   │   └── deps.py            # JWT cookie auth dependency
│   ├── flights/
│   │   ├── routes.py
│   │   ├── opensky.py         # OpenSky client (httpx + retry)
│   │   └── cache.py
│   ├── policies/
│   │   ├── routes.py
│   │   ├── service.py         # rate calc + create
│   │   └── models.py
│   ├── claims/
│   │   ├── routes.py
│   │   └── engine.py          # asyncio 后台循环
│   ├── contracts/
│   │   ├── base.py            # Protocol + types
│   │   ├── mock_rialo.py
│   │   └── real_rialo.py      # NotImplementedError stub
│   ├── ws/
│   │   ├── routes.py
│   │   └── broadcaster.py
│   └── tests/
│       ├── conftest.py
│       ├── unit/
│       ├── integration/
│       └── contracts/
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   │   ├── Tower.tsx              # /
│   │   │   ├── FlightDetail.tsx       # /flight/:id (drawer)
│   │   │   ├── MyHangar.tsx           # /policies
│   │   │   ├── ClaimsFeed.tsx         # /claims
│   │   │   ├── HotRoutes.tsx          # /routes
│   │   │   └── RialoInside.tsx        # /rialo-inside
│   │   ├── components/
│   │   │   ├── Tower/
│   │   │   ├── FlightCard/
│   │   │   ├── BuyDrawer/
│   │   │   ├── StatusBar/
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── useFlights.ts
│   │   │   ├── usePolicies.ts
│   │   │   └── useWebSocket.ts
│   │   ├── design/
│   │   │   ├── tokens.css           # 6.1-6.4 全部 token
│   │   │   └── motion.ts
│   │   ├── api/
│   │   │   └── client.ts            # fetch wrapper + JWT
│   │   └── tests/
│   └── e2e/                          # Playwright
├── scripts/
│   ├── dev.sh
│   └── seed_demo_delay.py            # admin: 注入模拟延误演示用
├── docs/
│   ├── superpowers/specs/2026-06-13-rialo-captain-design.md  ← 本文件
│   └── plans/                                                ← writing-plans 产出
├── openspec/
│   └── changes/                                              ← OpenSpec 提案
├── main.py                            # 暂留，后续移除
├── pyproject.toml
└── README.md
```

## 14. 接下来的步骤

1. **本设计文档** → 用户审阅
2. → `superpowers:writing-plans` 生成 bite-sized 实现计划至 `docs/plans/`
3. → 同步走 OpenSpec：创建 proposal + spec deltas + tasks（CLAUDE.md 0.3 触发器满足）
4. → `superpowers:test-driven-development` 按计划执行
5. → Adapter 契约测试 + Playwright E2E 全绿
6. → README + demo 视频

---

*Author: Claude Code (brainstorming session 2026-06-13)*
