from backend.flights.cache import CacheEntry, FlightCache
from backend.flights.opensky import FlightState


def _make_state(callsign: str = "BA178") -> FlightState:
    return FlightState(
        icao24="abc",
        callsign=callsign,
        origin_country="UK",
        longitude=0.0,
        latitude=51.0,
        velocity=200.0,
        heading=90.0,
        on_ground=False,
    )


def test_cache_returns_fresh_within_ttl():
    cache = FlightCache(ttl_seconds=30, now=lambda: 1000)
    cache.store([_make_state()])
    entry = cache.get(now=1015)

    assert isinstance(entry, CacheEntry)
    assert entry.stale is False
    assert entry.stale_seconds == 0
    assert len(entry.states) == 1


def test_cache_marks_stale_after_ttl():
    cache = FlightCache(ttl_seconds=30, now=lambda: 1000)
    cache.store([_make_state()])
    entry = cache.get(now=1080)

    assert entry.stale is True
    assert entry.stale_seconds == 50


def test_cache_empty_when_nothing_stored():
    cache = FlightCache(ttl_seconds=30, now=lambda: 1000)
    entry = cache.get(now=1000)

    assert entry.states == []
    assert entry.stale is True
    assert entry.stale_seconds == 0
