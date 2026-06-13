# Rialo-Captain Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Rialo-Captain 的可运行骨架：用户能用 Google 登录、看到真实的 OpenSky 在飞航班数据接入、前端 shell 渲染受设计系统约束的路由壳。此 Plan 完成后项目可启动，但还没有保险业务（Plan 2）和完整大屏 UI（Plan 3）。

**Architecture:** FastAPI + SQLAlchemy 2.x async + SQLite 后端；Vite + React 18 + TS + Mapbox 占位前端。所有业务代码只依赖接口，不依赖具体实现（为 Plan 2 的 ReactiveContractAdapter 让路）。TDD 严格执行，每个 task 完成即 commit。

**Tech Stack:** Python 3.11 · FastAPI · SQLAlchemy 2.x (async) · aiosqlite · httpx · pytest + pytest-asyncio + vcrpy · pydantic-settings · PyJWT · google-auth · Vite · React 18 · TypeScript · React Router 6 · @react-oauth/google · Vitest · ESLint。

**Reference docs:**
- 完整设计：`docs/superpowers/specs/2026-06-13-rialo-captain-design.md`
- OpenSpec proposal：`openspec/changes/rialo-captain-mvp/`

---

## 文件结构（Plan 1 范围）

```
rialo-captain/
├── pyproject.toml                                 (新) Python 项目元数据 + 依赖
├── .env.example                                   (新) 环境变量模板
├── .python-version                                (新) 锁定 3.11
├── README.md                                      (新) 中英双语启动指南
├── scripts/
│   └── dev.sh                                     (新) 一键启动前后端
├── backend/
│   ├── __init__.py
│   ├── app.py                                     FastAPI app + lifespan + CORS
│   ├── config.py                                  pydantic-settings Settings
│   ├── db.py                                      AsyncEngine + AsyncSession + Base
│   ├── models.py                                  ORM: User / Flight / Policy / Claim / FailedTrigger
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── google.py                              Google ID token 校验
│   │   ├── jwt.py                                 JWT encode / decode
│   │   ├── service.py                             UserService
│   │   ├── deps.py                                get_current_user dependency
│   │   └── routes.py                              POST /auth/google, GET /me, POST /auth/logout
│   ├── flights/
│   │   ├── __init__.py
│   │   ├── opensky.py                             OpenSky httpx client + retry
│   │   ├── cache.py                               in-memory 30s cache + stale 标记
│   │   ├── service.py                             FlightService + 历史延误率
│   │   └── routes.py                              GET /flights/live, GET /flights/:id
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py                            DB / client / current_user fixtures
│       ├── factories.py                           user / flight 工厂
│       ├── cassettes/                             vcrpy 录制
│       ├── unit/
│       │   ├── test_jwt.py
│       │   ├── test_google_verify.py
│       │   ├── test_user_service.py
│       │   ├── test_opensky_client.py
│       │   ├── test_flight_cache.py
│       │   └── test_flight_service.py
│       └── integration/
│           ├── test_auth_routes.py
│           └── test_flights_routes.py
├── frontend/
│   ├── package.json                               (新) 依赖与脚本
│   ├── pnpm-lock.yaml                             pnpm 自动生成
│   ├── vite.config.ts                             (新) 代理 /api、/ws → 8000
│   ├── tsconfig.json                              (新) TS 严格模式
│   ├── tsconfig.node.json                         (新) Vite 配置专用
│   ├── index.html                                 (新) 极简 shell
│   ├── .eslintrc.cjs                              (新) 禁字体规则
│   ├── vitest.config.ts                           (新)
│   ├── src/
│   │   ├── main.tsx                               入口 + Google OAuth provider
│   │   ├── App.tsx                                React Router 装配
│   │   ├── design/
│   │   │   ├── tokens.css                         全量 design tokens
│   │   │   └── motion.ts                          easing / duration 常量
│   │   ├── api/
│   │   │   └── client.ts                          fetch wrapper（带 credentials）
│   │   ├── hooks/
│   │   │   └── useMe.ts                           SWR /me
│   │   ├── auth/
│   │   │   ├── GoogleSignIn.tsx                   按钮
│   │   │   └── ProtectedRoute.tsx                 路由守卫
│   │   └── routes/
│   │       ├── Login.tsx                          登录页
│   │       └── TowerShell.tsx                     Tower 占位（Plan 3 实现完整）
│   └── e2e/
│       └── foundation.spec.ts                     Playwright: 登录→看到 Tower 占位
└── docs/
    └── superpowers/
        └── plans/
            └── 2026-06-13-rialo-captain-foundation.md  ← 本文件
```

**未在 Plan 1 范围（留给 Plan 2/3）**：
- `backend/contracts/` ReactiveContractAdapter（Plan 2）
- `backend/policies/`、`backend/claims/`（Plan 2）
- `backend/ws/`（Plan 3）
- 完整前端 6 页（Plan 3，本 Plan 仅占位 Login + TowerShell）
- Mapbox 地图渲染（Plan 3）

---

## Task 1: 项目骨架（FastAPI app + 配置 + /health）

**Files:**
- Create: `pyproject.toml`
- Create: `.python-version`
- Create: `.env.example`
- Create: `backend/__init__.py`
- Create: `backend/app.py`
- Create: `backend/config.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/integration/__init__.py`
- Create: `backend/tests/integration/test_health.py`
- Delete: `main.py` (原占位)

### Step 1: 写 `backend/tests/integration/test_health.py`（失败测试）

- [ ] **Step 1: 创建 conftest 与 health 测试**

`backend/tests/integration/test_health.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import create_app


@pytest.mark.asyncio
async def test_health_returns_ok():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "rialo-captain"}
```

`backend/tests/conftest.py`（先建空文件，后续 task 填充）:

```python
"""共享 fixtures - Task 2 开始填充"""
```

`backend/tests/__init__.py`、`backend/tests/integration/__init__.py`、`backend/__init__.py` 均为空文件。

- [ ] **Step 2: 创建 pyproject.toml**

`pyproject.toml`:

```toml
[project]
name = "rialo-captain"
version = "0.1.0"
description = "Reactive insurance for the real sky · Built for Rialo"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "pydantic-settings>=2.6",
    "sqlalchemy[asyncio]>=2.0",
    "aiosqlite>=0.20",
    "httpx>=0.27",
    "pyjwt>=2.9",
    "google-auth>=2.35",
    "python-multipart>=0.0.12",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "vcrpy>=6.0",
    "ruff>=0.7",
    "pytest-cov>=5.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["backend/tests"]
pythonpath = ["."]

[tool.ruff]
line-length = 100
target-version = "py311"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["backend"]
```

`.python-version`:

```
3.11
```

`.env.example`:

```
# Rialo-Captain backend
DATABASE_URL=sqlite+aiosqlite:///./rialo.db
JWT_SECRET=change-me-in-prod-32-chars-min
JWT_COOKIE_NAME=rialo_session
JWT_TTL_HOURS=720
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
RIALO_MODE=mock
ADMIN_TOKEN=local-dev-admin-token
OPENSKY_BASE_URL=https://opensky-network.org/api
LOG_LEVEL=INFO
```

- [ ] **Step 3: 跑测试看失败**

```bash
pip install -e ".[dev]"
pytest backend/tests/integration/test_health.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.app'` 或 `ImportError: cannot import name 'create_app'`

- [ ] **Step 4: 实现 config + app，让测试通过**

`backend/config.py`:

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./rialo.db"
    jwt_secret: str = "change-me-in-prod-32-chars-min"
    jwt_cookie_name: str = "rialo_session"
    jwt_ttl_hours: int = 720
    google_client_id: str = ""
    rialo_mode: str = "mock"
    admin_token: str = "local-dev-admin-token"
    opensky_base_url: str = "https://opensky-network.org/api"
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

`backend/app.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(title="rialo-captain", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "rialo-captain"}

    return app


app = create_app()
```

- [ ] **Step 5: 跑测试看通过**

```bash
pytest backend/tests/integration/test_health.py -v
```

Expected: `PASSED`

- [ ] **Step 6: 删除占位 main.py 并 commit**

