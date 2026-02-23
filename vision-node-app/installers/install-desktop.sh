#!/bin/bash
set -e

# ────────────────────────────────────────────────────────────
#  Vision Node Desktop - One-Click Installer for macOS
#  Downloads, installs, and launches Vision Node automatically.
# ────────────────────────────────────────────────────────────

VERSION="1.0.0"
SERVER="http://46.224.221.201:8090"
APP_NAME="Vision Node.app"
INSTALL_DIR="/Applications"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}  Vision Node Desktop Installer v${VERSION}${NC}"
echo ""

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    DMG_FILE="Vision-Node-${VERSION}-arm64.dmg"
    echo -e "  Platform: ${CYAN}Apple Silicon (M1/M2/M3/M4)${NC}"
else
    DMG_FILE="Vision-Node-${VERSION}-x64.dmg"
    echo -e "  Platform: ${CYAN}Intel Mac${NC}"
fi

DMG_URL="${SERVER}/${DMG_FILE}"
TMP_DMG="/tmp/${DMG_FILE}"

# Download
echo ""
echo -e "  ${CYAN}[1/4]${NC} Downloading Vision Node..."
curl -# -L -o "$TMP_DMG" "$DMG_URL"

# Mount DMG
echo -e "  ${CYAN}[2/4]${NC} Installing..."
MOUNT_DIR=$(hdiutil attach "$TMP_DMG" -nobrowse -noverify 2>/dev/null | grep "/Volumes" | awk -F'\t' '{print $NF}')

if [ -z "$MOUNT_DIR" ]; then
    echo -e "  ${RED}Failed to mount DMG${NC}"
    exit 1
fi

# Copy to Applications
if [ -d "${INSTALL_DIR}/${APP_NAME}" ]; then
    rm -rf "${INSTALL_DIR}/${APP_NAME}"
fi
cp -R "${MOUNT_DIR}/${APP_NAME}" "${INSTALL_DIR}/"

# Unmount
hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
rm -f "$TMP_DMG"

# Remove quarantine
echo -e "  ${CYAN}[3/4]${NC} Configuring..."
xattr -cr "${INSTALL_DIR}/${APP_NAME}" 2>/dev/null || true

# Launch
echo -e "  ${CYAN}[4/4]${NC} Launching Vision Node..."
echo ""
echo -e "  ${GREEN}Installation complete!${NC}"
echo -e "  Vision Node is now in your Applications folder."
echo ""

open "${INSTALL_DIR}/${APP_NAME}"
