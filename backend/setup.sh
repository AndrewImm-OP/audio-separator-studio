#!/bin/bash
# Setup script for Audio Separator backend
# Clones MSST repo and installs dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MSST_DIR="$SCRIPT_DIR/msst"

echo "=== Audio Separator Setup ==="
echo ""

# Detect suitable Python (3.11 preferred for PyTorch & MSST stability)
PYTHON_CMD=""
for cmd in "/usr/sbin/python3.11" "python3.11" "python3.10" "python3"; do
    if command -v "$cmd" >/dev/null 2>&1; then
        PYTHON_CMD="$cmd"
        break
    fi
done

echo "Using Python: $($PYTHON_CMD --version) ($PYTHON_CMD)"

# 1. Determine venv path (check if project dir supports symlinks, else use ~/.local/share)
TARGET_VENV="$SCRIPT_DIR/venv"
if ! $PYTHON_CMD -m venv "$TARGET_VENV" 2>/dev/null; then
    echo "Filesystem does not support symlinks (e.g. exFAT). Using user local directory..."
    TARGET_VENV="$HOME/.local/share/audio-separator/venv"
    mkdir -p "$HOME/.local/share/audio-separator"
    $PYTHON_CMD -m venv "$TARGET_VENV"
fi

source "$TARGET_VENV/bin/activate"
echo "Virtualenv active: $TARGET_VENV"

# 2. Install requirements
echo "[2/4] Installing Python dependencies..."
# Unset proxies to prevent proxy timeout if proxy daemon is offline
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy

pip install --upgrade pip -q
# Install PyTorch with CUDA 12.4
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124 -q
pip install -r "$SCRIPT_DIR/requirements.txt" -q
pip install bs-roformer -q

# 3. Clone MSST repository
if [ ! -d "$MSST_DIR" ]; then
    echo "[3/4] Cloning Music-Source-Separation-Training..."
    git clone --depth 1 https://github.com/ZFTurbo/Music-Source-Separation-Training.git "$MSST_DIR"
else
    echo "[3/4] MSST repository already exists"
    cd "$MSST_DIR" && git pull --rebase 2>/dev/null || true
fi

# Install MSST dependencies
pip install -r "$MSST_DIR/requirements.txt" -q 2>/dev/null || true

# 4. Create .env file
ENV_FILE="$SCRIPT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "[4/4] Creating .env file..."
    cat > "$ENV_FILE" << EOF
# Audio Separator Backend Configuration
MSST_PATH=$MSST_DIR
UPLOAD_DIR=/tmp/audio-separator/uploads
OUTPUT_DIR=/tmp/audio-separator/outputs

# Set to 'cuda' for GPU, 'cpu' for CPU-only
# DEVICE=cuda
EOF
else
    echo "[4/4] .env file already exists"
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To start the backend:"
echo "  cd $SCRIPT_DIR"
echo "  source venv/bin/activate"
echo "  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "API docs will be at: http://localhost:8000/docs"
