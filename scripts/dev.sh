#!/usr/bin/env bash
# Rialo-Captain 开发一键启动: backend on :8000, frontend on :5173
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "[dev] 已从 .env.example 复制 .env, 记得填 GOOGLE_CLIENT_ID"
fi

if [[ ! -f frontend/.env ]]; then
  cp frontend/.env.example frontend/.env
  echo "[dev] 已从 frontend/.env.example 复制 frontend/.env, 记得填 VITE_GOOGLE_CLIENT_ID"
fi

cleanup() {
  echo "[dev] stopping..."
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

echo "[dev] 启动 backend (uvicorn :8000)"
# 优先用 .venv，避免落到系统 Python 缺依赖
UVICORN_BIN="uvicorn"
if [[ -x ".venv/bin/uvicorn" ]]; then
  UVICORN_BIN=".venv/bin/uvicorn"
elif [[ -x "venv/bin/uvicorn" ]]; then
  UVICORN_BIN="venv/bin/uvicorn"
fi
"$UVICORN_BIN" backend.app:app --reload --port 8000 &

echo "[dev] 启动 frontend (vite :5173)"
(cd frontend && pnpm dev) &

wait
