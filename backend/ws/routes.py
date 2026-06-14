import asyncio
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.ws.broadcaster import Broadcaster, EventType
from backend.ws.deps import authenticate_ws

router = APIRouter()


def _broadcaster_from(websocket: WebSocket) -> Broadcaster:
    return websocket.app.state.broadcaster


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
    try:
        user_id = await authenticate_ws(websocket)
    except Exception:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    broadcaster = _broadcaster_from(websocket)
    subscriber = broadcaster.subscribe(user_id=user_id)
    try:
        await websocket.send_json(
            {
                "type": EventType.HELLO.value,
                "payload": {"server_time": int(time.time())},
            }
        )
        while True:
            try:
                msg = await asyncio.wait_for(subscriber.queue.get(), timeout=20.0)
                await websocket.send_json(msg)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping", "payload": {}})
    except WebSocketDisconnect:
        pass
    finally:
        broadcaster.unsubscribe(subscriber)
