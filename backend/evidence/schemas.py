from typing import Any

from pydantic import BaseModel


class EvidenceEventPublic(BaseModel):
    id: str
    type: str
    title: str
    source: str
    created_at: int
    payload: dict[str, Any]


class EvidenceSubjectPublic(BaseModel):
    policy_id: str
    flight_id: str
    claim_id: str | None = None


class EvidenceTimelinePublic(BaseModel):
    subject: EvidenceSubjectPublic
    events: list[EvidenceEventPublic]
