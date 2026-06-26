import json
import re

import httpx
import pytest

EXPECTED_MAX_TOKENS = 520


def _contains_disallowed_visible_text(value: str) -> bool:
    return bool(
        re.search(
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
            "]",
            value,
        )
    )


def _sample_context():
    from backend.copilot.schemas import CopilotContext, CopilotSource

    return CopilotContext(
        subject_type="overview",
        subject_id=None,
        subject={
            "summary": {
                "policy_count": 1,
                "claim_count": 1,
            }
        },
        sources=[
            CopilotSource(
                type="policy",
                id="policy-1",
                label="Policy policy-1",
                href="/policies/policy-1",
            )
        ],
    )


@pytest.mark.asyncio
async def test_deepseek_provider_parses_json_object_response():
    from backend.copilot.provider import DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://deepseek.test/chat/completions"
        assert request.headers["authorization"] == "Bearer test-deepseek-key"
        payload = json.loads(request.content)
        assert payload["model"] == "deepseek-v4-pro"
        assert payload["response_format"] == {"type": "json_object"}
        assert payload["thinking"] == {"type": "disabled"}
        assert payload["max_tokens"] == EXPECTED_MAX_TOKENS
        system_prompt = payload["messages"][0]["content"]
        assert "Respond in English." in system_prompt
        assert "Keep answers short" in system_prompt
        assert "at most 3 bullets" in system_prompt
        assert "Do not write a long report" in system_prompt
        assert "Do not expand into historical statistics" in system_prompt
        assert not _contains_disallowed_visible_text(system_prompt)
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "answer": "BA178 is the most delay-sensitive flight right now.",
                                    "suggested_prompts": ["Explain the payout threshold."],
                                    "confidence": 0.82,
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.5,
        transport=httpx.MockTransport(handler),
    )

    result = await provider.complete(
        question="What needs attention right now?",
        context=_sample_context(),
    )

    assert result.answer == "BA178 is the most delay-sensitive flight right now."
    assert result.suggested_prompts == ["Explain the payout threshold."]
    assert result.confidence == pytest.approx(0.82)


@pytest.mark.asyncio
async def test_deepseek_provider_complete_rejects_non_english_visible_answer_without_leaking_raw_text():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "answer": "これはテストです",
                                    "suggested_prompts": ["Explain the payout threshold."],
                                    "confidence": 0.82,
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.5,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(CopilotProviderError) as exc_info:
        await provider.complete(
            question="What needs attention right now?",
            context=_sample_context(),
        )

    assert exc_info.value.code == "invalid_response"
    assert "これはテストです" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_deepseek_provider_complete_rejects_fullwidth_latin_answer_without_leaking_raw_text():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "answer": "ＡＢＣ１２３",
                                    "suggested_prompts": ["Explain the payout threshold."],
                                    "confidence": 0.82,
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.5,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(CopilotProviderError) as exc_info:
        await provider.complete(
            question="What needs attention right now?",
            context=_sample_context(),
        )

    assert exc_info.value.code == "invalid_response"
    assert "ＡＢＣ１２３" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_deepseek_provider_filters_non_english_visible_suggested_prompts():
    from backend.copilot.provider import DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "answer": "BA178 is the most delay-sensitive flight right now.",
                                    "suggested_prompts": [
                                        "Explain the payout threshold.",
                                        "안녕하세요",
                                        "これは次に確認すべきですか？",
                                        "Which evidence changed most recently?",
                                    ],
                                    "confidence": 0.82,
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.5,
        transport=httpx.MockTransport(handler),
    )

    result = await provider.complete(
        question="What needs attention right now?",
        context=_sample_context(),
    )

    assert result.suggested_prompts == [
        "Explain the payout threshold.",
        "Which evidence changed most recently?",
    ]


@pytest.mark.asyncio
async def test_deepseek_provider_filters_halfwidth_and_fullwidth_form_suggested_prompts():
    from backend.copilot.provider import DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "answer": "BA178 is the most delay-sensitive flight right now.",
                                    "suggested_prompts": [
                                        "Explain the payout threshold.",
                                        "ｶﾀｶﾅ",
                                        "￦",
                                        "Which evidence changed most recently?",
                                    ],
                                    "confidence": 0.82,
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.5,
        transport=httpx.MockTransport(handler),
    )

    result = await provider.complete(
        question="What needs attention right now?",
        context=_sample_context(),
    )

    assert result.suggested_prompts == [
        "Explain the payout threshold.",
        "Which evidence changed most recently?",
    ]


@pytest.mark.asyncio
async def test_deepseek_provider_streams_answer_deltas_from_sse_chunks():
    from backend.copilot.provider import DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["model"] == "deepseek-v4-pro"
        assert payload["stream"] is True
        assert payload["thinking"] == {"type": "disabled"}
        assert "response_format" not in payload
        assert payload["max_tokens"] == EXPECTED_MAX_TOKENS
        system_prompt = payload["messages"][0]["content"]
        assert "Respond in English." in system_prompt
        assert "Return plain English or Markdown" in system_prompt
        assert "Do not return JSON." in system_prompt
        assert not _contains_disallowed_visible_text(system_prompt)
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            text=(
                'data: {"choices":[{"delta":{"reasoning_content":"First reasoning chunk."}}]}\n\n'
                'data: {"choices":[{"delta":{"reasoning_content":"Second reasoning chunk."}}]}\n\n'
                'data: {"choices":[{"delta":{"content":"Tower is tracking "}}]}\n\n'
                'data: {"choices":[{"delta":{"content":"BA178 near the payout threshold."}}]}\n\n'
                "data: [DONE]\n\n"
            ),
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.5,
        transport=httpx.MockTransport(handler),
    )

    chunks: list[str] = []
    async for chunk in provider.stream(
        question="What needs attention right now?",
        context=_sample_context(),
    ):
        chunks.append(chunk)

    assert chunks == ["Tower is tracking ", "BA178 near the payout threshold."]


