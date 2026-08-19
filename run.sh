#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "    LocalStack Resource Companion & Dynamic Provisioner   "
echo "=========================================================="

MODE="${1:-docker}"

if [ "$MODE" = "docker" ]; then
    echo "[*] Launching LocalStack and Companion via Docker Compose..."
    docker compose up --build
elif [ "$MODE" = "local" ]; then
    echo "[*] Running standalone backend (assuming LocalStack on :4567)..."
    if [ ! -d "backend/.venv" ]; then
        echo "[*] Creating virtualenv..."
        python3 -m venv backend/.venv
        ./backend/.venv/bin/pip install -r backend/requirements.txt
    fi
    export LOCALSTACK_URL="http://localhost:4567"
    export CONFIG_PATH="resources.yaml"
    export PORT="4566"
    ./backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 4566 --reload
else
    echo "Usage: ./run.sh [docker|local]"
    exit 1
fi
