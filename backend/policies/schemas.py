from pydantic import BaseModel


class CreatePolicyRequest(BaseModel):
    flight_id: str
    premium: int


class PolicyPublic(BaseModel):
    id: str
    flight_id: str
    premium: int
    payout: int
    status: str
    contract_ref: str
    created_at: int
