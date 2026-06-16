from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.claims.service import ClaimsService
from backend.db import get_session

router = APIRouter()


class ClaimPublic(BaseModel):
    id: str
    policy_id: str
    flight_id: str
    payout: int
    delay_minutes: int
    signature: str
    settled_at: int
    settle_duration_ms: int


@router.get("/claims/recent", response_model=list[ClaimPublic])
async def claims_recent(
    session: Annotated[AsyncSession, Depends(get_session)],
    flight_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> list[ClaimPublic]:
    items = await ClaimsService(session).recent(limit=limit, flight_id=flight_id)
    return [
        ClaimPublic(
            id=c.id,
            policy_id=c.policy_id,
            flight_id=item_flight_id,
            payout=c.payout,
            delay_minutes=c.delay_minutes,
            signature=c.signature,
            settled_at=c.settled_at,
            settle_duration_ms=c.settle_duration_ms,
        )
        for c, item_flight_id in items
    ]
