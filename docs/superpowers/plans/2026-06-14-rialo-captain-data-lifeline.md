# Rialo-Captain · Plan 4 · 数据生命线（FlightFetcher + Seed Demo）

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Steps use checkbox / `### Step` syntax.

**Goal:** 补 Plan 1-3 的一个"设计差"：现有架构有 `OpenSkyClient` 和 `FlightCache`，但**没人定时调它**。结果：cache 永远是空的、`flights` 表是空的、大屏看不到飞机、买险走不通。本 Plan 加一个 30s 周期的 `FlightFetcher` 后台任务，把 OpenSky 数据自动写入 cache + `flights` 表；再加一个 admin 一键 seed demo 数据端点，让 Claims Feed / Hot Routes / My Hangar 立刻有内容。

**Architecture:** 仿造 `ClaimEngine` 的 asyncio 后台循环模式新增 `FlightFetcher`，同样 `run_once` / `run_forever` / `stop()` 接口、同样 `FLIGHT_FETCHER_ENABLED` env 开关、同样 lifespan 启动 asyncio.Task。Seed Demo 用现有 `PolicyService` + `_DELAY_OVERRIDES` + `ClaimEngine.run_once()` 拼装。

**Tech Stack:** 无新依赖，全部复用现有栈。

**Reference:**
- Plan 1 已实现: `OpenSkyClient.fetch_all()`、`FlightCache.store/get`、`flights` 表 model
- Plan 2 模板: `ClaimEngine` 类（`backend/claims/engine.py`）
- Plan 2 admin: `_DELAY_OVERRIDES` 字典 + `clear_injected_delays`

---

## 文件结构（Plan 4 范围）

```
backend/
├── flights/
│   ├── fetcher.py                      ← NEW: FlightFetcher
│   └── routes.py                        (不变)
├── admin/
│   └── routes.py                        ← MODIFY: 加 POST /admin/seed-demo
├── app.py                               ← MODIFY: lifespan 启动 FlightFetcher
└── tests/
    ├── unit/test_flight_fetcher.py     ← NEW
    └── integration/
        ├── test_flights_routes.py       ← MODIFY: 验证 fetcher 集成
        └── test_seed_demo.py            ← NEW
```

---

## Task 1: FlightFetcher 后台 task

**Files:**
- Create: `backend/flights/fetcher.py`
- Create: `backend/tests/unit/test_flight_fetcher.py`

### Step 1: 写测试

`backend/tests/unit/test_flight_fetcher.py`:

