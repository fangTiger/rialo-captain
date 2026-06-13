import asyncio
import json
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass

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
from backend.models import FailedTrigger, Policy, PolicyStatus

logger = logging.getLogger(__name__)


@dataclass
class RunSummary:
    checked: int = 0
    triggered: int = 0
    failed: int = 0


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
    ) -> None:
        self._adapter = adapter
        self._session_factory = session_factory
        self._observe_url = observe_url
        self._now = now or (lambda: int(time.time()))
        self._interval = interval_seconds
        self._stop_event = asyncio.Event()

    async def run_once(self) -> RunSummary:
        summary = RunSummary()
        async with self._session_factory() as session:
            stmt = select(Policy).where(Policy.status == PolicyStatus.ACTIVE)
            policies = (await session.execute(stmt)).scalars().all()

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
                logger.exception("ClaimEngine.run_once 外层错误")
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                continue

    def stop(self) -> None:
        self._stop_event.set()
