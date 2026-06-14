"""Mock 飞行数据源 - 当 OPENSKY_ENABLED=false 时替代真 OpenSkyClient.

提供与 OpenSkyClient 相同的接口 (fetch_all / fetch_track / aclose),
不打任何外部网络. 位置基于当前时间小幅度漂移, 让前端 SWR 能感受到运动.

数据组成: 20 个命名航班 (BA178/DL101/... 易识别) + N 个程序化生成航班 (默认 300),
总数受 MOCK_FLIGHT_COUNT env 控制. 程序化航班分布在常见飞行走廊 (北纬 -50..70).
"""
import math
import os
import random
import time

from backend.flights.opensky import FlightState, TrackPoint


# 命名航班 - 用真实航司前缀, 便于 demo 现场识别
# (callsign, icao24, base_lon, base_lat, country, velocity m/s, heading deg)
_NAMED_ROUTES: list[tuple[str, str, float, float, str, float, float]] = [
    ("BA178", "400a01", -1.0, 51.5, "United Kingdom", 240.0, 270.0),
    ("DL101", "a12345", -73.78, 40.64, "United States", 235.0, 90.0),
    ("UA200", "ac0001", -122.4, 37.6, "United States", 250.0, 180.0),
    ("AF1380", "39c1a3", 2.4, 48.9, "France", 220.0, 0.0),
    ("CX251", "780abc", 114.0, 22.3, "Hong Kong", 245.0, 280.0),
    ("JL5", "86abcd", 139.8, 35.5, "Japan", 230.0, 90.0),
    ("SQ22", "76cdef", 103.9, 1.4, "Singapore", 250.0, 45.0),
    ("EK401", "896aaa", 55.3, 25.3, "United Arab Emirates", 235.0, 120.0),
    ("TK1", "4bba01", 28.8, 41.0, "Turkey", 220.0, 90.0),
    ("LH400", "3c0123", 8.6, 50.0, "Germany", 240.0, 200.0),
    ("EY8", "896bbb", 54.7, 24.4, "United Arab Emirates", 230.0, 60.0),
    ("QF11", "7c1cab", 151.2, -33.9, "Australia", 240.0, 270.0),
    ("AZ610", "300abc", 12.5, 41.9, "Italy", 225.0, 90.0),
    ("AC859", "c01234", -79.6, 43.7, "Canada", 235.0, 270.0),
    ("IB6253", "342abc", -3.7, 40.4, "Spain", 230.0, 0.0),
    ("KL643", "484abc", 4.8, 52.3, "Netherlands", 230.0, 90.0),
    ("AY103", "461abc", 24.9, 60.3, "Finland", 215.0, 180.0),
    ("LO27", "489abc", 21.0, 52.2, "Poland", 225.0, 180.0),
    ("MS753", "010abc", 31.2, 30.0, "Egypt", 230.0, 0.0),
    ("ET500", "044abc", 38.8, 9.0, "Ethiopia", 240.0, 90.0),
]

_AIRLINE_PREFIXES = [
    "AAL", "UAL", "DAL", "SWA", "JBU", "NKS", "ACA", "WJA",
    "BAW", "VIR", "EZY", "RYR", "AFR", "DLH", "KLM", "SAS",
    "IBE", "AZA", "SWR", "AUA", "FIN", "LOT", "TAP", "BEL",
    "JAL", "ANA", "CES", "CCA", "CSN", "CPA", "EVA", "CAL",
    "SIA", "MAS", "THA", "GIA", "VJC", "PAL", "ANZ", "QFA",
    "UAE", "QTR", "ETD", "SVA", "MSR", "RJA", "MEA", "KAC",
    "ETH", "KQA", "RAM", "TAR", "DAH", "TAM", "AVA", "ARG",
]

_COUNTRIES = [
    "United States", "United Kingdom", "Germany", "France", "Spain",
    "Italy", "Netherlands", "Japan", "China", "Singapore", "Australia",
    "United Arab Emirates", "Turkey", "Brazil", "Canada", "India",
    "South Korea", "Mexico", "Egypt", "South Africa",
]


# 真实飞行密集区域 (lon_min, lon_max, lat_min, lat_max, weight)
# lon_max 可以 > 180 表示跨日期变更线 (使用时会 wrap 到 [-180, 180])
_HOTSPOTS: list[tuple[str, float, float, float, float, float]] = [
    ("NorthAmerica",   -125, -70,  28,  55, 0.18),
    ("Europe",          -10,  35,  35,  62, 0.16),
    ("EastAsia",        105, 145,  22,  48, 0.13),
    ("NorthAtlantic",   -55, -15,  42,  60, 0.08),
    ("NorthPacific",    155, 220,  35,  55, 0.07),  # 跨日期变更线
    ("MiddleEast",       35,  60,  22,  40, 0.06),
    ("SouthAsia",        65,  95,  12,  32, 0.06),
    ("SoutheastAsia",    95, 135, -10,  22, 0.06),
    ("Australia",       112, 155, -42, -12, 0.04),
    ("SouthAmerica",    -75, -35, -38,   8, 0.05),
    ("Africa",           -5,  45, -28,  30, 0.05),
    ("Other",          -180, 180, -55,  70, 0.06),
]


