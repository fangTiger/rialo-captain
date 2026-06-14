# Rialo-Captain · Cinema 大屏 设计文档

> 状态: Brainstorming 阶段产出 · 待用户最终审批 → 进入 writing-plans
> 日期: 2026-06-15
> 工作名: Rialo-Captain Cinema Big-Screen
> 上游设计: `docs/superpowers/specs/2026-06-13-rialo-captain-design.md`
> Tagline: *一块自己讲故事的大屏 · 评委盯 30 秒就被劫持*

---

## 0. 一句话定位

把当前的 TowerShell 从"全球飞机分布展板"升级为"自动讲完整保险闭环故事的电影大屏": 默认 cinema 模式, 镜头自动 zoom-in 到一架飞机, 演完"投保 → 飞行 → 延误触发 → 链上结算 → 落地"的 30 秒闭环, 然后 zoom-out, 循环. 用户随时可以接管, idle 30 秒自动恢复 cinema. 真实用户的真实事件优先抢占舞台.

## 1. 决策摘要 (brainstorming 收敛结果)

| 项 | 决策 | 说明 |
|---|---|---|
| 受众 | **主 A 演示 / 兼 B 操作** | 评委演示为主, 真用户操作为辅; 同一 URL 同一心智模型 |
| 闭环类型 | **C 混合** | 后台聚合流水线 + 周期 zoom-in 到单航班闭环 |
| 交互模型 | **A 自动驾驶 + 接管** | 单 URL `/`; 状态机切换; idle 30s 自动恢复 cinema |
| Cycle 节奏 | **30 秒 / cycle** | 5s ESTABLISH + 2s ZOOM-IN + 18s STORY + 2s ZOOM-OUT + 3s REST |
| 视觉冲击 | **8 个动效全要,按复杂度分层** | ①航迹爆轰 ②延误冲击波 ③链上光线 ④保单密度热力图 ⑤大数字 KPI ⑥雷达高亮 ⑦FLARE 落地 ⑧电影镜头 |
| 主角机制 | **Spotlight Hybrid** | 真实事件优先抢占 (REAL 红牌) + AutoSeeder 虚拟剧本兜底 (DEMO 灰牌) |
| 实现路径 | **方案 C 三层分包** | C1 Cinema 引擎 → C2 关键时刻 → C3 氛围装饰; 每层独立 OpenSpec change |
| 真链 RIA tx | **本次忽略** | RIALO_MODE=mock 保持, ChainBeam 显示 mock tx hash; 真链作为未来工作 |

## 2. 整体架构

**核心抽象: 一个状态机 + 四个驱动者。**

```
                ┌─────────────────────────────────┐
                │     CinemaController (FSM)      │
                │                                  │
                │   ┌──────────┐    ┌──────────┐  │
                │   │ CINEMA   │ ⇄  │INTERACTIVE│ │
                │   │ (auto)   │    │ (manual) │  │
                │   └──────────┘    └──────────┘  │
                └────────┬────────────────────────┘
                         │
        ┌────────────────┼──────────────────┐
        ▼                ▼                  ▼
  CameraDirector    AutoSeeder        EventChoreographer
  (D3 zoom/pan)    (后台造流量)     (WS event → 动效触发)
        │                │                  │
        └────────────────┼──────────────────┘
                         ▼
                  GlobeMap + CinemaOverlay
                  (现有 + 8 个新动效组件)
```

**四个驱动者职责:**

1. **CinemaController** — 状态机大脑, 管理 `cinema` ↔ `interactive`. 监听全局用户事件 (click/wheel/keydown), 用户一动就 pause; 30s idle 自动 resume. 提供 `interrupt(realPayload)` 入口给真实事件抢占.

2. **CameraDirector** — D3 viewport 控制器, cinema 态下按时间线驱动 `zoom + pan`; interactive 态下完全让位给用户的 zoom/pan.

3. **AutoSeeder** — cinema 态下后台定时调用 `/api/seed-demo` + `/api/inject-delay` 造虚拟剧情, 保证大屏永远有事发生. interactive 态下停止.

