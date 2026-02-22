#!/bin/bash
set -e

# ────────────────────────────────────────────────────────────
#  Vision Node Installer for macOS
#  Downloads, configures, and launches a Vision Chain storage node
# ────────────────────────────────────────────────────────────

VERSION="1.0.0"
INSTALL_DIR="$HOME/.vision-node"
BIN_DIR="/usr/local/bin"
REPO_URL="https://github.com/jays-visionAI/visionchain.git"
MIN_NODE_VERSION=20

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}  ╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}  ║                                          ║${NC}"
echo -e "${BOLD}  ║  ${CYAN}V I S I O N   N O D E${NC}${BOLD}   v${VERSION}    ║${NC}"
echo -e "${BOLD}  ║  ${NC}macOS Installer${BOLD}                        ║${NC}"
echo -e "${BOLD}  ║                                          ║${NC}"
echo -e "${BOLD}  ╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Check Node.js ──
echo -e "${CYAN}[1/5]${NC} Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}  Node.js is not installed.${NC}"
    echo ""
    echo "  Install Node.js v${MIN_NODE_VERSION}+ using one of:"
    echo "    - https://nodejs.org/ (recommended)"
    echo "    - brew install node"
    echo "    - nvm install ${MIN_NODE_VERSION}"
    echo ""
    exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VER" -lt "$MIN_NODE_VERSION" ]; then
    echo -e "${RED}  Node.js v${MIN_NODE_VERSION}+ required (found $(node -v))${NC}"
    echo "  Upgrade: https://nodejs.org/"
    exit 1
fi

echo -e "  ${GREEN}Node.js $(node -v)${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}  git is required. Install: xcode-select --install${NC}"
    exit 1
fi
echo -e "  ${GREEN}git $(git --version | cut -d' ' -f3)${NC}"

# ── Download ──
echo ""
echo -e "${CYAN}[2/5]${NC} Downloading Vision Node..."

if [ -d "$INSTALL_DIR/repo" ]; then
    echo "  Updating existing installation..."
    cd "$INSTALL_DIR/repo"
    git pull --quiet origin main 2>/dev/null || true
else
    mkdir -p "$INSTALL_DIR"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR/repo" 2>/dev/null
fi

# ── Install Dependencies ──
echo ""
echo -e "${CYAN}[3/5]${NC} Installing dependencies..."
cd "$INSTALL_DIR/repo/vision-node"
npm ci --silent 2>/dev/null || npm install --silent 2>/dev/null

# ── Build ──
echo ""
echo -e "${CYAN}[4/5]${NC} Building..."
npm run build --silent 2>/dev/null

# ── Create launcher script ──
echo ""
echo -e "${CYAN}[5/5]${NC} Setting up..."

cat > "$INSTALL_DIR/vision-node" << 'LAUNCHER'
#!/bin/bash
NODE_DIR="$HOME/.vision-node/repo/vision-node"
cd "$NODE_DIR" && node dist/index.js "$@"
LAUNCHER
chmod +x "$INSTALL_DIR/vision-node"

# Try to symlink to /usr/local/bin
if [ -w "$BIN_DIR" ] 2>/dev/null; then
    ln -sf "$INSTALL_DIR/vision-node" "$BIN_DIR/vision-node"
    echo -e "  ${GREEN}Installed 'vision-node' command globally${NC}"
elif [ -w "/opt/homebrew/bin" ] 2>/dev/null; then
    ln -sf "$INSTALL_DIR/vision-node" "/opt/homebrew/bin/vision-node"
    echo -e "  ${GREEN}Installed 'vision-node' command globally${NC}"
else
    echo -e "  ${YELLOW}Add to your PATH:${NC}"
    echo "    export PATH=\"$INSTALL_DIR:\$PATH\""
    echo "  Or run directly:"
    echo "    $INSTALL_DIR/vision-node"
fi

# ── Done ──
echo ""
echo -e "${GREEN}  Installation complete!${NC}"
echo ""
echo -e "  ${BOLD}Quick Start:${NC}"
echo ""
echo -e "    ${CYAN}1.${NC} Initialize your node:"
echo -e "       vision-node init --email ${YELLOW}your@email.com${NC} --class standard"
echo ""
echo -e "    ${CYAN}2.${NC} Start the node:"
echo -e "       vision-node start"
echo ""
echo -e "    ${CYAN}3.${NC} Open the dashboard:"
echo -e "       http://localhost:9090"
echo ""
echo -e "  ${BOLD}Node Classes:${NC}"
echo -e "    lite      100MB - 1GB   (minimal participation)"
echo -e "    standard  1GB - 100GB   (default)"
echo -e "    full      100GB - 1TB   (full archival)"
echo ""
echo -e "  ${BOLD}Options:${NC}"
echo -e "    --storage 10GB    Set storage allocation"
echo -e "    --staging         Use staging network"
echo ""
