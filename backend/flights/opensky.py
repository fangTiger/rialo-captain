import asyncio
from dataclasses import dataclass

import httpx

from backend.config import get_settings


class OpenSkyError(Exception):
    pass


@dataclass(frozen=True)
class FlightState:
    icao24: str
    callsign: str
    origin_country: str
    longitude: float | None
    latitude: float | None
    velocity: float | None
    heading: float | None
    on_ground: bool


@dataclass(frozen=True)
class TrackPoint:
    time: int
    latitude: float
    longitude: float
    altitude: float | None
    heading: float | None
    on_ground: bool


def _parse_state(row: list) -> FlightState | None:
    # OpenSky /states/all 列顺序见官方 REST API 文档。
    try:
        return FlightState(
            icao24=row[0] or "",
            callsign=(row[1] or "").strip(),
            origin_country=row[2] or "",
            longitude=row[5],
            latitude=row[6],
            velocity=row[9],
            heading=row[10],
            on_ground=bool(row[8]),
        )
    except (IndexError, TypeError):
        return None


class OpenSkyClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        max_attempts: int = 3,
        base_backoff: float = 1.0,
    ) -> None:
        self._base = (base_url or get_settings().opensky_base_url).rstrip("/")
        self._client = httpx.AsyncClient(transport=transport, timeout=10.0)
        self._max_attempts = max_attempts
        self._base_backoff = base_backoff

    async def aclose(self) -> None:
        await self._client.aclose()

    async def fetch_all(self) -> list[FlightState]:
        last_error: Exception | None = None
        for attempt in range(self._max_attempts):
            try:
                resp = await self._client.get(f"{self._base}/states/all")
                if resp.status_code >= 500:
                    raise OpenSkyError(f"upstream {resp.status_code}")
                resp.raise_for_status()
                data = resp.json()
                raw = data.get("states") or []
                states = [state for row in raw if (state := _parse_state(row)) and state.callsign]
                return states
            except (OpenSkyError, httpx.HTTPError) as exc:
                last_error = exc
                if attempt < self._max_attempts - 1:
                    await asyncio.sleep(self._base_backoff * (2**attempt))
        raise OpenSkyError(f"OpenSky failed after {self._max_attempts} attempts: {last_error}")

    async def fetch_track(self, *, icao24: str, time: int = 0) -> list[TrackPoint]:
        """OpenSky /tracks/all: aircraft 的最近航迹路径 (最多 ~30 天).

        参数:
            icao24: 飞机 ICAO 24 位地址 (小写 hex)
            time: 0 表示当前活跃 track; 其他值是 unix 时间戳

        返回: 按时间升序的航迹点列表; OpenSky 找不到时返回 [].
        """
        last_error: Exception | None = None
        for attempt in range(self._max_attempts):
            try:
                resp = await self._client.get(
                    f"{self._base}/tracks/all",
                    params={"icao24": icao24.lower(), "time": time},
                )
                if resp.status_code == 404:
                    return []
                if resp.status_code >= 500:
                    raise OpenSkyError(f"upstream {resp.status_code}")
                resp.raise_for_status()
                data = resp.json() or {}
                path = data.get("path") or []
                points: list[TrackPoint] = []
                for row in path:
                    if not isinstance(row, list) or len(row) < 6:
                        continue
                    if row[1] is None or row[2] is None:
                        continue
                    try:
                        points.append(
                            TrackPoint(
                                time=int(row[0]),
                                latitude=float(row[1]),
                                longitude=float(row[2]),
                                altitude=float(row[3]) if row[3] is not None else None,
                                heading=float(row[4]) if row[4] is not None else None,
                                on_ground=bool(row[5]),
                            )
                        )
                    except (TypeError, ValueError):
                        continue
                return points
            except (OpenSkyError, httpx.HTTPError) as exc:
                last_error = exc
                if attempt < self._max_attempts - 1:
                    await asyncio.sleep(self._base_backoff * (2**attempt))
        raise OpenSkyError(f"OpenSky tracks failed: {last_error}")