4. **EventChoreographer** — 订阅 WebSocket 事件 (`policy.created` / `claim.triggered` / `claim.settled` / `flight.landed`), 路由到对应动效组件. 无论 cinema 还是 interactive 都在工作.

**与现有代码的整合:**
- `TowerShell` 顶部包一层 `<CinemaProvider>`, 通过 context 注入状态
- `GlobeMap` 接收 `cameraTarget` prop, 现有 zoom/pan 转交给 director
- 新动效组件挂在 `<CinemaOverlay>` 内部, 由 EventChoreographer 触发

## 3. Cinema 单次循环时间线 (30s)

```
  ESTABLISH         ZOOM-IN  ┃         STORY          ┃  ZOOM-OUT    REST
   0s ────────── 5s ── 7s ── ┃ ─────────────────── 25s ┃ ─ 27s ─── 30s
                             ┃                         ┃
   全球态势       镜头平滑    ┃ 单航班闭环演绎          ┃ 镜头拉回    全球氛围
   热力图呼吸     zoom + pan  ┃ ① 航迹 ⑥ 雷达 ② 冲击波  ┃ 回全球      继续, 准备
   KPI 跳动                  ┃ ③ 链上 ⑤ KPI+1 ⑦ 落地  ┃             下个 cycle
   雷达扫描                  ┃                         ┃
```

**8 动效在时间线上的触发点:**

| t (s) | 动效 | 层 | 触发条件 |
|------|------|----|---------|
| 0-30  | ④ HeatmapBg | C3 | 持续运行, 5min 聚合保单坐标更新 |
| 0-30  | ⑤ KPI tick | C1 | 持续运行, settled 时跳变 |
| 0-30  | ⑥ Radar sweep | C1 | 持续运行, 扫到主角时标 AT RISK |
| 5-7   | ⑧ ZOOM-IN | C1 | ESTABLISH 结束触发 |
| 7-10  | ① TrailDraw | C3 | zoom 完毕 2s 后 |
| 10-13 | ⑥ AT RISK | C1 | 雷达 sweep 扫到主角 |
| 15-17 | ② ShockWave | C2 | `claim.triggered` WS 事件 |
| 17-21 | ③ ChainBeam | C2 | `claim.settled` WS 事件 |
| 21-24 | ⑤ KPI +1 | C1 | settled 时计数器加 |
| 23-25 | ⑦ FlareLand | C2 | `flight.landed` WS 事件 |
| 25-27 | ⑧ ZOOM-OUT | C1 | STORY 结束触发 |
| 27-30 | — | — | REST, 准备下一轮 |

## 4. 主角机制: Spotlight Hybrid

**两层优先级队列:**

| 优先级 | 来源 | 标牌 | 选择条件 |
|---|---|---|---|
| **1 (最高)** | 真实用户的真实事件 | **REAL · LIVE** (红色) | 60s 内 WS 推送的 `policy.created` 真实事件, FIFO 队列, 最多 3 条 |
| **2 (回退)** | AutoSeeder 虚拟剧本 | **DEMO** (灰色) | 从 in-flight 飞机里挑一架 ETA 在 5-15 分钟后的, 用虚拟名字池循环 |

**抢占规则:**
- 当前 cycle 处于 ESTABLISH 或 REST 阶段 — 立即抢占, 下一 cycle 用真实主角
- 当前 cycle 处于 STORY 阶段 — 不抢占, 等当前演完, 真实事件入队
- 真实事件队列堆积 3+ 条 — 标牌额外显示 `+N more`

**杀手锏 demo 场景:**
评委盯虚拟剧情看 → 你当场在 Hangar 买一张 → 5s 内大屏切到这条真实保单做主角 → 链上 tx hash 真的飘过 → 评委被劫持.

**虚拟名字池**: Alice / Bob / Carol / Dave / Eve / Frank / Grace / Henry / Ivy / Jack (10 个循环).

## 5. 组件清单 / 数据流

### 5.1 前端组件树