```bash
git rm main.py
git add pyproject.toml .python-version .env.example backend/ -- ':!backend/auth' ':!backend/flights'
git commit -m "feat(backend): 初始化 FastAPI app 骨架与 /health

- pyproject.toml + 依赖锁定 (FastAPI / SQLAlchemy async / httpx / PyJWT / google-auth)
- Settings 通过 pydantic-settings 加载
- create_app() factory + /health 端点
- pytest-asyncio auto mode, 集成测试就位
- 删除 PyCharm 占位 main.py

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: 数据模型 + AsyncEngine + 测试基础设施

**Files:**
- Create: `backend/db.py`
- Create: `backend/models.py`
- Create: `backend/tests/factories.py`
- Modify: `backend/tests/conftest.py`
- Create: `backend/tests/unit/__init__.py`
- Create: `backend/tests/unit/test_models.py`

### Tests first

- [ ] **Step 1: 写 model 单元测试**

`backend/tests/unit/test_models.py`:

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import User, Flight, Policy, Claim, FailedTrigger, PolicyStatus
from backend.tests.factories import make_user, make_flight


@pytest.mark.asyncio
async def test_user_default_balance_is_1000(db_session: AsyncSession):
    user = await make_user(db_session, email="alice@example.com")
    assert user.balance == 1000
    assert user.google_sub.startswith("sub-")


@pytest.mark.asyncio
async def test_flight_id_format(db_session: AsyncSession):
    flight = await make_flight(db_session, callsign="BA178", date="20260613")
    assert flight.id == "BA178-20260613"
    assert flight.origin == "LHR"


@pytest.mark.asyncio
async def test_policy_links_user_and_flight(db_session: AsyncSession):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    policy = Policy(
        id="pol-1",
        user_id=user.id,
        flight_id=flight.id,
        premium=10,
        payout=40,
        condition_json='{"type":"delay","threshold_min":30}',
        status=PolicyStatus.ACTIVE,
    )
    db_session.add(policy)
    await db_session.flush()
    assert policy.created_at is not None


@pytest.mark.asyncio
async def test_claim_signature_required(db_session: AsyncSession):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    policy = Policy(
        id="pol-2", user_id=user.id, flight_id=flight.id,
        premium=5, payout=20, condition_json="{}", status=PolicyStatus.ACTIVE,
    )
    db_session.add(policy)
    await db_session.flush()
    claim = Claim(
        id="clm-1", policy_id=policy.id, payout=20,
        delay_minutes=45, signature="0x" + "a" * 64, settle_duration_ms=1400,
    )
    db_session.add(claim)
    await db_session.flush()
    assert claim.settled_at is not None
```

- [ ] **Step 2: 跑测试看失败**

```bash
pytest backend/tests/unit/test_models.py -v
```

Expected: FAIL with `ImportError` (models 不存在) 和 `fixture 'db_session' not found`

### Implementation

- [ ] **Step 3: 实现 db.py + models.py**

`backend/db.py`:

```python
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import get_settings


class Base(DeclarativeBase):
    pass


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(get_settings().database_url, echo=False)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def init_db() -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    async with factory() as session:
        yield session
```

`backend/models.py`:

```python
import enum
import time
import uuid

from sqlalchemy import ForeignKey, String, Integer, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db import Base


def _now() -> int:
    return int(time.time())


def _uuid() -> str:
    return uuid.uuid4().hex[:16]


class PolicyStatus(str, enum.Enum):
    ACTIVE = "active"
    PAID = "paid"
    EXPIRED = "expired"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    google_sub: Mapped[str] = mapped_column(String(64), unique=True)
    email: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    balance: Mapped[int] = mapped_column(Integer, default=1000)
    created_at: Mapped[int] = mapped_column(Integer, default=_now)


class Flight(Base):
    __tablename__ = "flights"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)  # callsign-YYYYMMDD
    callsign: Mapped[str] = mapped_column(String(16))
    origin: Mapped[str] = mapped_column(String(8), default="")
    destination: Mapped[str] = mapped_column(String(8), default="")
    scheduled_dep: Mapped[int] = mapped_column(Integer, default=0)
    scheduled_arr: Mapped[int] = mapped_column(Integer, default=0)
    last_state: Mapped[str] = mapped_column(Text, default="{}")
    last_seen: Mapped[int] = mapped_column(Integer, default=_now)


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    flight_id: Mapped[str] = mapped_column(ForeignKey("flights.id"))
    premium: Mapped[int] = mapped_column(Integer)
    payout: Mapped[int] = mapped_column(Integer)
    condition_json: Mapped[str] = mapped_column(Text)
    status: Mapped[PolicyStatus] = mapped_column(Enum(PolicyStatus), default=PolicyStatus.ACTIVE)
    contract_ref: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[int] = mapped_column(Integer, default=_now)


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id"))
    payout: Mapped[int] = mapped_column(Integer)
    delay_minutes: Mapped[int] = mapped_column(Integer)
    signature: Mapped[str] = mapped_column(String(72))  # 0x + 64 hex + buffer
    settled_at: Mapped[int] = mapped_column(Integer, default=_now)
    settle_duration_ms: Mapped[int] = mapped_column(Integer, default=0)


class FailedTrigger(Base):
    __tablename__ = "failed_triggers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id"))
    error_text: Mapped[str] = mapped_column(Text)
    occurred_at: Mapped[int] = mapped_column(Integer, default=_now)
```

- [ ] **Step 4: 实现 conftest 与 factories**

`backend/tests/conftest.py`:

```python
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from backend.db import Base


@pytest_asyncio.fixture
async def db_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine: AsyncEngine) -> AsyncSession:
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session
```

`backend/tests/factories.py`:

```python
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Flight, User


async def make_user(session: AsyncSession, *, email: str = "user@example.com",
                    name: str = "Test User", balance: int = 1000) -> User:
    user = User(
        google_sub=f"sub-{uuid.uuid4().hex[:8]}",
        email=email,
        name=name,
        balance=balance,
    )
    session.add(user)
    await session.flush()
    return user


async def make_flight(session: AsyncSession, *, callsign: str = "BA178",
                      date: str = "20260613", origin: str = "LHR",
                      destination: str = "JFK") -> Flight:
    flight = Flight(
        id=f"{callsign}-{date}",
        callsign=callsign,
        origin=origin,
        destination=destination,
    )
    session.add(flight)
    await session.flush()
    return flight
```

- [ ] **Step 5: 跑测试看通过**

```bash
pytest backend/tests/unit/test_models.py -v
```

Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add backend/db.py backend/models.py backend/tests/
git commit -m "feat(backend): 数据模型 + AsyncEngine + pytest 基础设施

- SQLAlchemy 2.x 声明式 Base
- User / Flight / Policy / Claim / FailedTrigger 五个 ORM 模型
- in-memory SQLite db_session fixture (integration 真 DB, 禁 mock)
- factories: make_user / make_flight
- PolicyStatus enum: active/paid/expired

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: JWT + Google ID token 校验工具

**Files:**
- Create: `backend/auth/__init__.py`
- Create: `backend/auth/jwt.py`
- Create: `backend/auth/google.py`
- Create: `backend/tests/unit/test_jwt.py`
- Create: `backend/tests/unit/test_google_verify.py`

### JWT first

- [ ] **Step 1: 写 JWT 单元测试**

`backend/tests/unit/test_jwt.py`:

```python
import time

import pytest

from backend.auth.jwt import encode_session, decode_session, JWTError


def test_encode_decode_roundtrip():
    token = encode_session(user_id="u123", ttl_hours=1)
    payload = decode_session(token)
    assert payload["sub"] == "u123"
    assert payload["exp"] > int(time.time())


def test_decode_rejects_garbage():
    with pytest.raises(JWTError):
        decode_session("not-a-token")


def test_decode_rejects_expired_token():
    token = encode_session(user_id="u123", ttl_hours=-1)
    with pytest.raises(JWTError):
        decode_session(token)
```

- [ ] **Step 2: 跑测试看失败**

```bash
pytest backend/tests/unit/test_jwt.py -v
```

Expected: FAIL with ImportError.

- [ ] **Step 3: 实现 jwt.py**

`backend/auth/__init__.py` 留空。

`backend/auth/jwt.py`:

```python
import time

import jwt as pyjwt

from backend.config import get_settings


class JWTError(Exception):
    pass


def encode_session(*, user_id: str, ttl_hours: int | None = None) -> str:
    settings = get_settings()
    hours = ttl_hours if ttl_hours is not None else settings.jwt_ttl_hours
    payload = {
        "sub": user_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + hours * 3600,
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_session(token: str) -> dict:
    settings = get_settings()
    try:
        return pyjwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except pyjwt.PyJWTError as exc:
        raise JWTError(str(exc)) from exc
```

- [ ] **Step 4: 跑测试看通过**

```bash
pytest backend/tests/unit/test_jwt.py -v
```

Expected: 3 passed

### Google verify

- [ ] **Step 5: 写 Google verify 测试（用 monkeypatch 替换底层调用）**

`backend/tests/unit/test_google_verify.py`:

```python
import pytest

from backend.auth import google


@pytest.fixture
def fake_google_payload(monkeypatch):
    def _fake(id_token: str, request, audience: str):
        if id_token == "valid":
            return {
                "sub": "google-sub-123",
                "email": "alice@example.com",
                "name": "Alice",
                "picture": "https://lh3.googleusercontent.com/a/x",
            }
        raise ValueError("Invalid token")

    monkeypatch.setattr(google.id_token, "verify_oauth2_token", _fake)


def test_verify_returns_profile_for_valid_token(fake_google_payload):
    profile = google.verify_id_token("valid")
    assert profile.sub == "google-sub-123"
    assert profile.email == "alice@example.com"
    assert profile.name == "Alice"
    assert profile.avatar_url.startswith("https://")


def test_verify_returns_none_for_invalid_token(fake_google_payload):
    assert google.verify_id_token("garbage") is None
```

