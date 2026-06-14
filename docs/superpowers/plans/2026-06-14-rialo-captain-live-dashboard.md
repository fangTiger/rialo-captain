# Rialo-Captain · Plan 3 · Live Dashboard 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 把 Plan 1+2 落地的后端能力**前端化为可看见、可操作、可炫耀的控制塔大屏**。完成后用户在浏览器看到全球飞机雷达光点、点航线买险、实时事件流推送、赔付时光点炸开为绿色 flare。6 页 SPA 全部完成，Plan 1 中 TowerShell 占位被真正大屏替换。

**Architecture:** 后端加 WebSocket broadcaster + 三类事件（state_update / FLARE / toast），ClaimEngine 触发赔付时广播 FLARE，前端 SPA 用 SWR + WebSocket 复合数据流。Mapbox dark style 渲染地图，飞机光点用 deck.gl ScatterplotLayer + LineLayer 画轨迹尾迹。所有视觉受 Plan 1 的 `tokens.css` 约束，新组件严格走 design system。

**Tech Stack:** 后端无新依赖（FastAPI WebSocket 原生）。前端新增：`mapbox-gl@^3.7`、`deck.gl@^9.0` (含 `@deck.gl/layers` + `@deck.gl/mapbox`)、`zustand@^5.0` (轻量 store 管理 WS 事件)。Playwright 已就位。

**Reference docs:**
- 完整设计: `docs/superpowers/specs/2026-06-13-rialo-captain-design.md`
- Plan 1/2 已落地: 25 commits, 66 backend tests + 7 frontend tests + 1 E2E
- OpenSpec live-dashboard spec: `openspec/changes/rialo-captain-mvp/specs/live-dashboard/spec.md`

---

## 文件结构（Plan 3 范围）

```
rialo-captain/
├── backend/
│   ├── ws/                                  ← NEW
│   │   ├── __init__.py
│   │   ├── broadcaster.py                   Broadcaster + 事件类型 enum
│   │   ├── deps.py                          WS JWT 鉴权
│   │   └── routes.py                        WS /ws endpoint
│   ├── claims/engine.py                     ← MODIFY: trigger 成功后广播 FLARE
│   ├── app.py                               ← MODIFY: 装 WS router + broadcaster 到 app.state
│   └── tests/
│       ├── unit/test_broadcaster.py         ← NEW
│       └── integration/test_ws_routes.py    ← NEW
├── frontend/
│   ├── package.json                         ← MODIFY: 加 mapbox-gl / deck.gl / zustand
│   ├── .env.example                         ← MODIFY: 加 VITE_MAPBOX_TOKEN
│   ├── src/
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts              ← NEW
│   │   │   ├── useFlights.ts                ← NEW (SWR /flights/live)
│   │   │   ├── usePolicies.ts               ← NEW (SWR /policies + WS refresh)
│   │   │   ├── useClaims.ts                 ← NEW (SWR /claims/recent + WS append)
│   │   │   └── useHotRoutes.ts              ← NEW
│   │   ├── store/
│   │   │   ├── eventStore.ts                ← NEW (zustand: FLARE + toast 队列)
│   │   │   └── flareStore.ts                ← NEW (active flares for map animation)
│   │   ├── components/
│   │   │   ├── shell/
│   │   │   │   ├── TopNav.tsx               ← NEW
│   │   │   │   └── StatusBar.tsx            ← NEW (WS LED + grain)
│   │   │   ├── tower/
│   │   │   │   ├── GlobeMap.tsx             ← NEW (Mapbox + deck.gl)
│   │   │   │   ├── RadarSweep.tsx           ← NEW (左上角动画)
│   │   │   │   ├── FlightDot.tsx            ← NEW (光点)
│   │   │   │   ├── EventFeedSidebar.tsx     ← NEW (右侧实时事件流)
│   │   │   │   ├── DataStaleBadge.tsx       ← NEW
│   │   │   │   └── KPIBand.tsx              ← NEW (左下统计带)
│   │   │   ├── drawer/
│   │   │   │   ├── BuyDrawer.tsx            ← NEW (slide-up)
│   │   │   │   ├── PremiumPicker.tsx        ← NEW (5/10/20 档位)
│   │   │   │   └── DelayHistogram.tsx       ← NEW (历史延误率)
│   │   │   ├── hangar/
│   │   │   │   ├── HangarSlot.tsx           ← NEW (单个保单卡)
│   │   │   │   └── HangarLane.tsx           ← NEW (三栏布局)
│   │   │   ├── claims/
│   │   │   │   ├── ClaimsHeroCounter.tsx    ← NEW
│   │   │   │   └── ClaimRow.tsx             ← NEW
│   │   │   ├── routes/
│   │   │   │   └── RouteRow.tsx             ← NEW (sparkline + 排名)
│   │   │   └── rialo/
│   │   │       └── ReactiveDiagram.tsx      ← NEW (scroll-triggered 动画)
│   │   ├── routes/
│   │   │   ├── Tower.tsx                    ← REWRITE: 替换占位为完整大屏
│   │   │   ├── FlightDetail.tsx             ← NEW (drawer 路由)
│   │   │   ├── MyHangar.tsx                 ← NEW
│   │   │   ├── ClaimsFeed.tsx               ← NEW
│   │   │   ├── HotRoutes.tsx                ← NEW
│   │   │   └── RialoInside.tsx              ← NEW
│   │   └── App.tsx                          ← MODIFY: 路由 + shell 装载
│   ├── e2e/
│   │   └── dashboard.spec.ts                ← NEW (登录→大屏可见→点航班→drawer)
│   └── tests/
│       ├── useWebSocket.test.ts             ← NEW
│       ├── eventStore.test.ts               ← NEW
│       └── BuyDrawer.test.tsx               ← NEW
└── README.md                                ← MODIFY: Plan 3 状态 + Mapbox token 步骤
```

**未在 Plan 3 范围**：
- 真 Rialo testnet 接入（永远等 SDK）
- 移动端深度优化（仅响应式 fallback）
- 自定义保险产品（v2）
- 国际化（仅英文 UI）

---

## Task 1: 后端 WebSocket broadcaster + 路由 + 鉴权

**Files:**
- Create: `backend/ws/__init__.py`
- Create: `backend/ws/broadcaster.py`
- Create: `backend/ws/deps.py`
- Create: `backend/ws/routes.py`
- Modify: `backend/app.py` (装 ws router + broadcaster 到 app.state)
- Create: `backend/tests/unit/test_broadcaster.py`
- Create: `backend/tests/integration/test_ws_routes.py`

### Step 1: 写 broadcaster 单元测试

`backend/tests/unit/test_broadcaster.py`:

```python
import pytest

from backend.ws.broadcaster import Broadcaster, EventType


@pytest.mark.asyncio
async def test_subscribe_unsubscribe_changes_count():
    bus = Broadcaster()
    sub_a = bus.subscribe(user_id="u1")
    sub_b = bus.subscribe(user_id="u2")
    assert bus.subscriber_count() == 2
    bus.unsubscribe(sub_a)
    assert bus.subscriber_count() == 1
    bus.unsubscribe(sub_b)
    assert bus.subscriber_count() == 0


@pytest.mark.asyncio
async def test_broadcast_delivers_to_all_subscribers():
    bus = Broadcaster()
    sub_a = bus.subscribe(user_id="u1")
    sub_b = bus.subscribe(user_id="u2")
    await bus.broadcast({"type": EventType.STATE_UPDATE.value, "payload": {"x": 1}})
    msg_a = sub_a.queue.get_nowait()
    msg_b = sub_b.queue.get_nowait()
    assert msg_a["payload"] == {"x": 1}
    assert msg_b["payload"] == {"x": 1}


@pytest.mark.asyncio
async def test_send_to_user_delivers_only_to_target():
    bus = Broadcaster()
    sub_a = bus.subscribe(user_id="u1")
    sub_b = bus.subscribe(user_id="u2")
    await bus.send_to_user("u1", {"type": EventType.TOAST.value, "payload": "+10 RIA"})
    msg_a = sub_a.queue.get_nowait()
    assert msg_a["payload"] == "+10 RIA"
    assert sub_b.queue.empty()


@pytest.mark.asyncio
async def test_event_type_enum_values():
    assert EventType.STATE_UPDATE.value == "state_update"
    assert EventType.FLARE.value == "flare"
    assert EventType.TOAST.value == "toast"
    assert EventType.HELLO.value == "hello"
```

### Step 2: 跑看 fail

```bash
pytest backend/tests/unit/test_broadcaster.py -v
```

Expected: ImportError.

### Step 3: 实现 broadcaster.py

`backend/ws/__init__.py` 空。

`backend/ws/broadcaster.py`:

```python
import asyncio
import enum
import uuid
from dataclasses import dataclass, field


class EventType(str, enum.Enum):
    HELLO = "hello"
    STATE_UPDATE = "state_update"
    FLARE = "flare"
    TOAST = "toast"


@dataclass
class Subscriber:
    id: str
    user_id: str
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=256))


class Broadcaster:
    def __init__(self) -> None:
        self._subs: dict[str, Subscriber] = {}

    def subscribe(self, *, user_id: str) -> Subscriber:
        sub = Subscriber(id=uuid.uuid4().hex, user_id=user_id)
        self._subs[sub.id] = sub
        return sub

    def unsubscribe(self, sub: Subscriber) -> None:
        self._subs.pop(sub.id, None)

    def subscriber_count(self) -> int:
        return len(self._subs)

    async def broadcast(self, message: dict) -> None:
        for sub in list(self._subs.values()):
            try:
                sub.queue.put_nowait(message)
            except asyncio.QueueFull:
                # 慢消费者: 丢老的换新的 (大屏数据陈旧无所谓, 实时更重要)
                try:
                    sub.queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    sub.queue.put_nowait(message)
                except asyncio.QueueFull:
                    pass

    async def send_to_user(self, user_id: str, message: dict) -> None:
        for sub in list(self._subs.values()):
            if sub.user_id == user_id:
                try:
                    sub.queue.put_nowait(message)
                except asyncio.QueueFull:
                    pass
```

