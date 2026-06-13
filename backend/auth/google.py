from dataclasses import dataclass

import httpx
from google.auth import exceptions as google_exceptions
from google.auth import transport
from google.oauth2 import id_token

from backend.config import get_settings


@dataclass(frozen=True)
class GoogleProfile:
    sub: str
    email: str
    name: str
    avatar_url: str


class _HttpxResponse(transport.Response):
    def __init__(self, response: httpx.Response):
        self._response = response

    @property
    def status(self) -> int:
        return self._response.status_code

    @property
    def headers(self) -> httpx.Headers:
        return self._response.headers

    @property
    def data(self) -> bytes:
        return self._response.content


class _HttpxRequest(transport.Request):
    def __init__(self, client: httpx.Client | None = None):
        self._client = client or httpx.Client()

    def __call__(
        self,
        url: str,
        method: str = "GET",
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
        timeout: int | None = None,
        **kwargs,
    ) -> _HttpxResponse:
        try:
            response = self._client.request(
                method,
                url,
                content=body,
                headers=headers,
                timeout=timeout,
                **kwargs,
            )
        except httpx.HTTPError as exc:
            raise google_exceptions.TransportError(exc) from exc
        return _HttpxResponse(response)


_request = _HttpxRequest()


def verify_id_token(token: str) -> GoogleProfile | None:
    settings = get_settings()
    try:
        payload = id_token.verify_oauth2_token(token, _request, settings.google_client_id)
    except ValueError:
        return None
    return GoogleProfile(
        sub=payload["sub"],
        email=payload.get("email", ""),
        name=payload.get("name", ""),
        avatar_url=payload.get("picture", ""),
    )
