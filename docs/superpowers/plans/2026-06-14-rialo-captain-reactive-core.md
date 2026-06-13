# Rialo-Captain · Plan 2 · Reactive Insurance Core 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Plan 1 落地的骨架真正"会自己赔付"——加入 `ReactiveContractAdapter` 抽象层（Mock 实现 + Real 占位）、航班延误险产品、PolicyService、Claims 引擎（asyncio 后台循环 30s 监控 → 满足条件 → 写 claim + 加余额 + 生成 mock 签名）。完成后用户能买险，飞机延误时**没人点按钮**也会自动赔付，余额自动变化。

**Architecture:** 业务代码仅依赖 `ReactiveContractAdapter` Protocol（不依赖具体实现）。MockRialoAdapter 用 `asyncio` + `httpx` + SQLite 模拟 Rialo 反应式合约行为。`ClaimEngine` 是一个 `asyncio.Task`，每 30s 扫所有 active policy，对每个调 `adapter.fetch_external(...)` + condition 判定 + `adapter.trigger_claim(...)`。WebSocket FLARE 事件**预留接口**但本 Plan 不实装 WS（Plan 3 实装）；本 Plan 内 ClaimEngine 写入 claims 表 + 调 UserService.credit 即可，前端可以轮询 `/claims/recent` 看到结果。

**Tech Stack:** 继承 Plan 1 全部栈。新增：`asyncio.create_task` 后台循环 / `hashlib.sha256` mock 签名 / 无新外部依赖。

**Reference docs:**
- Plan 1 已落地: `docs/superpowers/plans/2026-06-13-rialo-captain-foundation.md` (15 commits ahead of plan start)
- 完整设计: `docs/superpowers/specs/2026-06-13-rialo-captain-design.md`
- OpenSpec 提案: `openspec/changes/rialo-captain-mvp/specs/reactive-insurance-core/spec.md`

---

## 文件结构（Plan 2 范围）

```
rialo-captain/
├── backend/
│   ├── contracts/                       ← NEW
│   │   ├── __init__.py
│   │   ├── base.py                      Protocol + Condition + ContractRef + ClaimPayload + TxResult
│   │   ├── mock_rialo.py                MockRialoAdapter 实现
│   │   ├── real_rialo.py                RealRialoAdapter NotImplementedError stub
│   │   └── factory.py                   get_contract_adapter() 按 RIALO_MODE 选实现
│   ├── policies/                        ← NEW
│   │   ├── __init__.py
│   │   ├── schemas.py                   CreatePolicyRequest / PolicyPublic Pydantic
│   │   ├── service.py                   PolicyService: 费率 + 创建 + 查询
│   │   └── routes.py                    POST /policies, GET /policies
│   ├── claims/                          ← NEW
│   │   ├── __init__.py
│   │   ├── signature.py                 sha256 mock 签名生成
│   │   ├── service.py                   ClaimsService: create_claim + recent
│   │   ├── engine.py                    ClaimEngine: asyncio 后台循环
│   │   └── routes.py                    GET /claims/recent
│   ├── admin/                           ← NEW
│   │   ├── __init__.py
│   │   ├── deps.py                      admin token 鉴权
│   │   └── routes.py                    POST /admin/inject-delay
│   ├── app.py                           ← MODIFY: 装 adapter / engine / 新 routers (lifespan)
│   └── tests/
│       ├── unit/
│       │   ├── test_contract_base.py    ← NEW
│       │   ├── test_mock_rialo.py       ← NEW
│       │   ├── test_contract_factory.py ← NEW
│       │   ├── test_policy_service.py   ← NEW
│       │   ├── test_signature.py        ← NEW
│       │   ├── test_claims_service.py   ← NEW
│       │   └── test_claim_engine.py     ← NEW
│       └── integration/
│           ├── test_policies_routes.py  ← NEW
│           ├── test_claims_routes.py    ← NEW
│           ├── test_admin_routes.py     ← NEW
│           └── test_reactive_e2e.py     ← NEW (端到端: 买险 → 注入延误 → 自动赔付)
└── docs/superpowers/plans/
    └── 2026-06-14-rialo-captain-reactive-core.md   ← 本文件
```

**未在 Plan 2 范围（留给 Plan 3）**：
- `backend/ws/` WebSocket FLARE 广播（Plan 2 中 ClaimEngine 写库 + log，Plan 3 加 WS broadcast）
- 完整前端 6 页 UI
- Mapbox 地图渲染
- Tower / Claims Feed / My Hangar 等页面具体 UI

---

## Task 1: Contracts 抽象层（base.py）

**Files:**
- Create: `backend/contracts/__init__.py` (空)
- Create: `backend/contracts/base.py`
- Create: `backend/tests/unit/test_contract_base.py`

### Step 1: 写测试

`backend/tests/unit/test_contract_base.py`:

```python
from typing import get_type_hints

from backend.contracts.base import (
    ReactiveContractAdapter,
    Condition,
    ConditionType,
    ContractRef,
    ClaimPayload,
    TxResult,
)


def test_condition_type_enum_has_delay():
    assert ConditionType.DELAY.value == "delay"


def test_condition_is_triggered_by_delay():
    cond = Condition(type=ConditionType.DELAY, threshold_min=30)
    assert cond.is_triggered({"delay_minutes": 45}) is True
    assert cond.is_triggered({"delay_minutes": 10}) is False
    assert cond.is_triggered({}) is False


def test_contract_ref_carries_id():
    ref = ContractRef(id="mock-policy-1", mode="mock")
    assert ref.id == "mock-policy-1"
    assert ref.mode == "mock"


def test_tx_result_has_signature_and_settle_time():
    tx = TxResult(signature="0x" + "a" * 64, settle_duration_ms=1234)
    assert tx.signature.startswith("0x")
    assert tx.settle_duration_ms == 1234


def test_claim_payload_carries_delay():
    payload = ClaimPayload(delay_minutes=45, observed_at=1700000000)
    assert payload.delay_minutes == 45


def test_adapter_protocol_has_required_methods():
    # Protocol structural check
    methods = [m for m in dir(ReactiveContractAdapter) if not m.startswith("_")]
    for required in ("watch", "fetch_external", "trigger_claim", "get_signature"):
        assert required in methods, f"Protocol missing {required}"
```

### Step 2: 跑看 fail

```bash
pytest backend/tests/unit/test_contract_base.py -v
```

Expected: ImportError.

### Step 3: 实现 base.py

`backend/contracts/__init__.py` 空。

`backend/contracts/base.py`:

```python
import enum
from dataclasses import dataclass
from typing import Protocol, runtime_checkable


class ConditionType(str, enum.Enum):
    DELAY = "delay"


@dataclass(frozen=True)
class Condition:
    type: ConditionType
    threshold_min: int

    def is_triggered(self, observation: dict) -> bool:
        if self.type is ConditionType.DELAY:
            delay = observation.get("delay_minutes", 0)
            return delay >= self.threshold_min
        return False


@dataclass(frozen=True)
class ContractRef:
    id: str
    mode: str  # "mock" | "real"


@dataclass(frozen=True)
class ClaimPayload:
    delay_minutes: int
    observed_at: int


@dataclass(frozen=True)
class TxResult:
    signature: str
    settle_duration_ms: int


@runtime_checkable
class ReactiveContractAdapter(Protocol):
    async def watch(self, policy_id: str, flight_id: str, condition: Condition) -> ContractRef: ...

    async def fetch_external(self, url: str) -> dict: ...

    async def trigger_claim(self, contract_ref: ContractRef, payload: ClaimPayload) -> TxResult: ...

    async def get_signature(self, tx: TxResult) -> str: ...
```

### Step 4: 跑看通过

```bash
pytest backend/tests/unit/test_contract_base.py -v
```

Expected: 6 passed.

### Step 5: Commit

