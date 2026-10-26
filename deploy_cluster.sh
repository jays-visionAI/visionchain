#!/bin/bash

# DANGER: this copies the repo's docker-compose.yml over the live one on S1 and
# runs scripts/deploy_vision_cluster.sh as root, which deletes every node's chain
# data (rm -rf deploy/v2-testnet/node*/geth) and re-inits a chainId 1337 genesis.
# Never run it against the live chain. Node flags on the live hosts are changed
# by hand, one signer at a time: docs/pending/rpc-lockdown.md.
if [ "${I_UNDERSTAND_THIS_WIPES_THE_CHAIN:-}" != "yes" ]; then
    echo "Refusing: this overwrites the live compose file and wipes chain data." >&2
    echo "Set I_UNDERSTAND_THIS_WIPES_THE_CHAIN=yes to run it anyway." >&2
    exit 1
fi

REMOTE_HOST="admin@46.224.221.201"
REMOTE_KEY="./vision_key"
REMOTE_DIR="/home/admin/vision-shared-sequencer"

echo "🚀 Deploying Vision 5-Node Cluster..."

# 1. Upload docker-compose.yml
echo "📤 Uploading docker-compose.yml..."
rsync -avz -e "ssh -i $REMOTE_KEY" docker-compose.yml $REMOTE_HOST:$REMOTE_DIR/

# 2. Upload scripts directory
echo "📤 Uploading scripts..."
ssh -i $REMOTE_KEY $REMOTE_HOST "mkdir -p $REMOTE_DIR/scripts"
rsync -avz -e "ssh -i $REMOTE_KEY" --exclude 'node_modules' scripts/ $REMOTE_HOST:$REMOTE_DIR/scripts/

# 3. Run deployment script on server
echo "🔧 Running cluster deployment script on server..."
ssh -i $REMOTE_KEY root@46.224.221.201 "cd /home/admin/vision-shared-sequencer && \
    chmod +x scripts/*.sh && \
    ./scripts/deploy_vision_cluster.sh"

echo "✅ Cluster Deployment Complete!"
