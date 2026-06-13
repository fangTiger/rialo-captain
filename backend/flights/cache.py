import time
from collections.abc import Callable
from dataclasses import dataclass

from backend.flights.opensky import FlightState


@dataclass(frozen=True)
class CacheEntry:
    states: list[FlightState]
    stale: bool
    stale_seconds: int


class FlightCache:
    def __init__(
        self,
        *,
        ttl_seconds: int = 30,
        now: Callable[[], int] = lambda: int(time.time()),
    ) -> None:
        self._ttl = ttl_seconds
        self._now = now
        self._states: list[FlightState] = []
        self._stored_at: int = 0

    def store(self, states: list[FlightState]) -> None:
        self._states = list(states)
        self._stored_at = self._now()

    def get(self, *, now: int | None = None) -> CacheEntry:
        current = now if now is not None else self._now()
        if not self._states:
            return CacheEntry(states=[], stale=True, stale_seconds=0)
        age = current - self._stored_at
        if age <= self._ttl:
            return CacheEntry(states=list(self._states), stale=False, stale_seconds=0)
        return CacheEntry(states=list(self._states), stale=True, stale_seconds=age - self._ttl)