### Step 4: 跑测试看通过

```bash
pytest backend/tests/unit/test_broadcaster.py -v
```

Expected: 4 passed.

### Step 5: 写 WS 路由 + deps + 集成测试

`backend/ws/deps.py`:

```python
from fastapi import WebSocket, WebSocketException, status

from backend.auth.jwt import JWTError, decode_session
from backend.config import get_settings


async def authenticate_ws(websocket: WebSocket) -> str:
    """从 cookie 中校验 JWT, 返回 user_id 或抛出 WebSocketException."""
    cookie_name = get_settings().jwt_cookie_name
    token = websocket.cookies.get(cookie_name)
    if not token:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="not authenticated")
    try:
        payload = decode_session(token)
    except JWTError as exc:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="invalid session") from exc
    return payload["sub"]
```

`backend/ws/routes.py`:

```python
import asyncio
import time

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect

from backend.ws.broadcaster import Broadcaster, EventType
from backend.ws.deps import authenticate_ws

router = APIRouter()


def _broadcaster_from(websocket: WebSocket) -> Broadcaster:
    return websocket.app.state.broadcaster


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
    try:
        user_id = await authenticate_ws(websocket)
    except Exception:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    broadcaster = _broadcaster_from(websocket)
    subscriber = broadcaster.subscribe(user_id=user_id)
    try:
        await websocket.send_json({
            "type": EventType.HELLO.value,
            "payload": {"server_time": int(time.time())},
        })
        while True:
            try:
                msg = await asyncio.wait_for(subscriber.queue.get(), timeout=20.0)
                await websocket.send_json(msg)
            except asyncio.TimeoutError:
                # heartbeat (前端用 onmessage 监听; 也可改为 ping)
                await websocket.send_json({"type": "ping", "payload": {}})
    except WebSocketDisconnect:
        pass
    finally:
        broadcaster.unsubscribe(subscriber)
```

### Step 6: 写 WS 集成测试

`backend/tests/integration/test_ws_routes.py`:

```python
import asyncio
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.db import Base, get_engine


@pytest.fixture
async def app_setup(monkeypatch, tmp_path):
    db_file = tmp_path / "ws.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake.apps.googleusercontent.com")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    from backend.config import get_settings
    get_settings.cache_clear()
    import backend.db
    backend.db._engine = None
    backend.db._session_factory = None

    monkeypatch.setattr(google, "verify_id_token",
        lambda t: GoogleProfile(sub="g-1", email="x@y.com", name="X", avatar_url="") if t == "v" else None)

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield app

    await engine.dispose()


@pytest.mark.asyncio
async def test_ws_requires_auth(app_setup):
    from fastapi.testclient import TestClient
    with TestClient(app_setup) as client:
        with pytest.raises(Exception):
            with client.websocket_connect("/ws"):
                pass


@pytest.mark.asyncio
async def test_ws_hello_after_auth(app_setup):
    from fastapi.testclient import TestClient
    with TestClient(app_setup) as client:
        # 登录拿 cookie
        login = client.post("/auth/google", json={"id_token": "v"})
        assert login.status_code == 200
        cookies = login.cookies
        with client.websocket_connect("/ws", cookies=dict(cookies)) as ws:
            hello = ws.receive_json()
            assert hello["type"] == "hello"
            assert "server_time" in hello["payload"]


@pytest.mark.asyncio
async def test_broadcast_delivers_to_connected_ws(app_setup):
    from fastapi.testclient import TestClient
    with TestClient(app_setup) as client:
        login = client.post("/auth/google", json={"id_token": "v"})
        with client.websocket_connect("/ws", cookies=dict(login.cookies)) as ws:
            ws.receive_json()  # hello
            # 主动从 app.state.broadcaster 发一个 state_update
            await app_setup.state.broadcaster.broadcast({
                "type": "state_update", "payload": {"x": 1}
            })
            msg = ws.receive_json()
            assert msg["type"] == "state_update"
            assert msg["payload"] == {"x": 1}
```

### Step 7: 改 `backend/app.py` 装 ws router + broadcaster

在 `create_app()` 与 `lifespan` 中加：

```python
from backend.ws.broadcaster import Broadcaster
from backend.ws.routes import router as ws_router

# 在 lifespan 内、create_app 内 ─ 都创建并装到 app.state.broadcaster:
app.state.broadcaster = Broadcaster()

# routes 装载区:
app.include_router(ws_router)
```

完整 `backend/app.py` 由 Codex 整合（注意 ClaimEngine 也要拿到 broadcaster 引用，用 setter）。

### Step 8: 跑全测 + commit

```bash
pytest backend/tests -v
```

Expected: 全部 66 + 7 (broadcaster 4 + ws routes 3) = 73 passed.

```bash
git add backend/ws/ backend/app.py backend/tests/unit/test_broadcaster.py backend/tests/integration/test_ws_routes.py
git commit -m "$(printf 'feat(ws): WebSocket broadcaster + /ws endpoint + JWT 鉴权\n\n- Broadcaster: subscribe/unsubscribe/broadcast/send_to_user, 慢消费者丢老换新\n- EventType: hello / state_update / flare / toast\n- /ws: cookie 校验 JWT, accept + 发 hello + 转发 queue 消息, heartbeat 20s\n- 装 broadcaster 到 app.state, 供 ClaimEngine 与 routes 使用\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 2: ClaimEngine 集成 WebSocket FLARE 广播

**Files:**
- Modify: `backend/claims/engine.py` (trigger 成功后广播 FLARE)
- Modify: `backend/app.py` (lifespan 把 broadcaster 注入 ClaimEngine)
- Modify: `backend/tests/unit/test_claim_engine.py` (验证广播)
- Create: `backend/tests/integration/test_flare_broadcast.py`

### Step 1: 加测试（claim 触发时广播）

修改 `backend/tests/unit/test_claim_engine.py`，加一个新测试：

```python
@pytest.mark.asyncio
async def test_run_once_broadcasts_flare_when_triggered(db_session: AsyncSession):
    policy = await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45})

    captured: list[dict] = []

    class FakeBroadcaster:
        async def broadcast(self, message: dict) -> None:
            captured.append(message)
        async def send_to_user(self, user_id, message): pass

    engine = ClaimEngine(
        adapter=adapter,
        session_factory=get_session_factory(),
        broadcaster=FakeBroadcaster(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )
    summary = await engine.run_once()
    assert summary.triggered == 1
    assert len(captured) == 1
    flare = captured[0]
    assert flare["type"] == "flare"
    assert flare["payload"]["flight_id"] == policy.flight_id
    assert flare["payload"]["payout"] == policy.payout
    assert flare["payload"]["signature"].startswith("0x")
```

### Step 2: 跑看 fail
```bash
pytest backend/tests/unit/test_claim_engine.py::test_run_once_broadcasts_flare_when_triggered -v
```

### Step 3: 改 ClaimEngine 支持注入 broadcaster + 广播 FLARE

修改 `backend/claims/engine.py`，加 `broadcaster` 参数：

```python
class ClaimEngine:
    def __init__(
        self,
        *,
        adapter: ReactiveContractAdapter,
        session_factory: async_sessionmaker,
        broadcaster=None,
        observe_url: Callable[[str], str] = default_observe_url,
        now: Callable[[], int] | None = None,
        interval_seconds: int = 30,
    ) -> None:
        # ...existing...
        self._broadcaster = broadcaster

    def set_broadcaster(self, broadcaster) -> None:
        self._broadcaster = broadcaster

    async def _process(self, policy: Policy) -> None:
        # ...existing 直到 ClaimsService.create_claim 完成后...
        async with self._session_factory() as session:
            persistent = await session.get(Policy, policy.id)
            if persistent is None or persistent.status != PolicyStatus.ACTIVE:
                return
            await ClaimsService(session).create_claim(
                policy=persistent,
                payout=persistent.payout,
                delay_minutes=payload.delay_minutes,
                signature=signature,
                settle_duration_ms=tx.settle_duration_ms,
            )
            await session.commit()
            # ---- 新增: 广播 FLARE ----
            if self._broadcaster is not None:
                await self._broadcaster.broadcast({
                    "type": "flare",
                    "payload": {
                        "flight_id": persistent.flight_id,
                        "policy_id": persistent.id,
                        "payout": persistent.payout,
                        "delay_minutes": payload.delay_minutes,
                        "signature": signature,
                        "settle_duration_ms": tx.settle_duration_ms,
                    },
                })
                # 同时通知保单持有人 toast
                await self._broadcaster.send_to_user(persistent.user_id, {
                    "type": "toast",
                    "payload": f"+{persistent.payout} RIA settled",
                })
```

### Step 4: 改 `backend/app.py` 把 broadcaster 注入 ClaimEngine

```python
# lifespan 内:
broadcaster = Broadcaster()
adapter = get_contract_adapter()
engine = ClaimEngine(adapter=adapter, session_factory=get_session_factory(), broadcaster=broadcaster)
app.state.broadcaster = broadcaster
app.state.contract_adapter = adapter
app.state.claim_engine = engine
```

### Step 5: 写 e2e 广播集成测试

`backend/tests/integration/test_flare_broadcast.py`:

```python
import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.db import Base, get_engine, get_session_factory
from backend.flights.opensky import FlightState
from backend.tests.factories import make_flight


@pytest.fixture
def app_setup(monkeypatch, tmp_path):
    db_file = tmp_path / "flare.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake.apps.googleusercontent.com")
    monkeypatch.setenv("ADMIN_TOKEN", "admin-x")
    monkeypatch.setenv("RIALO_MODE", "mock")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    from backend.config import get_settings
    get_settings.cache_clear()
    import backend.db
    backend.db._engine = None
    backend.db._session_factory = None
    monkeypatch.setattr(google, "verify_id_token",
        lambda t: GoogleProfile(sub="g-1", email="x@y.com", name="X", avatar_url="") if t == "v" else None)
    return create_app()


