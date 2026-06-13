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
