from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt import JWTError, decode_session
from backend.auth.service import UserService
from backend.config import get_settings
from backend.db import get_session
from backend.models import User


async def get_current_user(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    settings = get_settings()
    rialo_session = request.cookies.get(settings.jwt_cookie_name)
    if not rialo_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    try:
        payload = decode_session(rialo_session)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid session")
    service = UserService(session)
    user = await service.get_by_id(payload["sub"])
    if user is None:
        dev_email = payload.get("dev_email")
        if settings.dev_login_enabled and isinstance(dev_email, str) and dev_email:
            dev_name = payload.get("dev_name")
            user = await service.create_or_get_dev(
                email=dev_email,
                name=dev_name if isinstance(dev_name, str) and dev_name else "Dev Captain",
                user_id=payload["sub"],
            )
            await session.commit()
            return user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user gone")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
