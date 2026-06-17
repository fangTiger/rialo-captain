import asyncio
import hashlib
import json
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import select
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
from backend.models import FailedTrigger, Flight, Policy, PolicyStatus
from backend.ws.broadcaster import EventType

logger = logging.getLogger(__name__)


@dataclass
class RunSummary:
    checked: int = 0
    triggered: int = 0
    failed: int = 0


class ClaimBroadcaster(Protocol):
    async def broadcast(self, message: dict) -> None: ...

    async def send_to_user(self, user_id: str, message: dict) -> None: ...


def default_observe_url(flight_id: str) -> str:
    return f"https://opensky-network.org/api/states/all?icao24=&_q={flight_id}"


class ClaimEngine:
    def __init__(
        self,
        *,
        adapter: ReactiveContractAdapter,
        session_factory: async_sessionmaker,
        observe_url: Callable[[str], str] = default_observe_url,
        now: Callable[[], int] | None = None,
        interval_seconds: int = 30,
        broadcaster: ClaimBroadcaster | None = None,
        external_observation_enabled: bool = True,
    ) -> None:
        self._adapter = adapter
        self._session_factory = session_factory
        self._observe_url = observe_url
        self._now = now or (lambda: int(time.time()))
        self._interval = interval_seconds
        self._broadcaster = broadcaster
        self._external_observation_enabled = external_observation_enabled
        self._stop_event = asyncio.Event()
        self._block_height = 0
        # 后台轮询和 inject-delay 即时检测可能同时进入，串行化可避免同一 ACTIVE policy 并发结算。
        self._run_lock = asyncio.Lock()

    def set_broadcaster(self, broadcaster: ClaimBroadcaster | None) -> None:
        self._broadcaster = broadcaster

    def _next_block_height(self) -> int:
        self._block_height += 1
        return self._block_height

    async def run_once(self) -> RunSummary:
        async with self._run_lock:
            async with self._session_factory() as session:
                stmt = select(Policy).where(Policy.status == PolicyStatus.ACTIVE)
                policies = (await session.execute(stmt)).scalars().all()
            return await self._run_policies(list(policies))

    async def run_for_flight(self, flight_id: str) -> RunSummary:
        async with self._run_lock:
            async with self._session_factory() as session:
                stmt = select(Policy).where(
                    Policy.status == PolicyStatus.ACTIVE,
                    Policy.flight_id == flight_id,
                )
                policies = (await session.execute(stmt)).scalars().all()
            logger.info("checking flight=%s policies=%s", flight_id, len(policies))
            return await self._run_policies(list(policies))

    async def _run_policies(self, policies: list[Policy]) -> RunSummary:
        summary = RunSummary()
        for policy in policies:
            summary.checked += 1
            try:
                await self._process(policy)
                async with self._session_factory() as session:
                    fresh = await session.get(Policy, policy.id)
                    if fresh is not None and fresh.status == PolicyStatus.PAID:
                        summary.triggered += 1
            except Exception as exc:
                summary.failed += 1
                logger.exception("ClaimEngine 触发失败: policy=%s", policy.id)
                async with self._session_factory() as session:
                    session.add(FailedTrigger(policy_id=policy.id, error_text=str(exc)))
                    await session.commit()
        return summary

    async def _process(self, policy: Policy) -> None:
        from backend.admin.routes import get_injected_delay

        condition = self._parse_condition(policy.condition_json)
        injected = get_injected_delay(policy.flight_id)
        if injected is not None:
            observation = {"delay_minutes": injected, "source": "admin-injection"}
        elif self._external_observation_enabled:
            observation = await self._adapter.fetch_external(self._observe_url(policy.flight_id))
        else:
            # 外部 observation 关闭且无 admin 注入: 跳过, 避免不必要的外部请求
            return
        if not condition.is_triggered(observation):
            return

        contract_ref = ContractRef(id=policy.contract_ref or f"mock-{policy.id}", mode="mock")
        payload = ClaimPayload(
            delay_minutes=int(observation.get("delay_minutes", 0)),
            observed_at=self._now(),
        )

        async with self._session_factory() as session:
            persistent = await session.get(Policy, policy.id)
            if persistent is None or persistent.status != PolicyStatus.ACTIVE:
                return
            flight = await session.get(Flight, persistent.flight_id)
            logger.info("triggered policy=%s delay=%s", persistent.id, payload.delay_minutes)
            if self._broadcaster is not None:
                await self._broadcaster.broadcast(
                    {
                        "type": EventType.CLAIM_TRIGGERED.value,
                        "payload": self._claim_triggered_payload(
                            policy=persistent,
                            flight=flight,
                            delay_minutes=payload.delay_minutes,
                            observation=observation,
                        ),
                    }
                )

        tx = await self._adapter.trigger_claim(contract_ref, payload)
        signature = await self._adapter.get_signature(tx)
        if not signature:
            signature = build_signature(policy_id=policy.id, timestamp=self._now(), nonce=0)

        async with self._session_factory() as session:
            persistent = await session.get(Policy, policy.id)
            if persistent is None or persistent.status != PolicyStatus.ACTIVE:
                return
            claim = await ClaimsService(session).create_claim(
                policy=persistent,
                payout=persistent.payout,
                delay_minutes=payload.delay_minutes,
                signature=signature,
                settle_duration_ms=tx.settle_duration_ms,
            )
            await session.commit()
            tx_hash = self._mock_tx_hash(
                claim_id=claim.id,
                policy_id=persistent.id,
                signature=signature,
            )
            logger.info("settled policy=%s tx=%s", persistent.id, tx_hash)
            if self._broadcaster is not None:
                block_height = self._next_block_height()
                await self._broadcaster.broadcast(
                    {
                        "type": "flare",
                        "payload": {
                            "flight_id": persistent.flight_id,
                            "policy_id": persistent.id,
                            "payout": persistent.payout,
                            "delay_minutes": payload.delay_minutes,
                            "signature": signature,
                            "settle_duration_ms": tx.settle_duration_ms,
                        },
                    }
                )
                await self._broadcaster.broadcast(
                    {
                        "type": EventType.CLAIM_SETTLED.value,
                        "payload": {
                            "flight_id": persistent.flight_id,
                            "policy_id": persistent.id,
                            "payout": persistent.payout,
                            "delay_minutes": payload.delay_minutes,
                            "signature": signature,
                            "settle_duration_ms": tx.settle_duration_ms,
                            "tx_hash": tx_hash,
                            "block_height": block_height,
                            "source": "mock",
                        },
                    }
                )
                logger.info("landed flight=%s", persistent.flight_id)
                await self._broadcaster.broadcast(
                    {
                        "type": EventType.FLIGHT_LANDED.value,
                        "payload": {
                            "flight_id": persistent.flight_id,
                            "policy_id": persistent.id,
                            "landed_at": self._now(),
                            "source": "mock",
                        },
                    }
                )
                await self._broadcaster.send_to_user(
                    persistent.user_id,
                    {
                        "type": "toast",
                        "payload": f"+{persistent.payout} RIA settled",
                    },
                )

    @staticmethod
    def _mock_tx_hash(*, claim_id: str, policy_id: str, signature: str) -> str:
        material = f"{claim_id}|{policy_id}|{signature}".encode()
        return "0x" + hashlib.sha256(material).hexdigest()[:40]

    @staticmethod
    def _claim_triggered_payload(
        *,
        policy: Policy,
        flight: Flight | None,
        delay_minutes: int,
        observation: dict,
    ) -> dict:
        airport_iata = "UNKNOWN"
        if flight is not None:
            airport_iata = flight.destination or flight.origin or airport_iata

        return {
            "flight_id": policy.flight_id,
            "policy_id": policy.id,
            "delay_minutes": delay_minutes,
            "source": str(observation.get("source", "mock")),
            "airport_iata": airport_iata,
        }

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
                logger.exception("ClaimEngine.run_once 外层错误")
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                continue

    def stop(self) -> None:
        self._stop_event.set()
