import asyncio
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.flights.cache import FlightCache
from backend.models import Flight

logger = logging.getLogger(__name__)


@dataclass
class FetchSummary:
    fetched: int = 0
    upserted: int = 0
    error: str | None = None


def _today_yyyymmdd() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


class FlightFetcher:
    """定时从 OpenSky 拉数据, 写入 cache + upsert flights 表."""

    def __init__(
        self,
        *,
        opensky,
        cache: FlightCache,
        session_factory: async_sessionmaker,
        interval_seconds: int = 30,
        today_id: Callable[[], str] = _today_yyyymmdd,
    ) -> None:
        self._opensky = opensky
        self._cache = cache
        self._session_factory = session_factory
        self._interval = interval_seconds
        self._today_id = today_id
        self._stop_event = asyncio.Event()

    async def run_once(self) -> FetchSummary:
        summary = FetchSummary()
        try:
            states = await self._opensky.fetch_all()
        except Exception as exc:
            summary.error = str(exc)
            logger.exception("FlightFetcher 拉取 OpenSky 失败")
            return summary

        valid = [state for state in states if state.callsign]
        self._cache.store(valid)
        summary.fetched = len(valid)

        if not valid:
            return summary

        date_str = self._today_id()
        async with self._session_factory() as session:
            for state in valid:
                flight_id = f"{state.callsign}-{date_str}"
                existing = await session.get(Flight, flight_id)
                now = int(time.time())
                if existing is None:
                    session.add(
                        Flight(
                            id=flight_id,
                            callsign=state.callsign,
                            origin=state.origin_country[:8] if state.origin_country else "",
                            destination="",
                            last_state="{}",
                            last_seen=now,
                        )
                    )
                else:
                    existing.last_seen = now
                summary.upserted += 1
            await session.commit()

        return summary

    async def run_forever(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self.run_once()
            except Exception:
                logger.exception("FlightFetcher.run_once 外层错误")
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                continue

    def stop(self) -> None:
        self._stop_event.set()