- [ ] **Step 6: 跑测试看失败**

```bash
pytest backend/tests/unit/test_google_verify.py -v
```

Expected: FAIL with ImportError.

- [ ] **Step 7: 实现 google.py**

`backend/auth/google.py`:

```python
from dataclasses import dataclass

from google.auth.transport import requests as g_requests
from google.oauth2 import id_token

from backend.config import get_settings


@dataclass(frozen=True)
class GoogleProfile:
    sub: str
    email: str
    name: str
    avatar_url: str


_request = g_requests.Request()


def verify_id_token(token: str) -> GoogleProfile | None:
    settings = get_settings()
    try:
        payload = id_token.verify_oauth2_token(token, _request, settings.google_client_id)
    except ValueError:
        return None
    return GoogleProfile(
        sub=payload["sub"],
        email=payload.get("email", ""),
        name=payload.get("name", ""),
        avatar_url=payload.get("picture", ""),
    )
```

- [ ] **Step 8: 跑测试看通过 + commit**

```bash
pytest backend/tests/unit/test_jwt.py backend/tests/unit/test_google_verify.py -v
```

Expected: 5 passed.

```bash
git add backend/auth/__init__.py backend/auth/jwt.py backend/auth/google.py backend/tests/unit/test_jwt.py backend/tests/unit/test_google_verify.py
git commit -m "feat(auth): JWT 编解码 + Google ID token 校验

- encode_session / decode_session 基于 PyJWT HS256, ttl 可配置
- verify_id_token 返回 GoogleProfile dataclass, 失败返回 None
- 失败用 JWTError 统一抛, 不静默
- 测试用 monkeypatch 替换 google.oauth2.id_token 避免真网络

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: UserService（创建/获取 + 余额变动）

**Files:**
- Create: `backend/auth/service.py`
- Create: `backend/tests/unit/test_user_service.py`

### Tests first

- [ ] **Step 1: 写 UserService 测试**

`backend/tests/unit/test_user_service.py`:

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.google import GoogleProfile
from backend.auth.service import UserService, InsufficientBalanceError


@pytest.mark.asyncio
async def test_create_user_on_first_login(db_session: AsyncSession):
    service = UserService(db_session)
    profile = GoogleProfile(sub="sub-001", email="a@x.com", name="A", avatar_url="https://a")
    user = await service.create_or_get(profile)
    assert user.balance == 1000
    assert user.google_sub == "sub-001"


@pytest.mark.asyncio
async def test_returning_user_keeps_balance(db_session: AsyncSession):
    service = UserService(db_session)
    profile = GoogleProfile(sub="sub-002", email="b@x.com", name="B", avatar_url="")
    first = await service.create_or_get(profile)
    first.balance = 250
    await db_session.flush()
    second = await service.create_or_get(profile)
    assert second.id == first.id
    assert second.balance == 250


@pytest.mark.asyncio
async def test_debit_decreases_balance(db_session: AsyncSession):
    service = UserService(db_session)
    user = await service.create_or_get(
        GoogleProfile(sub="sub-003", email="c@x.com", name="C", avatar_url="")
    )
    await service.debit(user, 30)
    assert user.balance == 970


@pytest.mark.asyncio
async def test_debit_rejects_insufficient_balance(db_session: AsyncSession):
    service = UserService(db_session)
    user = await service.create_or_get(
        GoogleProfile(sub="sub-004", email="d@x.com", name="D", avatar_url="")
    )
    user.balance = 5
    with pytest.raises(InsufficientBalanceError):
        await service.debit(user, 10)
    assert user.balance == 5


@pytest.mark.asyncio
async def test_credit_increases_balance(db_session: AsyncSession):
    service = UserService(db_session)
    user = await service.create_or_get(
        GoogleProfile(sub="sub-005", email="e@x.com", name="E", avatar_url="")
    )
    await service.credit(user, 50)
    assert user.balance == 1050
```

- [ ] **Step 2: 跑测试看失败**

```bash
pytest backend/tests/unit/test_user_service.py -v
```

Expected: ImportError.

- [ ] **Step 3: 实现 UserService**

`backend/auth/service.py`:

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.google import GoogleProfile
from backend.models import User


class InsufficientBalanceError(Exception):
    pass


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_or_get(self, profile: GoogleProfile) -> User:
        stmt = select(User).where(User.google_sub == profile.sub)
        existing = (await self._session.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            existing.email = profile.email
            existing.name = profile.name
            if profile.avatar_url:
                existing.avatar_url = profile.avatar_url
            await self._session.flush()
            return existing
        user = User(
            google_sub=profile.sub,
            email=profile.email,
            name=profile.name,
            avatar_url=profile.avatar_url,
        )
        self._session.add(user)
        await self._session.flush()
        return user

    async def get_by_id(self, user_id: str) -> User | None:
        stmt = select(User).where(User.id == user_id)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def debit(self, user: User, amount: int) -> None:
        if user.balance < amount:
            raise InsufficientBalanceError(f"need {amount}, have {user.balance}")
        user.balance -= amount
        await self._session.flush()

    async def credit(self, user: User, amount: int) -> None:
        user.balance += amount
        await self._session.flush()
```

- [ ] **Step 4: 跑测试看通过**

```bash
pytest backend/tests/unit/test_user_service.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/auth/service.py backend/tests/unit/test_user_service.py
git commit -m "feat(auth): UserService - 创建/获取/余额变动

- create_or_get: 首次登录初始化 balance=1000, 复登保留余额
- debit / credit 改 user.balance (内存 + flush)
- 余额不足显式抛 InsufficientBalanceError, 不静默

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Auth routes + dependency（/auth/google + /me + cookie 鉴权）

**Files:**
- Create: `backend/auth/deps.py`
- Create: `backend/auth/routes.py`
- Modify: `backend/app.py` (装载 router + DB lifespan)
- Create: `backend/tests/integration/test_auth_routes.py`

### Tests first

- [ ] **Step 1: 写 auth routes 集成测试**

`backend/tests/integration/test_auth_routes.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.app import create_app
from backend.db import get_engine, Base


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    # 用临时 SQLite 文件，避免 in-memory 多连接问题
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake-client-id.apps.googleusercontent.com")
    # 清理 settings cache
    from backend.config import get_settings
    get_settings.cache_clear()
    # 清理 engine
    import backend.db
    backend.db._engine = None
    backend.db._session_factory = None

    def fake_verify(token: str) -> GoogleProfile | None:
        if token == "valid-google-token":
            return GoogleProfile(sub="g-1", email="x@y.com", name="X", avatar_url="https://a")
        return None

    monkeypatch.setattr(google, "verify_id_token", fake_verify)

    app = create_app()
    # 手动初始化 schema
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_google_auth_creates_user_and_sets_cookie(app_client: AsyncClient):
    res = await app_client.post("/auth/google", json={"id_token": "valid-google-token"})
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "x@y.com"
    assert body["balance"] == 1000
    assert "rialo_session" in res.cookies


@pytest.mark.asyncio
async def test_invalid_google_token_returns_401(app_client: AsyncClient):
    res = await app_client.post("/auth/google", json={"id_token": "bad"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_current_user(app_client: AsyncClient):
    await app_client.post("/auth/google", json={"id_token": "valid-google-token"})
    res = await app_client.get("/me")
    assert res.status_code == 200
    assert res.json()["email"] == "x@y.com"


@pytest.mark.asyncio
async def test_me_without_cookie_returns_401(app_client: AsyncClient):
    res = await app_client.get("/me")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_logout_clears_cookie(app_client: AsyncClient):
    await app_client.post("/auth/google", json={"id_token": "valid-google-token"})
    res = await app_client.post("/auth/logout")
    assert res.status_code == 204
    me_after = await app_client.get("/me")
    assert me_after.status_code == 401
```

- [ ] **Step 2: 跑测试看失败**

```bash
pytest backend/tests/integration/test_auth_routes.py -v
```

Expected: ImportError on `backend.auth.routes`.

### Implementation

- [ ] **Step 3: 实现 deps.py**

`backend/auth/deps.py`:

```python
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt import JWTError, decode_session
from backend.auth.service import UserService
from backend.config import get_settings
from backend.db import get_session
from backend.models import User


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_session)],
    rialo_session: Annotated[str | None, Cookie()] = None,
) -> User:
    settings = get_settings()
    if rialo_session is None or settings.jwt_cookie_name != "rialo_session":
        # cookie 名称如非默认, 让 FastAPI 找不到时也按 401 处理
        pass
    if not rialo_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    try:
        payload = decode_session(rialo_session)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid session")
    user = await UserService(session).get_by_id(payload["sub"])
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user gone")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
```

- [ ] **Step 4: 实现 routes.py**

`backend/auth/routes.py`:

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import google
from backend.auth.deps import CurrentUser
from backend.auth.jwt import encode_session
from backend.auth.service import UserService
from backend.config import get_settings
from backend.db import get_session

router = APIRouter()


class GoogleAuthRequest(BaseModel):
    id_token: str


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str
    balance: int


@router.post("/auth/google", response_model=UserPublic)
async def auth_google(
    body: GoogleAuthRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserPublic:
    profile = google.verify_id_token(body.id_token)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid Google token")
    user = await UserService(session).create_or_get(profile)
    await session.commit()
    settings = get_settings()
    token = encode_session(user_id=user.id)
    response.set_cookie(
        settings.jwt_cookie_name, token,
        httponly=True, samesite="lax",
        max_age=settings.jwt_ttl_hours * 3600,
    )
    return UserPublic(
        id=user.id, email=user.email, name=user.name,
        avatar_url=user.avatar_url, balance=user.balance,
    )


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUser) -> UserPublic:
    return UserPublic(
        id=user.id, email=user.email, name=user.name,
        avatar_url=user.avatar_url, balance=user.balance,
    )


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(get_settings().jwt_cookie_name)
```

- [ ] **Step 5: 把 router 装上 + DB lifespan**

修改 `backend/app.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.auth.routes import router as auth_router
from backend.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="rialo-captain", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "rialo-captain"}

    app.include_router(auth_router)
    return app