def test_flare_broadcast_on_admin_inject(app_setup, anyio_backend="asyncio"):
    import anyio
    with TestClient(app_setup) as client:
        engine_init = anyio.from_thread.run if False else None  # 占位; 用同步流程

        from backend.db import get_engine
        eng = get_engine()
        import asyncio
        asyncio.get_event_loop().run_until_complete(
            (lambda: eng.begin().__aenter__())()
        )
        # 这种 anyio + TestClient 混用复杂; 简化为直接 async 跑
```

**注意**：FastAPI TestClient + WebSocket + ClaimEngine.run_once 混用比较繁琐。这里**保留为 spec/note**，实际 Codex 可以根据情况要么用 `httpx-ws` + AsyncClient 整套 async，要么把这个 integration test 简化为：在 TestClient 中 connect WS → 直接调 `app.state.claim_engine.run_once()`（用 `asyncio.run` 包） → 验证 WS receive FLARE。

具体写法见 Codex 调整。重点是验证：admin inject → run_once → WS 收到 FLARE 事件。

### Step 6: 跑全测 + commit

```bash
pytest backend/tests -v
```
Expected: 73 之前 + 1 (claim_engine 加的) + 1 (flare 集成) = 75 passed.

```bash
git add backend/claims/engine.py backend/app.py backend/tests/unit/test_claim_engine.py backend/tests/integration/test_flare_broadcast.py
git commit -m "$(printf 'feat(ws): ClaimEngine 触发赔付时广播 FLARE + toast\n\n- ClaimEngine 新增 broadcaster 注入参数 + set_broadcaster\n- _process 在 commit 后广播: type=flare 全员可见, toast 仅发持有人\n- FakeBroadcaster 测试验证广播 payload 含 flight_id/payout/signature\n- app.lifespan 把同一 Broadcaster 实例注入 ClaimEngine 与 /ws\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 3: 前端 useWebSocket + StatusBar + 全局 shell

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/store/eventStore.ts`
- Create: `frontend/src/components/shell/TopNav.tsx`
- Create: `frontend/src/components/shell/StatusBar.tsx`
- Modify: `frontend/package.json` (加 zustand)
- Create: `frontend/src/tests/useWebSocket.test.ts`
- Create: `frontend/src/tests/eventStore.test.ts`

### Step 1: 装 zustand

```bash
cd frontend && pnpm add zustand@^5.0
```

### Step 2: 写 eventStore 测试

`frontend/src/tests/eventStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useEventStore } from "../store/eventStore";

describe("eventStore", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
  });

  it("addFlare prepends to flares", () => {
    useEventStore.getState().addFlare({ flight_id: "BA178-20260614", policy_id: "p1", payout: 80, delay_minutes: 45, signature: "0x", settle_duration_ms: 100 });
    expect(useEventStore.getState().flares).toHaveLength(1);
    expect(useEventStore.getState().flares[0].flight_id).toBe("BA178-20260614");
  });

  it("flares capped at 100", () => {
    const { addFlare } = useEventStore.getState();
    for (let i = 0; i < 150; i++) {
      addFlare({ flight_id: `F-${i}`, policy_id: `p${i}`, payout: 10, delay_minutes: 30, signature: "0x", settle_duration_ms: 100 });
    }
    expect(useEventStore.getState().flares).toHaveLength(100);
  });

  it("addToast auto-clears after timeout (manual clear)", () => {
    useEventStore.getState().addToast({ id: "t1", message: "+10 RIA" });
    expect(useEventStore.getState().toasts).toHaveLength(1);
    useEventStore.getState().dismissToast("t1");
    expect(useEventStore.getState().toasts).toHaveLength(0);
  });

  it("setWsState transitions", () => {
    useEventStore.getState().setWsState("connecting");
    expect(useEventStore.getState().wsState).toBe("connecting");
    useEventStore.getState().setWsState("open");
    expect(useEventStore.getState().wsState).toBe("open");
  });
});
```

### Step 3: 实现 eventStore.ts

`frontend/src/store/eventStore.ts`:

```typescript
import { create } from "zustand";

export type WsState = "idle" | "connecting" | "open" | "retrying" | "closed";

export interface FlareEvent {
  flight_id: string;
  policy_id: string;
  payout: number;
  delay_minutes: number;
  signature: string;
  settle_duration_ms: number;
}

export interface ToastEvent {
  id: string;
  message: string;
}

interface EventStore {
  flares: FlareEvent[];
  toasts: ToastEvent[];
  wsState: WsState;
  addFlare: (f: FlareEvent) => void;
  addToast: (t: ToastEvent) => void;
  dismissToast: (id: string) => void;
  setWsState: (s: WsState) => void;
}

const FLARES_CAP = 100;

export const useEventStore = create<EventStore>((set) => ({
  flares: [],
  toasts: [],
  wsState: "idle",
  addFlare: (flare) => set((s) => ({ flares: [flare, ...s.flares].slice(0, FLARES_CAP) })),
  addToast: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setWsState: (wsState) => set({ wsState }),
}));
```

### Step 4: 写 useWebSocket 测试 + 实现

`frontend/src/tests/useWebSocket.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useEventStore } from "../store/eventStore";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  readyState = 0;
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send() {}
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe("useWebSocket", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("transitions to open on socket open", () => {
    renderHook(() => useWebSocket("/ws"));
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = 1;
      ws.onopen?.();
    });
    expect(useEventStore.getState().wsState).toBe("open");
  });

  it("dispatches flare events to store", () => {
    renderHook(() => useWebSocket("/ws"));
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = 1;
      ws.onopen?.();
      ws.onmessage?.({ data: JSON.stringify({
        type: "flare",
        payload: { flight_id: "BA178-20260614", policy_id: "p1", payout: 80,
                   delay_minutes: 45, signature: "0x", settle_duration_ms: 100 }
      }) });
    });
    expect(useEventStore.getState().flares).toHaveLength(1);
  });

  it("dispatches toast events to store", () => {
    renderHook(() => useWebSocket("/ws"));
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.onopen?.();
      ws.onmessage?.({ data: JSON.stringify({ type: "toast", payload: "+10 RIA" }) });
    });
    expect(useEventStore.getState().toasts).toHaveLength(1);
  });
});
```

### Step 5: 实现 useWebSocket.ts

`frontend/src/hooks/useWebSocket.ts`:

```typescript
import { useEffect, useRef } from "react";
import { useEventStore } from "../store/eventStore";

const BACKOFF_SCHEDULE = [1000, 2000, 4000, 8000, 16000, 30000];