```python
import time
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.flights.cache import FlightCache
from backend.flights.fetcher import FlightFetcher
from backend.flights.opensky import FlightState
from backend.db import get_session_factory
from backend.models import Flight


class FakeOpenSky:
    def __init__(self, states: list[FlightState]):
        self._states = list(states)
        self.calls = 0
    async def fetch_all(self) -> list[FlightState]:
        self.calls += 1
        return list(self._states)
    async def aclose(self) -> None:
        pass


def _state(callsign: str = "BA178", lat: float = 51.0, lon: float = 0.0) -> FlightState:
    return FlightState(
        icao24="abc", callsign=callsign, origin_country="UK",
        longitude=lon, latitude=lat, velocity=200.0, heading=90.0, on_ground=False,
    )


@pytest.mark.asyncio
async def test_run_once_stores_to_cache_and_upserts_flights(db_session: AsyncSession):
    cache = FlightCache(ttl_seconds=30)
    fake = FakeOpenSky([_state("BA178"), _state("DL101")])
    fetcher = FlightFetcher(
        opensky=fake, cache=cache, session_factory=get_session_factory(),
        today_id=lambda: "20260614",
    )
    summary = await fetcher.run_once()
    assert summary.fetched == 2
    assert summary.upserted == 2
    # cache 已填
    entry = cache.get()
    assert entry.stale is False
    assert len(entry.states) == 2
    # flights 表已写
    rows = (await db_session.execute(select(Flight))).scalars().all()
    callsigns = {r.callsign for r in rows}
    assert {"BA178", "DL101"}.issubset(callsigns)
    ids = {r.id for r in rows}
    assert {"BA178-20260614", "DL101-20260614"}.issubset(ids)


@pytest.mark.asyncio
async def test_run_once_idempotent_upsert(db_session: AsyncSession):
    cache = FlightCache(ttl_seconds=30)
    fake = FakeOpenSky([_state("BA178")])
    fetcher = FlightFetcher(
        opensky=fake, cache=cache, session_factory=get_session_factory(),
        today_id=lambda: "20260614",
    )
    await fetcher.run_once()
    await fetcher.run_once()
    rows = (await db_session.execute(select(Flight))).scalars().all()
    # 同一 (callsign, date) 只写一条
    assert len([r for r in rows if r.callsign == "BA178"]) == 1


@pytest.mark.asyncio
async def test_run_once_handles_opensky_failure(db_session: AsyncSession):
    class FlakyOpenSky:
        async def fetch_all(self):
            raise RuntimeError("upstream 503")
        async def aclose(self):
            pass
    cache = FlightCache(ttl_seconds=30)
    fetcher = FlightFetcher(
        opensky=FlakyOpenSky(), cache=cache, session_factory=get_session_factory(),
        today_id=lambda: "20260614",
    )
    summary = await fetcher.run_once()
    assert summary.fetched == 0
    assert summary.error is not None
    # cache 不应该被清空（已有数据保持; 这里初始就空, 仍空）
    assert cache.get().states == []


@pytest.mark.asyncio
async def test_skip_states_without_callsign(db_session: AsyncSession):
    cache = FlightCache(ttl_seconds=30)
    fake = FakeOpenSky([
        _state("BA178"),
        FlightState(icao24="x", callsign="", origin_country="", longitude=0, latitude=0,
                    velocity=None, heading=None, on_ground=False),
    ])
    fetcher = FlightFetcher(
        opensky=fake, cache=cache, session_factory=get_session_factory(),
        today_id=lambda: "20260614",
    )
    summary = await fetcher.run_once()
    assert summary.fetched == 1  # 空 callsign 跳过
    assert summary.upserted == 1
```

### Step 2: 跑看 fail

```bash
.venv/bin/pytest backend/tests/unit/test_flight_fetcher.py -v
```

Expected: ImportError.

### Step 3: 实现 fetcher.py

`backend/flights/fetcher.py`:

```python
import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.flights.cache import FlightCache
from backend.flights.opensky import FlightState, OpenSkyClient
from backend.models import Flight

logger = logging.getLogger(__name__)


@dataclass
class FetchSummary:
    fetched: int = 0
    upserted: int = 0
    error: str | None = None


def _today_yyyymmdd() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


class FlightFetcher:
    """定时从 OpenSky 拉数据, 写入 cache + upsert flights 表."""

    def __init__(
        self,
        *,
        opensky,  # 鸭子类型: 只需 fetch_all()
        cache: FlightCache,
        session_factory: async_sessionmaker,
        interval_seconds: int = 30,
        today_id: Callable[[], str] = _today_yyyymmdd,
    ) -> None:
        self._opensky = opensky
        self._cache = cache
        self._session_factory = session_factory
        self._interval = interval_seconds
        self._today_id = today_id
        self._stop_event = asyncio.Event()

    async def run_once(self) -> FetchSummary:
        summary = FetchSummary()
        try:
            states = await self._opensky.fetch_all()
        except Exception as exc:
            summary.error = str(exc)
            logger.exception("FlightFetcher: OpenSky fetch failed")
            return summary

        # 过滤掉无 callsign 的脏数据
        valid = [s for s in states if s.callsign]
        self._cache.store(valid)
        summary.fetched = len(valid)

        if not valid:
            return summary

        date_str = self._today_id()
        async with self._session_factory() as session:
            for s in valid:
                flight_id = f"{s.callsign}-{date_str}"
                existing = await session.get(Flight, flight_id)
                if existing is None:
                    flight = Flight(
                        id=flight_id,
                        callsign=s.callsign,
                        origin=s.origin_country[:8] if s.origin_country else "",
                        destination="",
                        last_state="{}",
                        last_seen=int(time.time()),
                    )
                    session.add(flight)
                else:
                    existing.last_seen = int(time.time())
                summary.upserted += 1
            await session.commit()

        return summary

    async def run_forever(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self.run_once()
            except Exception:
                logger.exception("FlightFetcher.run_once outer error")
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                continue

    def stop(self) -> None:
        self._stop_event.set()
```

