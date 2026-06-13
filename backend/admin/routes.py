from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.admin.deps import admin_required
from backend.db import get_session
from backend.flights.service import FlightService

router = APIRouter()


class InjectDelayRequest(BaseModel):
    flight_id: str
    delay_minutes: int


class InjectDelayResponse(BaseModel):
    flight_id: str
    delay_minutes: int


_DELAY_OVERRIDES: dict[str, int] = {}


def get_injected_delay(flight_id: str) -> int | None:
    return _DELAY_OVERRIDES.get(flight_id)


def clear_injected_delays() -> None:
    _DELAY_OVERRIDES.clear()


@router.post(
    "/admin/inject-delay",
    response_model=InjectDelayResponse,
    dependencies=[Depends(admin_required)],
)
async def inject_delay(
    body: InjectDelayRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InjectDelayResponse:
    flight = await FlightService(session).get_flight(body.flight_id)
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="flight unknown")
    _DELAY_OVERRIDES[body.flight_id] = body.delay_minutes
    return InjectDelayResponse(flight_id=body.flight_id, delay_minutes=body.delay_minutes)
