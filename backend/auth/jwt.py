import time

import jwt as pyjwt

from backend.config import get_settings


class JWTError(Exception):
    pass


def encode_session(*, user_id: str, ttl_hours: int | None = None) -> str:
    settings = get_settings()
    hours = ttl_hours if ttl_hours is not None else settings.jwt_ttl_hours
    payload = {
        "sub": user_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + hours * 3600,
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_session(token: str) -> dict:
    settings = get_settings()
    try:
        return pyjwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except pyjwt.PyJWTError as exc:
        raise JWTError(str(exc)) from exc
