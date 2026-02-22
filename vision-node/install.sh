#!/bin/bash
set -e

# ────────────────────────────────────────────────────────────
#  Vision Node Installer
#  Installs and configures a Vision Chain distributed storage node
# ────────────────────────────────────────────────────────────

REPO="jays-visionAI/visionchain"
NODE_DIR="$HOME/.vision-node"
MIN_NODE_VERSION=20

echo ""
echo "  Vision Chain Node Installer"
echo "  ─────────────────────────────"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is required (v${MIN_NODE_VERSION}+)"
    echo "Install: https://nodejs.org/"
    exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VER" -lt "$MIN_NODE_VERSION" ]; then
    echo "[ERROR] Node.js v${MIN_NODE_VERSION}+ required (found v$(node -v))"
    exit 1
fi

echo "[OK] Node.js $(node -v) detected"

# Create install directory
mkdir -p "$NODE_DIR"
cd "$NODE_DIR"

# Download latest release
echo "[..] Downloading Vision Node..."
if command -v git &> /dev/null; then
    if [ -d ".git" ]; then
        git pull --quiet
    else
        git clone --depth 1 "https://github.com/${REPO}.git" temp
        cp -r temp/vision-node/* .
        cp -r temp/vision-node/.* . 2>/dev/null || true
        rm -rf temp
    fi
else
    echo "[ERROR] git is required for installation"
    exit 1
fi

# Install dependencies
echo "[..] Installing dependencies..."
npm ci --silent 2>/dev/null || npm install --silent

# Build
echo "[..] Building..."
npm run build --silent 2>/dev/null || true

# Initialize if needed
if [ ! -f "config.json" ]; then
    echo "[..] Initializing node..."
    node dist/index.js init 2>/dev/null || true
fi

# Create symlink
if [ -w "/usr/local/bin" ]; then
    ln -sf "$NODE_DIR/bin/vision-node.js" /usr/local/bin/vision-node
    echo "[OK] Installed 'vision-node' command globally"
else
    echo "[INFO] Add to PATH: export PATH=\"$NODE_DIR/bin:\$PATH\""
fi

echo ""
echo "  Installation complete!"
echo ""
echo "  Usage:"
echo "    vision-node init       # Configure your node"
echo "    vision-node start      # Start the node"
echo "    vision-node status     # Check node status"
echo "    vision-node stop       # Stop the node"
echo ""
echo "  Dashboard: http://localhost:9090"
echo ""