app = create_app()
```

- [ ] **Step 6: 跑全部测试**

```bash
pytest backend/tests -v
```

Expected: 全绿（health + models + jwt + google_verify + user_service + auth_routes 全过）。

- [ ] **Step 7: Commit**

```bash
git add backend/auth/ backend/app.py backend/tests/integration/test_auth_routes.py
git commit -m "feat(auth): /auth/google + /me + /auth/logout + cookie 鉴权

- POST /auth/google: 校验 Google ID token, create_or_get user, set HttpOnly cookie
- GET /me: CurrentUser dependency, 未登录返回 401
- POST /auth/logout: clear cookie
- create_app() 装载 lifespan 自动 init_db

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: OpenSky client + cache + degraded mode

**Files:**
- Create: `backend/flights/__init__.py`
- Create: `backend/flights/opensky.py`
- Create: `backend/flights/cache.py`
- Create: `backend/tests/unit/test_opensky_client.py`
- Create: `backend/tests/unit/test_flight_cache.py`
- Create: `backend/tests/cassettes/.gitkeep`

### OpenSky client first

- [ ] **Step 1: 写 OpenSky client 测试**

`backend/tests/unit/test_opensky_client.py`:

```python
import pytest
import httpx

from backend.flights.opensky import OpenSkyClient, OpenSkyError, FlightState


@pytest.mark.asyncio
async def test_fetch_all_returns_flight_states():
    fake_payload = {
        "time": 1718000000,
        "states": [
            # OpenSky 真实字段顺序: icao24, callsign, origin_country, ...
            ["a1b2c3", "BA178   ", "United Kingdom", None, None, -0.45, 51.47, 11000, False,
             240.0, 280.0, 0.0, None, 11500, "5471", False, 0],
            ["d4e5f6", "DL101   ", "United States", None, None, -73.78, 40.64, 10000, False,
             230.0, 90.0, 0.0, None, 10500, "5472", False, 0],
        ],
    }

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=fake_payload)

    transport = httpx.MockTransport(handler)
    client = OpenSkyClient(base_url="https://opensky.test", transport=transport)
    try:
        states = await client.fetch_all()
    finally:
        await client.aclose()
    assert len(states) == 2
    assert states[0].callsign == "BA178"
    assert states[0].origin_country == "United Kingdom"
    assert isinstance(states[0], FlightState)


@pytest.mark.asyncio
async def test_5xx_raises_opensky_error_after_retries():
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503)

    transport = httpx.MockTransport(handler)
    client = OpenSkyClient(base_url="https://opensky.test", transport=transport,
                           max_attempts=3, base_backoff=0.0)
    try:
        with pytest.raises(OpenSkyError):
            await client.fetch_all()
    finally:
        await client.aclose()
    assert calls == 3
```

- [ ] **Step 2: 跑测试看失败**

```bash
pytest backend/tests/unit/test_opensky_client.py -v
```

Expected: ImportError.

- [ ] **Step 3: 实现 OpenSkyClient**

`backend/flights/__init__.py` 留空。

`backend/flights/opensky.py`:

```python
import asyncio
from dataclasses import dataclass

import httpx

from backend.config import get_settings


class OpenSkyError(Exception):
    pass


@dataclass(frozen=True)
class FlightState:
    icao24: str
    callsign: str
    origin_country: str
    longitude: float | None
    latitude: float | None
    velocity: float | None
    heading: float | None
    on_ground: bool


def _parse_state(row: list) -> FlightState | None:
    # OpenSky /states/all 列顺序见 https://openskynetwork.github.io/opensky-api/rest.html
    try:
        return FlightState(
            icao24=row[0] or "",
            callsign=(row[1] or "").strip(),
            origin_country=row[2] or "",
            longitude=row[5],
            latitude=row[6],
            velocity=row[9],
            heading=row[10],
            on_ground=bool(row[8]),
        )
    except (IndexError, TypeError):
        return None


class OpenSkyClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        max_attempts: int = 3,
        base_backoff: float = 1.0,
    ) -> None:
        self._base = (base_url or get_settings().opensky_base_url).rstrip("/")
        self._client = httpx.AsyncClient(transport=transport, timeout=10.0)
        self._max_attempts = max_attempts
        self._base_backoff = base_backoff

    async def aclose(self) -> None:
        await self._client.aclose()

    async def fetch_all(self) -> list[FlightState]:
        last_error: Exception | None = None
        for attempt in range(self._max_attempts):
            try:
                resp = await self._client.get(f"{self._base}/states/all")
                if resp.status_code >= 500:
                    raise OpenSkyError(f"upstream {resp.status_code}")
                resp.raise_for_status()
                data = resp.json()
                raw = data.get("states") or []
                states = [s for row in raw if (s := _parse_state(row)) and s.callsign]
                return states
            except (OpenSkyError, httpx.HTTPError) as exc:
                last_error = exc
                if attempt < self._max_attempts - 1:
                    await asyncio.sleep(self._base_backoff * (2 ** attempt))
        raise OpenSkyError(f"OpenSky failed after {self._max_attempts} attempts: {last_error}")
```

- [ ] **Step 4: 跑测试看通过**

```bash
pytest backend/tests/unit/test_opensky_client.py -v
```

Expected: 2 passed.

### Cache

- [ ] **Step 5: 写 cache 测试**

`backend/tests/unit/test_flight_cache.py`:

```python
import pytest

from backend.flights.cache import FlightCache, CacheEntry
from backend.flights.opensky import FlightState


def _make_state(callsign: str = "BA178") -> FlightState:
    return FlightState(
        icao24="abc", callsign=callsign, origin_country="UK",
        longitude=0.0, latitude=51.0, velocity=200.0, heading=90.0, on_ground=False,
    )


def test_cache_returns_fresh_within_ttl():
    cache = FlightCache(ttl_seconds=30, now=lambda: 1000)
    cache.store([_make_state()])
    entry = cache.get(now=1015)
    assert entry.stale is False
    assert entry.stale_seconds == 0
    assert len(entry.states) == 1


def test_cache_marks_stale_after_ttl():
    cache = FlightCache(ttl_seconds=30, now=lambda: 1000)
    cache.store([_make_state()])
    entry = cache.get(now=1080)
    assert entry.stale is True
    assert entry.stale_seconds == 50


def test_cache_empty_when_nothing_stored():
    cache = FlightCache(ttl_seconds=30, now=lambda: 1000)
    entry = cache.get(now=1000)
    assert entry.states == []
    assert entry.stale is True
    assert entry.stale_seconds == 0
```

- [ ] **Step 6: 跑测试看失败**

```bash
pytest backend/tests/unit/test_flight_cache.py -v
```

Expected: ImportError.

- [ ] **Step 7: 实现 FlightCache**

`backend/flights/cache.py`:

```python
import time
from dataclasses import dataclass, field
from typing import Callable

from backend.flights.opensky import FlightState


@dataclass(frozen=True)
class CacheEntry:
    states: list[FlightState]
    stale: bool
    stale_seconds: int


class FlightCache:
    def __init__(self, *, ttl_seconds: int = 30, now: Callable[[], int] = lambda: int(time.time())) -> None:
        self._ttl = ttl_seconds
        self._now = now
        self._states: list[FlightState] = []
        self._stored_at: int = 0

    def store(self, states: list[FlightState]) -> None:
        self._states = list(states)
        self._stored_at = self._now()

    def get(self, *, now: int | None = None) -> CacheEntry:
        current = now if now is not None else self._now()
        if not self._states:
            return CacheEntry(states=[], stale=True, stale_seconds=0)
        age = current - self._stored_at
        if age <= self._ttl:
            return CacheEntry(states=list(self._states), stale=False, stale_seconds=0)
        return CacheEntry(states=list(self._states), stale=True, stale_seconds=age - self._ttl)
```

- [ ] **Step 8: 跑测试看通过 + commit**

