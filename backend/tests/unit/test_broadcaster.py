import pytest

from backend.ws.broadcaster import Broadcaster, EventType


@pytest.mark.asyncio
async def test_subscribe_unsubscribe_changes_count():
    bus = Broadcaster()
    sub_a = bus.subscribe(user_id="u1")
    sub_b = bus.subscribe(user_id="u2")
    assert bus.subscriber_count() == 2
    bus.unsubscribe(sub_a)
    assert bus.subscriber_count() == 1
    bus.unsubscribe(sub_b)
    assert bus.subscriber_count() == 0


@pytest.mark.asyncio
async def test_broadcast_delivers_to_all_subscribers():
    bus = Broadcaster()
    sub_a = bus.subscribe(user_id="u1")
    sub_b = bus.subscribe(user_id="u2")
    await bus.broadcast({"type": EventType.STATE_UPDATE.value, "payload": {"x": 1}})
    msg_a = sub_a.queue.get_nowait()
    msg_b = sub_b.queue.get_nowait()
    assert msg_a["payload"] == {"x": 1}
    assert msg_b["payload"] == {"x": 1}


@pytest.mark.asyncio
async def test_send_to_user_delivers_only_to_target():
    bus = Broadcaster()
    sub_a = bus.subscribe(user_id="u1")
    sub_b = bus.subscribe(user_id="u2")
    await bus.send_to_user("u1", {"type": EventType.TOAST.value, "payload": "+10 RIA"})
    msg_a = sub_a.queue.get_nowait()
    assert msg_a["payload"] == "+10 RIA"
    assert sub_b.queue.empty()


def test_event_type_enum_values():
    assert EventType.STATE_UPDATE.value == "state_update"
    assert EventType.FLARE.value == "flare"
    assert EventType.TOAST.value == "toast"
    assert EventType.HELLO.value == "hello"
