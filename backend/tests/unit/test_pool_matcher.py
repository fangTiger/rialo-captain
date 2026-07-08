from backend.models import Pool, PoolStatus, PresetStyle
from backend.pools.matcher import FlightCandidate, first_match, match


def make_pool(
    *,
    pool_id: str = "pool-1",
    preset_style: PresetStyle = PresetStyle.STEADY,
    delay_threshold_min: int = 30,
    payout_multiplier: float = 3.0,
    include_hubs: bool = True,
    exclude_thunderstorm: bool = True,
    cover_red_eye: bool = False,
    status: PoolStatus = PoolStatus.ACTIVE,
) -> Pool:
    return Pool(
        id=pool_id,
        user_id="user-1",
        preset_style=preset_style,
        delay_threshold_min=delay_threshold_min,
        payout_multiplier=payout_multiplier,
        stake_ria=200,
        balance=200,
        include_hubs=include_hubs,
        exclude_thunderstorm=exclude_thunderstorm,
        cover_red_eye=cover_red_eye,
        status=status,
    )


def flight_candidate(**overrides) -> FlightCandidate:
    values = {
        "flight_id": "BA178-20260708",
        "callsign": "BA178",
        "origin": "LHR",
        "destination": "JFK",
        "delay_threshold_min": 30,
        "is_red_eye": False,
    }
    values.update(overrides)
    return FlightCandidate(**values)


def test_steady_pool_matches_normal_hub_flight():
    pool = make_pool(preset_style=PresetStyle.STEADY)

    assert match(pool, flight_candidate(), "clear") is True


def test_pool_rejects_policy_threshold_below_rule_threshold():
    pool = make_pool(delay_threshold_min=45)

    assert match(pool, flight_candidate(delay_threshold_min=30), "clear") is False
    assert match(pool, flight_candidate(delay_threshold_min=45), "clear") is True


def test_exclude_thunderstorm_rejects_thunderstorm_tier():
    pool = make_pool(exclude_thunderstorm=True)

    assert match(pool, flight_candidate(), "thunderstorm") is False


def test_storm_chaser_can_cover_thunderstorm_and_red_eye():
    pool = make_pool(
        preset_style=PresetStyle.STORM,
        exclude_thunderstorm=False,
        cover_red_eye=True,
        payout_multiplier=5.0,
    )

    assert match(pool, flight_candidate(is_red_eye=True), "thunderstorm") is True


def test_red_eye_is_rejected_unless_rule_covers_it():
    pool = make_pool(cover_red_eye=False)

    assert match(pool, flight_candidate(is_red_eye=True), "clear") is False


def test_include_hubs_false_rejects_hub_routes():
    pool = make_pool(include_hubs=False)

    assert match(pool, flight_candidate(origin="SFO", destination="LAX"), "clear") is False
    assert match(pool, flight_candidate(origin="AUS", destination="SAT"), "clear") is True


def test_hub_hunter_requires_hub_route():
    pool = make_pool(preset_style=PresetStyle.HUB, cover_red_eye=True)

    assert match(pool, flight_candidate(origin="SFO", destination="AUS"), "clear") is True
    assert match(pool, flight_candidate(origin="AUS", destination="SAT"), "clear") is False


def test_first_match_returns_first_active_matching_pool():
    closed = make_pool(pool_id="closed", status=PoolStatus.CLOSED_BY_USER)
    first = make_pool(pool_id="first", include_hubs=False)
    second = make_pool(pool_id="second", include_hubs=True)

    result = first_match(
        flight_candidate(origin="SFO", destination="LAX"),
        [closed, first, second],
        "clear",
    )

    assert result is second