### Step 4: 跑测试看通过 + commit

```bash
.venv/bin/pytest backend/tests/unit/test_flight_fetcher.py -v
.venv/bin/pytest backend/tests -v
```

Expected: 4 passed + 80 全测.

```bash
git add backend/flights/fetcher.py backend/tests/unit/test_flight_fetcher.py
git commit -m "$(printf 'feat(flights): FlightFetcher 后台 task - 定时拉 OpenSky + upsert flights\n\n- run_once: opensky.fetch_all() -> cache.store + 写入/更新 flights 表\n- run_forever: stop_event 控制的循环, 默认 30s 间隔\n- 过滤无 callsign 脏数据 + 错误时不清空 cache\n- 用 (callsign, today_date) 作为 flight_id 主键避免重复\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 2: lifespan 集成 + FLIGHT_FETCHER_ENABLED env

**Files:**
- Modify: `backend/app.py` (lifespan 启动 FlightFetcher.run_forever)
- Modify: `backend/tests/integration/test_flights_routes.py` (新加一个集成测试验证 fetcher 起作用)

### Step 1: 改 backend/app.py

在 lifespan 中，在 ClaimEngine 启动之前/之后启动 FlightFetcher。整合后：

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _opensky_singleton
    await init_db()
    _opensky_singleton = OpenSkyClient()
    broadcaster = Broadcaster()
    adapter = get_contract_adapter()
    engine = ClaimEngine(adapter=adapter, session_factory=get_session_factory(), broadcaster=broadcaster)
    fetcher = FlightFetcher(
        opensky=_opensky_singleton, cache=_flight_cache_singleton,
        session_factory=get_session_factory(),
    )

    app.state.flight_cache = _flight_cache_singleton
    app.state.opensky = _opensky_singleton
    app.state.broadcaster = broadcaster
    app.state.contract_adapter = adapter
    app.state.claim_engine = engine
    app.state.flight_fetcher = fetcher

    engine_task: asyncio.Task | None = None
    fetcher_task: asyncio.Task | None = None
    if os.environ.get("CLAIM_ENGINE_ENABLED", "true").lower() != "false":
        engine_task = asyncio.create_task(engine.run_forever())
    if os.environ.get("FLIGHT_FETCHER_ENABLED", "true").lower() != "false":
        fetcher_task = asyncio.create_task(fetcher.run_forever())

    try:
        yield
    finally:
        engine.stop()
        fetcher.stop()
        for t in (engine_task, fetcher_task):
            if t is not None:
                t.cancel()
                try:
                    await t
                except asyncio.CancelledError:
                    pass
        if _opensky_singleton is not None:
            await _opensky_singleton.aclose()
        if isinstance(adapter, MockRialoAdapter):
            await adapter.aclose()
```

在 create_app() 中也实例化 FlightFetcher 供 lifespan 之外的测试使用（fetcher 默认在测试中不启动，环境变量 FLIGHT_FETCHER_ENABLED=false 关闭）。

新增 import: `from backend.flights.fetcher import FlightFetcher`

### Step 2: 在 `.env.example` 加配置

```
# 后台任务开关 (dev 默认 true, 测试设 false)
CLAIM_ENGINE_ENABLED=true
FLIGHT_FETCHER_ENABLED=true
```

### Step 3: 跑全测 + commit

```bash
.venv/bin/pytest backend/tests -v
```

