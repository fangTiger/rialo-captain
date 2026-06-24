from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import CurrentUser
from backend.db import get_session
from backend.evidence.schemas import EvidenceTimelinePublic
from backend.evidence.service import EvidenceNotFoundError, EvidenceService

router = APIRouter()


def _evidence_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")


@router.get("/policies/{policy_id}/timeline", response_model=EvidenceTimelinePublic)
async def policy_timeline(
    policy_id: str,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EvidenceTimelinePublic:
    try:
        return await EvidenceService(session).timeline_for_policy(user, policy_id)
    except EvidenceNotFoundError as exc:
        raise _evidence_not_found() from exc


@router.get("/claims/{claim_id}/timeline", response_model=EvidenceTimelinePublic)
async def claim_timeline(
    claim_id: str,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EvidenceTimelinePublic:
    try:
        return await EvidenceService(session).timeline_for_claim(user, claim_id)
    except EvidenceNotFoundError as exc:
        raise _evidence_not_found() from exc
