import json
from typing import Any, Literal

from pydantic import BaseModel, Field


CopilotSubjectType = Literal["overview", "flight", "policy", "claim", "evidence"]
CopilotStatus = Literal["ok", "unavailable"]
CopilotSourceType = Literal["flight", "policy", "claim", "evidence"]
CopilotStreamEventName = Literal["context", "delta", "suggestions", "done", "error"]


class CopilotAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    subject_type: CopilotSubjectType
    subject_id: str | None = None


class CopilotSource(BaseModel):
    type: CopilotSourceType
    id: str
    label: str
    href: str | None = None


class CopilotContext(BaseModel):
    subject_type: CopilotSubjectType
    subject_id: str | None = None
    subject: dict[str, Any] = Field(default_factory=dict)
    sources: list[CopilotSource] = Field(default_factory=list)


class CopilotAskResponse(BaseModel):
    status: CopilotStatus
    answer: str
    sources: list[CopilotSource] = Field(default_factory=list)
    suggested_prompts: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    model: str


class CopilotStreamEvent(BaseModel):
    event: CopilotStreamEventName
    data: dict[str, Any] = Field(default_factory=dict)


def encode_sse_event(event: CopilotStreamEvent) -> str:
    payload = json.dumps(event.data, ensure_ascii=False)
    return f"event: {event.event}\ndata: {payload}\n\n"