```
TowerShell                                 [既有, 加 CinemaProvider 包装]
  └─ <CinemaProvider>                      [新, 全局状态 context]
      ├─ <CinemaController/>               [新, FSM 大脑, 无渲染]
      ├─ <AutoSeeder/>                     [新, 后台造剧情, 无渲染]
      ├─ <EventChoreographer/>             [新, WS 事件路由, 无渲染]
      ├─ <CameraDirector>                  [新, 控 D3 viewport]
      │    └─ <GlobeMap/>                  [既有, 接收 cameraTarget prop]
      ├─ <RadarSweep/>                     [既有, +AT RISK 标签 ⑥]
      ├─ <KPIBand/>                        [既有, +tick 动效 ⑤]
      ├─ <EventFeedSidebar/>               [既有, cinema 态收起]
      ├─ <CinemaOverlay/>                  [新, 顶层动效画布]
      │    ├─ <TrailDraw flightId/>        [新 ①, C3]
      │    ├─ <ShockWave airport/>         [新 ②, C2]
      │    ├─ <ChainBeam from to txHash/>  [新 ③, C2]
      │    ├─ <HeatmapBg/>                 [新 ④, C3]
      │    ├─ <FlareLand flightId/>        [新 ⑦, C2]
      │    └─ <ProtagonistBadge kind/>     [新, REAL / DEMO 标牌]
      └─ <ModeIndicator/>                  [新, 角落小灯]
```

### 5.2 数据流

```
                   ┌─ POST /api/seed-demo ────┐
   AutoSeeder ─────┤                          ├──► backend ClaimEngine
                   └─ POST /api/inject-delay ─┘
                                                       │
                              ┌── policy.created       │
   WS /ws ◄───────────────────┤── claim.triggered      │ (现有事件流)
       │                      ├── claim.settled        │
       │                      └── flight.landed        │
       │
       ▼
   EventChoreographer  ──── route ──┬──► ShockWave (claim.triggered)
       │                            ├──► ChainBeam  (claim.settled)
       │                            ├──► FlareLand  (flight.landed)
       │                            └──► KPI tick   (any settled)
       │
       └─ event.source == "real"? ──► CinemaController.interrupt(realPayload)
                                                     │
                                                     ▼
                                          CameraDirector.flyTo(realFlight)
```

## 6. 接管 / 恢复机制

**Trigger pause (cinema → interactive):**
- `click` 飞机 / 按钮 / 菜单 → 立即 pause
- 滚轮 `wheel` (用户在 zoom) → 立即 pause
- 顶栏 nav 切换页面 → 立即 pause
- **不触发**: `mousemove`, `hover flight` (鼠标飘过不切走)

**Resume (interactive → cinema):**
- 30s 无 input 事件 (click/wheel/keydown) → 自动 resume
- 角落 `ModeIndicator` 显示倒计时: `MANUAL · auto-resume in 28s`
- `Esc` 立即恢复 cinema (彩蛋, 演示快捷键)
- pause 时 AutoSeeder 同步暂停, 避免污染真用户操作

**页面 hidden:**
- `document.visibilitychange === hidden` → pause cinema (省资源)
- 回到 visible → resume

## 7. AutoSeeder 节奏

| 时刻 | 动作 |
|---|---|
| Cycle 开头 (0-5s ESTABLISH) | 选下一条虚拟主角: in-flight 飞机, ETA 5-15min 后. 调 `/api/seed-demo` 买保单 (虚拟用户名) |
| Cycle 第 12s | 调 `/api/inject-delay` 触发延误 (5s 后后端反应式合约自动赔付) |
| 真实事件到达 | 优先级队列入队, 看抢占规则决定是否打断当前 cycle |
| Pause 期间 | 完全停止, 不调任何 API |

**关键参数:**

| 参数 | 默认值 | 备注 |
|---|---|---|
| Cycle 时长 | 30s | 可配置 |
| Idle 阈值 | 30s | 演示日可临时调到 60s |
| Virtual 名字池 | 10 | 可扩展 |
| 真实事件抢占窗口 | 立即 (非 STORY 阶段) / 下个 cycle (STORY 阶段) | |
| 真实事件 lookback | 60s | 事件 `created_at` 距当前墙钟 > 60s 的不进队列, 避免补播旧事件 |
| Real queue 容量 | 3 | 超出显示 `+N more` |