```bash
git add backend/contracts/__init__.py backend/contracts/base.py backend/tests/unit/test_contract_base.py
git commit -m "$(printf 'feat(contracts): ReactiveContractAdapter Protocol + 类型定义\n\n- Protocol: watch / fetch_external / trigger_claim / get_signature\n- Condition (含 is_triggered 判定) + ConditionType.DELAY\n- ContractRef / ClaimPayload / TxResult dataclass\n- @runtime_checkable 允许 isinstance 检查\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 2: MockRialoAdapter 实现

**Files:**
- Create: `backend/contracts/mock_rialo.py`
- Create: `backend/tests/unit/test_mock_rialo.py`

### Step 1: 写测试

`backend/tests/unit/test_mock_rialo.py`:

```python
import hashlib

import httpx
import pytest

from backend.contracts.base import Condition, ConditionType, ClaimPayload
from backend.contracts.mock_rialo import MockRialoAdapter


@pytest.mark.asyncio
async def test_watch_returns_mock_contract_ref():
    adapter = MockRialoAdapter()
    ref = await adapter.watch(policy_id="p1", flight_id="BA178-20260613",
                              condition=Condition(type=ConditionType.DELAY, threshold_min=30))
    assert ref.mode == "mock"
    assert ref.id == "mock-p1"


@pytest.mark.asyncio
async def test_fetch_external_calls_httpx():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": True, "url": str(request.url)})

    transport = httpx.MockTransport(handler)
    adapter = MockRialoAdapter(transport=transport)
    try:
        data = await adapter.fetch_external("https://example.test/x")
    finally:
        await adapter.aclose()
    assert data["ok"] is True


@pytest.mark.asyncio
async def test_trigger_claim_generates_signature():
    adapter = MockRialoAdapter()
    ref = await adapter.watch(policy_id="p2", flight_id="DL101-20260613",
                              condition=Condition(type=ConditionType.DELAY, threshold_min=30))
    tx = await adapter.trigger_claim(ref, ClaimPayload(delay_minutes=45, observed_at=1700000000))
    assert tx.signature.startswith("0x")
    assert len(tx.signature) == 66  # 0x + 64 hex
    assert tx.settle_duration_ms >= 0


@pytest.mark.asyncio
async def test_get_signature_returns_tx_signature():
    adapter = MockRialoAdapter()
    ref = await adapter.watch(policy_id="p3", flight_id="x-20260613",
                              condition=Condition(type=ConditionType.DELAY, threshold_min=30))
    tx = await adapter.trigger_claim(ref, ClaimPayload(delay_minutes=45, observed_at=1700000000))
    sig = await adapter.get_signature(tx)
    assert sig == tx.signature


@pytest.mark.asyncio
async def test_signature_is_deterministic_for_same_inputs():
    adapter = MockRialoAdapter(nonce_source=lambda: 42)
    ref = await adapter.watch(policy_id="p4", flight_id="x-20260613",
                              condition=Condition(type=ConditionType.DELAY, threshold_min=30))
    tx1 = await adapter.trigger_claim(ref, ClaimPayload(delay_minutes=45, observed_at=1700000000))
    tx2 = await adapter.trigger_claim(ref, ClaimPayload(delay_minutes=45, observed_at=1700000000))
    expected = "0x" + hashlib.sha256(b"mock-p4|45|1700000000|42").hexdigest()
    assert tx1.signature == expected
    assert tx2.signature == expected
```

### Step 2: 跑看 fail

```bash
pytest backend/tests/unit/test_mock_rialo.py -v
```

Expected: ImportError.

### Step 3: 实现 MockRialoAdapter

`backend/contracts/mock_rialo.py`:

```python
import hashlib
import random
import time
from typing import Callable

import httpx

from backend.contracts.base import (
    ClaimPayload,
    Condition,
    ContractRef,
    ReactiveContractAdapter,
    TxResult,
)


class MockRialoAdapter(ReactiveContractAdapter):
    """MVP 实现 - 用 asyncio + httpx 模拟 Rialo 反应式合约。

    生命周期：app lifespan 创建 + aclose。watch 注册到内存 + 业务方 + DB 由调用方处理。
    """

    def __init__(
        self,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        nonce_source: Callable[[], int] = lambda: random.randint(0, 2**31 - 1),
    ) -> None:
        self._client = httpx.AsyncClient(transport=transport, timeout=10.0)
        self._nonce_source = nonce_source
        self._watched: dict[str, tuple[str, Condition]] = {}

    async def aclose(self) -> None:
        await self._client.aclose()

    async def watch(self, policy_id: str, flight_id: str, condition: Condition) -> ContractRef:
        self._watched[policy_id] = (flight_id, condition)
        return ContractRef(id=f"mock-{policy_id}", mode="mock")

    async def fetch_external(self, url: str) -> dict:
        resp = await self._client.get(url)
        resp.raise_for_status()
        return resp.json()

    async def trigger_claim(self, contract_ref: ContractRef, payload: ClaimPayload) -> TxResult:
        start = time.perf_counter()
        nonce = self._nonce_source()
        material = f"{contract_ref.id}|{payload.delay_minutes}|{payload.observed_at}|{nonce}".encode()
        sig = "0x" + hashlib.sha256(material).hexdigest()
        # 模拟"上链"耗时少许
        settle_ms = int((time.perf_counter() - start) * 1000)
        return TxResult(signature=sig, settle_duration_ms=max(settle_ms, 1))

    async def get_signature(self, tx: TxResult) -> str:
        return tx.signature
```

### Step 4: 跑看通过

```bash
pytest backend/tests/unit/test_mock_rialo.py -v
```

Expected: 5 passed.

### Step 5: Commit

```bash
git add backend/contracts/mock_rialo.py backend/tests/unit/test_mock_rialo.py
git commit -m "$(printf 'feat(contracts): MockRialoAdapter - 反应式合约 mock 实现\n\n- watch: 注册到内存监听表 + 返回 mock-{policy_id} 引用\n- fetch_external: httpx GET, 复用 Plan 1 的网络模式\n- trigger_claim: sha256(ref|delay|ts|nonce) -> 0x...64hex 签名\n- get_signature: 透传 tx.signature\n- nonce_source 可注入, 测试用固定值验证确定性\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 3: RealRialoAdapter stub + factory + RIALO_MODE 配置

**Files:**
- Create: `backend/contracts/real_rialo.py`
- Create: `backend/contracts/factory.py`
- Create: `backend/tests/unit/test_contract_factory.py`

### Step 1: 写测试

`backend/tests/unit/test_contract_factory.py`:

```python
import pytest

from backend.contracts.base import Condition, ConditionType
from backend.contracts.factory import get_contract_adapter
from backend.contracts.mock_rialo import MockRialoAdapter
from backend.contracts.real_rialo import RealRialoAdapter


def test_factory_returns_mock_when_rialo_mode_mock(monkeypatch):
    monkeypatch.setenv("RIALO_MODE", "mock")
    from backend.config import get_settings
    get_settings.cache_clear()
    adapter = get_contract_adapter()
    assert isinstance(adapter, MockRialoAdapter)


def test_factory_returns_real_when_rialo_mode_real(monkeypatch):
    monkeypatch.setenv("RIALO_MODE", "real")
    from backend.config import get_settings
    get_settings.cache_clear()
    adapter = get_contract_adapter()
    assert isinstance(adapter, RealRialoAdapter)


@pytest.mark.asyncio
async def test_real_adapter_raises_not_implemented_on_any_call():
    adapter = RealRialoAdapter()
    with pytest.raises(NotImplementedError, match="Awaiting Rialo SDK release"):
        await adapter.watch("p", "f", Condition(type=ConditionType.DELAY, threshold_min=30))
    with pytest.raises(NotImplementedError):
        await adapter.fetch_external("https://x")
```

### Step 2: 跑看 fail

```bash
pytest backend/tests/unit/test_contract_factory.py -v
```

Expected: ImportError.

### Step 3: 实现 real_rialo.py + factory.py

`backend/contracts/real_rialo.py`:

