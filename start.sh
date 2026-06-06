#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PORT="${PORT:-8001}"
PERSONA_PORT="${PERSONA_PORT:-8765}"
PERSONA_DIR="${PERSONA_DIR:-/Users/jv222/persona}"
PERSONA_WEB="${PERSONA_DIR}/.venv/bin/persona-web"
PYTHON="${ROOT}/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
  "$PYTHON" -m pip install -r requirements.txt
fi

check_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -i ":${port}" -sTCP:LISTEN 2>/dev/null || true
  fi
}

existing="$(check_port "$PORT")"
if [[ -n "$existing" ]]; then
  echo "Port ${PORT} is already in use:"
  echo "$existing"
  echo ""
  echo "Either open http://127.0.0.1:${PORT}/ in your browser,"
  echo "or stop the process and run this script again."
  if [[ "$(uname)" == "Darwin" ]]; then
    sleep 1
    open "http://127.0.0.1:${PORT}/"
  fi
  exit 0
fi

ensure_indexed_backend() {
  local backend_url="http://127.0.0.1:${PERSONA_PORT}"

  if curl -fsS "${backend_url}/api/persona" >/dev/null 2>&1; then
    echo "Indexed persona backend is already running at ${backend_url}."
    export PERSONA_BACKEND="${backend_url}"
    return
  fi

  if [[ ! -x "$PERSONA_WEB" ]]; then
    echo "Indexed persona backend not found at ${PERSONA_WEB}; continuing with local-source mode."
    return
  fi

  echo "Starting indexed persona backend on port ${PERSONA_PORT}..."
  (
    cd "$PERSONA_DIR"
    PERSONA_PORT="$PERSONA_PORT" "$PERSONA_WEB" > /private/tmp/persona-web.log 2>&1
  ) &

  for _ in {1..30}; do
    if curl -fsS "${backend_url}/api/persona" >/dev/null 2>&1; then
      export PERSONA_BACKEND="${backend_url}"
      return
    fi
    sleep 0.3
  done

  echo "Indexed persona backend did not become ready; continuing with local-source mode."
}

ensure_indexed_backend

echo "Starting Karpathy Companion on port ${PORT}..."
export PORT

if [[ "$(uname)" == "Darwin" ]]; then
  (
    sleep 1
    open "http://127.0.0.1:${PORT}/"
  ) &
fi

exec "$PYTHON" server.py
