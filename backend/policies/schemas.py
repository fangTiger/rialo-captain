from pydantic import BaseModel


class CreatePolicyRequest(BaseModel):
    flight_id: str
    premium: int


class PolicyCreatedPublic(BaseModel):
    id: str
    flight_id: str
    premium: int
    payout: int
    status: str
    contract_ref: str
    created_at: int


class PolicyPublic(PolicyCreatedPublic):
    delay_threshold_minutes: int
    live_delay_minutes: int | None
    minutes_until_trigger: int | None
    risk_level: str
    risk_reason: str
