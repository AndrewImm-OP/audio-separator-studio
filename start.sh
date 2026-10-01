#!/bin/bash
# Start Audio Separator desktop app in development mode
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend/audio-separator-ui"

echo "=== Audio Separator (Desktop) ==="
echo ""

# Clear ELECTRON_RUN_AS_NODE if set (breaks Electron)
unset ELECTRON_RUN_AS_NODE

# Locate functional python venv
VENV_ACTIVATE=""
if [ -f "$BACKEND_DIR/venv/bin/activate" ] && "$BACKEND_DIR/venv/bin/python" -c "import sys" 2>/dev/null; then
    VENV_ACTIVATE="$BACKEND_DIR/venv/bin/activate"
elif [ -f "$HOME/.local/share/audio-separator/venv/bin/activate" ] && "$HOME/.local/share/audio-separator/venv/bin/python" -c "import sys" 2>/dev/null; then
    VENV_ACTIVATE="$HOME/.local/share/audio-separator/venv/bin/activate"
fi

if [ -z "$VENV_ACTIVATE" ]; then
    echo "Backend environment not set up or needs repair."
    echo "Running setup script..."
    cd "$BACKEND_DIR" && bash setup.sh
    if [ -f "$HOME/.local/share/audio-separator/venv/bin/activate" ]; then
        VENV_ACTIVATE="$HOME/.local/share/audio-separator/venv/bin/activate"
    elif [ -f "$BACKEND_DIR/venv/bin/activate" ]; then
        VENV_ACTIVATE="$BACKEND_DIR/venv/bin/activate"
    fi
fi

# Check if frontend deps installed
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd "$FRONTEND_DIR" && npm install --no-bin-links
fi

echo "Starting backend (port 8000)..."
cd "$BACKEND_DIR"
source "$VENV_ACTIVATE"
export MSST_PATH="$BACKEND_DIR/msst"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "Starting Electron app..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== Services running ==="
echo "Backend:  http://localhost:8000"
echo "App:      Electron window"
echo ""
echo "Press Ctrl+C to stop all services"

# Trap SIGINT and kill both
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
