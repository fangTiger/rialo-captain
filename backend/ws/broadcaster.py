import asyncio
import enum
import uuid
from dataclasses import dataclass, field


class EventType(str, enum.Enum):
    HELLO = "hello"
    STATE_UPDATE = "state_update"
    FLARE = "flare"
    TOAST = "toast"


@dataclass
class Subscriber:
    id: str
    user_id: str
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=256))


class Broadcaster:
    def __init__(self) -> None:
        self._subs: dict[str, Subscriber] = {}

    def subscribe(self, *, user_id: str) -> Subscriber:
        sub = Subscriber(id=uuid.uuid4().hex, user_id=user_id)
        self._subs[sub.id] = sub
        return sub

    def unsubscribe(self, sub: Subscriber) -> None:
        self._subs.pop(sub.id, None)

    def subscriber_count(self) -> int:
        return len(self._subs)

    async def broadcast(self, message: dict) -> None:
        for sub in list(self._subs.values()):
            try:
                sub.queue.put_nowait(message)
            except asyncio.QueueFull:
                # 慢消费者：丢弃最旧消息，保留最新状态。
                try:
                    sub.queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    sub.queue.put_nowait(message)
                except asyncio.QueueFull:
                    pass

    async def send_to_user(self, user_id: str, message: dict) -> None:
        for sub in list(self._subs.values()):
            if sub.user_id == user_id:
                try:
                    sub.queue.put_nowait(message)
                except asyncio.QueueFull:
                    pass
