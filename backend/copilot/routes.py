from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import CurrentUser
from backend.config import get_settings
from backend.db import get_session
from backend.flights.cache import FlightCache

from .context import CopilotContextBuilder
from .provider import DeepSeekProvider
from .schemas import CopilotAskRequest, CopilotAskResponse, encode_sse_event
from .service import CopilotNotFoundError, CopilotService

router = APIRouter(prefix="/copilot", tags=["copilot"])


def build_copilot_service(
    session: AsyncSession,
    *,
    flight_cache: FlightCache | None = None,
) -> CopilotService:
    settings = get_settings()
    provider = DeepSeekProvider(
        api_key=settings.deepseek_api_key,
        model=settings.deepseek_model,
        base_url=settings.deepseek_base_url,
        timeout_seconds=settings.deepseek_timeout_seconds,
    )
    return CopilotService(
        session,
        provider=provider,
        deepseek_api_key=settings.deepseek_api_key,
        deepseek_model=settings.deepseek_model,
        context_builder=CopilotContextBuilder(session, flight_cache=flight_cache),
    )


@router.post("/ask", response_model=CopilotAskResponse)
async def copilot_ask(
    request: Request,
    body: CopilotAskRequest,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CopilotAskResponse:
    service = build_copilot_service(
        session,
        flight_cache=getattr(request.app.state, "flight_cache", None),
    )
    try:
        return await service.ask(user, body)
    except CopilotNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found") from exc


@router.post("/ask/stream")
async def copilot_ask_stream(
    request: Request,
    body: CopilotAskRequest,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> StreamingResponse:
    service = build_copilot_service(
        session,
        flight_cache=getattr(request.app.state, "flight_cache", None),
    )
    stream_iter = service.stream(user, body)
    try:
        first_event = await anext(stream_iter)
    except StopAsyncIteration:
        first_event = None
    except CopilotNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found") from exc

    async def event_source():
        if first_event is not None:
            yield encode_sse_event(first_event)
        async for event in stream_iter:
            yield encode_sse_event(event)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform"},
    )
