from typing import Annotated

from fastapi import Header, HTTPException, status

from backend.config import get_settings


def admin_required(x_admin_token: Annotated[str | None, Header()] = None) -> None:
    expected = get_settings().admin_token
    if not x_admin_token or x_admin_token != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