```bash
pytest backend/tests/unit/test_flight_cache.py backend/tests/unit/test_opensky_client.py -v
```

Expected: 5 passed.

```bash
git add backend/flights/__init__.py backend/flights/opensky.py backend/flights/cache.py backend/tests/cassettes/.gitkeep backend/tests/unit/test_opensky_client.py backend/tests/unit/test_flight_cache.py
git commit -m "feat(flights): OpenSky 客户端 + FlightCache 30s ttl + stale 标记

- OpenSkyClient: httpx + 指数退避 + 5xx 显式抛 OpenSkyError
- FlightState dataclass: 关键字段 icao24/callsign/origin/lon/lat/...
- FlightCache: store/get + 显式 stale + stale_seconds (degraded mode 基础)
- 单元测试用 httpx.MockTransport, 不打真实网络

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: FlightService + 历史延误率 + /flights 路由

**Files:**
- Create: `backend/flights/service.py`
- Create: `backend/flights/routes.py`
- Modify: `backend/app.py` (装载 flights router + cache/client 单例)
- Create: `backend/tests/unit/test_flight_service.py`
- Create: `backend/tests/integration/test_flights_routes.py`

### Service first

- [ ] **Step 1: 写 FlightService 测试（含延误率计算）**

`backend/tests/unit/test_flight_service.py`:

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.flights.service import FlightService, DelayStats
from backend.models import Flight, Policy, Claim, PolicyStatus


@pytest.mark.asyncio
async def test_delay_stats_zero_when_no_history(db_session: AsyncSession):
    service = FlightService(db_session)
    stats = await service.delay_stats(callsign="XX999")
    assert stats == DelayStats(samples=0, delayed=0, delay_rate=0.0)


@pytest.mark.asyncio
async def test_delay_stats_counts_claims_for_callsign(db_session: AsyncSession):
    # 2 个 BA178 航班, 都已赔付; 1 个 BA178 航班, 未赔付
    for i, paid in enumerate([True, True, False]):
        flight = Flight(id=f"BA178-2026061{i}", callsign="BA178", origin="LHR", destination="JFK")
        db_session.add(flight)
        await db_session.flush()
        policy = Policy(
            id=f"pol-{i}", user_id="u-x", flight_id=flight.id,
            premium=10, payout=40, condition_json="{}",
            status=PolicyStatus.PAID if paid else PolicyStatus.ACTIVE,
        )
        db_session.add(policy)
        await db_session.flush()
        if paid:
            db_session.add(Claim(
                id=f"clm-{i}", policy_id=policy.id, payout=40,
                delay_minutes=45, signature="0x" + "a" * 64, settle_duration_ms=1000,
            ))
            await db_session.flush()
    service = FlightService(db_session)
    stats = await service.delay_stats(callsign="BA178")
    assert stats.samples == 3
    assert stats.delayed == 2
    assert stats.delay_rate == pytest.approx(2 / 3, rel=1e-3)
```

- [ ] **Step 2: 跑测试看失败**

```bash
pytest backend/tests/unit/test_flight_service.py -v
```

Expected: ImportError.

- [ ] **Step 3: 实现 FlightService**

`backend/flights/service.py`:

```python
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Claim, Flight, Policy


@dataclass(frozen=True)
class DelayStats:
    samples: int
    delayed: int
    delay_rate: float


class FlightService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def delay_stats(self, *, callsign: str) -> DelayStats:
        # samples = 这个 callsign 上承保过的 flight 数 (= policies 数)
        # delayed = 其中有 claim 的 (=赔付过的)
        samples_q = (
            select(func.count(Policy.id.distinct()))
            .select_from(Policy)
            .join(Flight, Flight.id == Policy.flight_id)
            .where(Flight.callsign == callsign)
        )
        delayed_q = (
            select(func.count(Claim.id.distinct()))
            .select_from(Claim)
            .join(Policy, Policy.id == Claim.policy_id)
            .join(Flight, Flight.id == Policy.flight_id)
            .where(Flight.callsign == callsign)
        )
        samples = (await self._session.execute(samples_q)).scalar_one() or 0
        delayed = (await self._session.execute(delayed_q)).scalar_one() or 0
        rate = (delayed / samples) if samples else 0.0
        return DelayStats(samples=samples, delayed=delayed, delay_rate=rate)

    async def get_flight(self, flight_id: str) -> Flight | None:
        stmt = select(Flight).where(Flight.id == flight_id)
        return (await self._session.execute(stmt)).scalar_one_or_none()
```

- [ ] **Step 4: 跑测试看通过**

```bash
pytest backend/tests/unit/test_flight_service.py -v
```

Expected: 2 passed.

### Routes

- [ ] **Step 5: 写 routes 集成测试**

`backend/tests/integration/test_flights_routes.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import create_app, get_flight_cache, get_opensky_client
from backend.flights.opensky import FlightState
from backend.db import get_engine, Base


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("OPENSKY_BASE_URL", "https://opensky.test")
    from backend.config import get_settings
    get_settings.cache_clear()
    import backend.db
    backend.db._engine = None
    backend.db._session_factory = None

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 灌入一个 fake 状态
    cache = get_flight_cache()
    cache.store([
        FlightState(icao24="abc", callsign="BA178", origin_country="UK",
                    longitude=-0.4, latitude=51.4, velocity=240.0,
                    heading=280.0, on_ground=False),
    ])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_live_returns_cached_states(app_client: AsyncClient):
    res = await app_client.get("/flights/live")
    assert res.status_code == 200
    body = res.json()
    assert body["data_stale"] is False
    assert len(body["flights"]) == 1
    assert body["flights"][0]["callsign"] == "BA178"


@pytest.mark.asyncio
async def test_flight_detail_returns_404_when_unknown(app_client: AsyncClient):
    res = await app_client.get("/flights/UNKNOWN-20260613")
    assert res.status_code == 404
```

- [ ] **Step 6: 跑测试看失败**

```bash
pytest backend/tests/integration/test_flights_routes.py -v
```

Expected: ImportError on `get_flight_cache` / `backend.flights.routes`.

- [ ] **Step 7: 实现 routes.py 与 app 单例**

`backend/flights/routes.py`:

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_session
from backend.flights.cache import FlightCache
from backend.flights.service import FlightService

router = APIRouter()


class FlightPublic(BaseModel):
    callsign: str
    origin_country: str
    longitude: float | None
    latitude: float | None
    velocity: float | None
    heading: float | None
    on_ground: bool


class LiveResponse(BaseModel):
    data_stale: bool
    stale_seconds: int
    flights: list[FlightPublic]


class FlightDetail(BaseModel):
    id: str
    callsign: str
    origin: str
    destination: str
    delay_rate: float
    samples: int


def _cache_from(request: Request) -> FlightCache:
    return request.app.state.flight_cache


@router.get("/flights/live", response_model=LiveResponse)
async def flights_live(request: Request) -> LiveResponse:
    cache = _cache_from(request)
    entry = cache.get()
    return LiveResponse(
        data_stale=entry.stale,
        stale_seconds=entry.stale_seconds,
        flights=[
            FlightPublic(
                callsign=s.callsign, origin_country=s.origin_country,
                longitude=s.longitude, latitude=s.latitude,
                velocity=s.velocity, heading=s.heading, on_ground=s.on_ground,
            )
            for s in entry.states
        ],
    )


@router.get("/flights/{flight_id}", response_model=FlightDetail)
async def flight_detail(
    flight_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FlightDetail:
    service = FlightService(session)
    flight = await service.get_flight(flight_id)
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="flight unknown")
    stats = await service.delay_stats(callsign=flight.callsign)
    return FlightDetail(
        id=flight.id, callsign=flight.callsign,
        origin=flight.origin, destination=flight.destination,
        delay_rate=stats.delay_rate, samples=stats.samples,
    )
```

- [ ] **Step 8: 在 app.py 装单例 + 装 router**

修改 `backend/app.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.auth.routes import router as auth_router
from backend.db import init_db
from backend.flights.cache import FlightCache
from backend.flights.opensky import OpenSkyClient
from backend.flights.routes import router as flights_router


def get_flight_cache() -> FlightCache:
    return _flight_cache_singleton


def get_opensky_client() -> OpenSkyClient:
    return _opensky_singleton


_flight_cache_singleton = FlightCache(ttl_seconds=30)
_opensky_singleton: OpenSkyClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _opensky_singleton
    await init_db()
    _opensky_singleton = OpenSkyClient()
    app.state.flight_cache = _flight_cache_singleton
    app.state.opensky = _opensky_singleton
    try:
        yield
    finally:
        if _opensky_singleton is not None:
            await _opensky_singleton.aclose()


def create_app() -> FastAPI:
    app = FastAPI(title="rialo-captain", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.flight_cache = _flight_cache_singleton

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "rialo-captain"}

    app.include_router(auth_router)
    app.include_router(flights_router)
    return app


