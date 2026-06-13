import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.flights.service import DelayStats, FlightService
from backend.models import Claim, Flight, Policy, PolicyStatus


@pytest.mark.asyncio
async def test_delay_stats_zero_when_no_history(db_session: AsyncSession):
    service = FlightService(db_session)
    stats = await service.delay_stats(callsign="XX999")
    assert stats == DelayStats(samples=0, delayed=0, delay_rate=0.0)


@pytest.mark.asyncio
async def test_delay_stats_counts_claims_for_callsign(db_session: AsyncSession):
    for i, paid in enumerate([True, True, False]):
        flight = Flight(id=f"BA178-2026061{i}", callsign="BA178", origin="LHR", destination="JFK")
        db_session.add(flight)
        await db_session.flush()
        policy = Policy(
            id=f"pol-{i}",
            user_id="u-x",
            flight_id=flight.id,
            premium=10,
            payout=40,
            condition_json="{}",
            status=PolicyStatus.PAID if paid else PolicyStatus.ACTIVE,
        )
        db_session.add(policy)
        await db_session.flush()
        if paid:
            db_session.add(
                Claim(
                    id=f"clm-{i}",
                    policy_id=policy.id,
                    payout=40,
                    delay_minutes=45,
                    signature="0x" + "a" * 64,
                    settle_duration_ms=1000,
                )
            )
            await db_session.flush()
    service = FlightService(db_session)
    stats = await service.delay_stats(callsign="BA178")
    assert stats.samples == 3
    assert stats.delayed == 2
    assert stats.delay_rate == pytest.approx(2 / 3, rel=1e-3)