export function useWebSocket(path: string = "/ws") {
  const wsRef = useRef<WebSocket | null>(null);
  const stoppedRef = useRef(false);
  const attemptRef = useRef(0);
  const { setWsState, addFlare, addToast } = useEventStore.getState();

  useEffect(() => {
    stoppedRef.current = false;

    const connect = () => {
      if (stoppedRef.current) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${window.location.host}${path}`;
      useEventStore.getState().setWsState("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        useEventStore.getState().setWsState("open");
      };
      ws.onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(typeof e.data === "string" ? e.data : "{}");
          if (msg.type === "flare") {
            useEventStore.getState().addFlare(msg.payload);
          } else if (msg.type === "toast") {
            const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            useEventStore.getState().addToast({ id, message: msg.payload });
            setTimeout(() => useEventStore.getState().dismissToast(id), 4000);
          }
          // state_update / hello / ping 暂不处理 (Tower 自行订阅 useFlights)
        } catch {
          // 忽略坏帧
        }
      };
      ws.onclose = () => {
        if (stoppedRef.current) return;
        useEventStore.getState().setWsState("retrying");
        const backoff = BACKOFF_SCHEDULE[Math.min(attemptRef.current, BACKOFF_SCHEDULE.length - 1)];
        attemptRef.current += 1;
        setTimeout(connect, backoff);
      };
      ws.onerror = () => {
        try { ws.close(); } catch { /* noop */ }
      };
    };

    connect();
    return () => {
      stoppedRef.current = true;
      wsRef.current?.close();
      useEventStore.getState().setWsState("closed");
    };
  }, [path]);
}
```

### Step 6: 实现 TopNav + StatusBar

`frontend/src/components/shell/TopNav.tsx`:

```typescript
import { Link, useLocation } from "react-router-dom";
import { useMe } from "../../hooks/useMe";

const TABS = [
  { to: "/", label: "TOWER" },
  { to: "/policies", label: "MY HANGAR" },
  { to: "/claims", label: "CLAIMS FEED" },
  { to: "/routes", label: "HOT ROUTES" },
  { to: "/rialo-inside", label: "RIALO INSIDE" },
];

export function TopNav() {
  const { user } = useMe();
  const loc = useLocation();
  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 24px", borderBottom: "1px solid var(--border-subtle)",
      fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.16em",
      textTransform: "uppercase", color: "var(--text-secondary)",
    }}>
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <span style={{ color: "var(--accent-radar)", letterSpacing: "0.24em" }}>RIALO ◦ CAPTAIN</span>
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} style={{
            color: loc.pathname === t.to ? "var(--text-primary)" : "var(--text-secondary)",
            textDecoration: "none",
            borderBottom: loc.pathname === t.to ? "1px solid var(--accent-radar)" : "1px solid transparent",
            paddingBottom: 4,
          }}>{t.label}</Link>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "var(--text-tertiary)" }}>BAL</span>
        <span style={{ color: "var(--text-primary)" }}>{user?.balance ?? "—"} RIA</span>
        <span style={{ color: "var(--text-tertiary)" }}>{user?.email}</span>
      </div>
    </nav>
  );
}
```

`frontend/src/components/shell/StatusBar.tsx`:

```typescript
import { useEventStore } from "../../store/eventStore";

const COLORS: Record<string, string> = {
  idle: "var(--text-tertiary)",
  connecting: "var(--warn-amber)",
  retrying: "var(--warn-amber)",
  open: "var(--accent-radar)",
  closed: "var(--danger-flare)",
};

export function StatusBar() {
  const wsState = useEventStore((s) => s.wsState);
  const flareCount = useEventStore((s) => s.flares.length);
  return (
    <footer style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: 32, display: "flex", alignItems: "center",
      gap: 16, padding: "0 16px",
      borderTop: "1px solid var(--border-subtle)",
      background: "var(--surface-1)",
      fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)",
      letterSpacing: "0.16em", textTransform: "uppercase",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: 999,
          background: COLORS[wsState] ?? COLORS.idle,
          boxShadow: wsState === "open" ? "0 0 8px var(--accent-radar-dim)" : "none",
        }} />
        <span>{wsState}</span>
      </div>
      <div style={{ color: "var(--text-tertiary)" }}>·</div>
      <div>FLARES <span style={{ color: "var(--text-primary)" }}>{flareCount}</span></div>
    </footer>
  );
}
```

### Step 7: 跑测试 + commit

```bash
cd frontend && pnpm test
```

Expected: 13+ passed (含 useWebSocket 3 + eventStore 4 + 之前 7).

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/hooks/useWebSocket.ts frontend/src/store/ frontend/src/components/shell/ frontend/src/tests/useWebSocket.test.ts frontend/src/tests/eventStore.test.ts
git commit -m "$(printf 'feat(frontend): useWebSocket + zustand eventStore + TopNav/StatusBar\n\n- useWebSocket: 自动协议匹配 ws/wss, 指数退避重连\n- eventStore (zustand): flares (cap 100) + toasts (manual dismiss) + wsState\n- TopNav: 5 个 tab + 余额 + 邮箱, 当前页用雷达青绿下划线\n- StatusBar: 底部 fixed, WS LED 三态 (idle/open/retrying), FLARES 计数\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 4: Tower 主页（Mapbox + 飞机光点 + 雷达扫描 + Sidebar）

**Files:**
- Modify: `frontend/package.json` (加 mapbox-gl + deck.gl + @deck.gl/layers + @deck.gl/mapbox + swr 已有)
- Modify: `frontend/.env.example` (加 VITE_MAPBOX_TOKEN)
- Create: `frontend/src/hooks/useFlights.ts`
- Create: `frontend/src/components/tower/GlobeMap.tsx`
- Create: `frontend/src/components/tower/RadarSweep.tsx`
- Create: `frontend/src/components/tower/EventFeedSidebar.tsx`
- Create: `frontend/src/components/tower/KPIBand.tsx`
- Create: `frontend/src/components/tower/DataStaleBadge.tsx`
- Modify: `frontend/src/routes/Tower.tsx` (整体重写)
- Modify: `frontend/src/App.tsx` (用 TopNav + StatusBar 包路由)

### Step 1: 装依赖

```bash
cd frontend
pnpm add mapbox-gl@^3.7.0 deck.gl@^9.0.0 @deck.gl/layers@^9.0.0 @deck.gl/mapbox@^9.0.0
pnpm add -D @types/mapbox-gl
```

### Step 2: 添加 Mapbox token 配置

修改 `frontend/.env.example`:

```
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_MAPBOX_TOKEN=pk.your-mapbox-public-token
```

### Step 3: 写 useFlights hook

`frontend/src/hooks/useFlights.ts`:

```typescript
import useSWR from "swr";
import { apiFetch } from "../api/client";

export interface FlightPublic {
  callsign: string;
  origin_country: string;
  longitude: number | null;
  latitude: number | null;
  velocity: number | null;
  heading: number | null;
  on_ground: boolean;
}

export interface LiveResponse {
  data_stale: boolean;
  stale_seconds: number;
  flights: FlightPublic[];
}

const fetcher = (path: string) => apiFetch<LiveResponse>(path);

export function useFlights() {
  const { data, error, isLoading } = useSWR<LiveResponse>("/flights/live", fetcher, {
    refreshInterval: 15000,
  });
  return {
    flights: data?.flights ?? [],
    stale: data?.data_stale ?? true,
    staleSeconds: data?.stale_seconds ?? 0,
    error, isLoading,
  };
}
```

### Step 4: 实现 RadarSweep

`frontend/src/components/tower/RadarSweep.tsx`:

```typescript
export function RadarSweep() {
  return (
    <div style={{
      position: "absolute", top: 16, left: 16,
      width: 56, height: 56, pointerEvents: "none",
      borderRadius: "50%",
      border: "1px solid var(--border-subtle)",
      overflow: "hidden",
    }}>
      <div className="radar-sweep" style={{
        width: "100%", height: "100%",
        background: "conic-gradient(from 0deg, transparent 0deg, var(--accent-radar-dim) 60deg, transparent 90deg)",
      }} />
    </div>
  );
}
```

### Step 5: 实现 GlobeMap (Mapbox + deck.gl scatter)

`frontend/src/components/tower/GlobeMap.tsx`:

```typescript
import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useFlights, type FlightPublic } from "../../hooks/useFlights";
import { useEventStore } from "../../store/eventStore";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface Props {
  onSelectFlight?: (callsign: string) => void;
}

export function GlobeMap({ onSelectFlight }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const { flights } = useFlights();
  const flares = useEventStore((s) => s.flares);

  const activeFlares = useMemo(() => {
    const now = Date.now();
    return flares.slice(0, 30).map((f, idx) => ({ ...f, _age: idx }));
  }, [flares]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [0, 30],
      zoom: 1.5,
      attributionControl: false,
      projection: "mercator",
    });
    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay as unknown as mapboxgl.IControl);
    mapRef.current = map;
    overlayRef.current = overlay;
    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const validFlights = flights.filter(
      (f): f is FlightPublic & { longitude: number; latitude: number } =>
        f.longitude !== null && f.latitude !== null
    );
    const flightLayer = new ScatterplotLayer({
      id: "flights",
      data: validFlights,
      getPosition: (f) => [f.longitude, f.latitude],
      getRadius: 32000,
      radiusUnits: "meters",
      radiusMinPixels: 2,
      radiusMaxPixels: 6,
      getFillColor: [0, 255, 157, 200],
      pickable: true,
      onClick: (info) => {
        if (info.object && onSelectFlight) onSelectFlight((info.object as FlightPublic).callsign);
      },
    });
    const flareLayer = new ScatterplotLayer({
      id: "flares",
      data: activeFlares,
      getPosition: () => [0, 0],   // 实际坐标从 useFlights 里映射 callsign-to-position
      getRadius: 80000,
      getFillColor: [0, 255, 157, 180],
      radiusMinPixels: 6,
      radiusMaxPixels: 24,
    });
    overlay.setProps({ layers: [flightLayer, flareLayer] });
  }, [flights, activeFlares, onSelectFlight]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
```

> **注意**：flareLayer 的 `getPosition: () => [0, 0]` 是占位，实际 demo 中可由 `useFlights` 维护 callsign→position 映射后查表。为简化 Plan，Codex 实现时可只画 flightLayer + flightDot hover 高亮，flare 改为在 `RadarSweep` 旁的 sidebar 中放飘字。**核心 spec：地图能渲染≥50 个飞机光点 + 点击触发 onSelectFlight 即满足 §10 验收**。

### Step 6: 实现 EventFeedSidebar + KPIBand + DataStaleBadge

`frontend/src/components/tower/EventFeedSidebar.tsx`:

```typescript
import { useEventStore } from "../../store/eventStore";

export function EventFeedSidebar() {
  const flares = useEventStore((s) => s.flares.slice(0, 20));
  return (
    <aside style={{
      position: "absolute", top: 64, right: 16,
      width: 320, maxHeight: "70vh", overflow: "auto",
      background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-soft)", padding: 16,
      fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)",
    }}>
      <div style={{ letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>EVENT FEED</div>
      {flares.length === 0 && <div style={{ color: "var(--text-tertiary)" }}>awaiting first flare…</div>}
      {flares.map((f) => (
        <div key={f.signature.slice(0, 16)} style={{
          padding: "8px 0", borderTop: "1px solid var(--border-subtle)",
          display: "grid", gap: 4,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--accent-radar)" }}>{f.flight_id}</span>
            <span style={{ color: "var(--text-primary)" }}>+{f.payout} RIA</span>
          </div>
          <div style={{ display: "flex", gap: 12, color: "var(--text-tertiary)", fontSize: 10 }}>
            <span>{f.delay_minutes}m late</span>
            <span>{f.settle_duration_ms}ms</span>
            <span>{f.signature.slice(0, 10)}…</span>
          </div>
        </div>
      ))}
    </aside>
  );
}
```

`frontend/src/components/tower/KPIBand.tsx`:

```typescript
import { useEventStore } from "../../store/eventStore";

export function KPIBand() {
  const flares = useEventStore((s) => s.flares);
  const totalPayout = flares.reduce((sum, f) => sum + f.payout, 0);
  return (
    <div style={{
      position: "absolute", bottom: 48, left: 16,
      padding: "10px 14px",
      background: "var(--surface-1)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-soft)",
      display: "flex", gap: 20,
      fontFamily: "var(--font-mono)", fontSize: 11,
      letterSpacing: "0.18em", textTransform: "uppercase",
    }}>
      <div>
        <span style={{ color: "var(--text-tertiary)", marginRight: 6 }}>SESSION FLARES</span>
        <span style={{ color: "var(--accent-radar)" }}>{flares.length}</span>
      </div>
      <div>
        <span style={{ color: "var(--text-tertiary)", marginRight: 6 }}>PAYOUT</span>
        <span style={{ color: "var(--accent-radar)" }}>{totalPayout}</span>
      </div>
    </div>
  );
}
```

`frontend/src/components/tower/DataStaleBadge.tsx`:

```typescript
import { useFlights } from "../../hooks/useFlights";

export function DataStaleBadge() {
  const { stale, staleSeconds } = useFlights();
  if (!stale) return null;
  return (
    <div style={{
      position: "absolute", top: 16, right: 16,
      padding: "6px 10px",
      background: "rgba(255, 180, 0, 0.18)",
      border: "1px solid var(--warn-amber)",
      color: "var(--warn-amber)",
      fontFamily: "var(--font-mono)", fontSize: 11,
      letterSpacing: "0.18em", textTransform: "uppercase",
      borderRadius: 4,
    }}>
      DATA STALE · {staleSeconds}s
    </div>
  );
}
```

### Step 7: 重写 Tower.tsx

`frontend/src/routes/Tower.tsx`:

```typescript
import { useNavigate } from "react-router-dom";
import { GlobeMap } from "../components/tower/GlobeMap";
import { RadarSweep } from "../components/tower/RadarSweep";
import { EventFeedSidebar } from "../components/tower/EventFeedSidebar";
import { KPIBand } from "../components/tower/KPIBand";
import { DataStaleBadge } from "../components/tower/DataStaleBadge";

export function Tower() {
  const navigate = useNavigate();
  return (
    <div style={{ position: "absolute", inset: 0, top: 56, bottom: 32 }}>
      <GlobeMap onSelectFlight={(callsign) => navigate(`/flight/${callsign}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`)} />
      <RadarSweep />
      <DataStaleBadge />
      <EventFeedSidebar />
      <KPIBand />
    </div>
  );
}
```

### Step 8: 改 App.tsx 装 TopNav + StatusBar + useWebSocket

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Login } from "./routes/Login";
import { Tower } from "./routes/Tower";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { TopNav } from "./components/shell/TopNav";
import { StatusBar } from "./components/shell/StatusBar";
import { useWebSocket } from "./hooks/useWebSocket";

function AppShell({ children }: { children: React.ReactNode }) {
  useWebSocket("/ws");
  return (
    <>
      <TopNav />
      {children}
      <StatusBar />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute><AppShell><Tower /></AppShell></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

(下一 task 加 /policies、/claims、/routes、/rialo-inside、/flight/:id 路由)

### Step 9: 验证 + commit

```bash
cd frontend && pnpm test && pnpm build && pnpm lint
```

Expected: 全过.

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/.env.example frontend/src/hooks/useFlights.ts frontend/src/components/tower/ frontend/src/routes/Tower.tsx frontend/src/App.tsx
git commit -m "$(printf 'feat(tower): Mapbox GlobeMap + RadarSweep + EventFeed + KPI + DataStale\n\n- mapbox-gl + deck.gl + @deck.gl/layers + @deck.gl/mapbox 依赖\n- GlobeMap: dark style + ScatterplotLayer 渲染飞机光点 + onClick 选 flight\n- RadarSweep: conic-gradient + radar-sweep utility\n- EventFeedSidebar: 实时 flares 时间线 (右上)\n- KPIBand: 本会话 flares + payout 累计 (左下)\n- DataStaleBadge: OpenSky 不可用时显示\n- App.tsx 装 useWebSocket + TopNav + StatusBar 全局壳\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 5: Flight Detail drawer + 购买流程

**Files:**
- Create: `frontend/src/components/drawer/BuyDrawer.tsx`
- Create: `frontend/src/components/drawer/PremiumPicker.tsx`
- Create: `frontend/src/components/drawer/DelayHistogram.tsx`
- Create: `frontend/src/routes/FlightDetail.tsx`
- Modify: `frontend/src/App.tsx` (装 /flight/:id 路由)
- Create: `frontend/src/tests/BuyDrawer.test.tsx`

### Step 1: 写 BuyDrawer 测试

`frontend/src/tests/BuyDrawer.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { BuyDrawer } from "../components/drawer/BuyDrawer";

const fakeFlight = {
  id: "BA178-20260614", callsign: "BA178",
  origin: "LHR", destination: "JFK", delay_rate: 0.1, samples: 30,
};

describe("BuyDrawer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(fakeFlight), { status: 200 })
    ));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders flight callsign and route", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter><BuyDrawer flightId="BA178-20260614" onClose={() => {}} /></MemoryRouter>
      </SWRConfig>
    );
    await waitFor(() => expect(screen.getByText("BA178")).toBeInTheDocument());
    expect(screen.getByText(/LHR.*JFK/)).toBeInTheDocument();
  });

  it("calls POST /policies on Confirm", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "p1", flight_id: "BA178-20260614", premium: 10, payout: 60,
      status: "active", contract_ref: "mock-p1", created_at: 1,
    }), { status: 201 }));

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter><BuyDrawer flightId="BA178-20260614" onClose={() => {}} /></MemoryRouter>
      </SWRConfig>
    );
    await waitFor(() => screen.getByText("BA178"));
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/policies"));
      expect(call).toBeDefined();
    });
  });
});
```

### Step 2: 实现 PremiumPicker + DelayHistogram + BuyDrawer

`frontend/src/components/drawer/PremiumPicker.tsx`:

```typescript
interface Props {
  value: number;
  onChange: (v: number) => void;
}

const TIERS = [5, 10, 20] as const;

export function PremiumPicker({ value, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {TIERS.map((tier) => {
        const active = value === tier;
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            style={{
              flex: 1, padding: "12px 16px",
              border: `1px solid ${active ? "var(--accent-radar)" : "var(--border-subtle)"}`,
              background: active ? "rgba(0, 255, 157, 0.08)" : "var(--surface-2)",
              color: active ? "var(--accent-radar)" : "var(--text-primary)",
              borderRadius: "var(--radius-sharp)",
              fontFamily: "var(--font-mono)", fontSize: 14,
              letterSpacing: "0.18em",
              cursor: "pointer",
            }}
          >
            {tier} RIA
          </button>
        );
      })}
    </div>
  );
}
```

`frontend/src/components/drawer/DelayHistogram.tsx`:

```typescript
interface Props {
  delayRate: number;
  samples: number;
}

export function DelayHistogram({ delayRate, samples }: Props) {
  const pct = Math.round(delayRate * 100);
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
      <div style={{ color: "var(--text-secondary)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>
        DELAY RATE (last {samples} obs)
      </div>
      <div style={{ height: 10, background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: pct > 30 ? "var(--warn-amber)" : "var(--accent-radar)",
        }} />
      </div>
      <div style={{ marginTop: 6, color: "var(--text-tertiary)" }}>{pct}% historical</div>
    </div>
  );
}
```

`frontend/src/components/drawer/BuyDrawer.tsx`:

```typescript
import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "../../api/client";
import { useMe } from "../../hooks/useMe";
import { PremiumPicker } from "./PremiumPicker";
import { DelayHistogram } from "./DelayHistogram";

interface FlightDetailDto {
  id: string;
  callsign: string;
  origin: string;
  destination: string;
  delay_rate: number;
  samples: number;
}

interface Props {
  flightId: string;
  onClose: () => void;
}

export function BuyDrawer({ flightId, onClose }: Props) {
  const { data: flight } = useSWR<FlightDetailDto>(`/flights/${flightId}`, (p: string) => apiFetch(p));
  const { refresh } = useMe();
  const [premium, setPremium] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!flight) {
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: 24, color: "var(--text-secondary)" }}>loading…</div>
      </Shell>
    );
  }

  const estimatedPayout = Math.round(premium * (flight.delay_rate <= 0.05 ? 8 :
    flight.delay_rate >= 0.40 ? 2.5 :
    8 - ((flight.delay_rate - 0.05) / 0.35) * 5.5));

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/policies", {
        method: "POST",
        body: JSON.stringify({ flight_id: flightId, premium }),
      });
      await refresh();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell onClose={onClose}>
      <div style={{ padding: 24, display: "grid", gap: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }}>FLIGHT</div>
          <div style={{ fontSize: 36, marginTop: 4 }}>{flight.callsign}</div>
          <div style={{ color: "var(--text-secondary)", marginTop: 6 }}>
            {flight.origin} → {flight.destination}
          </div>
        </div>
        <DelayHistogram delayRate={flight.delay_rate} samples={flight.samples} />
        <div>
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>
            PREMIUM
          </div>
          <PremiumPicker value={premium} onChange={setPremium} />
        </div>
        <div style={{
          padding: 16,
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-2)",
          fontFamily: "var(--font-mono)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "var(--text-secondary)" }}>
            <span>EST. PAYOUT IF DELAYED ≥ 30 MIN</span>
            <span style={{ color: "var(--accent-radar)", fontSize: 18 }}>{estimatedPayout} RIA</span>
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>auto-settled by Rialo reactive contract</div>
        </div>
        {err && <div style={{ color: "var(--danger-flare)", fontSize: 12 }}>{err}</div>}
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          style={{
            padding: "14px 20px",
            background: "var(--accent-radar)",
            color: "var(--surface-0)",
            border: "none",
            borderRadius: "var(--radius-sharp)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            cursor: "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? "Confirming…" : `Confirm · ${premium} RIA`}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50,
      }} />
      <aside style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 51,
        background: "var(--surface-1)",
        borderTop: "1px solid var(--border-emphasis)",
        boxShadow: "var(--elev-2)",
        maxHeight: "80vh", overflow: "auto",
        animation: "slideup 280ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}>{children}</aside>
      <style>{`@keyframes slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </>
  );
}
```

### Step 3: 实现 FlightDetail 路由

`frontend/src/routes/FlightDetail.tsx`:

```typescript
import { useNavigate, useParams } from "react-router-dom";
import { BuyDrawer } from "../components/drawer/BuyDrawer";
import { Tower } from "./Tower";

export function FlightDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <>
      <Tower />
      {id && <BuyDrawer flightId={id} onClose={() => navigate("/")} />}
    </>
  );
}
```

### Step 4: 改 App.tsx 装 /flight/:id

加 `<Route path="/flight/:id" element={<ProtectedRoute><AppShell><FlightDetail /></AppShell></ProtectedRoute>} />`

### Step 5: 跑测试 + commit

```bash
cd frontend && pnpm test && pnpm build
```

```bash
git add frontend/src/components/drawer/ frontend/src/routes/FlightDetail.tsx frontend/src/App.tsx frontend/src/tests/BuyDrawer.test.tsx
git commit -m "$(printf 'feat(drawer): BuyDrawer slide-up + PremiumPicker + DelayHistogram + /flight/:id\n\n- BuyDrawer: 浮层覆盖 Tower, slideup 280ms ease-out\n- PremiumPicker 5/10/20 RIA 三档, 选中态雷达青绿\n- DelayHistogram: 历史延误率横条, >30%% 转琴黄\n- 估算 payout 当场显示, 点 Confirm 调 POST /policies + refresh 余额\n- /flight/:id 路由复用 Tower 作为底层\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 6: My Hangar 我的保单

**Files:**
- Create: `frontend/src/hooks/usePolicies.ts`
- Create: `frontend/src/components/hangar/HangarSlot.tsx`
- Create: `frontend/src/components/hangar/HangarLane.tsx`
- Create: `frontend/src/routes/MyHangar.tsx`
- Modify: `frontend/src/App.tsx` (装 /policies)

### Step 1: 实现 usePolicies hook

`frontend/src/hooks/usePolicies.ts`:

```typescript
import useSWR from "swr";
import { useEffect } from "react";
import { apiFetch } from "../api/client";
import { useEventStore } from "../store/eventStore";

export interface Policy {
  id: string;
  flight_id: string;
  premium: number;
  payout: number;
  status: "active" | "paid" | "expired";
  contract_ref: string;
  created_at: number;
}

const fetcher = (p: string) => apiFetch<Policy[]>(p);

export function usePolicies() {
  const { data, error, isLoading, mutate } = useSWR<Policy[]>("/policies", fetcher);
  const flares = useEventStore((s) => s.flares);
  // WS FLARE 一来就强制 revalidate (省得长轮询)
  useEffect(() => {
    if (flares.length > 0) mutate();
  }, [flares.length, mutate]);
  return { policies: data ?? [], error, isLoading, refresh: mutate };
}
```

### Step 2: 实现 HangarSlot + HangarLane

`frontend/src/components/hangar/HangarSlot.tsx`:

```typescript
import type { Policy } from "../../hooks/usePolicies";

const STATUS_COLOR: Record<Policy["status"], string> = {
  active: "var(--accent-radar)",
  paid: "var(--info-beige)",
  expired: "var(--text-tertiary)",
};

export function HangarSlot({ p }: { p: Policy }) {
  return (
    <div style={{
      padding: 16,
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-soft)",
      background: "var(--surface-1)",
      display: "grid", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: STATUS_COLOR[p.status] }}>{p.flight_id}</span>
        <span style={{
          padding: "2px 8px", borderRadius: 999,
          background: "var(--surface-2)",
          fontFamily: "var(--font-mono)", fontSize: 10,
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: STATUS_COLOR[p.status],
        }}>{p.status}</span>
      </div>
      <div style={{ display: "flex", gap: 20, fontFamily: "var(--font-mono)", fontSize: 12 }}>
        <div>
          <div style={{ color: "var(--text-tertiary)", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 10 }}>PREMIUM</div>
          <div>{p.premium} RIA</div>
        </div>
        <div>
          <div style={{ color: "var(--text-tertiary)", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 10 }}>PAYOUT</div>
          <div>{p.payout} RIA</div>
        </div>
        <div>
          <div style={{ color: "var(--text-tertiary)", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 10 }}>CONTRACT</div>
          <div style={{ color: "var(--text-secondary)" }}>{p.contract_ref.slice(0, 10)}…</div>
        </div>
      </div>
    </div>
  );
}
```

`frontend/src/components/hangar/HangarLane.tsx`:

```typescript
import type { Policy } from "../../hooks/usePolicies";
import { HangarSlot } from "./HangarSlot";

interface Props {
  title: string;
  policies: Policy[];
}

export function HangarLane({ title, policies }: Props) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h2 style={{
        margin: 0, fontFamily: "var(--font-mono)",
        fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}>{title} <span style={{ color: "var(--text-tertiary)", marginLeft: 6 }}>· {policies.length}</span></h2>
      {policies.length === 0 ? (
        <div style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>none</div>
      ) : policies.map((p) => <HangarSlot key={p.id} p={p} />)}
    </section>
  );
}
```

### Step 3: 实现 MyHangar

`frontend/src/routes/MyHangar.tsx`:

```typescript
import { usePolicies } from "../hooks/usePolicies";
import { HangarLane } from "../components/hangar/HangarLane";

export function MyHangar() {
  const { policies, isLoading } = usePolicies();
  if (isLoading) return <main style={{ padding: 32 }}>loading…</main>;
  const active = policies.filter((p) => p.status === "active");
  const paid = policies.filter((p) => p.status === "paid");
  const expired = policies.filter((p) => p.status === "expired");
  return (
    <main style={{ padding: "32px 24px 64px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, maxWidth: 1280, margin: "0 auto" }}>
      <HangarLane title="ACTIVE" policies={active} />
      <HangarLane title="PAID" policies={paid} />
      <HangarLane title="EXPIRED" policies={expired} />
    </main>
  );
}
```

### Step 4: 装 /policies 路由 + commit

修改 `frontend/src/App.tsx`：加 `<Route path="/policies" element={...MyHangar...} />`.

```bash
cd frontend && pnpm test && pnpm build
git add frontend/src/hooks/usePolicies.ts frontend/src/components/hangar/ frontend/src/routes/MyHangar.tsx frontend/src/App.tsx
git commit -m "$(printf 'feat(hangar): My Hangar 三栏机库 + WS-triggered SWR revalidate\n\n- usePolicies: SWR /policies + 监听 eventStore.flares 长度变化自动 mutate\n- HangarSlot: flight_id + status pill + premium/payout/contract 三联\n- HangarLane: ACTIVE / PAID / EXPIRED 标题 + 数量\n- /policies 路由\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 7: Claims Feed 实时赔付时间线

**Files:**
- Create: `frontend/src/hooks/useClaims.ts`
- Create: `frontend/src/components/claims/ClaimsHeroCounter.tsx`
- Create: `frontend/src/components/claims/ClaimRow.tsx`
- Create: `frontend/src/routes/ClaimsFeed.tsx`
- Modify: `frontend/src/App.tsx` (装 /claims)

### Step 1: 实现 useClaims (合并 REST + WS FLARE)

`frontend/src/hooks/useClaims.ts`:

```typescript
import useSWR from "swr";
import { useMemo } from "react";
import { apiFetch } from "../api/client";
import { useEventStore } from "../store/eventStore";

export interface Claim {
  id: string;
  policy_id: string;
  payout: number;
  delay_minutes: number;
  signature: string;
  settled_at: number;
  settle_duration_ms: number;
}

const fetcher = (p: string) => apiFetch<Claim[]>(p);

export function useClaims() {
  const { data, error, isLoading } = useSWR<Claim[]>("/claims/recent?limit=50", fetcher, {
    refreshInterval: 30000,
  });
  const flares = useEventStore((s) => s.flares);

  // 把当前会话 FLARE 转成"乐观"Claim 行（去重以 signature 为 key）
  const claims = useMemo<Claim[]>(() => {
    const persistent = data ?? [];
    const persistentSigs = new Set(persistent.map((c) => c.signature));
    const fromFlares: Claim[] = flares
      .filter((f) => !persistentSigs.has(f.signature))
      .map((f) => ({
        id: `optimistic-${f.signature.slice(0, 16)}`,
        policy_id: f.policy_id,
        payout: f.payout,
        delay_minutes: f.delay_minutes,
        signature: f.signature,
        settled_at: Math.floor(Date.now() / 1000),
        settle_duration_ms: f.settle_duration_ms,
      }));
    return [...fromFlares, ...persistent];
  }, [data, flares]);

  return { claims, isLoading, error };
}
```

### Step 2: 实现 HeroCounter + ClaimRow

`frontend/src/components/claims/ClaimsHeroCounter.tsx`:

```typescript
import type { Claim } from "../../hooks/useClaims";

export function ClaimsHeroCounter({ claims }: { claims: Claim[] }) {
  const totalPayout = claims.reduce((sum, c) => sum + c.payout, 0);
  return (
    <div style={{ padding: "40px 24px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{
        fontFamily: "var(--font-mono)", letterSpacing: "0.22em",
        textTransform: "uppercase", fontSize: 11, color: "var(--text-secondary)",
      }}>
        SESSION AUTO-SETTLED
      </div>
      <div style={{ marginTop: 6, fontSize: 64, color: "var(--accent-radar)", letterSpacing: "-0.02em" }}>
        {totalPayout} <span style={{ color: "var(--text-tertiary)", fontSize: 16 }}>RIA</span>
      </div>
      <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", fontSize: 12 }}>
        {claims.length} claims, paid by reactive contract
      </div>
    </div>
  );
}
```

`frontend/src/components/claims/ClaimRow.tsx`:

```typescript
import type { Claim } from "../../hooks/useClaims";

export function ClaimRow({ c }: { c: Claim }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "120px 1fr 100px 100px 200px",
      padding: "14px 24px",
      borderBottom: "1px solid var(--border-subtle)",
      fontFamily: "var(--font-mono)", fontSize: 12,
      alignItems: "center",
      color: "var(--text-secondary)",
    }}>
      <div style={{ color: "var(--accent-radar)" }}>{c.policy_id.slice(0, 10)}…</div>
      <div>{new Date(c.settled_at * 1000).toLocaleTimeString()}</div>
      <div>{c.delay_minutes}m late</div>
      <div style={{ color: "var(--text-primary)" }}>+{c.payout} RIA</div>
      <div style={{ color: "var(--text-tertiary)" }}>{c.signature.slice(0, 18)}… ({c.settle_duration_ms}ms)</div>
    </div>
  );
}
```

### Step 3: 实现 ClaimsFeed 路由

`frontend/src/routes/ClaimsFeed.tsx`:

```typescript
import { useClaims } from "../hooks/useClaims";
import { ClaimsHeroCounter } from "../components/claims/ClaimsHeroCounter";
import { ClaimRow } from "../components/claims/ClaimRow";