## 8. 三层分包

每层都是独立可上线的 OpenSpec change. 砍掉任何中间层不影响前一层功能.

### 8.1 C1 — Cinema 引擎 (中, ~10h, 1 session)

**目标**: 大屏自动播虚拟剧情, 用户能接管, 30s 自动恢复. 出 C1 就能录推特视频.

**新增组件**: `CinemaProvider` / `CinemaController` / `CameraDirector` / `AutoSeeder` / `EventChoreographer` (仅路由 KPI tick) / `CinemaOverlay` (空容器) / `ModeIndicator` / `ProtagonistBadge`

**已有改造**: `TowerShell` 套 Provider; `GlobeMap` 接 cameraTarget; `RadarSweep` 加 **⑥ AT RISK**; `KPIBand` 加 **⑤ tick**

**后端**: `/api/seed-demo` 支持 `protagonist_name`; `claim.settled` payload 增 `tx_hash` + `block_height` (mock); `flight.landed` event emit

**验收**: 打开 `/` 不操作 → 5s 后自动 zoom 到主角航班, KPI 跳动, 雷达高亮 AT RISK, 30s 一 cycle 循环. 点任意飞机 → cinema 停, 角落显示 `MANUAL · 30s`, 30s 无操作 → 自动恢复. 按 Esc → 立即恢复.

### 8.2 C2 — 闭环关键时刻 (中, ~10h, 1 session)

**目标**: 把 cinema 的高潮戏码做出来 — 延误/赔付/落地, 三个最有冲击力的时刻.

**新增组件**: `ShockWave` (②) / `ChainBeam` (③) / `FlareLand` (⑦)

**EventChoreographer 扩展**: 路由 `claim.triggered` → ShockWave; `claim.settled` → ChainBeam; `flight.landed` → FlareLand

**后端**: 复用 C1 的 payload 扩展, 无新改

**验收**: cinema 跑到 STORY phase, 延误瞬间机场爆红圈, 1s 后光线从机场飞到 hangar, KPI 累计 +¥320, 4s 后飞机 FLARE 落地.

### 8.3 C3 — 氛围装饰 (小, ~6h, 1 session)

**目标**: 锦上添花 — 全局氛围 + 单条航线视觉化.

**新增组件**: `HeatmapBg` (④) / `TrailDraw` (①)

**EventChoreographer 扩展**: `policy.created` 增量更新 heatmap 数据点; cinema STORY phase 开始时触发 `TrailDraw(flightId)`

**验收**: 全球地图永远呼吸紫红色热斑; zoom 到主角后航线一笔画亮起.

### 8.4 总览

| 层 | 范围 | 工时 | 价值 |
|---|---|---|---|
| C1 | Cinema 引擎 + ⑤⑥⑧ + Spotlight | ~10h | 大屏能自动播 + 接管 |
| C2 | 关键时刻 ②③⑦ | ~10h | 戏剧性高潮 |
| C3 | 氛围 ①④ | ~6h | 高级感 |
| **合计** | **8 动效 + 完整闭环** | **~26h** | **完整大屏** |

## 9. 边界 / 错误处理

| 场景 | 处理 |
|---|---|
| 无 in-flight 飞机 | AutoSeeder 跳过本 cycle, ESTABLISH 延长 10s 后重试 |
| WS 断连 | CinemaController 转 `degraded`, ModeIndicator 显示 `⚠ DATA LINK LOST · retry`; reconnect 后恢复 cinema |
| 后端 API 失败 (seed-demo 503) | AutoSeeder 本 cycle 改用纯前端 mock 事件, 标牌 `DEMO · OFFLINE`, KPI 不变 |
| 用户在 STORY phase 接管 | 立即 pause, 镜头停在当前 viewport, 不强制 zoom-out |
| 真实事件 STORY phase 到达 | 当前 cycle 跑完, 真实事件入 priority queue, 下个 cycle 立即用 |
| Real queue 堆积 | FIFO, 最多 3 条 in-flight, 超出丢弃, 显示 `+N more` |
| 主角飞机被真实保单覆盖 | 立即切到 REAL 标牌, 复用当前镜头, 不重启 cycle |
| 页面 hidden | pause cinema, AutoSeeder 停, 回 visible 后 resume |
| TIME_ACCEL=10 与 30s cycle | Cinema 用墙钟时间, 与 TIME_ACCEL 解耦 |
| Cinema 偏好持久化 | 不持久化, 每次打开默认 cinema 态 |