```python
from backend.contracts.base import (
    ClaimPayload,
    Condition,
    ContractRef,
    ReactiveContractAdapter,
    TxResult,
)

_NOT_READY = "Awaiting Rialo SDK release"


class RealRialoAdapter(ReactiveContractAdapter):
    """占位 - 等 Rialo SDK 公开后填充真实测试网调用。

    保持接口签名与 Mock 一致, 让业务代码切换实现时零修改。
    """

    async def watch(self, policy_id: str, flight_id: str, condition: Condition) -> ContractRef:
        raise NotImplementedError(_NOT_READY)

    async def fetch_external(self, url: str) -> dict:
        raise NotImplementedError(_NOT_READY)

    async def trigger_claim(self, contract_ref: ContractRef, payload: ClaimPayload) -> TxResult:
        raise NotImplementedError(_NOT_READY)

    async def get_signature(self, tx: TxResult) -> str:
        raise NotImplementedError(_NOT_READY)
```

`backend/contracts/factory.py`:

```python
from backend.config import get_settings
from backend.contracts.base import ReactiveContractAdapter
from backend.contracts.mock_rialo import MockRialoAdapter
from backend.contracts.real_rialo import RealRialoAdapter


def get_contract_adapter() -> ReactiveContractAdapter:
    mode = get_settings().rialo_mode
    if mode == "real":
        return RealRialoAdapter()
    return MockRialoAdapter()
```

### Step 4: 跑看通过

```bash
pytest backend/tests/unit/test_contract_factory.py -v
```

Expected: 3 passed.

### Step 5: Commit

```bash
git add backend/contracts/real_rialo.py backend/contracts/factory.py backend/tests/unit/test_contract_factory.py
git commit -m "$(printf 'feat(contracts): RealRialoAdapter stub + get_contract_adapter factory\n\n- RealRialoAdapter: 全部方法 raise NotImplementedError(\"Awaiting Rialo SDK release\")\n- factory: 按 settings.rialo_mode (\"mock\"|\"real\") 选实现\n- 业务代码 import factory 不依赖具体实现, 实现 spec 中\n  \"业务代码与具体实现解耦\" 要求\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 4: PolicyService - 费率算法 + create_policy

**Files:**
- Create: `backend/policies/__init__.py` (空)
- Create: `backend/policies/service.py`
- Create: `backend/tests/unit/test_policy_service.py`

### Step 1: 写测试

`backend/tests/unit/test_policy_service.py`:

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import InsufficientBalanceError, UserService
from backend.auth.google import GoogleProfile
from backend.contracts.base import Condition, ConditionType
from backend.policies.service import (
    InvalidPremiumError,
    PolicyService,
    payout_multiplier_for_rate,
)
from backend.tests.factories import make_flight


def test_payout_multiplier_high_rate_low_multiplier():
    assert payout_multiplier_for_rate(0.50) == 2.5
    assert payout_multiplier_for_rate(0.40) == 2.5


def test_payout_multiplier_low_rate_high_multiplier():
    assert payout_multiplier_for_rate(0.04) == 8.0
    assert payout_multiplier_for_rate(0.0) == 8.0


def test_payout_multiplier_middle_band():
    # 5% < r < 40% → 线性插值 8 -> 2.5
    m_mid = payout_multiplier_for_rate(0.225)  # 中点
    assert 2.5 < m_mid < 8.0


@pytest.mark.asyncio
async def test_create_policy_charges_premium_and_writes_record(db_session: AsyncSession):
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub="s", email="e@x", name="n", avatar_url=""))
    flight = await make_flight(db_session, callsign="BA178", date="20260614")
    service = PolicyService(db_session)
    policy = await service.create_policy(
        user=user, flight_id=flight.id, premium=10,
        condition=Condition(type=ConditionType.DELAY, threshold_min=30),
        delay_rate=0.0,
    )
    assert policy.premium == 10
    assert policy.payout == 80  # 8x * 10
    assert user.balance == 990


@pytest.mark.asyncio
async def test_create_policy_rejects_invalid_premium_tier(db_session: AsyncSession):
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub="s2", email="e@x", name="n", avatar_url=""))
    flight = await make_flight(db_session, callsign="BA178", date="20260614")
    service = PolicyService(db_session)
    with pytest.raises(InvalidPremiumError):
        await service.create_policy(
            user=user, flight_id=flight.id, premium=7,
            condition=Condition(type=ConditionType.DELAY, threshold_min=30),
            delay_rate=0.1,
        )


@pytest.mark.asyncio
async def test_create_policy_rejects_when_balance_insufficient(db_session: AsyncSession):
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub="s3", email="e@x", name="n", avatar_url=""))
    user.balance = 3
    await db_session.flush()
    flight = await make_flight(db_session, callsign="BA178", date="20260614")
    service = PolicyService(db_session)
    with pytest.raises(InsufficientBalanceError):
        await service.create_policy(
            user=user, flight_id=flight.id, premium=5,
            condition=Condition(type=ConditionType.DELAY, threshold_min=30),
            delay_rate=0.0,
        )
    assert user.balance == 3
```

### Step 2: 跑看 fail

```bash
pytest backend/tests/unit/test_policy_service.py -v
```

Expected: ImportError.

### Step 3: 实现 PolicyService

`backend/policies/__init__.py` 空。

`backend/policies/service.py`:

```python
import json
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import UserService
from backend.contracts.base import Condition
from backend.models import Policy, PolicyStatus, User


ALLOWED_PREMIUMS = (5, 10, 20)


class InvalidPremiumError(Exception):
    pass


def payout_multiplier_for_rate(delay_rate: float) -> float:
    """低延误率 → 高赔付倍率（保险定价直觉：低概率事件赔得多）。

    分段：
    - rate ≤ 0.05         → 8x
    - rate ≥ 0.40         → 2.5x
    - 0.05 < rate < 0.40  → 8x → 2.5x 线性插值
    """
    if delay_rate <= 0.05:
        return 8.0
    if delay_rate >= 0.40:
        return 2.5
    span = 0.40 - 0.05
    progress = (delay_rate - 0.05) / span
    return 8.0 + progress * (2.5 - 8.0)


class PolicyService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_policy(
        self,
        *,
        user: User,
        flight_id: str,
        premium: int,
        condition: Condition,
        delay_rate: float,
    ) -> Policy:
        if premium not in ALLOWED_PREMIUMS:
            raise InvalidPremiumError(
                f"premium must be one of {ALLOWED_PREMIUMS}, got {premium}"
            )
        multiplier = payout_multiplier_for_rate(delay_rate)
        payout = int(round(premium * multiplier))
        # debit 先，因为余额不足要在写入 policy 之前失败
        await UserService(self._session).debit(user, premium)
        policy = Policy(
            user_id=user.id,
            flight_id=flight_id,
            premium=premium,
            payout=payout,
            condition_json=json.dumps({"type": condition.type.value, "threshold_min": condition.threshold_min}),
            status=PolicyStatus.ACTIVE,
        )
        self._session.add(policy)
        await self._session.flush()
        return policy

    async def attach_contract_ref(self, policy: Policy, contract_ref_id: str) -> None:
        policy.contract_ref = contract_ref_id
        await self._session.flush()

    async def get_user_policies(self, user_id: str) -> Sequence[Policy]:
        stmt = (
            select(Policy)
            .where(Policy.user_id == user_id)
            .order_by(Policy.created_at.desc())
        )
        return (await self._session.execute(stmt)).scalars().all()

    async def list_active(self) -> Sequence[Policy]:
        stmt = select(Policy).where(Policy.status == PolicyStatus.ACTIVE)
        return (await self._session.execute(stmt)).scalars().all()

    async def mark_paid(self, policy: Policy) -> None:
        policy.status = PolicyStatus.PAID
        await self._session.flush()
```

### Step 4: 跑看通过 + commit

```bash
pytest backend/tests/unit/test_policy_service.py -v
```

Expected: 6 passed.

