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

### 申请 Mapbox token（免费）

1. 打开 [Mapbox account](https://account.mapbox.com/access-tokens/)
2. 注册 → 默认 default public token 就够用 (`pk....`)
3. 填到 `frontend/.env` 的 `VITE_MAPBOX_TOKEN=pk.xxx`

如果没填 token, GlobeMap 会 fail-soft 显示提示文案, 不崩溃但看不到地图.

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

## Deploy: Vercel 前端

Vercel 负责部署 `frontend/` Vite SPA；FastAPI 后端建议部署到支持常驻进程与 WebSocket 的平台（Railway / Fly / Render 等），再把后端域名填入 Vercel 环境变量。

Vercel 可以直接导入仓库根目录，也可以把 Root Directory 设置为 `frontend`：

- 仓库根目录导入：使用根目录 `vercel.json`，自动进入 `frontend` 安装并构建。
- Root Directory = `frontend`：使用 `frontend/vercel.json`。

Vercel Production 环境变量：

```bash
VITE_GOOGLE_CLIENT_ID=your-real-google-client-id.apps.googleusercontent.com
VITE_MAPBOX_TOKEN=pk.your-real-mapbox-public-token
VITE_DEV_LOGIN_ENABLED=false
VITE_API_BASE_URL=https://your-backend.example.com
VITE_WS_BASE_URL=wss://your-backend.example.com
```

构建命令会先运行 `node scripts/ensure-production-env.mjs`。如果仍使用占位值、缺少外部后端地址，或生产环境未关闭 dev login，Vercel 构建会直接失败。

## Demo: 反应式赔付

```bash
# 启动
./scripts/dev.sh

# 1. 浏览器登录 → 拿 cookie (或脚本)
# 2. 调 /policies 买险
curl -X POST http://localhost:8000/policies \
  -H "Content-Type: application/json" \
  -b "rialo_session=YOUR_JWT" \
  -d '{"flight_id":"<某 callsign>-<YYYYMMDD>","premium":10}'

# 3. admin 注入延误 (替代真延误等待)
curl -X POST http://localhost:8000/admin/inject-delay \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{"flight_id":"<同上>","delay_minutes":45}'

# 4. 等 30s (ClaimEngine 下一轮), 看赔付
curl http://localhost:8000/claims/recent
```

## 项目状态

- [x] **Plan 1 · Foundation**
- [x] **Plan 2 · Reactive Insurance Core**
- [x] **Plan 3 · Live Dashboard** ← 当前

Rialo-Captain MVP 完成. ReactiveContract Adapter 设计上保证: Rialo SDK 公开后,
只需实现 `RealRialoAdapter`, 业务代码 0 改动即可切换到真测试网.

## License

MIT
