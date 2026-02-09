#!/bin/bash
# Replace all hardcoded Hardhat Account #0 private keys with environment variable references
# This script finds and replaces the public key in all remaining files

OLD_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
OLD_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
NEW_ADMIN_ADDR="0xd4FeD8Fe5946aDA714bb664D6B5F2C954acf6B15"

echo "=== Replacing hardcoded Hardhat #0 keys ==="
echo ""

# Files that use the key as a direct assignment (const KEY = "...")
# Replace with process.env.PRIVATE_KEY || error
FILES_WITH_KEY=(
    "services/traffic-generator/index.js"
    "services/bridge/send-native-vcn.cjs"
    "services/bridge/grant-tss-role.cjs"
    "blockchain/scripts/deployBridgeStaking.js"
    "blockchain/scripts/deploy-direct.js"
    "blockchain/scripts/fund_paymaster.js"
    "blockchain/scripts/deploy-staking-only.js"
    "blockchain/scripts/deploy-continue-v2.js"
    "blockchain/scripts/fund-admin-wallet.js"
    "blockchain/scripts/deploy_paymaster_v2.js"
    "blockchain/scripts/configure-staking.js"
    "blockchain/scripts/deploy-direct-v2.js"
    "blockchain/scripts/deploy-fixed-apy-staking.js"
    "blockchain/scripts/restore-snapshot.js"
    "blockchain/deploy-staking-direct.js"
    "blockchain/engine/vision-ai-oracle/oracle_service.js"
    "blockchain/engine/vision-shared-sequencer/server.js"
)

REPLACED=0
for f in "${FILES_WITH_KEY[@]}"; do
    FULL_PATH="/Users/sangjaeseo/Antigravity/Vision-Chain/$f"
    if [ -f "$FULL_PATH" ]; then
        if grep -q "$OLD_KEY" "$FULL_PATH"; then
            # Replace the private key with process.env.PRIVATE_KEY reference
            sed -i '' "s|\"$OLD_KEY\"|process.env.VISION_ADMIN_PK|g" "$FULL_PATH"
            sed -i '' "s|'$OLD_KEY'|process.env.VISION_ADMIN_PK|g" "$FULL_PATH"
            echo "[REPLACED] $f"
            REPLACED=$((REPLACED + 1))
        else
            echo "[SKIP] $f (key not found)"
        fi
    else
        echo "[MISSING] $f"
    fi
done

echo ""
echo "=== Results ==="
echo "Files modified: $REPLACED"
echo ""
echo "IMPORTANT: You must set the VISION_ADMIN_PK environment variable"
echo "  export VISION_ADMIN_PK='0xYOUR_ADMIN_PRIVATE_KEY'"
echo ""
echo "Verifying no remaining hardcoded keys..."
REMAINING=$(grep -rl "$OLD_KEY" /Users/sangjaeseo/Antigravity/Vision-Chain/ --include="*.js" --include="*.ts" --include="*.cjs" --include="*.json" 2>/dev/null | grep -v node_modules | grep -v ".git")
if [ -z "$REMAINING" ]; then
    echo "SUCCESS: No hardcoded Hardhat #0 keys remaining!"
else
    echo "WARNING: Still found in:"
    echo "$REMAINING"
fi