export function ClaimsFeed() {
  const { claims, isLoading } = useClaims();
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto" }}>
      <ClaimsHeroCounter claims={claims} />
      <section>
        {isLoading && <div style={{ padding: 24 }}>loading…</div>}
        {claims.map((c) => <ClaimRow key={c.signature} c={c} />)}
      </section>
    </main>
  );
}
```

### Step 4: 装 /claims 路由 + commit

```bash
cd frontend && pnpm test && pnpm build
git add frontend/src/hooks/useClaims.ts frontend/src/components/claims/ frontend/src/routes/ClaimsFeed.tsx frontend/src/App.tsx
git commit -m "$(printf 'feat(claims): Claims Feed - hero counter + 实时时间线 + WS optimistic\n\n- useClaims: SWR /claims/recent + 合并当前会话 FLARE 为乐观行 (signature 去重)\n- ClaimsHeroCounter: 大字 session payout + claims 数\n- ClaimRow: policy/time/delay/payout/signature 五列 (mono 字体)\n- /claims 路由\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 8: Hot Routes 热门航线排行榜

**Files:**
- Create: `frontend/src/hooks/useHotRoutes.ts`
- Create: `frontend/src/components/routes/RouteRow.tsx`
- Create: `frontend/src/routes/HotRoutes.tsx`
- Modify: `frontend/src/App.tsx` (装 /routes)
- Modify: `backend/flights/routes.py` (加 GET /routes/hot endpoint)
- Modify: `backend/flights/service.py` (FlightService.hot_routes)
- Create: `backend/tests/integration/test_hot_routes.py`

