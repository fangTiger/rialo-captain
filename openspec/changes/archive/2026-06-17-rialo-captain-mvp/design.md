# Design: rialo-captain-mvp

> 完整设计参见 `docs/superpowers/specs/2026-06-13-rialo-captain-design.md`。
> 本文档仅记录提案级别的技术决策与权衡，供审阅。

## 关键技术决策

### 决策 1: ReactiveContractAdapter 抽象层

- **问题**：Rialo SDK 公开状态不明，但项目承诺"Testnet-Ready"。
- **方案**：定义 `ReactiveContractAdapter` Protocol，提供 `MockRialoAdapter` 实现，`RealRialoAdapter` 留 NotImplementedError stub。
- **权衡**：增加一层抽象（成本），换取业务代码零改动切换（收益）。值得。
- **验证**：契约测试集 parametrize 两个实现，Mock 全绿，Real skip-if。

### 决策 2: SQLite + asyncio（不用 PostgreSQL / Celery）

- **问题**：MVP 不需要分布式或高并发。
- **方案**：SQLite 单文件 + asyncio 后台循环。
- **权衡**：扩展性受限，但 MVP 无需扩展；运维零成本，本地可跑。
- **影响**：integration 测试用 in-memory SQLite，无 mock DB（遵循 CLAUDE.md 0.4 + 项目宪章 § 5）。

### 决策 3: Vite + React + TypeScript（不用 Next / SvelteKit）

- **问题**：前端框架选型。
- **方案**：Vite + React 18 + TS（SPA）。
- **权衡**：放弃 SSR，但 demo 不需要 SEO；冷启动开发体验最佳，社区资源丰富。

### 决策 4: Mapbox 主用 + MapLibre 兜底

- **问题**：地图栈选择。
- **方案**：默认 Mapbox（dark style 最强），监控用量；超额降级 MapLibre + 自建瓦片。
- **权衡**：免费层风险，但切换成本低（接口兼容）。

### 决策 5: Google OAuth（不用 magic link / 邮箱密码）

- **问题**：账号体系。
- **方案**：仅 Google OAuth。
- **权衡**：放弃灵活性；贴合 Rialo "社交账号登录" 哲学，零邮件成本，零密码记忆。

### 决策 6: 后端 Python（不用 Node 全栈一致）

- **问题**：前后端语言统一 vs 各选最优。
- **方案**：后端 Python（FastAPI + asyncio）。
- **权衡**：失去 mono-language 收益，但项目根 `main.py` 是 Python，全局 CLAUDE.md 偏 Python，团队已熟。

### 决策 7: 视觉气质 = 航空控制塔 / 雷达塔台

- **问题**：差异化但不与 Rialo 品牌脱节。
- **方案**：深黑底 + 雷达青绿 + 琴黄/红警示 + 信息白米（致敬 Rialo `--beige`）。
- **权衡**：放弃 100% Rialo 一致性，换产品独立 identity；后期入 Rialo 生态时可入混色版。

## 反应式合约 Mock 设计

Mock Adapter 用 Python asyncio 任务循环模拟 Rialo 反应式合约：

```python
async def reactive_loop():
    while True:
        for policy in await db.fetch_watched_policies():
            try:
                state = await adapter.fetch_external(opensky_url(policy.flight_id))
                if policy.condition.is_triggered(state):
                    await adapter.trigger_claim(policy.contract_ref, build_payload(state))
            except Exception as exc:
                await db.log_failed_trigger(policy.id, exc)
        await asyncio.sleep(30)
```

签名生成用 `sha256(policy_id + timestamp + nonce)` 模拟 0x... 格式 64-hex 串，前端不区分真假签名（仅展示用）。

## 范围与依赖关系

```
                 ┌─ auth-and-account ─┐
                 │                    ▼
flight-data ──── reactive-insurance-core ──── live-dashboard
```

- `auth-and-account` 与 `flight-data` 互不依赖，可并行开发
- `reactive-insurance-core` 依赖前两者
- `live-dashboard` 是消费方，依赖前三者

按此 DAG 顺序在 `tasks.md` 中排布。