def _pick_region(rng: random.Random) -> tuple[float, float, float, float]:
    r = rng.random()
    cumulative = 0.0
    for _, lon_min, lon_max, lat_min, lat_max, weight in _HOTSPOTS:
        cumulative += weight
        if r <= cumulative:
            return lon_min, lon_max, lat_min, lat_max
    last = _HOTSPOTS[-1]
    return last[1], last[2], last[3], last[4]


def _generated_routes(count: int) -> list[tuple[str, str, float, float, str, float, float]]:
    """程序化生成 count 个虚拟航班.

    Deterministic (seed=42) - 同 count 多次调用结果一致.
    按真实飞行密集区域加权分布: 北美/欧洲/东亚 占大头, 海洋稀疏.
    """
    rng = random.Random(42)
    out: list[tuple[str, str, float, float, str, float, float]] = []
    for i in range(count):
        airline = _AIRLINE_PREFIXES[i % len(_AIRLINE_PREFIXES)]
        flight_num = (i // len(_AIRLINE_PREFIXES)) * 7 + 100 + (i % 11)
        callsign = f"{airline}{flight_num}"
        icao24 = f"{(0x100000 + i):06x}"

        lon_min, lon_max, lat_min, lat_max = _pick_region(rng)
        lon = rng.uniform(lon_min, lon_max)
        # wrap 跨日期变更线的经度回到 [-180, 180]
        if lon > 180.0:
            lon -= 360.0
        lat = rng.uniform(lat_min, lat_max)
        heading = rng.uniform(0.0, 360.0)
        velocity = rng.uniform(200.0, 280.0)
        country = _COUNTRIES[rng.randint(0, len(_COUNTRIES) - 1)]
        out.append((callsign, icao24, lon, lat, country, velocity, heading))
    return out


def _all_routes() -> list[tuple[str, str, float, float, str, float, float]]:
    """命名航班 + 程序化生成. 数量由 MOCK_FLIGHT_COUNT env 控制."""
    try:
        total = int(os.environ.get("MOCK_FLIGHT_COUNT", "300"))
    except ValueError:
        total = 300
    total = max(len(_NAMED_ROUTES), min(2000, total))
    needed = total - len(_NAMED_ROUTES)
    if needed <= 0:
        return list(_NAMED_ROUTES)
    return list(_NAMED_ROUTES) + _generated_routes(needed)


_ROUTES = _all_routes()


def _drift_position(
    base_lon: float, base_lat: float, velocity: float, heading: float, elapsed_sec: float
) -> tuple[float, float]:
    heading_rad = math.radians(heading)
    dx_m = velocity * math.sin(heading_rad) * elapsed_sec
    dy_m = velocity * math.cos(heading_rad) * elapsed_sec
    dlat = dy_m / 111_000
    cos_lat = math.cos(math.radians(base_lat))
    dlon = dx_m / (111_000 * max(0.1, cos_lat))
    new_lon = base_lon + dlon
    new_lat = base_lat + dlat
    # 经度 wrap 到 [-180, 180]
    new_lon = ((new_lon + 180) % 360) - 180
    # 纬度 clamp 到 [-85, 85]
    new_lat = max(-85.0, min(85.0, new_lat))
    return new_lon, new_lat


def generate_mock_states(now: int | None = None) -> list[FlightState]:
    """生成虚拟航班状态. 位置基于 (now % 1800) 缓慢漂移 (30 分钟周期)."""
    if now is None:
        now = int(time.time())
    elapsed = float(now % 1800)
    states: list[FlightState] = []
    for callsign, icao24, base_lon, base_lat, country, velocity, heading in _ROUTES:
        lon, lat = _drift_position(base_lon, base_lat, velocity, heading, elapsed)
        states.append(
            FlightState(
                icao24=icao24,
                callsign=callsign,
                origin_country=country,
                longitude=lon,
                latitude=lat,
                velocity=velocity,
                heading=heading,
                on_ground=False,
            )
        )
    return states


def generate_mock_track(*, icao24: str, now: int | None = None) -> list[TrackPoint]:
    """生成过去 30 分钟的虚拟航迹点 (每 60 秒一个点)."""
    if now is None:
        now = int(time.time())
    # 找到这架飞机的基础数据
    matched = next((r for r in _ROUTES if r[1].lower() == icao24.lower()), None)
    if matched is None:
        return []
    _, _, base_lon, base_lat, _, velocity, heading = matched
    points: list[TrackPoint] = []
    elapsed_now = float(now % 1800)
    for offset_back in range(30, 0, -1):
        elapsed = max(0.0, elapsed_now - offset_back * 60.0)
        lon, lat = _drift_position(base_lon, base_lat, velocity, heading, elapsed)
        points.append(
            TrackPoint(
                time=now - offset_back * 60,
                latitude=lat,
                longitude=lon,
                altitude=11000.0,
                heading=heading,
                on_ground=False,
            )
        )
    return points


class MockOpenSky:
    """与 OpenSkyClient 接口兼容的 mock, 不打外部网络."""

    async def fetch_all(self) -> list[FlightState]:
        return generate_mock_states()

    async def fetch_track(self, *, icao24: str, time: int = 0) -> list[TrackPoint]:
        del time
        return generate_mock_track(icao24=icao24)

    async def aclose(self) -> None:
        return None