### Step 1: 后端 add /routes/hot endpoint

加 `FlightService.hot_routes(limit)`：按累积 policy 数 desc 返回 callsign + 数量 + delay_rate。

`backend/flights/service.py` 加方法：

```python
    async def hot_routes(self, *, limit: int = 20):
        # 按 callsign 聚合 policy 数, 排序
        from sqlalchemy import func
        stmt = (
            select(Flight.callsign, func.count(Policy.id).label("policy_count"))
            .join(Flight, Flight.id == Policy.flight_id)
            .group_by(Flight.callsign)
            .order_by(func.count(Policy.id).desc())
            .limit(limit)
        )
        rows = (await self._session.execute(stmt)).all()
        results = []
        for callsign, count in rows:
            stats = await self.delay_stats(callsign=callsign)
            results.append({
                "callsign": callsign,
                "policy_count": int(count),
                "delay_rate": stats.delay_rate,
                "samples": stats.samples,
            })
        return results
```

`backend/flights/routes.py` 加路由：

```python
@router.get("/routes/hot")
async def hot_routes(
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = Query(20, ge=1, le=100),
):
    return await FlightService(session).hot_routes(limit=limit)
```

### Step 2: 写后端测试

`backend/tests/integration/test_hot_routes.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import create_app
from backend.db import Base, get_engine, get_session_factory
from backend.models import Policy, PolicyStatus
from backend.tests.factories import make_flight, make_user


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "hot.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    from backend.config import get_settings
    get_settings.cache_clear()
    import backend.db
    backend.db._engine = None
    backend.db._session_factory = None

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # seed
    async with get_session_factory()() as s:
        u = await make_user(s)
        for cs, count in [("BA178", 5), ("DL101", 3), ("UA200", 1)]:
            for i in range(count):
                f = await make_flight(s, callsign=cs, date=f"2026061{i}")
                p = Policy(user_id=u.id, flight_id=f.id, premium=10, payout=20,
                           condition_json="{}", status=PolicyStatus.ACTIVE)
                s.add(p)
                await s.flush()
        await s.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        yield client
    await engine.dispose()


@pytest.mark.asyncio
async def test_hot_routes_sorted_by_policy_count(app_client):
    res = await app_client.get("/routes/hot?limit=10")
    assert res.status_code == 200
    items = res.json()
    assert items[0]["callsign"] == "BA178"
    assert items[0]["policy_count"] == 5
    assert items[1]["callsign"] == "DL101"
    assert items[1]["policy_count"] == 3
```