```bash
git add backend/policies/__init__.py backend/policies/service.py backend/tests/unit/test_policy_service.py
git commit -m "$(printf 'feat(policies): PolicyService - 费率算法 + 创建保单\n\n- payout_multiplier_for_rate: 低延误率 8x, 高延误率 2.5x, 中间线性\n- create_policy: 校验保费档位 (5/10/20) + 扣款 + 写库\n- attach_contract_ref / mark_paid / list_active / get_user_policies\n- 余额不足显式抛 InsufficientBalanceError (来自 UserService)\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 5: /policies REST endpoints

**Files:**
- Create: `backend/policies/schemas.py`
- Create: `backend/policies/routes.py`
- Modify: `backend/app.py` (装 adapter + policies router)
- Create: `backend/tests/integration/test_policies_routes.py`

### Step 1: 写集成测试

`backend/tests/integration/test_policies_routes.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.db import Base, get_engine
from backend.flights.opensky import FlightState


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake-id.apps.googleusercontent.com")
    monkeypatch.setenv("RIALO_MODE", "mock")
    from backend.config import get_settings
    get_settings.cache_clear()
    import backend.db
    backend.db._engine = None
    backend.db._session_factory = None

    def fake_verify(token: str) -> GoogleProfile | None:
        return GoogleProfile(sub="g-1", email="x@y.com", name="X", avatar_url="") if token == "v" else None

    monkeypatch.setattr(google, "verify_id_token", fake_verify)

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 注入一个航班用于买险
    from backend.tests.factories import make_flight
    from backend.db import get_session_factory
    async with get_session_factory()() as s:
        await make_flight(s, callsign="BA178", date="20260614")
        await s.commit()

    # 灌入 FlightCache 让购买流程有数据
    from backend.app import get_flight_cache
    get_flight_cache().store([
        FlightState(icao24="abc", callsign="BA178", origin_country="UK",
                    longitude=-0.4, latitude=51.4, velocity=240.0, heading=280.0, on_ground=False),
    ])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 登录拿到 cookie
        await client.post("/auth/google", json={"id_token": "v"})
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_create_policy_returns_policy_with_payout(app_client: AsyncClient):
    res = await app_client.post("/policies", json={
        "flight_id": "BA178-20260614",
        "premium": 10,
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["premium"] == 10
    assert body["payout"] > 0
    assert body["status"] == "active"


@pytest.mark.asyncio
async def test_create_policy_invalid_premium_422(app_client: AsyncClient):
    res = await app_client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 7})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_policy_insufficient_balance_402(app_client: AsyncClient):
    # 连续 100 次买 20 RIA, 必然把 1000 RIA 余额烧光 → 最后 1 次 402
    last_status = 0
    for _ in range(60):
        res = await app_client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 20})
        last_status = res.status_code
        if last_status == 402:
            break
    assert last_status == 402


@pytest.mark.asyncio
async def test_get_policies_returns_user_policies(app_client: AsyncClient):
    await app_client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 5})
    res = await app_client.get("/policies")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    assert items[0]["flight_id"] == "BA178-20260614"


@pytest.mark.asyncio
async def test_create_policy_requires_auth():
    # 单独搞一个未登录 client
    pass  # 已被 test_me_without_cookie_returns_401 间接覆盖（同一 dependency）
```

### Step 2: 跑看 fail

```bash
pytest backend/tests/integration/test_policies_routes.py -v
```

Expected: 404 / ImportError.

### Step 3: 实现 schemas.py + routes.py

`backend/policies/schemas.py`:

```python
from pydantic import BaseModel, Field

from backend.policies.service import ALLOWED_PREMIUMS


class CreatePolicyRequest(BaseModel):
    flight_id: str
    premium: int = Field(..., description="保费档位")

    def model_post_init(self, __context) -> None:
        if self.premium not in ALLOWED_PREMIUMS:
            from pydantic import ValidationError
            raise ValueError(f"premium must be one of {ALLOWED_PREMIUMS}")


class PolicyPublic(BaseModel):
    id: str
    flight_id: str
    premium: int
    payout: int
    status: str
    contract_ref: str
    created_at: int
```

`backend/policies/routes.py`:

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import CurrentUser
from backend.auth.service import InsufficientBalanceError
from backend.contracts.base import Condition, ConditionType
from backend.db import get_session
from backend.flights.service import FlightService
from backend.policies.schemas import CreatePolicyRequest, PolicyPublic
from backend.policies.service import InvalidPremiumError, PolicyService

router = APIRouter()


@router.post("/policies", response_model=PolicyPublic, status_code=status.HTTP_201_CREATED)
async def create_policy(
    body: CreatePolicyRequest,
    request: Request,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PolicyPublic:
    # 查 flight 存在 + 延误率
    flight = await FlightService(session).get_flight(body.flight_id)
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="flight unknown")
    stats = await FlightService(session).delay_stats(callsign=flight.callsign)
    condition = Condition(type=ConditionType.DELAY, threshold_min=30)
    try:
        policy = await PolicyService(session).create_policy(
            user=user, flight_id=flight.id, premium=body.premium,
            condition=condition, delay_rate=stats.delay_rate,
        )
    except InvalidPremiumError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except InsufficientBalanceError as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))
    # 触发 adapter.watch
    adapter = request.app.state.contract_adapter
    ref = await adapter.watch(policy_id=policy.id, flight_id=flight.id, condition=condition)
    await PolicyService(session).attach_contract_ref(policy, ref.id)
    await session.commit()
    return PolicyPublic(
        id=policy.id, flight_id=policy.flight_id, premium=policy.premium,
        payout=policy.payout, status=policy.status.value,
        contract_ref=policy.contract_ref, created_at=policy.created_at,
    )


@router.get("/policies", response_model=list[PolicyPublic])
async def list_policies(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[PolicyPublic]:
    policies = await PolicyService(session).get_user_policies(user.id)
    return [
        PolicyPublic(
            id=p.id, flight_id=p.flight_id, premium=p.premium,
            payout=p.payout, status=p.status.value,
            contract_ref=p.contract_ref, created_at=p.created_at,
        )
        for p in policies
    ]
```

### Step 4: 改 `backend/app.py` 装 adapter + 装 policies router

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.auth.routes import router as auth_router
from backend.contracts.factory import get_contract_adapter
from backend.contracts.mock_rialo import MockRialoAdapter
from backend.db import init_db
from backend.flights.cache import FlightCache
from backend.flights.opensky import OpenSkyClient
from backend.flights.routes import router as flights_router
from backend.policies.routes import router as policies_router


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
    adapter = get_contract_adapter()
    app.state.flight_cache = _flight_cache_singleton
    app.state.opensky = _opensky_singleton
    app.state.contract_adapter = adapter
    try:
        yield
    finally:
        if _opensky_singleton is not None:
            await _opensky_singleton.aclose()
        if isinstance(adapter, MockRialoAdapter):
            await adapter.aclose()


def create_app() -> FastAPI:
    app = FastAPI(title="rialo-captain", version="0.2.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # 初始化 app.state（保证 routes 中 request.app.state 总有这些字段）
    app.state.flight_cache = _flight_cache_singleton
    app.state.contract_adapter = get_contract_adapter()

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "rialo-captain"}

    app.include_router(auth_router)
    app.include_router(flights_router)
    app.include_router(policies_router)
    return app


app = create_app()
```

### Step 5: 跑全测 + commit

```bash
pytest backend/tests -v
```

Expected: 29 + Task 1-4 新测试 + Task 5 新测试 全绿。

```bash
git add backend/policies/schemas.py backend/policies/routes.py backend/app.py backend/tests/integration/test_policies_routes.py
git commit -m "$(printf 'feat(policies): POST /policies + GET /policies + lifespan 装 adapter\n\n- POST /policies: 校验 flight 存在 + 计算 delay_rate + 走 PolicyService\n  + 调 adapter.watch 拿 contract_ref 并写库\n- GET /policies: 当前 user 的全部 policy, created_at desc\n- 422 (premium 档位错) / 402 (余额不足) / 404 (flight 不存在) 三态错误码\n- app.state.contract_adapter 来自 factory, lifespan 内 aclose 清理 Mock\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 6: Claim 签名生成 + ClaimsService