Expected: 80 全测仍绿（除非现有测试启动 lifespan 时被 fetcher 影响 — 集成测试 fixture 已显式设 `CLAIM_ENGINE_ENABLED=false`，同样要加 `FLIGHT_FETCHER_ENABLED=false` 防止 OpenSky 真网络请求污染测试）。**关键: 所有现有 integration 测试 fixture 都要 `monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")`**。受影响的测试文件：
- `backend/tests/integration/test_auth_routes.py`
- `backend/tests/integration/test_flights_routes.py`
- `backend/tests/integration/test_policies_routes.py`
- `backend/tests/integration/test_claims_routes.py`
- `backend/tests/integration/test_admin_routes.py`
- `backend/tests/integration/test_ws_routes.py`
- `backend/tests/integration/test_dev_login.py`
- `backend/tests/integration/test_hot_routes.py`
- `backend/tests/integration/test_reactive_e2e.py`

逐个加 `monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")` 到 fixture 顶部（仅修改环境变量行，其它代码不动）。

```bash
git add backend/app.py backend/tests/integration/.env.example
# 实际 add 列表会因测试文件修改增多, 由 Codex 自行整合
git commit -m "$(printf 'feat(app): lifespan 启动 FlightFetcher.run_forever + FLIGHT_FETCHER_ENABLED 开关\n\n- 与 ClaimEngine 并列在 asyncio.Task 中运行\n- FLIGHT_FETCHER_ENABLED=false 关闭 (测试 fixture 用)\n- 全部 integration 测试 fixture 加 FLIGHT_FETCHER_ENABLED=false 防真网络\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 3: Seed Demo Data admin endpoint

**Files:**
- Modify: `backend/admin/routes.py` (加 POST /admin/seed-demo)
- Create: `backend/tests/integration/test_seed_demo.py`

### Step 1: 写测试

`backend/tests/integration/test_seed_demo.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import create_app
from backend.db import Base, get_engine, get_session_factory
from backend.tests.factories import make_flight, make_user


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "seed.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("ADMIN_TOKEN", "secret-admin")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.setenv("DEV_LOGIN_ENABLED", "true")
    monkeypatch.setenv("RIALO_MODE", "mock")
    from backend.config import get_settings
    get_settings.cache_clear()
    import backend.db
    backend.db._engine = None
    backend.db._session_factory = None

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # seed: 1 user + 5 flights 让买险有目标
    async with get_session_factory()() as s:
        await make_user(s, email="captain@local.dev")
        for cs in ["BA178", "DL101", "UA200", "AF1380", "CX251"]:
            await make_flight(s, callsign=cs, date="20260614")
        await s.commit()

    from backend.admin.routes import clear_injected_delays
    clear_injected_delays()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        yield client, app

    await engine.dispose()


