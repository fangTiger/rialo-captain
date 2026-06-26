import json
from json import JSONDecodeError
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.flights.cache import FlightCache
from backend.flights.opensky import FlightState
from backend.flights.service import DelayStats
from backend.models import Claim, Flight, Policy, PolicyEvent, User

from .schemas import CopilotAskRequest, CopilotContext, CopilotSource


SAFE_EVENT_PAYLOAD_KEYS = {
    "delay_minutes",
    "threshold_minutes",
    "payout",
    "premium",
    "flight_id",
    "delay_rate",
    "adapter_mode",
}

OVERVIEW_CONTEXT_LIMIT = 5


class CopilotNotFoundError(Exception):
    pass


class CopilotContextBuilder:
    def __init__(
        self,
        session: AsyncSession,
        *,
        flight_cache: FlightCache | None = None,
    ) -> None:
        self._session = session
        self._flight_cache = flight_cache

    async def build(self, user: User, request: CopilotAskRequest) -> CopilotContext:
        if request.subject_type == "overview":
            return await self._build_overview(user)
        if request.subject_type == "flight":
            return await self._build_flight(user, request.subject_id)
        if request.subject_type == "policy":
            return await self._build_policy(user, request.subject_id)
        if request.subject_type == "claim":
            return await self._build_claim(user, request.subject_id)
        if request.subject_type == "evidence":
            return await self._build_evidence(user, request.subject_id)
        raise CopilotNotFoundError("unsupported subject type")

    async def _build_overview(self, user: User) -> CopilotContext:
        flight_count = await self._flight_count_for_user(user.id)
        policy_count = await self._policy_count_for_user(user.id)
        claim_count = await self._claim_count_for_user(user.id)
        event_count = await self._event_count_for_user(user.id)

        policies = await self._policies_for_user(user.id, limit=OVERVIEW_CONTEXT_LIMIT)
        claims = await self._claims_for_user(user.id, limit=OVERVIEW_CONTEXT_LIMIT)
        events = await self._recent_events_for_user(user.id, limit=OVERVIEW_CONTEXT_LIMIT)
        flights = await self._flights_for_user(user.id, limit=OVERVIEW_CONTEXT_LIMIT)
        live_tower, live_sources = await self._live_tower_summary()

        sources = self._dedupe_sources(
            [
                *[self._flight_source(flight) for flight in flights],
                *live_sources,
                *[self._policy_source(policy) for policy in policies],
                *[self._claim_source(claim) for claim in claims],
                *[self._event_source(event) for event in events],
            ]
        )
        return CopilotContext(
            subject_type="overview",
            subject={
                "summary": {
                    "flight_count": flight_count,
                    "policy_count": policy_count,
                    "claim_count": claim_count,
                    "evidence_event_count": event_count,
                },
                "flights": [await self._flight_summary(user.id, flight) for flight in flights],
                "policies": [self._policy_summary(policy) for policy in policies],
                "claims": [self._claim_summary(claim) for claim in claims],
                "evidence_events": [self._event_summary(event) for event in events],
                "live_tower": live_tower,
            },
            sources=sources,
        )

    async def _build_flight(self, user: User, subject_id: str | None) -> CopilotContext:
        flight = await self._get_flight(subject_id)
        if flight is None:
            raise CopilotNotFoundError("flight not found")

        policies = await self._policies_for_user(user.id, flight_id=flight.id)
        claims = await self._claims_for_user(user.id, flight_id=flight.id)
        sources = self._dedupe_sources(
            [
                self._flight_source(flight),
                *[self._policy_source(policy) for policy in policies],
                *[self._claim_source(claim) for claim in claims],
            ]
        )
        return CopilotContext(
            subject_type="flight",
            subject_id=flight.id,
            subject={
                "flight": await self._flight_summary(user.id, flight),
                "policies": [self._policy_summary(policy) for policy in policies],
                "claims": [self._claim_summary(claim) for claim in claims],
            },
            sources=sources,
        )

    async def _build_policy(self, user: User, subject_id: str | None) -> CopilotContext:
        policy = await self._owned_policy(user.id, subject_id)
        if policy is None:
            raise CopilotNotFoundError("policy not found")

        flight = await self._get_flight(policy.flight_id)
        claims = await self._claims_for_policy(policy.id)
        events = await self._events_for_policy(policy.id)
        sources = self._dedupe_sources(
            [
                self._policy_source(policy),
                *([self._flight_source(flight)] if flight is not None else []),
                *[self._claim_source(claim) for claim in claims],
                *[self._event_source(event) for event in events],
            ]
        )
        return CopilotContext(
            subject_type="policy",
            subject_id=policy.id,
            subject={
                "policy": self._policy_summary(policy),
                "flight": await self._flight_summary(user.id, flight) if flight is not None else {},
                "claims": [self._claim_summary(claim) for claim in claims],
                "evidence_events": [self._event_summary(event) for event in events],
            },
            sources=sources,
        )

    async def _build_claim(self, user: User, subject_id: str | None) -> CopilotContext:
        claim_bundle = await self._claim_bundle_for_user(user.id, subject_id)
        if claim_bundle is None:
            raise CopilotNotFoundError("claim not found")
        claim, policy, flight = claim_bundle
        events = await self._events_for_policy(policy.id)
        sources = self._dedupe_sources(
            [
                self._claim_source(claim),
                self._policy_source(policy),
                *([self._flight_source(flight)] if flight is not None else []),
                *[self._event_source(event) for event in events],
            ]
        )
        return CopilotContext(
            subject_type="claim",
            subject_id=claim.id,
            subject={
                "claim": self._claim_summary(claim),
                "policy": self._policy_summary(policy),
                "flight": await self._flight_summary(user.id, flight) if flight is not None else {},
                "evidence_events": [self._event_summary(event) for event in events],
            },
            sources=sources,
        )

    async def _build_evidence(self, user: User, subject_id: str | None) -> CopilotContext:
        claim_bundle = await self._claim_bundle_for_user(user.id, subject_id)
        if claim_bundle is not None:
            claim, policy, flight = claim_bundle
            events = await self._events_for_policy(policy.id)
            sources = self._dedupe_sources(
                [
                    self._policy_source(policy),
                    self._claim_source(claim),
                    *([self._flight_source(flight)] if flight is not None else []),
                    *[self._event_source(event) for event in events],
                ]
            )
            return CopilotContext(
                subject_type="evidence",
                subject_id=claim.id,
                subject={
                    "claim": self._claim_summary(claim),
                    "policy": self._policy_summary(policy),
                    "flight": await self._flight_summary(user.id, flight) if flight is not None else {},
                    "evidence_events": [self._event_summary(event) for event in events],
                },
                sources=sources,
            )

        policy = await self._owned_policy(user.id, subject_id)
        if policy is None:
            raise CopilotNotFoundError("evidence subject not found")
        flight = await self._get_flight(policy.flight_id)
        claim = await self._latest_claim_for_policy(policy.id)
        events = await self._events_for_policy(policy.id)
        sources = self._dedupe_sources(
            [
                self._policy_source(policy),
                *([self._claim_source(claim)] if claim is not None else []),
                *([self._flight_source(flight)] if flight is not None else []),
                *[self._event_source(event) for event in events],
            ]
        )
        subject: dict[str, Any] = {
            "policy": self._policy_summary(policy),
            "flight": await self._flight_summary(user.id, flight) if flight is not None else {},
            "evidence_events": [self._event_summary(event) for event in events],
        }
        if claim is not None:
            subject["claim"] = self._claim_summary(claim)
        return CopilotContext(
            subject_type="evidence",
            subject_id=policy.id,
            subject=subject,
            sources=sources,
        )

    async def _flight_summary(self, user_id: str, flight: Flight) -> dict[str, Any]:
        stats = await self._user_delay_stats(user_id, flight.callsign)
        last_state = self._parse_json_dict(flight.last_state)
        return {
            "id": flight.id,
            "callsign": flight.callsign,
            "origin": flight.origin,
            "destination": flight.destination,
            "delay_rate": stats.delay_rate,
            "samples": stats.samples,
            "live_delay_minutes": self._int_or_none(last_state.get("delay_minutes")),
            "status": self._string_or_empty(last_state.get("status")),
        }

    async def _user_delay_stats(self, user_id: str, callsign: str) -> DelayStats:
        samples_q = (
            select(func.count(Policy.id.distinct()))
            .select_from(Policy)
            .join(Flight, Flight.id == Policy.flight_id)
            .where(
                Policy.user_id == user_id,
                Flight.callsign == callsign,
            )
        )
        delayed_q = (
            select(func.count(Claim.id.distinct()))
            .select_from(Claim)
            .join(Policy, Policy.id == Claim.policy_id)
            .join(Flight, Flight.id == Policy.flight_id)
            .where(
                Policy.user_id == user_id,
                Flight.callsign == callsign,
            )
        )
        samples = (await self._session.execute(samples_q)).scalar_one() or 0
        delayed = (await self._session.execute(delayed_q)).scalar_one() or 0
        delay_rate = (delayed / samples) if samples else 0.0
        return DelayStats(samples=samples, delayed=delayed, delay_rate=delay_rate)

    async def _live_tower_summary(self) -> tuple[dict[str, Any], list[CopilotSource]]:
        if self._flight_cache is None:
            return self._empty_live_tower_summary(), []

        entry = self._flight_cache.get()
        unique_states = self._dedupe_live_states(entry.states)
        if not unique_states:
            return {
                "total_flights": 0,
                "data_stale": entry.stale,
                "stale_seconds": entry.stale_seconds,
                "sample_flights": [],
            }, []

        flights_by_callsign = await self._flight_lookup_by_callsign(
            [state.callsign for state in unique_states]
        )
        prioritized_states = sorted(
            enumerate(unique_states),
            key=lambda item: (
                0 if item[1].callsign in flights_by_callsign else 1,
                item[0],
            ),
        )
        sample_states = [state for _, state in prioritized_states[:5]]
        sample_flights: list[dict[str, Any]] = []
        sample_sources: list[CopilotSource] = []
        for state in sample_states:
            flight = flights_by_callsign.get(state.callsign)
            last_state = self._parse_json_dict(flight.last_state) if flight is not None else {}
            sample_flights.append(
                {
                    "callsign": state.callsign,
                    "origin": flight.origin if flight is not None else "",
                    "destination": flight.destination if flight is not None else "",
                    "status": self._string_or_empty(last_state.get("status")),
                    "on_ground": state.on_ground,
                }
            )
            if flight is not None:
                sample_sources.append(self._flight_source(flight))

        return (
            {
                "total_flights": len(unique_states),
                "data_stale": entry.stale,
                "stale_seconds": entry.stale_seconds,
                "sample_flights": sample_flights,
            },
            self._dedupe_sources(sample_sources),
        )

    def _empty_live_tower_summary(self) -> dict[str, Any]:
        return {
            "total_flights": 0,
            "data_stale": True,
            "stale_seconds": 0,
            "sample_flights": [],
        }

    def _dedupe_live_states(self, states: list[FlightState]) -> list[FlightState]:
        unique: list[FlightState] = []
        seen_callsigns: set[str] = set()
        for state in states:
            callsign = state.callsign.strip().upper()
            if not callsign or callsign in seen_callsigns:
                continue
            seen_callsigns.add(callsign)
            unique.append(state)
        return unique

    async def _flight_lookup_by_callsign(self, callsigns: list[str]) -> dict[str, Flight]:
        if not callsigns:
            return {}
        rows = (
            await self._session.execute(
                select(Flight)
                .where(Flight.callsign.in_(callsigns))
                .order_by(Flight.id.desc())
            )
        ).scalars().all()
        lookup: dict[str, Flight] = {}
        for flight in rows:
            lookup.setdefault(flight.callsign, flight)
        return lookup

    def _policy_summary(self, policy: Policy) -> dict[str, Any]:
        return {
            "id": policy.id,
            "flight_id": policy.flight_id,
            "premium": policy.premium,
            "payout": policy.payout,
            "status": policy.status.value,
            "created_at": policy.created_at,
        }

    def _claim_summary(self, claim: Claim) -> dict[str, Any]:
        return {
            "id": claim.id,
            "policy_id": claim.policy_id,
            "payout": claim.payout,
            "delay_minutes": claim.delay_minutes,
            "settled_at": claim.settled_at,
            "settle_duration_ms": claim.settle_duration_ms,
        }

    def _event_summary(self, event: PolicyEvent) -> dict[str, Any]:
        event_reference = self._event_reference(event)
        return {
            "id": event.id,
            "type": event.event_type,
            "title": event_reference,
            "source": event.source,
            "created_at": event.created_at,
            "payload": self._safe_event_payload(event.payload_json),
        }

    def _safe_event_payload(self, payload_json: str | None) -> dict[str, Any]:
        payload = self._parse_json_dict(payload_json)
        return {
            key: value
            for key, value in payload.items()
            if key in SAFE_EVENT_PAYLOAD_KEYS and isinstance(value, int | float | str | bool)
        }

    def _parse_json_dict(self, payload_json: str | None) -> dict[str, Any]:
        if not payload_json:
            return {}
        try:
            payload = json.loads(payload_json)
        except (JSONDecodeError, TypeError, ValueError):
            return {}
        if isinstance(payload, dict):
            return payload
        return {}

    def _int_or_none(self, value: Any) -> int | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return None

    def _string_or_empty(self, value: Any) -> str:
        return value if isinstance(value, str) else ""

    def _flight_source(self, flight: Flight) -> CopilotSource:
        label = f"Flight {flight.callsign} {flight.origin}->{flight.destination}"
        return CopilotSource(type="flight", id=flight.id, label=label, href=f"/flights/{flight.id}")

    def _policy_source(self, policy: Policy) -> CopilotSource:
        return CopilotSource(
            type="policy",
            id=policy.id,
            label=f"Policy {policy.id}",
            href=f"/policies/{policy.id}/timeline",
        )

    def _claim_source(self, claim: Claim) -> CopilotSource:
        return CopilotSource(
            type="claim",
            id=claim.id,
            label=f"Claim {claim.id}",
            href=f"/claims/{claim.id}/timeline",
        )

    def _event_source(self, event: PolicyEvent) -> CopilotSource:
        event_reference = self._event_reference(event)
        href = (
            f"/claims/{event.claim_id}/timeline"
            if event.claim_id
            else f"/policies/{event.policy_id}/timeline"
        )
        return CopilotSource(
            type="evidence",
            id=event.id,
            label=f"Evidence {event_reference}",
            href=href,
        )

    def _event_reference(self, event: PolicyEvent) -> str:
        reference = event.event_type.strip() if isinstance(event.event_type, str) else ""
        if reference:
            return reference
        return event.id

    def _dedupe_sources(self, sources: list[CopilotSource]) -> list[CopilotSource]:
        deduped: list[CopilotSource] = []
        seen: set[tuple[str, str]] = set()
        for source in sources:
            key = (source.type, source.id)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(source)
        return deduped

    async def _get_flight(self, flight_id: str | None) -> Flight | None:
        if not flight_id:
            return None
        return (
            await self._session.execute(select(Flight).where(Flight.id == flight_id))
        ).scalar_one_or_none()

    async def _flight_count_for_user(self, user_id: str) -> int:
        return (
            await self._session.execute(
                select(func.count(Policy.flight_id.distinct())).where(Policy.user_id == user_id)
            )
        ).scalar_one() or 0

    async def _policy_count_for_user(self, user_id: str) -> int:
        return (
            await self._session.execute(
                select(func.count(Policy.id)).where(Policy.user_id == user_id)
            )
        ).scalar_one() or 0

    async def _claim_count_for_user(self, user_id: str) -> int:
        return (
            await self._session.execute(
                select(func.count(Claim.id))
                .select_from(Claim)
                .join(Policy, Claim.policy_id == Policy.id)
                .where(Policy.user_id == user_id)
            )
        ).scalar_one() or 0

    async def _event_count_for_user(self, user_id: str) -> int:
        return (
            await self._session.execute(
                select(func.count(PolicyEvent.id))
                .select_from(PolicyEvent)
                .join(Policy, PolicyEvent.policy_id == Policy.id)
                .where(Policy.user_id == user_id)
            )
        ).scalar_one() or 0

    async def _flights_for_user(self, user_id: str, *, limit: int | None = None) -> list[Flight]:
        latest_policy_per_flight = (
            select(
                Policy.flight_id.label("flight_id"),
                func.max(Policy.created_at).label("latest_policy_created_at"),
            )
            .where(Policy.user_id == user_id)
            .group_by(Policy.flight_id)
            .order_by(
                func.max(Policy.created_at).desc(),
                Policy.flight_id.desc(),
            )
        )
        if limit is not None:
            latest_policy_per_flight = latest_policy_per_flight.limit(limit)
        latest_policy_per_flight_subquery = latest_policy_per_flight.subquery()
        return (
            await self._session.execute(
                select(Flight)
                .join(latest_policy_per_flight_subquery, latest_policy_per_flight_subquery.c.flight_id == Flight.id)
                .order_by(
                    latest_policy_per_flight_subquery.c.latest_policy_created_at.desc(),
                    Flight.id.desc(),
                )
            )
        ).scalars().all()

    async def _policies_for_user(
        self,
        user_id: str,
        *,
        flight_id: str | None = None,
        limit: int | None = None,
    ) -> list[Policy]:
        stmt = (
            select(Policy)
            .where(Policy.user_id == user_id)
            .order_by(Policy.created_at.desc(), Policy.id.desc())
        )
        if flight_id is not None:
            stmt = stmt.where(Policy.flight_id == flight_id)
        if limit is not None:
            stmt = stmt.limit(limit)
        return (await self._session.execute(stmt)).scalars().all()

    async def _owned_policy(self, user_id: str, policy_id: str | None) -> Policy | None:
        if not policy_id:
            return None
        return (
            await self._session.execute(
                select(Policy).where(
                    Policy.id == policy_id,
                    Policy.user_id == user_id,
                )
            )
        ).scalar_one_or_none()

    async def _claims_for_user(
        self,
        user_id: str,
        *,
        flight_id: str | None = None,
        limit: int | None = None,
    ) -> list[Claim]:
        stmt = (
            select(Claim)
            .join(Policy, Claim.policy_id == Policy.id)
            .where(Policy.user_id == user_id)
            .order_by(Claim.settled_at.desc(), Claim.id.desc())
        )
        if flight_id is not None:
            stmt = stmt.where(Policy.flight_id == flight_id)
        if limit is not None:
            stmt = stmt.limit(limit)
        return (await self._session.execute(stmt)).scalars().all()

    async def _claims_for_policy(self, policy_id: str) -> list[Claim]:
        stmt = (
            select(Claim)
            .where(Claim.policy_id == policy_id)
            .order_by(Claim.settled_at.desc(), Claim.id.desc())
        )
        return (await self._session.execute(stmt)).scalars().all()

    async def _latest_claim_for_policy(self, policy_id: str) -> Claim | None:
        claims = await self._claims_for_policy(policy_id)
        return claims[0] if claims else None

    async def _claim_bundle_for_user(
        self,
        user_id: str,
        claim_id: str | None,
    ) -> tuple[Claim, Policy, Flight | None] | None:
        if not claim_id:
            return None
        row = (
            await self._session.execute(
                select(Claim, Policy, Flight)
                .join(Policy, Claim.policy_id == Policy.id)
                .join(Flight, Policy.flight_id == Flight.id)
                .where(
                    Claim.id == claim_id,
                    Policy.user_id == user_id,
                )
            )
        ).one_or_none()
        if row is None:
            return None
        claim, policy, flight = row
        return claim, policy, flight

    async def _events_for_policy(self, policy_id: str) -> list[PolicyEvent]:
        return (
            await self._session.execute(
                select(PolicyEvent)
                .where(PolicyEvent.policy_id == policy_id)
                .order_by(
                    PolicyEvent.created_at.asc(),
                    PolicyEvent.event_sequence.asc(),
                    PolicyEvent.id.asc(),
                )
            )
        ).scalars().all()

    async def _recent_events_for_user(
        self,
        user_id: str,
        *,
        limit: int | None = OVERVIEW_CONTEXT_LIMIT,
    ) -> list[PolicyEvent]:
        stmt = (
            select(PolicyEvent)
            .join(Policy, PolicyEvent.policy_id == Policy.id)
            .where(Policy.user_id == user_id)
            .order_by(
                PolicyEvent.created_at.desc(),
                PolicyEvent.event_sequence.desc(),
                PolicyEvent.id.desc(),
            )
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        return (await self._session.execute(stmt)).scalars().all()
