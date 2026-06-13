import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Flight, User


async def make_user(
    session: AsyncSession,
    *,
    email: str = "user@example.com",
    name: str = "Test User",
    balance: int = 1000,
) -> User:
    user = User(
        google_sub=f"sub-{uuid.uuid4().hex[:8]}",
        email=email,
        name=name,
        balance=balance,
    )
    session.add(user)
    await session.flush()
    return user


async def make_flight(
    session: AsyncSession,
    *,
    callsign: str = "BA178",
    date: str = "20260613",
    origin: str = "LHR",
    destination: str = "JFK",
) -> Flight:
    flight = Flight(
        id=f"{callsign}-{date}",
        callsign=callsign,
        origin=origin,
        destination=destination,
    )
    session.add(flight)
    await session.flush()
    return flight
