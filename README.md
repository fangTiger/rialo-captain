# Rialo-Captain

**Reactive insurance for the real sky · Built for Rialo**

Watch every live flight on a global ATC-style radar. Insure a flight in one click. When it's delayed, a reactive contract reads OpenSky live, settles itself, and pays you out — no oracle, no keeper, no admin.

· [设计文档](docs/superpowers/specs/2026-06-13-rialo-captain-design.md) · [OpenSpec proposal](openspec/changes/rialo-captain-mvp/) · [Plan 1 实现计划](docs/superpowers/plans/2026-06-13-rialo-captain-foundation.md)

---

## 中文简介

Rialo-Captain 是一个跑在 Rialo 上的航班延误险演示项目，演示反应式合约如何**直接读 web2 数据并自主结算**，不依赖 oracle / keeper / 管理员。

- **Plan 1 (Foundation)**：登录、OpenSky 接入、前端 Shell — 已落地
- **Plan 2 (Reactive Insurance Core)**：保险产品 + 反应式合约 Adapter — 在路上
- **Plan 3 (Live Dashboard)**：6 页 SPA + 全球大屏 + WebSocket — 在路上

## Tech Stack

- **Backend** Python 3.11 · FastAPI · SQLAlchemy 2.x async · SQLite · httpx · PyJWT · google-auth
- **Frontend** Vite 5 · React 18 · TypeScript · React Router 6 · SWR · @react-oauth/google · Mapbox GL (Plan 3)
- **Test** pytest + pytest-asyncio · vcrpy · Vitest · @testing-library/react · Playwright

## Prerequisites

1. Python 3.11+
2. Node 20+ and pnpm 9
3. Google OAuth Client ID（见下方步骤）

### 申请 Google OAuth Client ID（免费）

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → 新建项目 `rialo-captain-local`
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**
3. Application type: **Web application**
4. **Authorized JavaScript origins** 添加: `http://localhost:5173`、`http://localhost:8000`
5. 复制 Client ID
6. `cp .env.example .env`，填入 `GOOGLE_CLIENT_ID=...`
7. `cp frontend/.env.example frontend/.env`，填入同一个 `VITE_GOOGLE_CLIENT_ID=...`

### OpenSky 注意事项

OpenSky 公共 API **无需 key**，但匿名调用有限频（约 1 req/s）。开发期足够。

## Run

```bash
pip install -e ".[dev]"
cd frontend && pnpm install
cd ..
./scripts/dev.sh
```

打开 `http://localhost:5173` → "Sign in with Google" → 登录后进入 Tower 占位页。

## Tests

```bash
pytest backend/tests -v
cd frontend && pnpm test
cd frontend && pnpm exec playwright install --with-deps chromium
cd frontend && pnpm exec playwright test
```

## 项目状态

- [x] **Plan 1 · Foundation**
- [ ] Plan 2 · Reactive Insurance Core
- [ ] Plan 3 · Live Dashboard

## License

MIT
