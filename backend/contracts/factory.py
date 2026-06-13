from backend.config import get_settings
from backend.contracts.base import ReactiveContractAdapter
from backend.contracts.mock_rialo import MockRialoAdapter
from backend.contracts.real_rialo import RealRialoAdapter


def get_contract_adapter() -> ReactiveContractAdapter:
    mode = get_settings().rialo_mode
    if mode == "real":
        return RealRialoAdapter()
    return MockRialoAdapter()
