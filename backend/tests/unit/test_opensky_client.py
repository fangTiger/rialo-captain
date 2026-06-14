import httpx
import pytest

from backend.flights.opensky import FlightState, OpenSkyClient, OpenSkyError, TrackPoint


@pytest.mark.asyncio
async def test_fetch_all_returns_flight_states():
    fake_payload = {
        "time": 1718000000,
        "states": [
            [
                "a1b2c3",
                "BA178   ",
                "United Kingdom",
                None,
                None,
                -0.45,
                51.47,
                11000,
                False,
                240.0,
                280.0,
                0.0,
                None,
                11500,
                "5471",
                False,
                0,
            ],
            [
                "d4e5f6",
                "DL101   ",
                "United States",
                None,
                None,
                -73.78,
                40.64,
                10000,
                False,
                230.0,
                90.0,
                0.0,
                None,
                10500,
                "5472",
                False,
                0,
            ],
        ],
    }

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=fake_payload)

    transport = httpx.MockTransport(handler)
    client = OpenSkyClient(base_url="https://opensky.test", transport=transport)
    try:
        states = await client.fetch_all()
    finally:
        await client.aclose()

    assert len(states) == 2
    assert states[0].callsign == "BA178"
    assert states[0].origin_country == "United Kingdom"
    assert isinstance(states[0], FlightState)


@pytest.mark.asyncio
async def test_5xx_raises_opensky_error_after_retries():
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503)

    transport = httpx.MockTransport(handler)
    client = OpenSkyClient(
        base_url="https://opensky.test",
        transport=transport,
        max_attempts=3,
        base_backoff=0.0,
    )
    try:
        with pytest.raises(OpenSkyError):
            await client.fetch_all()
    finally:
        await client.aclose()

    assert calls == 3


@pytest.mark.asyncio
async def test_fetch_track_returns_track_points():
    fake_payload = {
        "icao24": "a1b2c3",
        "startTime": 1718000000,
        "endTime": 1718003600,
        "callsign": "BA178   ",
        "path": [
            [1718000000, 51.47, -0.45, 11000, 280.0, False],
            [1718001800, 52.10, -8.20, 11500, 285.0, False],
            [1718003600, 53.50, -20.00, 11500, 290.0, False],
        ],
    }

    async def handler(request: httpx.Request) -> httpx.Response:
        assert "tracks/all" in str(request.url)
        return httpx.Response(200, json=fake_payload)

    transport = httpx.MockTransport(handler)
    client = OpenSkyClient(base_url="https://opensky.test", transport=transport)
    try:
        points = await client.fetch_track(icao24="A1B2C3", time=0)
    finally:
        await client.aclose()

    assert len(points) == 3
    assert isinstance(points[0], TrackPoint)
    assert points[0].latitude == 51.47
    assert points[0].longitude == -0.45
    assert points[2].longitude == -20.0


@pytest.mark.asyncio
async def test_fetch_track_returns_empty_on_404():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    client = OpenSkyClient(base_url="https://opensky.test", transport=transport)
    try:
        points = await client.fetch_track(icao24="missing", time=0)
    finally:
        await client.aclose()

    assert points == []


@pytest.mark.asyncio
async def test_fetch_track_skips_rows_with_missing_position():
    fake_payload = {
        "path": [
            [1718000000, None, None, None, None, False],
            [1718001800, 52.0, -8.0, 11500, 285.0, False],
            [1718003600, 53.5, -20.0, None, None, False],
        ],
    }

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=fake_payload)

    transport = httpx.MockTransport(handler)
    client = OpenSkyClient(base_url="https://opensky.test", transport=transport)
    try:
        points = await client.fetch_track(icao24="x", time=0)
    finally:
        await client.aclose()

    assert len(points) == 2
    assert points[0].longitude == -8.0
    assert points[1].longitude == -20.0
    assert points[1].altitude is None