### Step 3: 前端 useHotRoutes + RouteRow + HotRoutes

`frontend/src/hooks/useHotRoutes.ts`:

```typescript
import useSWR from "swr";
import { apiFetch } from "../api/client";

export interface HotRoute {
  callsign: string;
  policy_count: number;
  delay_rate: number;
  samples: number;
}

export function useHotRoutes() {
  const { data, isLoading } = useSWR<HotRoute[]>("/routes/hot?limit=30", (p: string) => apiFetch(p));
  return { routes: data ?? [], isLoading };
}
```

`frontend/src/components/routes/RouteRow.tsx`:

```typescript
import type { HotRoute } from "../../hooks/useHotRoutes";

export function RouteRow({ r, rank }: { r: HotRoute; rank: number }) {
  const pct = Math.round(r.delay_rate * 100);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "40px 1fr 120px 100px",
      padding: "14px 24px",
      borderBottom: "1px solid var(--border-subtle)",
      fontFamily: "var(--font-mono)", fontSize: 13, alignItems: "center",
    }}>
      <div style={{ color: "var(--text-tertiary)" }}>#{rank}</div>
      <div style={{ color: "var(--accent-radar)", fontSize: 16 }}>{r.callsign}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: "var(--surface-2)" }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: pct > 30 ? "var(--warn-amber)" : "var(--accent-radar)",
          }} />
        </div>
        <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{pct}%</span>
      </div>
      <div style={{ textAlign: "right", color: "var(--text-secondary)" }}>{r.policy_count} pol</div>
    </div>
  );
}
```

`frontend/src/routes/HotRoutes.tsx`:

```typescript
import { useHotRoutes } from "../hooks/useHotRoutes";
import { RouteRow } from "../components/routes/RouteRow";

export function HotRoutes() {
  const { routes, isLoading } = useHotRoutes();
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 0 64px" }}>
      <h1 style={{ padding: "0 24px 24px", margin: 0, fontFamily: "var(--font-mono)", letterSpacing: "0.22em", textTransform: "uppercase", fontSize: 14, color: "var(--text-secondary)" }}>
        HOT ROUTES <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>· by policy demand</span>
      </h1>
      {isLoading && <div style={{ padding: 24 }}>loading…</div>}
      {routes.map((r, i) => <RouteRow key={r.callsign} r={r} rank={i + 1} />)}
    </main>
  );
}
```

### Step 4: 装路由 + commit

