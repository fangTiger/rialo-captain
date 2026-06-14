from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_session
from backend.flights.cache import FlightCache
from backend.flights.opensky import OpenSkyClient, OpenSkyError
from backend.flights.service import FlightService

router = APIRouter()


class FlightPublic(BaseModel):
    icao24: str
    callsign: str
    origin_country: str
    longitude: float | None
    latitude: float | None
    velocity: float | None
    heading: float | None
    on_ground: bool


class TrackPointPublic(BaseModel):
    longitude: float
    latitude: float
    altitude: float | None
    time: int


class TrackResponse(BaseModel):
    icao24: str
    points: list[TrackPointPublic]


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
                icao24=s.icao24,
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


@router.get("/flights/track/{icao24}", response_model=TrackResponse)
async def flight_track(icao24: str, request: Request) -> TrackResponse:
    client: OpenSkyClient | None = getattr(request.app.state, "opensky", None)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="opensky client not ready",
        )
    try:
        points = await client.fetch_track(icao24=icao24, time=0)
    except OpenSkyError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return TrackResponse(
        icao24=icao24,
        points=[
            TrackPointPublic(
                longitude=p.longitude,
                latitude=p.latitude,
                altitude=p.altitude,
                time=p.time,
            )
            for p in points
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


@router.get("/routes/hot")
async def hot_routes(
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = Query(20, ge=1, le=100),
):
    return await FlightService(session).hot_routes(limit=limit)
