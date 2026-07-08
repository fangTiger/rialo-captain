import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import UserService
from backend.pools.service import SYSTEM_SIM_USER_EMAIL, ensure_system_sim_user


@pytest.mark.asyncio
async def test_system_sim_user_seed_is_idempotent_and_hidden(db_session: AsyncSession):
    first = await ensure_system_sim_user(db_session)
    second = await ensure_system_sim_user(db_session)

    assert second.id == first.id
    assert first.email == SYSTEM_SIM_USER_EMAIL
    assert first.is_system is True
    assert first.balance == 0


@pytest.mark.asyncio
async def test_dev_login_does_not_reuse_system_sim_user(db_session: AsyncSession):
    system_user = await ensure_system_sim_user(db_session)

    dev_user = await UserService(db_session).create_or_get_dev(
        email=SYSTEM_SIM_USER_EMAIL,
        name="Dev Captain",
    )

    assert dev_user.id != system_user.id
    assert dev_user.is_system is False
    assert dev_user.google_sub.startswith("dev-")