app = create_app()
```

- [ ] **Step 9: 跑全部后端测试**

```bash
pytest backend/tests -v
```

Expected: 全绿（含 flights routes + service）。

- [ ] **Step 10: Commit**

```bash
git add backend/flights/service.py backend/flights/routes.py backend/app.py backend/tests/unit/test_flight_service.py backend/tests/integration/test_flights_routes.py
git commit -m "feat(flights): /flights/live + /flights/:id + 延误率统计

- LiveResponse 带 data_stale + stale_seconds 显式标记 degraded mode
- FlightDetail 含基于 claims/policies 的累积 delay_rate
- FlightCache 与 OpenSkyClient 注入 app.state, 单例
- 集成测试灌入 cache fake state 验证端到端

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: 前端初始化（Vite + React + TS + ESLint 禁字体）

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/index.html`
- Create: `frontend/.eslintrc.cjs`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/vite-env.d.ts`

### Tests first (build/lint 是这一 task 的"验证")

- [ ] **Step 1: 创建 package.json**

`frontend/package.json`:

```json
{
  "name": "rialo-captain-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 5173",
    "lint": "eslint . --max-warnings=0",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.27.0",
    "swr": "^2.2.5",
    "@react-oauth/google": "^0.12.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.4",
    "@vitest/ui": "^2.1.4",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.3",
    "jsdom": "^25.0.1",
    "eslint": "^9.14.0",
    "@typescript-eslint/parser": "^8.13.0",
    "@typescript-eslint/eslint-plugin": "^8.13.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "playwright": "^1.48.2",
    "@playwright/test": "^1.48.2"
  },
  "packageManager": "pnpm@9.12.3"
}
```

- [ ] **Step 2: 创建 Vite / TS / index.html / ESLint 配置**

`frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true, rewrite: p => p.replace(/^\/api/, "") },
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
});
```

`frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "e2e"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

`frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rialo-Captain</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
  },
});
```

`frontend/.eslintrc.cjs`（含禁字体规则）:

```javascript
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  env: { browser: true, es2022: true },
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/Inter|Roboto|Arial|Fraunces|system-ui/i]",
        message: "禁用字体: 来自 web-design-engineer skill 规约。请使用 Geist / Söhne / JetBrains Mono",
      },
    ],
  },
  ignorePatterns: ["dist", "node_modules"],
};
```

- [ ] **Step 3: 写 main.tsx + App.tsx 最小骨架**

`frontend/src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />
```

`frontend/src/main.tsx`:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`frontend/src/App.tsx`:

```typescript
export default function App() {
  return <main aria-label="Rialo-Captain shell">Rialo-Captain · bootstrapping</main>;
}
```

`frontend/src/tests/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: 安装依赖 + 跑 build + lint**

```bash
cd frontend
pnpm install
pnpm build
pnpm lint
```

Expected:
- build: `dist/` 生成成功，无 error
- lint: 0 problems

- [ ] **Step 5: 故意写违规字体确认 lint 工作**

`frontend/src/App.tsx`（临时）改为：

```typescript
export default function App() {
  return <main style={{ fontFamily: "Inter" }}>x</main>;
}
```

```bash
pnpm lint
```

Expected: FAIL with "禁用字体: 来自 web-design-engineer skill 规约..."

然后还原 `App.tsx`：

```typescript
export default function App() {
  return <main aria-label="Rialo-Captain shell">Rialo-Captain · bootstrapping</main>;
}
```

确认 `pnpm lint` 0 problems.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): Vite + React 18 + TS 初始化 + ESLint 禁字体

- pnpm + Vite 5 + React 18 + TS 严格模式
- vite.config 代理 /api -> :8000, /ws -> ws://:8000
- vitest + jsdom + testing-library 测试栈就位
- ESLint 自定义规则: 字面量含 Inter/Roboto/Arial/Fraunces/system-ui 直接 error
  (来自 web-design-engineer skill 规约)
- main.tsx + App.tsx 最小骨架, pnpm build 通过

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Design Tokens + Grain Noise + 字体注册

**Files:**
- Create: `frontend/src/design/tokens.css`
- Create: `frontend/src/design/motion.ts`
- Modify: `frontend/src/main.tsx` (引入 tokens.css)
- Modify: `frontend/src/App.tsx` (应用 surface-0 + grain overlay)
- Create: `frontend/src/tests/tokens.test.ts`

### Tests first

- [ ] **Step 1: 写 token 存在性测试**

`frontend/src/tests/tokens.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import "../design/tokens.css?inline";

describe("design tokens", () => {
  beforeAll(() => {
    // 通过给 body 一个 class 来强制注入（jsdom 不渲染 CSS, 我们改测 motion.ts 常量）
  });

  it("motion constants are stable", async () => {
    const m = await import("../design/motion");
    expect(m.DURATION.fast).toBe(160);
    expect(m.DURATION.mid).toBe(280);
    expect(m.DURATION.slow).toBe(600);
    expect(m.EASE_OUT).toMatch(/cubic-bezier/);
  });
});
```

- [ ] **Step 2: 跑测试看失败**

```bash
pnpm test
```

Expected: FAIL with module not found.

### Implementation

- [ ] **Step 3: 实现 tokens.css**

`frontend/src/design/tokens.css`:

```css
:root {
  /* Surfaces */
  --surface-0: #050608;
  --surface-1: #0B0E12;
  --surface-2: #14181F;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-emphasis: rgba(0, 255, 157, 0.24);

  /* Accents */
  --accent-radar: #00FF9D;
  --accent-radar-dim: rgba(0, 255, 157, 0.20);
  --warn-amber: #FFB400;
  --danger-flare: #FF3D5C;
  --info-beige: #E8E3D5;

  /* Text */
  --text-primary: rgba(232, 227, 213, 0.95);
  --text-secondary: rgba(232, 227, 213, 0.60);
  --text-tertiary: rgba(232, 227, 213, 0.35);

  /* Typography (不引入 Inter / Roboto, fallback 用通用 sans/mono) */
  --font-display: "Geist", "Söhne", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-ui: var(--font-display);
  --font-mono: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Radius */
  --radius-sharp: 2px;
  --radius-soft: 8px;
  --radius-pill: 999px;

  /* Shadow */
  --elev-1: 0 0 0 1px var(--border-subtle);
  --elev-2: 0 0 0 1px var(--border-subtle), 0 1px 0 rgba(0, 0, 0, 0.4);
  --glow-radar: 0 0 16px var(--accent-radar-dim);
}

* {
  box-sizing: border-box;
}

html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: var(--surface-0);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-feature-settings: "ss01", "cv11";
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

body {
  position: relative;
  overflow-x: hidden;
}

/* 全局 grain noise overlay */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.03;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.8'/></svg>");
}

/* Mono 与数据 */
.mono { font-family: var(--font-mono); }

/* Radar sweep utility */
@keyframes radar-sweep {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.radar-sweep {
  animation: radar-sweep 6s linear infinite;
  transform-origin: center;
}

/* Flare burst utility */
@keyframes flare-burst {
  0%   { box-shadow: 0 0 0 0 var(--accent-radar); opacity: 1; }
  60%  { box-shadow: 0 0 0 32px rgba(0, 255, 157, 0); opacity: 0.8; }
  100% { box-shadow: 0 0 0 0 rgba(0, 255, 157, 0); opacity: 1; }
}

.flare-burst {
  animation: flare-burst 400ms cubic-bezier(0.22, 1, 0.36, 1);
}
```

- [ ] **Step 4: 实现 motion.ts**

`frontend/src/design/motion.ts`:

```typescript
export const DURATION = {
  fast: 160,
  mid: 280,
  slow: 600,
} as const;

export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_RADAR = "cubic-bezier(0.65, 0, 0.35, 1)";
```

- [ ] **Step 5: 引入 tokens.css + 跑测试 + 视觉走查**

修改 `frontend/src/main.tsx`:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import "./design/tokens.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

修改 `frontend/src/App.tsx`:

```typescript
export default function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        gap: 16,
        padding: 24,
      }}
      aria-label="Rialo-Captain shell"
    >
      <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 12 }}>
        RIALO · CAPTAIN
      </div>
      <div style={{ fontSize: 40, letterSpacing: "-0.02em" }}>
        Reactive insurance for the real sky
      </div>
      <div style={{ fontFamily: "var(--font-mono)", color: "var(--accent-radar)", fontSize: 12 }}>
        bootstrapping · awaiting design tokens go-live
      </div>
    </main>
  );
}
```

```bash
pnpm test
pnpm dev   # 手动打开 http://localhost:5173, 确认: 深黑底 / 米色文本 / 雷达青绿 / grain 噪点
```

Expected:
- `pnpm test`: 1 passed
- 手动: 浏览器看到深黑底 + 极淡 grain 噪点 + 米色字 + 一行雷达青绿 "bootstrapping"

- [ ] **Step 6: Commit**

