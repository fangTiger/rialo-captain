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
