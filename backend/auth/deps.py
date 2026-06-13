from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt import JWTError, decode_session
from backend.auth.service import UserService
from backend.db import get_session
from backend.models import User


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_session)],
    rialo_session: Annotated[str | None, Cookie()] = None,
) -> User:
    if not rialo_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    try:
        payload = decode_session(rialo_session)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid session")
    user = await UserService(session).get_by_id(payload["sub"])
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user gone")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