**Files:**
- Create: `backend/claims/__init__.py` (空)
- Create: `backend/claims/signature.py`
- Create: `backend/claims/service.py`
- Create: `backend/tests/unit/test_signature.py`
- Create: `backend/tests/unit/test_claims_service.py`

### Step 1: 写签名测试

`backend/tests/unit/test_signature.py`:

```python
from backend.claims.signature import build_signature


def test_signature_format_is_0x_prefixed_64_hex():
    sig = build_signature(policy_id="p1", timestamp=1700000000, nonce=42)
    assert sig.startswith("0x")
    assert len(sig) == 66
    assert all(c in "0123456789abcdef" for c in sig[2:])


def test_signature_is_deterministic():
    a = build_signature(policy_id="p1", timestamp=1700000000, nonce=42)
    b = build_signature(policy_id="p1", timestamp=1700000000, nonce=42)
    assert a == b


def test_signature_changes_with_inputs():
    a = build_signature(policy_id="p1", timestamp=1700000000, nonce=42)
    b = build_signature(policy_id="p2", timestamp=1700000000, nonce=42)
    c = build_signature(policy_id="p1", timestamp=1700000001, nonce=42)
    d = build_signature(policy_id="p1", timestamp=1700000000, nonce=43)
    assert len({a, b, c, d}) == 4
```

### Step 2: 写 ClaimsService 测试

`backend/tests/unit/test_claims_service.py`:

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import UserService
from backend.auth.google import GoogleProfile
from backend.claims.service import ClaimsService
from backend.models import Policy, PolicyStatus
from backend.tests.factories import make_flight


@pytest.mark.asyncio
async def test_create_claim_credits_user_and_marks_policy_paid(db_session: AsyncSession):
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub="s", email="e@x", name="n", avatar_url=""))
    flight = await make_flight(db_session, callsign="BA178", date="20260614")
    policy = Policy(
        user_id=user.id, flight_id=flight.id, premium=10, payout=80,
        condition_json="{}", status=PolicyStatus.ACTIVE,
    )
    db_session.add(policy)
    await db_session.flush()
    initial_balance = user.balance

    service = ClaimsService(db_session)
    claim = await service.create_claim(
        policy=policy, payout=policy.payout, delay_minutes=45,
        signature="0x" + "a" * 64, settle_duration_ms=1234,
    )
    assert claim.payout == 80
    assert claim.signature.startswith("0x")
    assert claim.settle_duration_ms == 1234
    assert user.balance == initial_balance + 80
    assert policy.status == PolicyStatus.PAID


@pytest.mark.asyncio
async def test_recent_claims_returns_in_settled_desc(db_session: AsyncSession):
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub="s2", email="e@x", name="n", avatar_url=""))
    flight = await make_flight(db_session, callsign="BA178", date="20260614")

    service = ClaimsService(db_session)
    for i in range(3):
        policy = Policy(
            user_id=user.id, flight_id=flight.id, premium=10, payout=20,
            condition_json="{}", status=PolicyStatus.ACTIVE,
        )
        db_session.add(policy)
        await db_session.flush()
        await service.create_claim(
            policy=policy, payout=20, delay_minutes=30 + i,
            signature=f"0x{'a' * 63}{i}", settle_duration_ms=100 + i,
        )

    items = await service.recent(limit=10)
    assert len(items) == 3
    # 默认按 settled_at desc, 但内存时间一致, 退化为按 id 比也可以
```

### Step 3: 跑看 fail

```bash
pytest backend/tests/unit/test_signature.py backend/tests/unit/test_claims_service.py -v
```

Expected: ImportError.

### Step 4: 实现 signature.py + service.py

`backend/claims/__init__.py` 空。

`backend/claims/signature.py`:

```python
import hashlib


def build_signature(*, policy_id: str, timestamp: int, nonce: int) -> str:
    """生成 0x... 64-hex 风格签名 - mock 链上签名展示用，前端不区分真假签名。"""
    material = f"{policy_id}|{timestamp}|{nonce}".encode()
    return "0x" + hashlib.sha256(material).hexdigest()
```

`backend/claims/service.py`:

```python
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import UserService
from backend.models import Claim, Policy, PolicyStatus, User


class ClaimsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_claim(
        self,
        *,
        policy: Policy,
        payout: int,
        delay_minutes: int,
        signature: str,
        settle_duration_ms: int,
    ) -> Claim:
        # 给用户加余额
        user = (await self._session.execute(
            select(User).where(User.id == policy.user_id)
        )).scalar_one()
        await UserService(self._session).credit(user, payout)
        # 写 claim
        claim = Claim(
            policy_id=policy.id,
            payout=payout,
            delay_minutes=delay_minutes,
            signature=signature,
            settle_duration_ms=settle_duration_ms,
        )
        self._session.add(claim)
        # policy 转 paid
        policy.status = PolicyStatus.PAID
        await self._session.flush()
        return claim

    async def recent(self, limit: int = 50) -> Sequence[Claim]:
        stmt = (
            select(Claim)
            .order_by(Claim.settled_at.desc(), Claim.id.desc())
            .limit(limit)
        )
        return (await self._session.execute(stmt)).scalars().all()
```

### Step 5: 跑测试看通过 + commit

```bash
pytest backend/tests/unit/test_signature.py backend/tests/unit/test_claims_service.py -v
```

Expected: 6 passed.

```bash
git add backend/claims/__init__.py backend/claims/signature.py backend/claims/service.py backend/tests/unit/test_signature.py backend/tests/unit/test_claims_service.py
git commit -m "$(printf 'feat(claims): build_signature + ClaimsService - 自动赔付落地\n\n- build_signature: sha256(policy_id|ts|nonce) -> 0x...64hex, 确定性\n- ClaimsService.create_claim: credit user + 写 claim 表 + policy → paid\n- ClaimsService.recent: settled_at desc, 用于 /claims/recent\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 7: ClaimEngine - asyncio 后台监控循环

**Files:**
- Create: `backend/claims/engine.py`
- Create: `backend/tests/unit/test_claim_engine.py`

### Step 1: 写测试

`backend/tests/unit/test_claim_engine.py`:

```python
import json

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import UserService
from backend.auth.google import GoogleProfile
from backend.claims.engine import ClaimEngine
from backend.contracts.base import (
    ClaimPayload,
    Condition,
    ConditionType,
    ContractRef,
    ReactiveContractAdapter,
    TxResult,
)
from backend.db import get_session_factory
from backend.models import FailedTrigger, Policy, PolicyStatus
from backend.tests.factories import make_flight


class FakeAdapter(ReactiveContractAdapter):
    def __init__(self, *, observation: dict | None = None, raise_on_fetch: Exception | None = None):
        self._observation = observation or {}
        self._raise_on_fetch = raise_on_fetch
        self.trigger_calls: list[tuple[ContractRef, ClaimPayload]] = []

    async def watch(self, policy_id, flight_id, condition):
        return ContractRef(id=f"mock-{policy_id}", mode="mock")

    async def fetch_external(self, url: str) -> dict:
        if self._raise_on_fetch is not None:
            raise self._raise_on_fetch
        return dict(self._observation)

    async def trigger_claim(self, contract_ref, payload):
        self.trigger_calls.append((contract_ref, payload))
        return TxResult(signature="0x" + "f" * 64, settle_duration_ms=42)

    async def get_signature(self, tx):
        return tx.signature


def _now() -> int:
    return 1_700_000_000


async def _seed_policy(db_session, callsign: str = "BA178") -> Policy:
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub=f"s-{callsign}", email="e@x", name="n", avatar_url=""))
    flight = await make_flight(db_session, callsign=callsign, date="20260614")
    policy = Policy(
        user_id=user.id, flight_id=flight.id, premium=10, payout=80,
        condition_json=json.dumps({"type": "delay", "threshold_min": 30}),
        status=PolicyStatus.ACTIVE,
        contract_ref=f"mock-seed-{callsign}",
    )
    db_session.add(policy)
    await db_session.flush()
    return policy


@pytest.mark.asyncio
async def test_run_once_triggers_claim_when_delay_exceeds_threshold(db_session: AsyncSession):
    policy = await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45})
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=get_session_factory(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_once()

    assert summary.triggered == 1
    assert summary.failed == 0
    assert summary.checked == 1
    assert len(adapter.trigger_calls) == 1


@pytest.mark.asyncio
async def test_run_once_no_trigger_when_below_threshold(db_session: AsyncSession):
    await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 5})
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=get_session_factory(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )
    summary = await engine.run_once()
    assert summary.triggered == 0
    assert summary.checked == 1
    assert adapter.trigger_calls == []


@pytest.mark.asyncio
async def test_run_once_isolates_single_failure(db_session: AsyncSession):
    await _seed_policy(db_session, callsign="BA178")
    await _seed_policy(db_session, callsign="DL101")
    await _seed_policy(db_session, callsign="UA200")
    await db_session.commit()

    class FlakyAdapter(FakeAdapter):
        def __init__(self):
            super().__init__(observation={"delay_minutes": 45})

        async def fetch_external(self, url: str) -> dict:
            if "DL101" in url:
                raise RuntimeError("boom")
            return await super().fetch_external(url)

    adapter = FlakyAdapter()
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=get_session_factory(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_once()
    assert summary.checked == 3
    assert summary.triggered == 2
    assert summary.failed == 1
    # DL101 入 failed_triggers
    from sqlalchemy import select
    failed = (await db_session.execute(select(FailedTrigger))).scalars().all()
    assert any("boom" in f.error_text for f in failed)
```

