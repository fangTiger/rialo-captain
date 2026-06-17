from pathlib import Path


def test_vercel_python_version_uses_supported_runtime():
    version = Path(".python-version").read_text(encoding="utf-8").strip()

    assert version == "3.12"
