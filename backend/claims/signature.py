import hashlib


def build_signature(*, policy_id: str, timestamp: int, nonce: int) -> str:
    """生成 0x... 64-hex 风格签名 - mock 链上签名展示用，前端不区分真假签名。"""
    material = f"{policy_id}|{timestamp}|{nonce}".encode()
    return "0x" + hashlib.sha256(material).hexdigest()
