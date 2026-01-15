#!/bin/bash

REMOTE_HOST="root@46.224.221.201"
REMOTE_KEY="./vision_key"
REMOTE_DIR="/root/vision-shared-sequencer"

echo "🚀 Deploying Vision Shared Sequencer..."

# 1. Create remote directory
ssh -i $REMOTE_KEY -o StrictHostKeyChecking=no $REMOTE_HOST "mkdir -p $REMOTE_DIR"

# 2. Upload source code
echo "📤 Uploading sequencer source..."
scp -i $REMOTE_KEY -r blockchain/engine/vision-shared-sequencer/* $REMOTE_HOST:$REMOTE_DIR/

echo "📤 Uploading traffic generator source..."
ssh -i $REMOTE_KEY $REMOTE_HOST "mkdir -p $REMOTE_DIR/traffic-generator"
scp -i $REMOTE_KEY -r services/traffic-generator/* $REMOTE_HOST:$REMOTE_DIR/traffic-generator/
# Upload .env if it exists locally
if [ -f "services/traffic-generator/.env" ]; then
    echo "🔑 Uploading Traffic Generator .env..."
    scp -i $REMOTE_KEY services/traffic-generator/.env $REMOTE_HOST:$REMOTE_DIR/traffic-generator/.env
fi

# 3. Install Dependencies & Start Services
echo "🔧 Installing dependencies and starting services..."
ssh -i $REMOTE_KEY $REMOTE_HOST "cd $REMOTE_DIR && \
    npm install --production && \
    cd traffic-generator && npm install --production && cd .. && \
    npm install -g pm2 && \
    pm2 stop vision-api vision-engine vision-traffic || true && \
    pm2 start server.js --name vision-api && \
    pm2 start sequencer-engine.js --name vision-engine && \
    pm2 start traffic-generator/index.js --name vision-traffic && \
    pm2 save"

echo "✅ Deployment Complete! Sequencer and Traffic Generator are running."
