from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import CurrentUser
from backend.auth.service import InsufficientBalanceError
from backend.db import get_session
from backend.models import Pool
from backend.pools.schemas import (
    ClosePoolResponse,
    CreatePoolRequest,
    PatchPoolRequest,
    PoolEventPublic,
    PoolPublic,
    event_to_public,
    pool_to_public,
)
from backend.pools.service import PoolConflictError, PoolService

router = APIRouter()


async def _broadcast(request: Request, message: dict) -> None:
    broadcaster = getattr(request.app.state, "broadcaster", None)
    if broadcaster is not None:
        await broadcaster.broadcast(message)


@router.post("/pools", response_model=PoolPublic, status_code=status.HTTP_201_CREATED)
async def create_pool(
    body: CreatePoolRequest,
    request: Request,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PoolPublic:
    service = PoolService(session, broadcaster=getattr(request.app.state, "broadcaster", None))
    try:
        pool = await service.open_pool(
            user=user,
            preset_style=body.preset_style,
            delay_threshold_min=body.delay_threshold_min,
            payout_multiplier=body.payout_multiplier,
            stake_ria=body.stake_ria,
            include_hubs=body.include_hubs,
            exclude_thunderstorm=body.exclude_thunderstorm,
            cover_red_eye=body.cover_red_eye,
        )
    except PoolConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active pool — close it first",
        ) from exc
    except InsufficientBalanceError as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc)) from exc
    await session.commit()
    return pool_to_public(pool)


@router.delete("/pools/{pool_id}", response_model=ClosePoolResponse)
async def close_pool(
    pool_id: str,
    request: Request,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ClosePoolResponse:
    pool = await _owned_pool_or_404(session, user.id, pool_id)
    service = PoolService(session, broadcaster=getattr(request.app.state, "broadcaster", None))
    result = await service.close_pool(pool=pool, reason="user")
    await session.commit()
    return ClosePoolResponse(closed_at=result.closed_at, returned_ria=result.returned_ria)


@router.get("/pools/{pool_id}/timeline", response_model=list[PoolEventPublic])
async def pool_timeline(
    pool_id: str,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = Query(50, ge=1, le=200),
) -> list[PoolEventPublic]:
    await _owned_pool_or_404(session, user.id, pool_id)
    events = await PoolService(session).list_timeline(pool_id, limit=limit)
    return [event_to_public(event) for event in events]


@router.get("/pools/me", response_model=PoolPublic | None)
async def get_my_pool(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PoolPublic | None:
    pool = await PoolService(session).get_active_pool(user.id)
    return pool_to_public(pool) if pool is not None else None


async def _owned_pool_or_404(session: AsyncSession, user_id: str, pool_id: str) -> Pool:
    pool = await session.get(Pool, pool_id)
    if pool is None or pool.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    return pool


@router.patch("/pools/{pool_id}", response_model=PoolPublic)
async def patch_pool(
    pool_id: str,
    body: PatchPoolRequest,
    request: Request,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PoolPublic:
    pool = await _owned_pool_or_404(session, user.id, pool_id)
    service = PoolService(session, broadcaster=getattr(request.app.state, "broadcaster", None))
    pool = await service.patch_pool_rule(
        pool=pool,
        delay_threshold_min=body.delay_threshold_min,
        payout_multiplier=body.payout_multiplier,
        include_hubs=body.include_hubs,
        exclude_thunderstorm=body.exclude_thunderstorm,
        cover_red_eye=body.cover_red_eye,
    )
    await session.commit()
    return pool_to_public(pool)
