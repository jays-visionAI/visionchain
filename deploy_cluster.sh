#!/bin/bash

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
