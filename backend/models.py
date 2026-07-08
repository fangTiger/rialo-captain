import enum
import time
import uuid

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from backend.db import Base


def _now() -> int:
    return int(time.time())


def _uuid() -> str:
    return uuid.uuid4().hex[:16]


def _now_ns() -> int:
    return time.time_ns()


class PolicyStatus(str, enum.Enum):
    ACTIVE = "active"
    PAID = "paid"
    EXPIRED = "expired"


class PoolStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED_BY_USER = "closed_by_user"
    CLOSED_BANKRUPT = "closed_bankrupt"


class PresetStyle(str, enum.Enum):
    STEADY = "steady"
    STORM = "storm"
    HUB = "hub"
    CUSTOM = "custom"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    google_sub: Mapped[str] = mapped_column(String(64), unique=True)
    email: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    balance: Mapped[int] = mapped_column(Integer, default=1000)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[int] = mapped_column(Integer, default=_now)


class Flight(Base):
    __tablename__ = "flights"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    callsign: Mapped[str] = mapped_column(String(16))
    origin: Mapped[str] = mapped_column(String(8), default="")
    destination: Mapped[str] = mapped_column(String(8), default="")
    scheduled_dep: Mapped[int] = mapped_column(Integer, default=0)
    scheduled_arr: Mapped[int] = mapped_column(Integer, default=0)
    last_state: Mapped[str] = mapped_column(Text, default="{}")
    last_seen: Mapped[int] = mapped_column(Integer, default=_now)


class Pool(Base):
    __tablename__ = "pools"
    __table_args__ = (
        Index(
            "ix_pools_active_per_user",
            "user_id",
            unique=True,
            sqlite_where=text("status = 'active'"),
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    preset_style: Mapped[PresetStyle] = mapped_column(
        Enum(PresetStyle, values_callable=lambda values: [item.value for item in values])
    )
    delay_threshold_min: Mapped[int] = mapped_column(Integer)
    payout_multiplier: Mapped[float] = mapped_column(Float)
    stake_ria: Mapped[int] = mapped_column(Integer)
    balance: Mapped[int] = mapped_column(Integer)
    include_hubs: Mapped[bool] = mapped_column(Boolean)
    exclude_thunderstorm: Mapped[bool] = mapped_column(Boolean)
    cover_red_eye: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[PoolStatus] = mapped_column(
        Enum(PoolStatus, values_callable=lambda values: [item.value for item in values])
    )
    created_at: Mapped[int] = mapped_column(Integer, default=_now)
    closed_at: Mapped[int] = mapped_column(Integer, default=0)


class PoolEvent(Base):
    __tablename__ = "pool_events"
    __table_args__ = (
        Index(
            "ix_pool_events_pool_timeline",
            "pool_id",
            "created_at",
            "event_sequence",
            "id",
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    pool_id: Mapped[str] = mapped_column(ForeignKey("pools.id"))
    event_type: Mapped[str] = mapped_column(String(64))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[int] = mapped_column(Integer, default=_now)
    event_sequence: Mapped[int] = mapped_column(Integer, default=_now_ns)


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    flight_id: Mapped[str] = mapped_column(ForeignKey("flights.id"))
    underwriter_pool_id: Mapped[str | None] = mapped_column(
        ForeignKey("pools.id"), nullable=True
    )
    premium: Mapped[int] = mapped_column(Integer)
    payout: Mapped[int] = mapped_column(Integer)
    condition_json: Mapped[str] = mapped_column(Text)
    status: Mapped[PolicyStatus] = mapped_column(Enum(PolicyStatus), default=PolicyStatus.ACTIVE)
    contract_ref: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[int] = mapped_column(Integer, default=_now)


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id"))
    payout: Mapped[int] = mapped_column(Integer)
    delay_minutes: Mapped[int] = mapped_column(Integer)
    signature: Mapped[str] = mapped_column(String(72))
    settled_at: Mapped[int] = mapped_column(Integer, default=_now)
    settle_duration_ms: Mapped[int] = mapped_column(Integer, default=0)


class PolicyEvent(Base):
    __tablename__ = "policy_events"
    __table_args__ = (
        Index(
            "ix_policy_events_policy_timeline",
            "policy_id",
            "created_at",
            "event_sequence",
            "id",
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id"))
    flight_id: Mapped[str] = mapped_column(ForeignKey("flights.id"))
    claim_id: Mapped[str | None] = mapped_column(ForeignKey("claims.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(128))
    source: Mapped[str] = mapped_column(String(32))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[int] = mapped_column(Integer, default=_now)
    event_sequence: Mapped[int] = mapped_column(Integer, default=_now_ns)


class FailedTrigger(Base):
    __tablename__ = "failed_triggers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id"))
    error_text: Mapped[str] = mapped_column(Text)
    occurred_at: Mapped[int] = mapped_column(Integer, default=_now)