@pytest.mark.asyncio
async def test_deepseek_provider_stream_rejects_reasoning_only_sse_without_leaking_raw_text():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            text=(
                'data: {"choices":[{"delta":{"reasoning_content":"Private chain-of-thought."}}]}\n\n'
                "data: [DONE]\n\n"
            ),
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.5,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(CopilotProviderError) as exc_info:
        async for _ in provider.stream(
            question="What needs attention right now?",
            context=_sample_context(),
        ):
            pass

    assert exc_info.value.code == "invalid_response"
    assert "Private chain-of-thought." not in str(exc_info.value)


@pytest.mark.asyncio
async def test_deepseek_provider_stream_rejects_cjk_delta_before_yielding_it():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            text=(
                'data: {"choices":[{"delta":{"content":"Tower is tracking "}}]}\n\n'
                'data: {"choices":[{"delta":{"content":"这是中文增量"}}]}\n\n'
                "data: [DONE]\n\n"
            ),
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.5,
        transport=httpx.MockTransport(handler),
    )

    chunks: list[str] = []
    with pytest.raises(CopilotProviderError) as exc_info:
        async for chunk in provider.stream(
            question="What needs attention right now?",
            context=_sample_context(),
        ):
            chunks.append(chunk)

    assert chunks == ["Tower is tracking "]
    assert exc_info.value.code == "invalid_response"
    assert "这是中文增量" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_deepseek_provider_stream_rejects_japanese_delta_before_yielding_it():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            text=(
                'data: {"choices":[{"delta":{"content":"これはテストです"}}]}\n\n'
                "data: [DONE]\n\n"
            ),
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.5,
        transport=httpx.MockTransport(handler),
    )

    chunks: list[str] = []
    with pytest.raises(CopilotProviderError) as exc_info:
        async for chunk in provider.stream(
            question="What needs attention right now?",
            context=_sample_context(),
        ):
            chunks.append(chunk)

    assert chunks == []
    assert exc_info.value.code == "invalid_response"
    assert "これはテストです" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_deepseek_provider_stream_rejects_halfwidth_hangul_delta_before_yielding_it():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            text=(
                'data: {"choices":[{"delta":{"content":"Tower is tracking "}}]}\n\n'
                'data: {"choices":[{"delta":{"content":"ﾡ"}}]}\n\n'
                "data: [DONE]\n\n"
            ),
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.5,
        transport=httpx.MockTransport(handler),
    )

    chunks: list[str] = []
    with pytest.raises(CopilotProviderError) as exc_info:
        async for chunk in provider.stream(
            question="What needs attention right now?",
            context=_sample_context(),
        ):
            chunks.append(chunk)

    assert chunks == ["Tower is tracking "]
    assert exc_info.value.code == "invalid_response"
    assert "ﾡ" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_deepseek_provider_stream_rejects_non_sse_success_response_without_leaking_body():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "application/json"},
            text='{"detail":"deepseek-secret-value"}',
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(CopilotProviderError) as exc_info:
        async for _ in provider.stream(
            question="What needs attention right now?",
            context=_sample_context(),
        ):
            pass

    assert exc_info.value.code == "invalid_response"
    assert "deepseek-secret-value" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_deepseek_provider_stream_rejects_empty_sse_without_delta_or_done():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            text="",
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(CopilotProviderError) as exc_info:
        async for _ in provider.stream(
            question="What needs attention right now?",
            context=_sample_context(),
        ):
            pass

    assert exc_info.value.code == "invalid_response"


@pytest.mark.asyncio
async def test_deepseek_provider_maps_timeout_to_public_error():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("read timed out", request=request)

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=0.1,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(CopilotProviderError) as exc_info:
        await provider.complete(
            question="What needs attention right now?",
            context=_sample_context(),
        )

    assert exc_info.value.code == "timeout"
    assert str(exc_info.value) == "DeepSeek request timed out. Please try again."


@pytest.mark.asyncio
async def test_deepseek_provider_maps_upstream_error_without_leaking_body():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            502,
            json={"error": {"message": "upstream stacktrace secret-key-123"}},
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(CopilotProviderError) as exc_info:
        await provider.complete(
            question="What needs attention right now?",
            context=_sample_context(),
        )

    assert exc_info.value.code == "upstream_error"
    assert "secret-key-123" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_deepseek_provider_rejects_non_json_content_without_leaking_raw_response():
    from backend.copilot.provider import CopilotProviderError, DeepSeekProvider

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "not-json raw provider response with deepseek-secret-value"
                        }
                    }
                ]
            },
        )

    provider = DeepSeekProvider(
        api_key="test-deepseek-key",
        model="deepseek-v4-pro",
        base_url="https://deepseek.test",
        timeout_seconds=2.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(CopilotProviderError) as exc_info:
        await provider.complete(
            question="What needs attention right now?",
            context=_sample_context(),
        )

    assert exc_info.value.code == "invalid_response"
    assert "deepseek-secret-value" not in str(exc_info.value)