### Step 2: 跑看 fail

```bash
pytest backend/tests/unit/test_claim_engine.py -v
```

Expected: ImportError.

### Step 3: 实现 ClaimEngine

`backend/claims/engine.py`:

```python
import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Awaitable, Callable

from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.claims.service import ClaimsService
from backend.claims.signature import build_signature
from backend.contracts.base import (
    ClaimPayload,
    Condition,
    ConditionType,
    ContractRef,
    ReactiveContractAdapter,
)
from backend.models import FailedTrigger, Policy, PolicyStatus

logger = logging.getLogger(__name__)


@dataclass
class RunSummary:
    checked: int = 0
    triggered: int = 0
    failed: int = 0


def default_observe_url(flight_id: str) -> str:
    # Plan 2 默认走 OpenSky 单航班 state；URL 仅为演示用，MockAdapter 会被注入 mock observation
    return f"https://opensky-network.org/api/states/all?icao24=&_q={flight_id}"


class ClaimEngine:
    def __init__(
        self,
        *,
        adapter: ReactiveContractAdapter,
        session_factory: async_sessionmaker,
        observe_url: Callable[[str], str] = default_observe_url,
        now: Callable[[], int] = None,
        interval_seconds: int = 30,
    ) -> None:
        import time
        self._adapter = adapter
        self._session_factory = session_factory
        self._observe_url = observe_url
        self._now = now or (lambda: int(time.time()))
        self._interval = interval_seconds
        self._stop_event = asyncio.Event()

    async def run_once(self) -> RunSummary:
        summary = RunSummary()
        # 拿所有 active policies
        from sqlalchemy import select
        async with self._session_factory() as session:
            stmt = select(Policy).where(Policy.status == PolicyStatus.ACTIVE)
            policies = (await session.execute(stmt)).scalars().all()
        for policy in policies:
            summary.checked += 1
            try:
                await self._process(policy)
                # 重新查 policy 状态判断是否真触发
                async with self._session_factory() as s2:
                    fresh = await s2.get(Policy, policy.id)
                    if fresh is not None and fresh.status == PolicyStatus.PAID:
                        summary.triggered += 1
            except Exception as exc:
                summary.failed += 1
                logger.exception("ClaimEngine trigger failed: policy=%s", policy.id)
                async with self._session_factory() as session:
                    session.add(FailedTrigger(policy_id=policy.id, error_text=str(exc)))
                    await session.commit()
        return summary

    async def _process(self, policy: Policy) -> None:
        condition = self._parse_condition(policy.condition_json)
        observation = await self._adapter.fetch_external(self._observe_url(policy.flight_id))
        if not condition.is_triggered(observation):
            return
        contract_ref = ContractRef(id=policy.contract_ref or f"mock-{policy.id}", mode="mock")
        payload = ClaimPayload(
            delay_minutes=int(observation.get("delay_minutes", 0)),
            observed_at=self._now(),
        )
        tx = await self._adapter.trigger_claim(contract_ref, payload)
        signature = await self._adapter.get_signature(tx)
        if not signature:
            signature = build_signature(policy_id=policy.id, timestamp=self._now(), nonce=0)
        # 落库赔付 - 单独的 session, 自己提交
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

    @staticmethod
    def _parse_condition(json_text: str) -> Condition:
        data = json.loads(json_text or "{}")
        return Condition(
            type=ConditionType(data.get("type", "delay")),
            threshold_min=int(data.get("threshold_min", 30)),
        )

    async def run_forever(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self.run_once()
            except Exception:
                logger.exception("ClaimEngine.run_once outer error")
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                continue

    def stop(self) -> None:
        self._stop_event.set()
```

### Step 4: 跑看通过 + commit

```bash
pytest backend/tests/unit/test_claim_engine.py -v
```

Expected: 3 passed.

```bash
git add backend/claims/engine.py backend/tests/unit/test_claim_engine.py
git commit -m "$(printf 'feat(claims): ClaimEngine - asyncio 后台监控循环\n\n- run_once: 扫所有 active policy, 调 adapter.fetch_external + condition.is_triggered\n  + adapter.trigger_claim, 入库 claim + credit user + policy -> paid\n- run_forever: stop_event 控制的循环, 默认 30s 间隔\n- 单 policy 失败入 failed_triggers, 不阻塞其它 policy\n- 每个 policy 自己一个 session, 避免长事务\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 8: ClaimEngine 集成到 app + /claims/recent endpoint

**Files:**
- Create: `backend/claims/routes.py`
- Modify: `backend/app.py` (启动 ClaimEngine task + 装 claims router)
- Create: `backend/tests/integration/test_claims_routes.py`

### Step 1: 写测试

`backend/tests/integration/test_claims_routes.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.db import Base, get_engine, get_session_factory
from backend.models import Claim, Policy, PolicyStatus
from backend.tests.factories import make_flight, make_user


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake.apps.googleusercontent.com")
    monkeypatch.setenv("RIALO_MODE", "mock")
    # 关掉自动 ClaimEngine 后台循环, 防止干扰 (本测专测端点)
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

    # 灌入一笔已赔付的 claim
    async with get_session_factory()() as s:
        user = await make_user(s, email="x@y.com")
        flight = await make_flight(s, callsign="BA178", date="20260614")
        policy = Policy(
            user_id=user.id, flight_id=flight.id, premium=10, payout=80,
            condition_json="{}", status=PolicyStatus.PAID,
        )
        s.add(policy)
        await s.flush()
        s.add(Claim(
            policy_id=policy.id, payout=80, delay_minutes=45,
            signature="0x" + "a" * 64, settle_duration_ms=900,
        ))
        await s.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/auth/google", json={"id_token": "v"})
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_claims_recent_returns_paid_claims(app_client: AsyncClient):
    res = await app_client.get("/claims/recent")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    item = items[0]
    assert item["payout"] == 80
    assert item["delay_minutes"] == 45
    assert item["signature"].startswith("0x")
    assert item["settle_duration_ms"] == 900
```

### Step 2: 跑看 fail

```bash
pytest backend/tests/integration/test_claims_routes.py -v
```

Expected: 404 / ImportError.

### Step 3: 实现 routes.py + app.py 集成

`backend/claims/routes.py`:

```python
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.claims.service import ClaimsService
from backend.db import get_session

router = APIRouter()


class ClaimPublic(BaseModel):
    id: str
    policy_id: str
    payout: int
    delay_minutes: int
    signature: str
    settled_at: int
    settle_duration_ms: int


