import json
import re
from dataclasses import dataclass
from json import JSONDecodeError
from typing import AsyncIterator

import httpx

from .schemas import CopilotContext

MAX_COPILOT_OUTPUT_TOKENS = 520
DISABLED_THINKING = {"type": "disabled"}
SHORT_ANSWER_INSTRUCTION = (
    "Respond in English. Keep answers short, at most 3 bullets, with each bullet about one sentence. "
    "Finish cleanly. Do not write a long report. Do not expand into historical statistics. "
    "Do not repeat more than 5 named examples or follow-up suggestions."
)
DISALLOWED_VISIBLE_TEXT_PATTERN = re.compile(
    "["
    "\uFF00-\uFFEF"
    "\u3000-\u303F"
    "\u3040-\u309F"
    "\u30A0-\u30FF"
    "\u31F0-\u31FF"
    "\u3400-\u4DBF"
    "\u4E00-\u9FFF"
    "\uF900-\uFAFF"
    "\u1100-\u11FF"
    "\u3130-\u318F"
    "\uA960-\uA97F"
    "\uAC00-\uD7AF"
    "\uD7B0-\uD7FF"
    "\U00020000-\U0002EBEF"
    "]"
)
NON_ENGLISH_VISIBLE_TEXT_MESSAGE = "DeepSeek returned non-English visible text."


@dataclass(frozen=True)
class ProviderResult:
    answer: str
    suggested_prompts: list[str]
    confidence: float


class CopilotProviderError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def contains_disallowed_page_text(value: str) -> bool:
    return bool(DISALLOWED_VISIBLE_TEXT_PATTERN.search(value))