```bash
git add frontend/src/design/ frontend/src/main.tsx frontend/src/App.tsx frontend/src/tests/tokens.test.ts
git commit -m "feat(design): 全量 design tokens + grain overlay + motion 常量

- tokens.css: 14 个颜色 token + 字体 stack (无 Inter) + radius/shadow + 动效
  utility (radar-sweep / flare-burst)
- motion.ts: DURATION fast/mid/slow + EASE_OUT/RADAR cubic-bezier
- body::after grain noise SVG inline (3% opacity, 视觉质感)
- App.tsx 当前展示 bootstrap 状态, 留给 Task 11 替换为路由壳

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: API client + useMe hook + vitest 单元测试

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/hooks/useMe.ts`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/tests/api-client.test.ts`
- Create: `frontend/src/tests/useMe.test.tsx`

### Tests first

- [ ] **Step 1: 写 api client 测试**

`frontend/src/tests/api-client.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { apiFetch, ApiError } from "../api/client";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests /api prefix and includes credentials", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const result = await apiFetch<{ ok: boolean }>("/me");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("throws ApiError on non-2xx", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("nope", { status: 401 }),
    );
    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: 写 useMe hook 测试**

`frontend/src/tests/useMe.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useMe } from "../hooks/useMe";

function Probe() {
  const { user, error, isLoading } = useMe();
  if (isLoading) return <div>loading</div>;
  if (error) return <div>error</div>;
  return <div>{user?.email ?? "anon"}</div>;
}

describe("useMe", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders email on success", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "u1", email: "a@x.com", name: "A", avatar_url: "", balance: 1000 }), { status: 200 }),
    );
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Probe />
      </SWRConfig>,
    );
    await waitFor(() => expect(screen.getByText("a@x.com")).toBeInTheDocument());
  });

  it("renders 'anon' when 401", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("", { status: 401 }),
    );
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Probe />
      </SWRConfig>,
    );
    await waitFor(() => expect(screen.getByText("anon")).toBeInTheDocument());
  });
});
```

- [ ] **Step 3: 跑测试看失败**

```bash
pnpm test
```

Expected: 2+ failing (module not found).

### Implementation

- [ ] **Step 4: 实现 types / client / useMe**

`frontend/src/types.ts`:

```typescript
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  balance: number;
}
```

`frontend/src/api/client.ts`:

```typescript
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith("/api") ? path : `/api${path}`;
  const res = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} on ${url}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

`frontend/src/hooks/useMe.ts`:

```typescript
import useSWR from "swr";
import { apiFetch, ApiError } from "../api/client";
import type { CurrentUser } from "../types";

