from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import User

from .context import CopilotContextBuilder, CopilotNotFoundError
from .provider import (
    NON_ENGLISH_VISIBLE_TEXT_MESSAGE,
    CopilotProviderError,
    contains_disallowed_page_text,
)
from .schemas import CopilotAskRequest, CopilotAskResponse, CopilotStreamEvent


class CopilotService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        provider,
        deepseek_api_key: str,
        deepseek_model: str,
        context_builder: CopilotContextBuilder | None = None,
    ) -> None:
        self._session = session
        self._provider = provider
        self._deepseek_api_key = deepseek_api_key
        self._deepseek_model = deepseek_model
        self._context_builder = context_builder or CopilotContextBuilder(session)

    def _fallback_suggested_prompts(self, subject_type: str) -> list[str]:
        prompts_by_subject = {
            "overview": [
                "Which flights need attention right now?",
                "Which routes are closest to a payout threshold?",
                "Which live flights are still uninsured for me?",
                "Which recent claims deserve a review?",
                "Which evidence chains should I inspect first?",
            ],
            "flight": [
                "What is the key risk signal for this flight?",
                "How far is it from a payout threshold?",
                "Which policies are tied to this flight?",
            ],
            "policy": [
                "What payout conditions matter most in this policy?",
                "Which evidence is linked to this policy?",
                "Which record should I inspect next?",
            ],
            "claim": [
                "Why did this claim pay out?",
                "Which evidence supported the settlement?",
                "What should I verify next?",
            ],
            "evidence": [
                "What does this evidence show?",
                "Which decision did this evidence affect?",
                "Which event should I cross-check next?",
            ],
        }
        return prompts_by_subject.get(subject_type, prompts_by_subject["overview"])

    def _sanitize_suggested_prompts(self, prompts: list[str], *, subject_type: str) -> list[str]:
        deduped: list[str] = []
        seen: set[str] = set()
        for prompt in prompts:
            if not isinstance(prompt, str):
                continue
            normalized = prompt.strip()
            if (
                not normalized
                or normalized in seen
                or contains_disallowed_page_text(normalized)
            ):
                continue
            seen.add(normalized)
            deduped.append(normalized)
            if len(deduped) == 5:
                return deduped
        if deduped:
            return deduped
        return self._fallback_suggested_prompts(subject_type)[:5]

    async def ask(self, user: User, request: CopilotAskRequest) -> CopilotAskResponse:
        if not self._deepseek_api_key.strip():
            return CopilotAskResponse(
                status="unavailable",
                answer="Rialo Copilot is not configured in this environment yet.",
                suggested_prompts=self._sanitize_suggested_prompts(
                    ["Try again later.", "Review recent claim timelines."],
                    subject_type=request.subject_type,
                ),
                confidence=0.0,
                model=self._deepseek_model,
            )

        context = await self._context_builder.build(user, request)
        try:
            result = await self._provider.complete(
                question=request.question,
                context=context,
            )
        except CopilotProviderError:
            return CopilotAskResponse(
                status="unavailable",
                answer="Rialo Copilot is temporarily unavailable. Please try again later.",
                sources=context.sources,
                suggested_prompts=self._sanitize_suggested_prompts(
                    ["Try again in a moment.", "Review the evidence timeline first."],
                    subject_type=request.subject_type,
                ),
                confidence=0.0,
                model=self._deepseek_model,
            )

        if contains_disallowed_page_text(result.answer):
            return CopilotAskResponse(
                status="unavailable",
                answer="Rialo Copilot is temporarily unavailable. Please try again later.",
                sources=context.sources,
                suggested_prompts=self._sanitize_suggested_prompts(
                    [],
                    subject_type=request.subject_type,
                ),
                confidence=0.0,
                model=self._deepseek_model,
            )

        return CopilotAskResponse(
            status="ok",
            answer=result.answer,
            sources=context.sources,
            suggested_prompts=self._sanitize_suggested_prompts(
                result.suggested_prompts,
                subject_type=request.subject_type,
            ),
            confidence=result.confidence,
            model=self._deepseek_model,
        )

    async def stream(
        self,
        user: User,
        request: CopilotAskRequest,
    ) -> AsyncIterator[CopilotStreamEvent]:
        if not self._deepseek_api_key.strip():
            yield CopilotStreamEvent(
                event="error",
                data={
                    "code": "unavailable",
                    "message": "Rialo Copilot is not configured in this environment yet.",
                },
            )
            return

        context = await self._context_builder.build(user, request)
        yield CopilotStreamEvent(
            event="context",
            data={
                "subject_type": context.subject_type,
                "subject_id": context.subject_id,
                "sources": [source.model_dump(mode="json") for source in context.sources],
                "model": self._deepseek_model,
                "summary": context.subject,
            },
        )

        answer_parts: list[str] = []
        suggestions = self._sanitize_suggested_prompts([], subject_type=request.subject_type)
        try:
            async for delta in self._provider.stream(
                question=request.question,
                context=context,
            ):
                if contains_disallowed_page_text(delta):
                    raise CopilotProviderError(
                        "invalid_response",
                        NON_ENGLISH_VISIBLE_TEXT_MESSAGE,
                    )
                answer_parts.append(delta)
                yield CopilotStreamEvent(event="delta", data={"delta": delta})
        except CopilotProviderError as exc:
            yield CopilotStreamEvent(
                event="error",
                data={
                    "code": exc.code,
                    "message": str(exc),
                },
            )
            return

        answer = "".join(answer_parts)
        yield CopilotStreamEvent(
            event="suggestions",
            data={"suggested_prompts": suggestions},
        )
        yield CopilotStreamEvent(
            event="done",
            data={
                "status": "ok",
                "answer": answer,
                "sources": [source.model_dump(mode="json") for source in context.sources],
                "suggested_prompts": suggestions,
                "confidence": 0.0,
                "model": self._deepseek_model,
            },
        )


__all__ = ["CopilotNotFoundError", "CopilotService"]