class DeepSeekProvider:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    def _messages(
        self,
        *,
        question: str,
        context: CopilotContext,
        stream: bool,
    ) -> list[dict[str, str]]:
        mode_instruction = (
            "Return plain English or Markdown. Do not return JSON."
            if stream
            else (
                "Return only a JSON object with answer, suggested_prompts, and confidence. "
                "The answer and suggested_prompts must be in English, and suggested_prompts may include at most 5 items."
            )
        )
        return [
            {
                "role": "system",
                "content": (
                    "You are Rialo Copilot. You may only explain, summarize, and guide navigation. "
                    "Do not create policies, alter claims, change balances, or say you executed product actions. "
                    "If the current user has no insured exposure while Tower is still tracking live flights, "
                    "you must say both that the user has no insured exposure and that Tower still tracks live flights. "
                    "Do not say there are no flights."
                    f"{SHORT_ANSWER_INSTRUCTION}"
                    f"{mode_instruction}"
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "question": question,
                        "context": context.model_dump(mode="json"),
                    },
                    ensure_ascii=False,
                ),
            },
        ]

    async def complete(self, *, question: str, context: CopilotContext) -> ProviderResult:
        payload = {
            "model": self._model,
            "max_tokens": MAX_COPILOT_OUTPUT_TOKENS,
            "response_format": {"type": "json_object"},
            "thinking": DISABLED_THINKING,
            "messages": self._messages(question=question, context=context, stream=False),
        }
        try:
            async with httpx.AsyncClient(
                transport=self._transport,
                timeout=self._timeout_seconds,
            ) as client:
                response = await client.post(
                    f"{self._base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise CopilotProviderError(
                "timeout",
                "DeepSeek request timed out. Please try again.",
            ) from exc
        except httpx.HTTPError as exc:
            raise CopilotProviderError(
                "network_error",
                "DeepSeek is temporarily unavailable. Please try again.",
            ) from exc

        if response.status_code >= 400:
            raise CopilotProviderError(
                "upstream_error",
                f"DeepSeek is temporarily unavailable ({response.status_code}).",
            )

        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
        except (KeyError, IndexError, TypeError, ValueError, JSONDecodeError) as exc:
            raise CopilotProviderError(
                "invalid_response",
                "DeepSeek returned an unreadable structured response.",
            ) from exc

        answer = parsed.get("answer")
        if not isinstance(answer, str) or not answer.strip():
            raise CopilotProviderError(
                "invalid_response",
                "DeepSeek returned an unreadable structured response.",
            )
        safe_answer = answer.strip()
        if contains_disallowed_page_text(safe_answer):
            raise CopilotProviderError(
                "invalid_response",
                NON_ENGLISH_VISIBLE_TEXT_MESSAGE,
            )

        suggested_prompts = parsed.get("suggested_prompts")
        if not isinstance(suggested_prompts, list):
            suggested_prompts = []
        safe_prompts: list[str] = []
        for item in suggested_prompts:
            if not isinstance(item, str):
                continue
            normalized = item.strip()
            if not normalized or contains_disallowed_page_text(normalized):
                continue
            safe_prompts.append(normalized)
            if len(safe_prompts) == 5:
                break

        confidence = parsed.get("confidence", 0.0)
        if isinstance(confidence, bool):
            confidence = 0.0
        if not isinstance(confidence, int | float):
            confidence = 0.0
        bounded_confidence = max(0.0, min(1.0, float(confidence)))

        return ProviderResult(
            answer=safe_answer,
            suggested_prompts=safe_prompts,
            confidence=bounded_confidence,
        )

    async def stream(self, *, question: str, context: CopilotContext) -> AsyncIterator[str]:
        payload = {
            "model": self._model,
            "max_tokens": MAX_COPILOT_OUTPUT_TOKENS,
            "stream": True,
            "thinking": DISABLED_THINKING,
            "messages": self._messages(question=question, context=context, stream=True),
        }
        try:
            async with httpx.AsyncClient(
                transport=self._transport,
                timeout=self._timeout_seconds,
            ) as client:
                async with client.stream(
                    "POST",
                    f"{self._base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                ) as response:
                    if response.status_code >= 400:
                        raise CopilotProviderError(
                            "upstream_error",
                            f"DeepSeek is temporarily unavailable ({response.status_code}).",
                        )

                    content_type = response.headers.get("content-type", "")
                    if "text/event-stream" not in content_type:
                        raise CopilotProviderError(
                            "invalid_response",
                            "DeepSeek returned an unreadable structured response.",
                        )

                    saw_delta = False
                    saw_done = False
                    async for line in response.aiter_lines():
                        stripped = line.strip()
                        if not stripped or not stripped.startswith("data:"):
                            continue
                        raw_data = stripped[5:].strip()
                        if raw_data == "[DONE]":
                            saw_done = True
                            break
                        try:
                            data = json.loads(raw_data)
                            delta_payload = data["choices"][0]["delta"]
                        except (KeyError, IndexError, TypeError, ValueError, JSONDecodeError) as exc:
                            raise CopilotProviderError(
                                "invalid_response",
                                "DeepSeek returned an unreadable structured response.",
                            ) from exc
                        if not isinstance(delta_payload, dict):
                            raise CopilotProviderError(
                                "invalid_response",
                                "DeepSeek returned an unreadable structured response.",
                            )
                        delta = delta_payload.get("content")
                        reasoning_content = delta_payload.get("reasoning_content")
                        if (delta is None or delta == "") and isinstance(reasoning_content, str):
                            continue
                        if isinstance(delta, str) and delta:
                            if contains_disallowed_page_text(delta):
                                raise CopilotProviderError(
                                    "invalid_response",
                                    NON_ENGLISH_VISIBLE_TEXT_MESSAGE,
                                )
                            saw_delta = True
                            yield delta

                    if not saw_delta or not saw_done:
                        raise CopilotProviderError(
                            "invalid_response",
                            "DeepSeek returned an unreadable structured response.",
                        )
        except httpx.TimeoutException as exc:
            raise CopilotProviderError(
                "timeout",
                "DeepSeek request timed out. Please try again.",
            ) from exc
        except CopilotProviderError:
            raise
        except httpx.HTTPError as exc:
            raise CopilotProviderError(
                "network_error",
                "DeepSeek is temporarily unavailable. Please try again.",
            ) from exc
