from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Claim, Flight, Policy


@dataclass(frozen=True)
class DelayStats:
    samples: int
    delayed: int
    delay_rate: float


class FlightService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def delay_stats(self, *, callsign: str) -> DelayStats:
        samples_q = (
            select(func.count(Policy.id.distinct()))
            .select_from(Policy)
            .join(Flight, Flight.id == Policy.flight_id)
            .where(Flight.callsign == callsign)
        )
        delayed_q = (
            select(func.count(Claim.id.distinct()))
            .select_from(Claim)
            .join(Policy, Policy.id == Claim.policy_id)
            .join(Flight, Flight.id == Policy.flight_id)
            .where(Flight.callsign == callsign)
        )
        samples = (await self._session.execute(samples_q)).scalar_one() or 0
        delayed = (await self._session.execute(delayed_q)).scalar_one() or 0
        rate = (delayed / samples) if samples else 0.0
        return DelayStats(samples=samples, delayed=delayed, delay_rate=rate)

    async def hot_routes(self, *, limit: int = 20):
        stmt = (
            select(
                Flight.callsign,
                func.max(Flight.id).label("flight_id"),
                func.count(Policy.id).label("policy_count"),
            )
            .select_from(Policy)
            .join(Flight, Flight.id == Policy.flight_id)
            .group_by(Flight.callsign)
            .order_by(func.count(Policy.id).desc())
            .limit(limit)
        )
        rows = (await self._session.execute(stmt)).all()
        results = []
        for callsign, flight_id, count in rows:
            stats = await self.delay_stats(callsign=callsign)
            results.append(
                {
                    "callsign": callsign,
                    "flight_id": flight_id,
                    "policy_count": int(count),
                    "delay_rate": stats.delay_rate,
                    "samples": stats.samples,
                },
            )
        return results

    async def get_flight(self, flight_id: str) -> Flight | None:
        stmt = select(Flight).where(Flight.id == flight_id)
        return (await self._session.execute(stmt)).scalar_one_or_none()
