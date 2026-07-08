from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.models import Pool, PoolStatus, PresetStyle
from backend.pools.service import PoolTimelineEvent


class PoolRulePublic(BaseModel):
    delay_threshold_min: int
    payout_multiplier: float
    include_hubs: bool
    exclude_thunderstorm: bool
    cover_red_eye: bool


class CreatePoolRequest(PoolRulePublic):
    preset_style: PresetStyle
    stake_ria: int = Field(gt=0)


class PatchPoolRequest(BaseModel):
    delay_threshold_min: int | None = Field(default=None, gt=0)
    payout_multiplier: float | None = Field(default=None, gt=0)
    include_hubs: bool | None = None
    exclude_thunderstorm: bool | None = None
    cover_red_eye: bool | None = None


class PoolPublic(BaseModel):
    id: str
    user_id: str
    preset_style: PresetStyle
    stake_ria: int
    balance: int
    status: PoolStatus
    created_at: int
    closed_at: int
    pl: int
    rule: PoolRulePublic


class PoolEventPublic(BaseModel):
    id: str
    pool_id: str
    type: str
    payload: dict[str, Any]
    created_at: int


class ClosePoolResponse(BaseModel):
    closed_at: int
    returned_ria: int


PoolClosedReason = Literal["user", "bankrupt"]


def pool_to_public(pool: Pool) -> PoolPublic:
    return PoolPublic(
        id=pool.id,
        user_id=pool.user_id,
        preset_style=pool.preset_style,
        stake_ria=pool.stake_ria,
        balance=pool.balance,
        status=pool.status,
        created_at=pool.created_at,
        closed_at=pool.closed_at,
        pl=pool.balance - pool.stake_ria,
        rule=PoolRulePublic(
            delay_threshold_min=pool.delay_threshold_min,
            payout_multiplier=pool.payout_multiplier,
            include_hubs=pool.include_hubs,
            exclude_thunderstorm=pool.exclude_thunderstorm,
            cover_red_eye=pool.cover_red_eye,
        ),
    )


def event_to_public(event: PoolTimelineEvent) -> PoolEventPublic:
    return PoolEventPublic(
        id=event.id,
        pool_id=event.pool_id,
        type=event.event_type,
        payload=event.payload,
        created_at=event.created_at,
    )
