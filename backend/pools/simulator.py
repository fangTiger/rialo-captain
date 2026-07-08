import asyncio
import logging
import random
from collections.abc import Awaitable, Callable

from sqlalchemy import select

from backend.contracts.base import Condition, ConditionType
from backend.flights.service import live_delay_minutes_for_flight
from backend.models import Flight
from backend.policies.service import PolicyService
from backend.pools.matcher import FlightCandidate, first_match
from backend.pools.service import ensure_system_sim_user
from backend.models import Pool, PoolStatus
from backend.ws.broadcaster import Broadcaster


SleepFn = Callable[[float], Awaitable[None]]
SIMULATOR_PREMIUMS = (5, 10, 20)

logger = logging.getLogger(__name__)


class PassengerSimulator:
    def __init__(
        self,
        *,
        session_factory,
        interval_min_seconds: int,
        interval_max_seconds: int,
        enabled: bool,
        broadcaster: Broadcaster | None = None,
        rng=None,
        sleep: SleepFn = asyncio.sleep,
    ) -> None:
        self._session_factory = session_factory
        self._interval_min_seconds = interval_min_seconds
        self._interval_max_seconds = interval_max_seconds
        self._enabled = enabled
        self._broadcaster = broadcaster
        self._rng = rng or random.Random()
        self._sleep = sleep
        self._stop_event = asyncio.Event()

    def next_interval_seconds(self) -> float:
        return float(self._rng.uniform(self._interval_min_seconds, self._interval_max_seconds))

    def create_task(self) -> asyncio.Task | None:
        if not self._enabled:
            return None
        return asyncio.create_task(self.run_forever())

    async def run_once(self) -> None:
        if self._session_factory is None:
            return None
        async with self._session_factory() as session:
            flights = (await session.execute(select(Flight))).scalars().all()
            if not flights:
                return None
            flight = self._choose_flight(list(flights))
            user = await ensure_system_sim_user(session)
            delay_minutes = live_delay_minutes_for_flight(flight) or 0
            delay_rate = min(0.9, max(0.05, delay_minutes / 100))
            policy = await PolicyService(session).create_policy(
                user=user,
                flight_id=flight.id,
                premium=int(self._rng.choice(SIMULATOR_PREMIUMS)),
                condition=Condition(type=ConditionType.DELAY, threshold_min=30),
                delay_rate=delay_rate,
                charge_premium=False,
            )
            pools = (
                await session.execute(select(Pool).where(Pool.status == PoolStatus.ACTIVE))
            ).scalars().all()
            matched_pool = first_match(
                FlightCandidate(
                    flight_id=flight.id,
                    callsign=flight.callsign,
                    origin=flight.origin,
                    destination=flight.destination,
                    delay_threshold_min=30,
                    is_red_eye=False,
                ),
                list(pools),
                "clear",
            )
            if matched_pool is not None:
                from backend.pools.service import PoolService

                await PoolService(session, broadcaster=self._broadcaster).bind_policy_to_pool(
                    pool=matched_pool,
                    policy=policy,
                    flight=flight,
                )
            await session.commit()
        return None

    def _choose_flight(self, flights: list[Flight]) -> Flight:
        weights = [max(1, (live_delay_minutes_for_flight(flight) or 0) + 1) for flight in flights]
        return self._rng.choices(flights, weights=weights, k=1)[0]

    async def run_forever(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self._sleep(self.next_interval_seconds())
            except asyncio.CancelledError:
                raise
            if self._stop_event.is_set():
                break
            try:
                await self.run_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("PassengerSimulator run_once failed, will retry next tick")

    def stop(self) -> None:
        self._stop_event.set()
