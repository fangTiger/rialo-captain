from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_session
from backend.flights.cache import FlightCache
from backend.flights.service import FlightService

router = APIRouter()


class FlightPublic(BaseModel):
    callsign: str
    origin_country: str
    longitude: float | None
    latitude: float | None
    velocity: float | None
    heading: float | None
    on_ground: bool


class LiveResponse(BaseModel):
    data_stale: bool
    stale_seconds: int
    flights: list[FlightPublic]


class FlightDetail(BaseModel):
    id: str
    callsign: str
    origin: str
    destination: str
    delay_rate: float
    samples: int


def _cache_from(request: Request) -> FlightCache:
    return request.app.state.flight_cache


@router.get("/flights/live", response_model=LiveResponse)
async def flights_live(request: Request) -> LiveResponse:
    cache = _cache_from(request)
    entry = cache.get()
    return LiveResponse(
        data_stale=entry.stale,
        stale_seconds=entry.stale_seconds,
        flights=[
            FlightPublic(
                callsign=s.callsign,
                origin_country=s.origin_country,
                longitude=s.longitude,
                latitude=s.latitude,
                velocity=s.velocity,
                heading=s.heading,
                on_ground=s.on_ground,
            )
            for s in entry.states
        ],
    )


@router.get("/flights/{flight_id}", response_model=FlightDetail)
async def flight_detail(
    flight_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FlightDetail:
    service = FlightService(session)
    flight = await service.get_flight(flight_id)
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="flight unknown")
    stats = await service.delay_stats(callsign=flight.callsign)
    return FlightDetail(
        id=flight.id,
        callsign=flight.callsign,
        origin=flight.origin,
        destination=flight.destination,
        delay_rate=stats.delay_rate,
        samples=stats.samples,
    )