```bash
pytest backend/tests -v
cd frontend && pnpm test && pnpm build
git add backend/flights/service.py backend/flights/routes.py backend/tests/integration/test_hot_routes.py frontend/src/hooks/useHotRoutes.ts frontend/src/components/routes/ frontend/src/routes/HotRoutes.tsx frontend/src/App.tsx
git commit -m "$(printf 'feat(routes): /routes/hot endpoint + Hot Routes 排行榜页\n\n- FlightService.hot_routes: 按 callsign 聚合 policy 数, desc\n- /routes/hot?limit=N endpoint\n- useHotRoutes SWR\n- RouteRow: rank + callsign + delay_rate sparkline + policy_count\n- /routes 路由\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 9: Rialo Inside 滚动驱动技术揭秘动画页

**Files:**
- Create: `frontend/src/components/rialo/ReactiveDiagram.tsx`
- Create: `frontend/src/routes/RialoInside.tsx`
- Modify: `frontend/src/App.tsx` (装 /rialo-inside)

### Step 1: 实现 ReactiveDiagram (scroll-triggered 对比)

`frontend/src/components/rialo/ReactiveDiagram.tsx`:

```typescript
import { useEffect, useRef, useState } from "react";

const STAGES = [
  { left: "User", right: "User" },
  { left: "Frontend", right: "Frontend" },
  { left: "Oracle service", right: "—" },
  { left: "Keeper bot", right: "—" },
  { left: "Admin review", right: "—" },
  { left: "Contract", right: "Reactive Contract" },
];

export function ReactiveDiagram() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const start = window.innerHeight;
      const end = -ref.current.offsetHeight + window.innerHeight;
      const p = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
      setProgress(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visibleStages = Math.floor(progress * STAGES.length);

  return (
    <section ref={ref} style={{
      minHeight: "100vh", padding: "120px 24px",
      display: "grid", gridTemplateColumns: "1fr 1fr",
      gap: 48, maxWidth: 1280, margin: "0 auto",
    }}>
      <div>
        <h3 style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.22em", textTransform: "uppercase", fontSize: 12, marginBottom: 32 }}>TRADITIONAL</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {STAGES.map((s, i) => (
            <div key={i} style={{
              padding: "14px 18px",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-1)",
              fontFamily: "var(--font-mono)",
              opacity: i < visibleStages ? 1 : 0.2,
              transition: "opacity 0.3s ease-out",
            }}>{s.left}</div>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: "var(--font-mono)", color: "var(--accent-radar)", letterSpacing: "0.22em", textTransform: "uppercase", fontSize: 12, marginBottom: 32 }}>RIALO</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {STAGES.map((s, i) => (
            <div key={i} style={{
              padding: "14px 18px",
              border: `1px solid ${s.right === "—" ? "transparent" : "var(--border-emphasis)"}`,
              background: s.right === "—" ? "transparent" : "var(--surface-1)",
              color: s.right === "—" ? "var(--text-tertiary)" : "var(--accent-radar)",
              fontFamily: "var(--font-mono)",
              textAlign: s.right === "—" ? "center" : "left",
              opacity: i < visibleStages ? 1 : 0.2,
              transition: "opacity 0.3s ease-out",
            }}>{s.right}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Step 2: 实现 RialoInside 页

`frontend/src/routes/RialoInside.tsx`:

```typescript
import { ReactiveDiagram } from "../components/rialo/ReactiveDiagram";

export function RialoInside() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto" }}>
      <section style={{ padding: "120px 24px 80px", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", letterSpacing: "0.22em", textTransform: "uppercase", fontSize: 11 }}>RIALO INSIDE</div>
        <h1 style={{ marginTop: 18, fontSize: 64, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
          Six roles<br /><span style={{ color: "var(--accent-radar)" }}>collapse into one</span>.
        </h1>
        <p style={{ marginTop: 24, color: "var(--text-secondary)", maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
          Traditional onchain insurance needs an oracle service, a keeper bot, and a manual review pipeline.
          Rialo's reactive contracts read the real world directly and settle themselves.
        </p>
      </section>
      <ReactiveDiagram />
      <section style={{ padding: "80px 24px 160px", textAlign: "center" }}>
        <h2 style={{ fontSize: 40, marginBottom: 16, letterSpacing: "-0.02em" }}>
          That's why <span style={{ color: "var(--accent-radar)" }}>The Tower</span> can stay open.
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>Built on Rialo · open source · MIT</p>
      </section>
    </main>
  );
}
```

### Step 3: 装路由 + commit

```bash
cd frontend && pnpm test && pnpm build
git add frontend/src/components/rialo/ frontend/src/routes/RialoInside.tsx frontend/src/App.tsx
git commit -m "$(printf 'feat(rialo-inside): 滚动驱动 traditional vs Rialo 对比动画页\n\n- ReactiveDiagram: scroll progress 控制两栏 6 行逐个亮起\n- 左栏 (traditional): User/Frontend/Oracle/Keeper/Admin/Contract\n- 右栏 (Rialo): User/Frontend/—/—/—/Reactive Contract\n- 顶部 hero + 底部 closing\n- /rialo-inside 路由\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 10: Playwright E2E 大屏验收 + README + Plan 3 收尾

**Files:**
- Modify: `frontend/e2e/dashboard.spec.ts` (新增 dashboard E2E)
- Modify: `README.md` (Plan 3 状态 + Mapbox token 步骤)
- Create: `docs/screenshots/` (可选, demo gif/png 落地)

### Step 1: 写 E2E dashboard.spec.ts

`frontend/e2e/dashboard.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Dashboard smoke", () => {
  test("六个 nav tab 都可点击且不 console error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    // 没 Google token 走不通真登录, 直接 mock cookie
    // (本 demo 中可用 admin-route 注入 + httpOnly cookie 不可由 JS 设, 留给 user 手动验)
    // 仅验证未登录路由都能跳到 /login 且页面无 JS error.
    for (const path of ["/policies", "/claims", "/routes", "/rialo-inside"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
    expect(errors).toEqual([]);
  });
});
```

> **更深度的 E2E**（真登录 → Tower 看到地图 → 买险 → 注入 → flare 出现）需要后端 ADMIN_TOKEN 配置 + Mapbox token 可用 + 跨进程 cookie 注入。Plan 3 仅打底，留给 user 在本机手动跑：
>
> 1. `./scripts/dev.sh`
> 2. 浏览器登录
> 3. 点航班 → 买险
> 4. `curl /admin/inject-delay`
> 5. 等 30s 看到 toast + sidebar flare + 余额变化

### Step 2: 修 README

把 "## 项目状态" 改为：

```markdown
## 项目状态

- [x] **Plan 1 · Foundation**
- [x] **Plan 2 · Reactive Insurance Core**
- [x] **Plan 3 · Live Dashboard** ← 当前

Rialo-Captain MVP 完成. ReactiveContract Adapter 设计上保证: Rialo SDK 公开后,
只需实现 `RealRialoAdapter`, 业务代码 0 改动即可切换到真测试网.
```

在 Prerequisites 加 Mapbox token 步骤：

```markdown
### 申请 Mapbox token（免费）

1. 打开 [Mapbox account](https://account.mapbox.com/access-tokens/)
2. 注册 → 默认 default public token 就够用
3. 填到 `frontend/.env` 的 `VITE_MAPBOX_TOKEN=pk.xxx`
```

### Step 3: 跑全部测试 + final commit

```bash
pytest backend/tests -v
cd frontend && pnpm test && pnpm build && pnpm lint
cd frontend && pnpm exec playwright test
```

Expected: 全绿.

```bash
git add frontend/e2e/dashboard.spec.ts README.md
git commit -m "$(printf 'feat: Plan 3 收尾 - dashboard E2E smoke + Mapbox token 步骤\n\n- dashboard.spec.ts: 4 个受保护路由都跳 /login, 无 JS error\n- README 加 Mapbox token 申请步骤 (免费)\n- Plan 3 完成. Rialo-Captain MVP 完整 (Plan 1+2+3).\n  下一步: 等 Rialo SDK 公开实现 RealRialoAdapter, 切真测试网.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Plan 3 验收

完成 Task 1-10 后，下列断言全部为真：

1. `pytest backend/tests -v` → 全绿（66 + Plan 3 新增 ≥ 10 个测试 ≥ 76 passed）
2. `cd frontend && pnpm test` → 全绿（7 + Plan 3 新增 ≥ 8 个测试 ≥ 15 passed）
3. `cd frontend && pnpm build` → `dist/` 生成，无 error
4. `cd frontend && pnpm lint` → 0 problems
5. `cd frontend && pnpm exec playwright test` → 2 passed (foundation + dashboard)
6. `./scripts/dev.sh` 启动后浏览器手动验证：
   - 登录 → 看到 The Tower 全球地图 + ≥ 50 飞机光点 + 右上事件流面板 + 左上雷达扫描
   - 点光点 → BuyDrawer slideup → 选 10 RIA → Confirm → 余额 990
   - `curl POST /admin/inject-delay` → 等 30s
   - StatusBar LED 显示绿（WS open）
   - 收到 toast "+payout RIA settled" + 右上 sidebar 出现 FLARE 一条
   - 余额自动变成 990 + payout
   - 跳 /policies → 看到刚才那条 policy 已是 paid
   - 跳 /claims → 看到大字 session payout + 时间线行
   - 跳 /routes → 看到航线排行榜
   - 跳 /rialo-inside → 滚动看到对比动画

## 下一步 (Plan 3 完成后)

- **整个 Rialo-Captain MVP 完成** —— 三 plan 全部落地
- **Rialo SDK 公开后**：实现 `RealRialoAdapter`、配置 `RIALO_MODE=real` + RPC endpoint，业务代码 0 改动即可切真测试网
- **可选 polish**：录制 demo 视频、写技术 blog、Twitter 推文、放 GitHub topic 标签、加 Vercel + Fly.io 部署
