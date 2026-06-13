# Change: rialo-captain-mvp

## Why

Rialo 的核心卖点（反应式合约 + native HTTPS 调用）目前没有面向终端用户的杀手 demo。航班延误险是天然契合反应式合约的真实世界场景：单一条件、可读 web2 数据、可被合约自动结算。本提案立项 Rialo-Captain 作为 Testnet-Ready 的演示型 MVP，通过 Adapter 抽象层让 SDK 公开后能零业务代码改动切换真实测试网。

完整设计参见 `docs/superpowers/specs/2026-06-13-rialo-captain-design.md`（已落盘，commit `0606cb2`）。

## What Changes

- **ADDED** Google OAuth 登录 + 模拟 RIA 积分账号体系
- **ADDED** OpenSky 实时航班数据接入与缓存（含 degraded mode）
- **ADDED** `ReactiveContractAdapter` 抽象层 + MockRialoAdapter 实现 + RealRialoAdapter 占位
- **ADDED** 航班延误险产品（保费档位固定，赔付倍率基于历史延误率）
- **ADDED** asyncio 后台自动赔付循环（每 30s 扫描、超阈值自动结算）
- **ADDED** 全球控制塔大屏 + 6 页 SPA（The Tower / Flight Detail / My Hangar / Claims Feed / Hot Routes / Rialo Inside）
- **ADDED** WebSocket 实时事件总线（state_update / FLARE / toast）
- **ADDED** 完整 Design System（雷达控制塔气质、雷达青绿 `#00FF9D`，**严禁 Inter / Roboto**）

## Impact

- Affected specs:
  - `auth-and-account` (NEW)
  - `flight-data` (NEW)
  - `reactive-insurance-core` (NEW)
  - `live-dashboard` (NEW)
- Affected code:
  - `backend/*` (从零)
  - `frontend/*` (从零)
  - `scripts/dev.sh`、`scripts/seed_demo_delay.py`

## Acceptance Criteria (Clarify Gate 产物)

- 6 个页面全部可达、桌面端 console 无 error 无 warning
- Google OAuth 走通完整流程
- 大屏同时显示 ≥ 50 真实在飞航班
- 至少 1 条端到端 "买险 → 模拟延误 → 自动赔付" 可演示
- 视觉 ≥ 90% 满足 web-design-engineer skill 的 Pre-delivery Checklist
- pytest 全绿、vitest 全绿、≥ 1 个 Playwright E2E smoke 绿

## Out of Scope (明确排除)

- 真实金钱、真钱包、真 Web3 交易
- 真实 Rialo testnet 合约部署（Adapter 已留 RealRialoAdapter 占位，单独立项）
- 用户自定义市场（v2）
- 非航班类事件触发（v2）
- 移动端深度优化（仅 fallback）
- 多语言 UI（先英文，README 中英双语）
- 国家级金融合规审查（非金融产品，是演示）

## Risks

| 风险 | 缓解 |
| --- | --- |
| OpenSky API 限频或挂掉 | 短 cache + degraded mode + "DATA STALE" 显眼徽章 |
| Rialo SDK 长期不开放 | Adapter 抽象保证业务无关，MVP 独立可演示 |
| Mapbox 免费层超额 | 用量监控 + 降级 MapLibre + 自建瓦片 |
| OAuth 配置门槛 | README 提供详细 Google Cloud Console 步骤截图 |
