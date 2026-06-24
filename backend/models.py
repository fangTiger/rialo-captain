import enum
import time
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.db import Base


def _now() -> int:
    return int(time.time())


def _uuid() -> str:
    return uuid.uuid4().hex[:16]


class PolicyStatus(str, enum.Enum):
    ACTIVE = "active"
    PAID = "paid"
    EXPIRED = "expired"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    google_sub: Mapped[str] = mapped_column(String(64), unique=True)
    email: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    balance: Mapped[int] = mapped_column(Integer, default=1000)
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


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    flight_id: Mapped[str] = mapped_column(ForeignKey("flights.id"))
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

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id"))
    flight_id: Mapped[str] = mapped_column(ForeignKey("flights.id"))
    claim_id: Mapped[str | None] = mapped_column(ForeignKey("claims.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(128))
    source: Mapped[str] = mapped_column(String(32))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[int] = mapped_column(Integer, default=_now)


class FailedTrigger(Base):
    __tablename__ = "failed_triggers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id"))
    error_text: Mapped[str] = mapped_column(Text)
    occurred_at: Mapped[int] = mapped_column(Integer, default=_now)