@pytest.mark.asyncio
async def test_seed_demo_requires_admin_token(app_client):
    client, _ = app_client
    res = await client.post("/admin/seed-demo", json={"user_email": "captain@local.dev"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_seed_demo_creates_policies_and_triggers_claims(app_client):
    client, app = app_client
    res = await client.post(
        "/admin/seed-demo",
        json={"user_email": "captain@local.dev"},
        headers={"X-Admin-Token": "secret-admin"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    # 至少创建几个 policy + 触发若干 claim
    assert body["policies_created"] >= 3
    assert body["claims_settled"] >= 1
```

### Step 2: 跑看 fail
```bash
.venv/bin/pytest backend/tests/integration/test_seed_demo.py -v
```
Expected: 404.

### Step 3: 实现 endpoint

修改 `backend/admin/routes.py`，加 schema + 端点（不删除已有 `/admin/inject-delay`）:

```python
class SeedDemoRequest(BaseModel):
    user_email: str = "captain@local.dev"


class SeedDemoResponse(BaseModel):
    user_email: str
    policies_created: int
    claims_settled: int


@router.post("/admin/seed-demo", response_model=SeedDemoResponse,
             dependencies=[Depends(admin_required)])
async def seed_demo(
    body: SeedDemoRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    request: Request,
) -> SeedDemoResponse:
    # 1. 找到目标 user
    from sqlalchemy import select
    from backend.models import User
    user = (await session.execute(
        select(User).where(User.email == body.user_email)
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user unknown")

    # 2. 拿前 5 个 flights (来自现有 DB; 通常是 FlightFetcher 已写入)
    from backend.models import Flight
    flights = (await session.execute(select(Flight).limit(5))).scalars().all()
    if len(flights) < 3:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="not enough flights in DB; wait for FlightFetcher or seed flights manually",
        )

    # 3. 给 user 一笔保底余额 (够买 5x10=50 RIA)
    if user.balance < 100:
        user.balance = 1000
        await session.flush()

    # 4. 创建 5 个 policy (每个 10 RIA), 然后给前 2 个注入延误 + 跑 ClaimEngine
    from backend.contracts.base import Condition, ConditionType
    from backend.policies.service import PolicyService
    policy_service = PolicyService(session)
    adapter = request.app.state.contract_adapter
    policies_created = 0
    policy_ids: list[str] = []
    for flight in flights[:5]:
        policy = await policy_service.create_policy(
            user=user, flight_id=flight.id, premium=10,
            condition=Condition(type=ConditionType.DELAY, threshold_min=30),
            delay_rate=0.1,
        )
        ref = await adapter.watch(policy_id=policy.id, flight_id=flight.id,
                                  condition=Condition(type=ConditionType.DELAY, threshold_min=30))
        await policy_service.attach_contract_ref(policy, ref.id)
        policy_ids.append(policy.id)
        policies_created += 1
    await session.commit()

    # 5. 注入前 2 个航班的延误
    for flight in flights[:2]:
        _DELAY_OVERRIDES[flight.id] = 45

    # 6. 触发 ClaimEngine 跑一轮
    engine = request.app.state.claim_engine
    summary = await engine.run_once()

    return SeedDemoResponse(
        user_email=body.user_email,
        policies_created=policies_created,
        claims_settled=summary.triggered,
    )
```

### Step 4: 跑测试 + commit

```bash
.venv/bin/pytest backend/tests/integration/test_seed_demo.py -v
.venv/bin/pytest backend/tests -v
```

Expected: 2 passed + 82 全测.

```bash
git add backend/admin/routes.py backend/tests/integration/test_seed_demo.py
git commit -m "$(printf 'feat(admin): POST /admin/seed-demo 一键填 demo 数据\n\n- 给指定用户创建 5 个 demo policy (前 5 个航班, 每个 10 RIA)\n- 注入前 2 个航班 45 min 延误\n- 触发 ClaimEngine.run_once 让赔付立即发生\n- 返回 policies_created + claims_settled summary\n- 用于 demo 现场快速填表, 让 Claims Feed / Hot Routes / Hangar 有视觉内容\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Plan 4 验收

完成后下列断言全部为真：

1. 启动 `./scripts/dev.sh` → 等 30 秒 → `curl /flights/live` 返回 ≥ 50 个真实在飞航班，`data_stale: false`
2. `curl POST /admin/seed-demo -H "X-Admin-Token: ..." -d '{"user_email":"captain@local.dev"}'` 返回 `{"policies_created":5, "claims_settled":≥2}`
3. 浏览器 Dev Login → Tower 大屏看到飞机光点（需 Mapbox token）+ My Hangar 看到 5 条 policy + Claims Feed 看到 2 条赔付 + 余额变化
4. 后端测试 ≥ 82 passed

## Plan 4 完成后的下一步

完整 demo 跑通后可考虑：
- 视觉 polish（光点动画、FLARE burst、grain noise 调灵）
- Vite chunk size 优化（Mapbox/deck.gl lazy chunk）
- 部署（Fly.io 后端 + Vercel 前端 + 域名）
- Rialo 社区曝光（Twitter / Discord）