const fetcher = async (path: string): Promise<CurrentUser | null> => {
  try {
    return await apiFetch<CurrentUser>(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
};

export function useMe() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUser | null>("/me", fetcher, {
    revalidateOnFocus: false,
  });
  return { user: data ?? null, error, isLoading, refresh: mutate };
}
```

- [ ] **Step 5: 跑测试看通过 + commit**

```bash
pnpm test
```

Expected: 4 passed (含 tokens.test.ts 之前的 1 + client 2 + useMe 2... 实际取决于排列, 全绿即可)。

```bash
git add frontend/src/api/ frontend/src/hooks/ frontend/src/types.ts frontend/src/tests/api-client.test.ts frontend/src/tests/useMe.test.tsx
git commit -m "feat(frontend): apiFetch wrapper + useMe SWR hook

- apiFetch: 自动 /api 前缀 + credentials: include + ApiError 显式抛
- useMe: SWR 取 /me, 401 视为 null (未登录), 其它错误向外抛
- 测试用 vi.stubGlobal('fetch') mock 网络

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Google Sign-In + ProtectedRoute + 路由壳 + 占位页

**Files:**
- Create: `frontend/src/auth/GoogleSignIn.tsx`
- Create: `frontend/src/auth/ProtectedRoute.tsx`
- Create: `frontend/src/routes/Login.tsx`
- Create: `frontend/src/routes/TowerShell.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/tests/protected-route.test.tsx`
- Create: `frontend/.env.example`

### Tests first

- [ ] **Step 1: 写 ProtectedRoute 测试**

`frontend/src/tests/protected-route.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SWRConfig } from "swr";
import { ProtectedRoute } from "../auth/ProtectedRoute";

function Wrap({ initial = "/" }: { initial?: string }) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/" element={<ProtectedRoute><div>secret</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders children when /me returns user", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ id: "u", email: "a@x.com", name: "A", avatar_url: "", balance: 1000 }), { status: 200 }),
    );
    render(<Wrap />);
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());
  });

  it("redirects to /login when /me returns 401", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response("", { status: 401 }));
    render(<Wrap />);
    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 跑测试看失败**

```bash
pnpm test
```

Expected: ProtectedRoute 未实现，import 失败。

### Implementation

- [ ] **Step 3: 实现 ProtectedRoute + GoogleSignIn**

`frontend/src/auth/ProtectedRoute.tsx`:

```typescript
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMe } from "../hooks/useMe";

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { user, isLoading } = useMe();
  if (isLoading) return <div style={{ padding: 24, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>checking session…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

`frontend/src/auth/GoogleSignIn.tsx`:

```typescript
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useMe } from "../hooks/useMe";

export function GoogleSignIn() {
  const navigate = useNavigate();
  const { refresh } = useMe();

  async function onSuccess(cred: CredentialResponse) {
    if (!cred.credential) return;
    await apiFetch<unknown>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ id_token: cred.credential }),
    });
    await refresh();
    navigate("/", { replace: true });
  }

  return (
    <div style={{ display: "grid", placeItems: "center" }}>
      <GoogleLogin
        onSuccess={onSuccess}
        onError={() => console.warn("google sign-in failed")}
        theme="filled_black"
        text="signin_with"
        shape="pill"
      />
    </div>
  );
}
```

- [ ] **Step 4: 实现 Login / TowerShell**

`frontend/src/routes/Login.tsx`:

```typescript
import { GoogleSignIn } from "../auth/GoogleSignIn";

export function Login() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32 }}>
      <div style={{
        display: "grid",
        gap: 32,
        padding: 40,
        background: "var(--surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-soft)",
        maxWidth: 420,
        width: "100%",
        boxShadow: "var(--elev-2)",
      }}>
        <div style={{
          fontFamily: "var(--font-mono)",
          color: "var(--text-secondary)",
          fontSize: 12,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}>
          RIALO · CAPTAIN
        </div>
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          The tower<br /><span style={{ color: "var(--accent-radar)" }}>is open</span>.
        </h1>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Sign in to watch the sky and insure a flight in one click.
        </p>
        <GoogleSignIn />
      </div>
    </main>
  );
}
```

`frontend/src/routes/TowerShell.tsx`:

```typescript
import { useMe } from "../hooks/useMe";

export function TowerShell() {
  const { user } = useMe();
  return (
    <main style={{ minHeight: "100vh", padding: 24, display: "grid", gap: 24 }}>
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingBottom: 16, borderBottom: "1px solid var(--border-subtle)",
      }}>
        <div style={{
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.18em", fontSize: 12, color: "var(--text-secondary)",
        }}>
          THE TOWER · LIVE
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "var(--font-mono)", fontSize: 12 }}>
          <span style={{ color: "var(--text-tertiary)" }}>BAL</span>
          <span>{user?.balance ?? "—"} RIA</span>
          <span style={{ color: "var(--text-tertiary)" }}>{user?.email}</span>
        </div>
      </header>
      <section style={{
        position: "relative",
        flex: 1,
        minHeight: 480,
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-soft)",
        background: "var(--surface-1)",
        display: "grid", placeItems: "center",
      }}>
        <div style={{
          display: "grid", gap: 12, placeItems: "center",
          color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: 12,
        }}>
          <div className="radar-sweep" style={{
            width: 80, height: 80, border: "1px solid var(--accent-radar-dim)", borderTop: "1px solid var(--accent-radar)",
            borderRadius: "50%",
          }} />
          <div>map awaiting · plan 3</div>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: 改 App.tsx 装路由 + main.tsx 装 OAuth provider**

修改 `frontend/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Login } from "./routes/Login";
import { TowerShell } from "./routes/TowerShell";
import { ProtectedRoute } from "./auth/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><TowerShell /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

修改 `frontend/src/main.tsx`:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./design/tokens.css";
import App from "./App";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
```

`frontend/.env.example`:

```
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

- [ ] **Step 6: 跑全部测试 + 视觉走查**

```bash
pnpm test
```

Expected: 全绿 (tokens / api-client / useMe / protected-route)。

```bash
pnpm build
pnpm dev   # 手动: 打开 / 跳转 /login, 看到深黑卡片 + GoogleSignIn 按钮
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/auth/ frontend/src/routes/ frontend/src/App.tsx frontend/src/main.tsx frontend/src/tests/protected-route.test.tsx frontend/.env.example
git commit -m "feat(frontend): Login + TowerShell 占位 + ProtectedRoute + Google Sign-In

- GoogleSignIn: @react-oauth/google -> POST /auth/google -> refresh useMe
- ProtectedRoute: useMe 加载中 placeholder, 未登录 <Navigate to=/login>
- Login: 大字标 + Tower-style 卡片, 'The tower is open' 文案
- TowerShell: header 显示余额, 主区雷达 sweep 占位 (留给 Plan 3)
- App.tsx 装 react-router, main.tsx 装 GoogleOAuthProvider
- .env.example 加 VITE_GOOGLE_CLIENT_ID

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: dev.sh + README + Playwright E2E + Plan 1 收尾

**Files:**
- Create: `scripts/dev.sh`
- Create: `README.md`
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/foundation.spec.ts`
- Modify: `.gitignore` (覆盖 user 已 stage 的版本，加入 node_modules / dist / .venv 等)

### Dev script

- [ ] **Step 1: 写 dev.sh**

`scripts/dev.sh`:

```bash
#!/usr/bin/env bash
# Rialo-Captain 开发一键启动: backend on :8000, frontend on :5173
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "[dev] 已从 .env.example 复制 .env, 记得填 GOOGLE_CLIENT_ID"
fi

if [[ ! -f frontend/.env ]]; then
  cp frontend/.env.example frontend/.env
  echo "[dev] 已从 frontend/.env.example 复制 frontend/.env, 记得填 VITE_GOOGLE_CLIENT_ID"
fi

cleanup() {
  echo "[dev] stopping..."
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

echo "[dev] 启动 backend (uvicorn :8000)"
uvicorn backend.app:app --reload --port 8000 &

echo "[dev] 启动 frontend (vite :5173)"
(cd frontend && pnpm dev) &

wait
```

```bash
chmod +x scripts/dev.sh
```

- [ ] **Step 2: 更新 .gitignore**

`.gitignore`（覆盖原内容）:

```
# Python
__pycache__/
*.py[cod]
.pytest_cache/
.coverage
.ruff_cache/
.venv/
venv/
*.db
*.db-journal

# Node
node_modules/
frontend/dist/
frontend/.vite/
frontend/playwright-report/
frontend/test-results/

# Env
.env
.env.local
frontend/.env
frontend/.env.local

# IDE
.idea/
.vscode/

# OS
.DS_Store
```

### README

- [ ] **Step 3: 写 README.md（中英双语）**

`README.md`:

````markdown
# Rialo-Captain

**Reactive insurance for the real sky · Built for Rialo**

Watch every live flight on a global ATC-style radar. Insure a flight in one click. When it's delayed, a reactive contract reads OpenSky live, settles itself, and pays you out — no oracle, no keeper, no admin.

Live demo（占位）· [设计文档](docs/superpowers/specs/2026-06-13-rialo-captain-design.md) · [OpenSpec proposal](openspec/changes/rialo-captain-mvp/)

---

## 中文简介

Rialo-Captain 是一个跑在 Rialo 上的航班延误险演示项目，演示反应式合约如何**直接读 web2 数据并自主结算**，不依赖 oracle / keeper / 管理员。Plan 1 (Foundation) 已落地登录、OpenSky 接入、前端 Shell；Plan 2 / 3 在路上。

## Stack

- **Backend** Python 3.11 · FastAPI · SQLAlchemy 2.x async · SQLite · httpx · PyJWT · google-auth
- **Frontend** Vite 5 · React 18 · TypeScript · React Router 6 · SWR · @react-oauth/google · Mapbox GL (Plan 3)
- **Test** pytest + pytest-asyncio · vcrpy · Vitest · @testing-library/react · Playwright

## Prerequisites

1. **Python 3.11** + `pip` 或 `uv`
2. **Node 20+** + `pnpm 9`
3. **Google OAuth Client ID** — 见下方步骤
4. (可选) **Mapbox token** — Plan 3 才会用到

### 申请 Google OAuth Client ID（免费）

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → 新建项目 `rialo-captain-local`
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**
3. Application type: **Web application**
4. **Authorized JavaScript origins** 加: `http://localhost:5173`、`http://localhost:8000`
5. 复制 Client ID
6. `cp .env.example .env`，填入 `GOOGLE_CLIENT_ID=...`
7. `cp frontend/.env.example frontend/.env`，填入同一个 `VITE_GOOGLE_CLIENT_ID=...`

### OpenSky 注意事项

OpenSky 公共 API **无需 key**，但匿名调用有限频（约每秒 1 次）。开发期足够；如果要做长期 demo，建议在 OpenSky 注册并把账号配进 `.env`（Plan 2/3 任务里可选加）。

## Run

```bash
pip install -e ".[dev]"          # 后端依赖
cd frontend && pnpm install       # 前端依赖
cd ..
./scripts/dev.sh                  # 前后端一键启动
```

打开 `http://localhost:5173` → "Sign in with Google" → 登录后进入 Tower 占位页（Plan 3 落地完整大屏）。

## Tests

```bash
# 后端
pytest backend/tests -v

# 前端
cd frontend && pnpm test

# E2E
cd frontend && pnpm exec playwright install --with-deps chromium
cd frontend && pnpm exec playwright test
```

## 项目状态

- [x] **Plan 1 · Foundation** ← 当前
  - [x] 项目骨架、Google OAuth、OpenSky 接入、设计系统、前端壳
- [ ] Plan 2 · Reactive Insurance Core
  - [ ] ReactiveContractAdapter、保险产品、自动赔付循环
- [ ] Plan 3 · Live Dashboard
  - [ ] 6 页 SPA、Tower 全量大屏、WebSocket、Playwright E2E

## License

MIT (TBD)
````

### Playwright E2E

- [ ] **Step 4: 写 playwright.config 与 foundation spec**

`frontend/playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: [
    {
      command: "cd .. && uvicorn backend.app:app --port 8000",
      url: "http://localhost:8000/health",
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
```

`frontend/e2e/foundation.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("未登录用户被引导到 /login 并看到 sign-in 按钮", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  // GoogleLogin 渲染一个 iframe (sign-in button)
  await expect(page.locator("iframe").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/The tower/i)).toBeVisible();
});
```

- [ ] **Step 5: 跑 E2E**

```bash
cd frontend
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test
```

Expected: 1 passed.

### Self-review

- [ ] **Step 6: Self-review checklist**

走查（每项打勾或修复）：
- [ ] proposal.md 的每个 capability 都有 task 实现：auth-and-account ✅ (Task 3-5), flight-data ✅ (Task 6-7), reactive-insurance-core ⏸ Plan 2, live-dashboard 部分 ✅ (Task 8-11) 部分 ⏸ Plan 3
- [ ] spec 中所有 Plan 1 范围的 Scenario 都被某测试覆盖（首次登录创建账号 ✅ / 已注册保留余额 ✅ / 非法 token 401 ✅ / 未登录访问 /me 401 ✅ / 30 秒缓存 ✅ / degraded mode 标记 ✅）
- [ ] 无 TBD / TODO 占位词
- [ ] 类型与方法名前后一致：`apiFetch` / `useMe` / `ProtectedRoute` / `UserService.create_or_get`
- [ ] 所有代码块都是完整可粘贴（无 `// ...`）
- [ ] commit 命令清晰、git add 指定路径、message 含 Co-Authored-By

如有 ❌ 项, 回前面 task 补充。

- [ ] **Step 7: 最终 commit + push（可选）**

```bash
git add scripts/dev.sh README.md .gitignore frontend/playwright.config.ts frontend/e2e/
git commit -m "feat: Plan 1 Foundation 收尾 - dev.sh + README + E2E smoke

- scripts/dev.sh 一键拉起 backend (:8000) + frontend (:5173) + env 自动复制
- README 中英双语, 含 Google OAuth 申请步骤 + OpenSky 注意事项
- Playwright config + foundation.spec: 未登录跳 /login 验证
- .gitignore 完整版 (Python / Node / env / IDE / OS)

Plan 1 完成. 下一步:
  superpowers:subagent-driven-development 或 executing-plans 执行本计划,
  或 writing-plans 继续写 Plan 2 (Reactive Insurance Core).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Plan 1 验收 (running)

完成 Task 1-12 后，下列断言全部为真即 Plan 1 通过：

1. `pytest backend/tests -v` → 全绿 (>= 18 tests)
2. `cd frontend && pnpm test` → 全绿 (>= 6 tests)
3. `cd frontend && pnpm build` → `dist/` 生成，无 error
4. `cd frontend && pnpm lint` → 0 problems
5. `cd frontend && pnpm exec playwright test` → 1 passed
6. `./scripts/dev.sh` → 浏览器手动 sign in with Google → 看到 TowerShell 占位 + 余额 1000 RIA
7. 浏览器 console 无 error 无 warning（含 Network panel）
8. `git log --oneline` 见到至少 9 个 conventional commits

## 下一步 (Plan 1 完成后)

- **Plan 2: Reactive Insurance Core** — 用 `superpowers:writing-plans` 继续起草，需先确认：保费档位 5/10/20 是否仍合适、赔付倍率公式细节、admin token 在 dev 期如何分发
- **Plan 3: Live Dashboard** — 需先选定 Mapbox 还是 MapLibre、确认 6 页页面 UI 的 v0 视觉草稿

