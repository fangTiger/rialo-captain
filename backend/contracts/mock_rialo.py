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

    生命周期：app lifespan 创建 + aclose。watch 注册到内存表 + 业务方/DB 由调用方处理。
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
        settle_ms = int((time.perf_counter() - start) * 1000)
        return TxResult(signature=sig, settle_duration_ms=max(settle_ms, 1))

    async def get_signature(self, tx: TxResult) -> str:
        return tx.signature
