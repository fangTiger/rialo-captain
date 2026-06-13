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
