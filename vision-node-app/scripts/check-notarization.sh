#!/bin/bash
# Check notarization status and if accepted, staple + upload to server

SUBMISSION_ID="523f3965-4794-48ec-b1ea-8fca86ae8601"
APPLE_ID="sangky94@gmail.com"
APP_PASSWORD="hzoa-blyt-gsen-kqnd"
TEAM_ID="9NHZ644XW4"
DMG_ARM64="dist/Vision Node-1.0.0-arm64.dmg"
DMG_X64="dist/Vision Node-1.0.0.dmg"

echo "Checking notarization status..."
STATUS=$(xcrun notarytool info "$SUBMISSION_ID" \
  --apple-id "$APPLE_ID" \
  --password "$APP_PASSWORD" \
  --team-id "$TEAM_ID" 2>&1)

echo "$STATUS"

if echo "$STATUS" | grep -q "status: Accepted"; then
    echo ""
    echo "=== Notarization ACCEPTED! Stapling... ==="
    
    # Staple arm64
    xcrun stapler staple "$DMG_ARM64"
    echo "ARM64 DMG stapled"
    
    # Staple x64
    xcrun stapler staple "$DMG_X64"
    echo "x64 DMG stapled"
    
    # Upload to server
    echo ""
    echo "=== Uploading to server ==="
    cd "$(dirname "$0")/.."
    scp -i ../../vision_key -o StrictHostKeyChecking=no "$DMG_ARM64" admin@46.224.221.201:/home/admin/downloads/Vision-Node-1.0.0-arm64.dmg
    scp -i ../../vision_key -o StrictHostKeyChecking=no "$DMG_X64" admin@46.224.221.201:/home/admin/downloads/Vision-Node-1.0.0-x64.dmg
    echo ""
    echo "=== DONE! DMGs are signed, notarized, and uploaded ==="
    
elif echo "$STATUS" | grep -q "status: In Progress"; then
    echo ""
    echo "Still processing. Try again later."
    
elif echo "$STATUS" | grep -q "status: Invalid"; then
    echo ""
    echo "=== REJECTED. Checking logs... ==="
    xcrun notarytool log "$SUBMISSION_ID" \
      --apple-id "$APPLE_ID" \
      --password "$APP_PASSWORD" \
      --team-id "$TEAM_ID"
fi