## 10. 性能预算

- Cinema 循环时 60fps, D3 zoom transition + 8 个动效全部 CSS `transform`/`opacity`
- ChainBeam tx hash 文字 `will-change: transform`
- HeatmapBg 5min 重算, SVG radial-gradient 实现, 不用 canvas
- AutoSeeder 节流: 1 cycle 最多 1 次 seed-demo + 1 次 inject-delay

## 11. 测试策略

**单元 (Vitest)**: `CinemaController` FSM 转换 / idle timer / Esc / visibilitychange; `AutoSeeder` 主角选择 / 名字池 / 抢占优先级; `EventChoreographer` 4 种事件路由; `CameraDirector` target → viewport 转换

**集成 (Vitest + happy-dom)**: 套 TowerShell, mock WS, 触发完整 cinema cycle, 断言每个动效按时间线渲染; mock `claim.settled` 断言 KPI 数字加 + ChainBeam 出现

**E2E (Playwright)**:
- C1: 打开 `/`, 5s 后镜头开始 zoom; 30s 后回全球; 点飞机 → MANUAL; 30s 倒计时 → 自动恢复
- C2: 注入真实 delay, 5s 内出现 ShockWave + ChainBeam, KPI 加预期数额
- C3: 截图验证 heatmap radial-gradient 存在; cycle 验证 TrailDraw 出现

**后端 (pytest)**: `protagonist_name` 端到端; `claim.settled` 携带 `tx_hash + block_height`; `flight.landed` event 在抵达时 emit

## 12. 不在范围 (Out of Scope)

- ❌ 多大屏拼接同步
- ❌ 音效
- ❌ 键盘快捷键 (除 Esc)
- ❌ 真实保单 cinema 历史回放 (倒带)
- ❌ 4K / 物理大屏 responsive 适配
- ❌ **真实链 RIA tx** — 保持 RIALO_MODE=mock, ChainBeam 显示 mock tx hash. 真链作为未来独立 OpenSpec change

## 13. OpenSpec 提案规划

| Change ID | 标题 | 触发 |
|---|---|---|
| `cinema-engine` | C1 Cinema 引擎 | 本设计批准后立即开 propose |
| `cinema-key-moments` | C2 闭环关键时刻 | C1 archive 后开 propose |
| `cinema-ambient` | C3 氛围装饰 | C2 archive 后开 propose (可选) |

每个 change 独立 propose → review → apply → archive 闭环.

## 附录 A. 8 动效速查

| # | 名字 | 触发 | 实现 | 层 |
|---|------|------|------|----|
| ① | 航迹爆轰 TrailDraw | STORY 开头 | SVG path stroke-dasharray 动画 | C3 |
| ② | 延误冲击波 ShockWave | `claim.triggered` | 多层 ring 同心 scale + fade | C2 |
| ③ | 链上光线 ChainBeam | `claim.settled` | SVG line + 沿线移动 pulse + tx 文字 | C2 |
| ④ | 保单密度 HeatmapBg | 持续 | SVG radial-gradient 多焦点 + breath | C3 |
| ⑤ | KPI 飙升 | 持续 / settled | requestAnimationFrame 数字差值 | C1 |
| ⑥ | 雷达高亮 | 主角扫到 | 现 RadarSweep + 风险计算 + 文字标签 | C1 |
| ⑦ | FLARE 落地 | `flight.landed` | 飞机收束 transform + ping ring | C2 |
| ⑧ | 电影镜头 | cycle 时间线 | D3 `transition().zoom().translate()` | C1 |