@router.get("/claims/recent", response_model=list[ClaimPublic])
async def claims_recent(
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = Query(50, ge=1, le=200),
) -> list[ClaimPublic]:
    items = await ClaimsService(session).recent(limit=limit)
    return [
        ClaimPublic(
            id=c.id, policy_id=c.policy_id, payout=c.payout,
            delay_minutes=c.delay_minutes, signature=c.signature,
            settled_at=c.settled_at, settle_duration_ms=c.settle_duration_ms,
        )
        for c in items
    ]
```

修改 `backend/app.py`（在原基础上加 ClaimEngine 集成）：

```python
import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.auth.routes import router as auth_router
from backend.claims.engine import ClaimEngine
from backend.claims.routes import router as claims_router
from backend.contracts.factory import get_contract_adapter
from backend.contracts.mock_rialo import MockRialoAdapter
from backend.db import get_session_factory, init_db
from backend.flights.cache import FlightCache
from backend.flights.opensky import OpenSkyClient
from backend.flights.routes import router as flights_router
from backend.policies.routes import router as policies_router


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
    adapter = get_contract_adapter()
    engine = ClaimEngine(adapter=adapter, session_factory=get_session_factory())

    app.state.flight_cache = _flight_cache_singleton
    app.state.opensky = _opensky_singleton
    app.state.contract_adapter = adapter
    app.state.claim_engine = engine

    engine_task: asyncio.Task | None = None
    if os.environ.get("CLAIM_ENGINE_ENABLED", "true").lower() != "false":
        engine_task = asyncio.create_task(engine.run_forever())

    try:
        yield
    finally:
        engine.stop()
        if engine_task is not None:
            engine_task.cancel()
            try:
                await engine_task
            except asyncio.CancelledError:
                pass
        if _opensky_singleton is not None:
            await _opensky_singleton.aclose()
        if isinstance(adapter, MockRialoAdapter):
            await adapter.aclose()


def create_app() -> FastAPI:
    app = FastAPI(title="rialo-captain", version="0.2.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.flight_cache = _flight_cache_singleton
    app.state.contract_adapter = get_contract_adapter()

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "rialo-captain"}

    app.include_router(auth_router)
    app.include_router(flights_router)
    app.include_router(policies_router)
    app.include_router(claims_router)
    return app


app = create_app()
```

### Step 4: 跑测试 + commit

```bash
pytest backend/tests -v
```

Expected: 全绿（含 claims routes）。

```bash
git add backend/claims/routes.py backend/app.py backend/tests/integration/test_claims_routes.py
git commit -m "$(printf 'feat(claims): GET /claims/recent + ClaimEngine 装 app lifespan\n\n- /claims/recent: 默认 50 条, 上限 200, settled_at desc\n- ClaimEngine 作为 asyncio.Task 在 lifespan 启动, stop() + cancel() 清理\n- CLAIM_ENGINE_ENABLED=false 用于测试场景关闭后台循环\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 9: /admin/inject-delay 端点（演示用）

**Files:**
- Create: `backend/admin/__init__.py` (空)
- Create: `backend/admin/deps.py`
- Create: `backend/admin/routes.py`
- Modify: `backend/app.py` (装 admin router)
- Create: `backend/tests/integration/test_admin_routes.py`

### Step 1: 写测试

`backend/tests/integration/test_admin_routes.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import create_app
from backend.db import Base, get_engine, get_session_factory
from backend.tests.factories import make_flight


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("ADMIN_TOKEN", "secret-admin")
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

    async with get_session_factory()() as s:
        await make_flight(s, callsign="BA178", date="20260614")
        await s.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_inject_delay_requires_admin_token(app_client: AsyncClient):
    res = await app_client.post("/admin/inject-delay",
                                json={"flight_id": "BA178-20260614", "delay_minutes": 45})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_inject_delay_with_token_succeeds(app_client: AsyncClient):
    res = await app_client.post(
        "/admin/inject-delay",
        json={"flight_id": "BA178-20260614", "delay_minutes": 45},
        headers={"X-Admin-Token": "secret-admin"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["flight_id"] == "BA178-20260614"
    assert body["delay_minutes"] == 45


@pytest.mark.asyncio
async def test_inject_delay_unknown_flight_returns_404(app_client: AsyncClient):
    res = await app_client.post(
        "/admin/inject-delay",
        json={"flight_id": "ZZ999-20260614", "delay_minutes": 45},
        headers={"X-Admin-Token": "secret-admin"},
    )
    assert res.status_code == 404
```

### Step 2: 跑看 fail

```bash
pytest backend/tests/integration/test_admin_routes.py -v
```

Expected: 404 / ImportError.

### Step 3: 实现 admin

`backend/admin/__init__.py` 空。

`backend/admin/deps.py`:

```python
from typing import Annotated

from fastapi import Header, HTTPException, status

from backend.config import get_settings


def admin_required(x_admin_token: Annotated[str | None, Header()] = None) -> None:
    expected = get_settings().admin_token
    if not x_admin_token or x_admin_token != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
```

`backend/admin/routes.py`:

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.admin.deps import admin_required
from backend.db import get_session
from backend.flights.service import FlightService

router = APIRouter()


class InjectDelayRequest(BaseModel):
    flight_id: str
    delay_minutes: int


class InjectDelayResponse(BaseModel):
    flight_id: str
    delay_minutes: int


# 演示用的全局延误注入表 - ClaimEngine 跑时通过 MockRialoAdapter override 走这张表
_DELAY_OVERRIDES: dict[str, int] = {}


def get_injected_delay(flight_id: str) -> int | None:
    return _DELAY_OVERRIDES.get(flight_id)


def clear_injected_delays() -> None:
    _DELAY_OVERRIDES.clear()


@router.post("/admin/inject-delay", response_model=InjectDelayResponse,
             dependencies=[Depends(admin_required)])
async def inject_delay(
    body: InjectDelayRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InjectDelayResponse:
    flight = await FlightService(session).get_flight(body.flight_id)
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="flight unknown")
    _DELAY_OVERRIDES[body.flight_id] = body.delay_minutes
    return InjectDelayResponse(flight_id=body.flight_id, delay_minutes=body.delay_minutes)
```

### Step 4: 修 `backend/contracts/mock_rialo.py` 集成延误注入

在 `MockRialoAdapter.fetch_external` 中检查 `_DELAY_OVERRIDES`：

修改 `backend/contracts/mock_rialo.py` 的 `fetch_external` 方法：

```python
    async def fetch_external(self, url: str) -> dict:
        # 演示 hook: 检查是否有 admin 注入的延误
        from backend.admin.routes import get_injected_delay
        for flight_id, delay in [(fid, get_injected_delay(fid)) for fid in self._watched_flight_ids()]:
            if delay is not None and flight_id in url:
                return {"delay_minutes": delay, "source": "admin-injection"}
        resp = await self._client.get(url)
        resp.raise_for_status()
        return resp.json()

    def _watched_flight_ids(self) -> list[str]:
        return [fid for fid, _ in self._watched.values()]
```

但更干净的设计：让 ClaimEngine 在 `_process` 中**直接检查 admin 注入**，绕过 adapter。修改 `backend/claims/engine.py` 的 `_process`：

```python
    async def _process(self, policy: Policy) -> None:
        from backend.admin.routes import get_injected_delay
        condition = self._parse_condition(policy.condition_json)
        injected = get_injected_delay(policy.flight_id)
        if injected is not None:
            observation = {"delay_minutes": injected, "source": "admin-injection"}
        else:
            observation = await self._adapter.fetch_external(self._observe_url(policy.flight_id))
        if not condition.is_triggered(observation):
            return
        # ...剩余代码不变
```

**选用 ClaimEngine 直接检查（更干净）**。修改 `backend/claims/engine.py` 而不是 mock_rialo.py，重新跑测试。

### Step 5: 把 admin router 装到 app

修改 `backend/app.py`，在 `create_app()` 加：

```python
from backend.admin.routes import router as admin_router
# ...
    app.include_router(admin_router)
