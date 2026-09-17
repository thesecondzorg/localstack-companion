#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "    LocalStack Resource Companion & Dynamic Provisioner   "
echo "=========================================================="

MODE="${1:-docker}"

# Detect docker compose / docker-compose
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "[!] Error: Neither 'docker compose' nor 'docker-compose' was found."
    exit 1
fi

if [ "$MODE" = "docker" ]; then
    echo "[*] Launching LocalStack and Companion via $COMPOSE_CMD..."
    $COMPOSE_CMD up --build
elif [ "$MODE" = "local" ]; then
    cleanup() {
        echo ""
        echo "[*] Shutting down LocalStack container..."
        $COMPOSE_CMD stop localstack >/dev/null 2>&1 || true
        echo "[✓] LocalStack container stopped."
    }
    trap cleanup INT TERM EXIT

    echo "[*] Checking LocalStack on port 4567..."
    if curl -s -f http://localhost:4567/_localstack/health >/dev/null 2>&1; then
        echo "[✓] LocalStack is already running and healthy on http://localhost:4567"
    else
        echo "[*] Starting LocalStack Core container via $COMPOSE_CMD (port 4567)..."
        $COMPOSE_CMD up -d localstack

        echo "[*] Waiting for LocalStack to become healthy..."
        RETRY=0
        MAX_RETRIES=30
        until curl -s -f http://localhost:4567/_localstack/health >/dev/null 2>&1 || [ $RETRY -eq $MAX_RETRIES ]; do
            RETRY=$((RETRY+1))
            sleep 1
        done

        if [ $RETRY -eq $MAX_RETRIES ]; then
            echo "[!] Warning: LocalStack healthcheck timed out, attempting to start backend anyway..."
        else
            echo "[✓] LocalStack is ready on port 4567!"
        fi
    fi

    echo "[*] Running Companion backend (proxy on :4566)..."
    if [ ! -d "backend/.venv" ]; then
        echo "[*] Creating Python virtual environment..."
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
