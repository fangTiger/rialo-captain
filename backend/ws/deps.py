from fastapi import WebSocket, WebSocketException, status

from backend.auth.jwt import JWTError, decode_session
from backend.config import get_settings


async def authenticate_ws(websocket: WebSocket) -> str:
    """从 cookie 校验 JWT，返回 user_id。"""
    cookie_name = get_settings().jwt_cookie_name
    token = websocket.cookies.get(cookie_name)
    if not token:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="not authenticated",
        )
    try:
        payload = decode_session(token)
    except JWTError as exc:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="invalid session",
        ) from exc
    return payload["sub"]
