from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import google
from backend.auth.deps import CurrentUser
from backend.auth.jwt import encode_session
from backend.auth.service import UserService
from backend.config import get_settings
from backend.db import get_session

router = APIRouter()


class GoogleAuthRequest(BaseModel):
    id_token: str


class DevLoginRequest(BaseModel):
    email: str
    name: str = "Dev Captain"


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str
    balance: int


@router.post("/auth/google", response_model=UserPublic)
async def auth_google(
    body: GoogleAuthRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserPublic:
    profile = google.verify_id_token(body.id_token)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid Google token")
    user = await UserService(session).create_or_get(profile)
    await session.commit()
    settings = get_settings()
    token = encode_session(user_id=user.id)
    response.set_cookie(
        settings.jwt_cookie_name,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_ttl_hours * 3600,
    )
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        balance=user.balance,
    )


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUser) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        balance=user.balance,
    )


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        settings.jwt_cookie_name,
        secure=settings.cookie_secure,
        samesite="lax",
    )


@router.post("/auth/dev-login", response_model=UserPublic)
async def auth_dev_login(
    body: DevLoginRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserPublic:
    settings = get_settings()
    if not settings.dev_login_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")

    user = await UserService(session).create_or_get_dev(
        email=body.email,
        name=body.name,
    )
    await session.commit()
    token = encode_session(
        user_id=user.id,
        extra_claims={
            "dev_email": user.email,
            "dev_name": user.name,
        },
    )
    response.set_cookie(
        settings.jwt_cookie_name,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_ttl_hours * 3600,
    )
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        balance=user.balance,
    )
