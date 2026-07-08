from dataclasses import dataclass
from typing import Sequence

from backend.models import Pool, PoolStatus, PresetStyle


HUB_IATA_CODES = frozenset({"SFO", "JFK", "LHR", "HND", "LAX", "ORD", "DXB", "SIN", "CDG", "FRA"})
THUNDERSTORM_TIERS = frozenset({"thunderstorm", "storm", "severe"})


@dataclass(frozen=True)
class FlightCandidate:
    flight_id: str
    callsign: str
    origin: str
    destination: str
    delay_threshold_min: int
    is_red_eye: bool = False


def touches_hub(flight: FlightCandidate) -> bool:
    return flight.origin.upper() in HUB_IATA_CODES or flight.destination.upper() in HUB_IATA_CODES


def match(pool: Pool, flight: FlightCandidate, tier: str) -> bool:
    if pool.status != PoolStatus.ACTIVE:
        return False
    if flight.delay_threshold_min < pool.delay_threshold_min:
        return False
    is_hub_route = touches_hub(flight)
    if not pool.include_hubs and is_hub_route:
        return False
    if pool.preset_style == PresetStyle.HUB and not is_hub_route:
        return False
    if pool.exclude_thunderstorm and tier.lower() in THUNDERSTORM_TIERS:
        return False
    if flight.is_red_eye and not pool.cover_red_eye:
        return False
    return True


def first_match(
    flight: FlightCandidate,
    active_pools: Sequence[Pool],
    tier: str,
) -> Pool | None:
    for pool in active_pools:
        if match(pool, flight, tier):
            return pool
    return None
