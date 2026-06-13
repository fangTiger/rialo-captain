import httpx
import pytest

from backend.flights.opensky import FlightState, OpenSkyClient, OpenSkyError


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
