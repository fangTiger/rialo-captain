import json
from json import JSONDecodeError
from typing import Any, Mapping

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.evidence.schemas import (
    EvidenceEventPublic,
    EvidenceSubjectPublic,
    EvidenceTimelinePublic,
)
from backend.models import Claim, Policy, PolicyEvent, User


class EvidenceNotFoundError(Exception):
    pass


class EvidenceIntegrityError(Exception):
    pass


class EvidenceService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record_event(
        self,
        *,
        policy_id: str,
        flight_id: str,
        event_type: str,
        title: str,
        source: str,
        payload: Mapping[str, Any] | None = None,
        claim_id: str | None = None,
    ) -> PolicyEvent:
        policy = await self._get_policy(policy_id)
        if policy is None:
            raise EvidenceNotFoundError("policy not found")
        if flight_id != policy.flight_id:
            raise EvidenceIntegrityError("flight does not match policy")
        if claim_id is not None:
            claim = await self._get_claim(claim_id)
            if claim is None:
                raise EvidenceIntegrityError("claim not found")
            if claim.policy_id != policy.id:
                raise EvidenceIntegrityError("claim does not belong to policy")

        event = PolicyEvent(
            policy_id=policy_id,
            flight_id=flight_id,
            claim_id=claim_id,
            event_type=event_type,
            title=title,
            source=source,
            payload_json=json.dumps(payload or {}, ensure_ascii=False),
        )
        self._session.add(event)
        await self._session.flush()
        return event

    async def timeline_for_policy(self, user: User, policy_id: str) -> EvidenceTimelinePublic:
        policy = (
            await self._session.execute(
                select(Policy).where(
                    Policy.id == policy_id,
                    Policy.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if policy is None:
            raise EvidenceNotFoundError("policy not found")

        events = (
            await self._session.execute(
                select(PolicyEvent)
                .where(PolicyEvent.policy_id == policy.id)
                .order_by(
                    PolicyEvent.created_at.asc(),
                    PolicyEvent.event_sequence.asc(),
                    PolicyEvent.id.asc(),
                )
            )
        ).scalars().all()

        claim_id = next((event.claim_id for event in events if event.claim_id is not None), None)
        return EvidenceTimelinePublic(
            subject=EvidenceSubjectPublic(
                policy_id=policy.id,
                flight_id=policy.flight_id,
                claim_id=claim_id,
            ),
            events=[self._to_public_event(event) for event in events],
        )

    def _to_public_event(self, event: PolicyEvent) -> EvidenceEventPublic:
        return EvidenceEventPublic(
            id=event.id,
            type=event.event_type,
            title=event.title,
            source=event.source,
            created_at=event.created_at,
            payload=self._parse_payload(event.payload_json),
        )

    def _parse_payload(self, payload_json: str | None) -> dict[str, Any]:
        if not payload_json:
            return {}
        try:
            payload = json.loads(payload_json)
        except (JSONDecodeError, TypeError, ValueError):
            return {}
        if isinstance(payload, dict):
            return payload
        return {}

    async def _get_policy(self, policy_id: str) -> Policy | None:
        return (
            await self._session.execute(select(Policy).where(Policy.id == policy_id))
        ).scalar_one_or_none()

    async def _get_claim(self, claim_id: str) -> Claim | None:
        return (
            await self._session.execute(select(Claim).where(Claim.id == claim_id))
        ).scalar_one_or_none()