```

### Step 6: 跑测试 + commit

```bash
pytest backend/tests/integration/test_admin_routes.py -v
pytest backend/tests -v
```

Expected: 全绿。

```bash
git add backend/admin/ backend/claims/engine.py backend/app.py backend/tests/integration/test_admin_routes.py
git commit -m "$(printf 'feat(admin): POST /admin/inject-delay - 演示用延误注入\n\n- X-Admin-Token header 校验 (settings.admin_token)\n- 注入后 ClaimEngine._process 优先使用 _DELAY_OVERRIDES 而非真 API\n- 404 unknown flight / 403 unauthorized 两态\n- 用于现场演示反应式赔付链路, 不通过真延误等待\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task 10: 端到端反应式赔付集成测试 + Plan 2 收尾

**Files:**
- Create: `backend/tests/integration/test_reactive_e2e.py`
- Modify: `README.md` (更新 Plan 2 状态)

### Step 1: 写端到端测试

`backend/tests/integration/test_reactive_e2e.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.db import Base, get_engine, get_session_factory
from backend.flights.opensky import FlightState
from backend.tests.factories import make_flight


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "e2e.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake.apps.googleusercontent.com")
    monkeypatch.setenv("ADMIN_TOKEN", "admin-x")
    monkeypatch.setenv("RIALO_MODE", "mock")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")  # 手动 run_once
    from backend.config import get_settings
    get_settings.cache_clear()
    import backend.db
    backend.db._engine = None
    backend.db._session_factory = None

    monkeypatch.setattr(google, "verify_id_token",
        lambda t: GoogleProfile(sub="g-e2e", email="captain@x.com", name="Captain", avatar_url="") if t == "v" else None)

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with get_session_factory()() as s:
        await make_flight(s, callsign="BA178", date="20260614")
        await s.commit()

    from backend.app import get_flight_cache
    get_flight_cache().store([
        FlightState(icao24="abc", callsign="BA178", origin_country="UK",
                    longitude=0.0, latitude=51.4, velocity=240.0, heading=280.0, on_ground=False),
    ])

    # 清理 admin 注入表防止跨测试污染
    from backend.admin.routes import clear_injected_delays
    clear_injected_delays()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, app

    await engine.dispose()


@pytest.mark.asyncio
async def test_reactive_pipeline_buy_inject_settle(app_client):
    client, app = app_client

    # 1. 登录
    me = await client.post("/auth/google", json={"id_token": "v"})
    assert me.status_code == 200
    initial_balance = me.json()["balance"]
    assert initial_balance == 1000

    # 2. 买险
    buy = await client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 10})
    assert buy.status_code == 201, buy.text
    policy = buy.json()
    assert policy["payout"] > 0
    assert policy["contract_ref"].startswith("mock-")

    # 余额扣 10
    me2 = await client.get("/me")
    assert me2.json()["balance"] == 990

    # 3. admin 注入延误
    inject = await client.post(
        "/admin/inject-delay",
        json={"flight_id": "BA178-20260614", "delay_minutes": 45},
        headers={"X-Admin-Token": "admin-x"},
    )
    assert inject.status_code == 200

    # 4. 手动跑一次 ClaimEngine
    engine = app.state.claim_engine
    summary = await engine.run_once()
    assert summary.triggered == 1

    # 5. 余额已加回 payout
    me3 = await client.get("/me")
    assert me3.json()["balance"] == 990 + policy["payout"]

    # 6. /claims/recent 看到这条赔付
    claims = await client.get("/claims/recent")
    items = claims.json()
    assert len(items) >= 1
    settled = items[0]
    assert settled["payout"] == policy["payout"]
    assert settled["delay_minutes"] == 45
    assert settled["signature"].startswith("0x")

    # 7. 我的保单已 paid
    mine = await client.get("/policies")
    assert mine.json()[0]["status"] == "paid"
```

### Step 2: 跑测试

```bash
pytest backend/tests/integration/test_reactive_e2e.py -v
```

Expected: 1 passed。

### Step 3: 跑全测

```bash
pytest backend/tests -v
```

Expected: 全部 Plan 1 (29) + Plan 2 全部新增测试 全绿。

### Step 4: 更新 README

修改 `README.md` 中的 "项目状态" 章节：

```markdown
## 项目状态

- [x] **Plan 1 · Foundation**
- [x] **Plan 2 · Reactive Insurance Core** ← 当前
- [ ] Plan 3 · Live Dashboard
```

如果有空间，加一节 "Demo: 反应式赔付"：

````markdown
### Demo: 反应式赔付

```bash
# 启动
./scripts/dev.sh

# 1. 浏览器登录, 在 /policies 买一份险 (或 curl)
curl -X POST http://localhost:8000/policies \
  -H "Content-Type: application/json" \
  -b "rialo_session=YOUR_JWT" \
  -d '{"flight_id":"<某 callsign>-<YYYYMMDD>","premium":10}'

# 2. admin 注入延误
curl -X POST http://localhost:8000/admin/inject-delay \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -d '{"flight_id":"<同上>","delay_minutes":45}'

# 3. 等 30s, ClaimEngine 跑一轮, 余额自动加 payout
curl http://localhost:8000/claims/recent
```
````

### Step 5: Self-review checklist

走查（每项确认）：
- OpenSpec reactive-insurance-core 4 个 requirement, 11 个 scenario, 都有 task 覆盖
  - Adapter Protocol → Task 1
  - Mock/Real factory → Task 3
  - Reactive 自动赔付循环 → Task 7, 10
  - 单 policy 失败不影响其它 → Task 7 test_run_once_isolates_single_failure
  - 延误险产品 + 保费档位 → Task 4, 5
  - 模拟链上签名 → Task 6, 10
  - Admin 注入 → Task 9, 10
- 无 TBD / TODO / 占位词
- 类型/方法名前后一致: `Condition` / `ContractRef` / `ClaimPayload` / `TxResult` / `PolicyService.create_policy` / `ClaimsService.create_claim` / `ClaimEngine.run_once` 通篇一致
- 所有代码块完整可粘贴
- commit 命令清晰指定路径

### Step 6: Final commit

```bash
git add backend/tests/integration/test_reactive_e2e.py README.md
git commit -m "$(printf 'feat: Plan 2 收尾 - 反应式赔付端到端测试 + README 更新\n\n- test_reactive_e2e: 登录 -> 买险 -> admin 注入延误 -> run_once -> 余额加payout\n  -> /claims/recent 可见 -> 我的保单 paid, 整链路验证\n- README 标记 Plan 2 完成, 加入 Demo 反应式赔付片段\n\nPlan 2 完成. 下一步: superpowers:writing-plans 写 Plan 3 (Live Dashboard)\n或验收当前实现.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Plan 2 验收

完成 Task 1-10 后，下列断言全部为真：

1. `pytest backend/tests -v` → 全绿 (29 + Plan 2 新增 >= 25 个测试)
2. ReactiveContractAdapter Protocol 在 `backend/contracts/base.py`，**所有业务代码（PolicyService / ClaimEngine / routes）只 import `from backend.contracts.base import ...` 或 `from backend.contracts.factory import ...`，不直接 import `MockRialoAdapter` / `RealRialoAdapter`**
3. `RIALO_MODE=real` 启动会在第一次 adapter 方法调用时抛 `NotImplementedError("Awaiting Rialo SDK release")`
4. 端到端测试通过 = 用户能完成"买险 → 注入延误 → 自动赔付"全链路
5. Claims 表有签名字段、settle_duration_ms 字段
6. 单 policy 触发失败入 `failed_triggers` 表，不阻塞其它 policy

## 下一步 (Plan 2 完成后)

- **手动验收**: `./scripts/dev.sh`，浏览器登录 → curl 买险 → curl 注入延误 → curl /claims/recent 看到自动赔付
- **Plan 3 · Live Dashboard**: 用 `superpowers:writing-plans` 起草，需要先确认：
  - Mapbox vs MapLibre 最终选型（涉及 token 申请）
  - 6 页 UI 的 v0 视觉草稿（先做哪一页）
  - WebSocket 协议：state_update / FLARE / toast 的具体 frame 结构

