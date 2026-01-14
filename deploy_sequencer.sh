#!/bin/bash

REMOTE_HOST="root@46.224.221.201"
REMOTE_KEY="./vision_key"
REMOTE_DIR="/root/vision-shared-sequencer"

echo "🚀 Deploying Vision Shared Sequencer..."

# 1. Create remote directory
ssh -i $REMOTE_KEY -o StrictHostKeyChecking=no $REMOTE_HOST "mkdir -p $REMOTE_DIR"

# 2. Upload source code
echo "📤 Uploading source code..."
scp -i $REMOTE_KEY -r blockchain/engine/vision-shared-sequencer/* $REMOTE_HOST:$REMOTE_DIR/

# 3. Install Dependencies & Start Services
echo "🔧 Installing dependencies and starting services..."
ssh -i $REMOTE_KEY $REMOTE_HOST "cd $REMOTE_DIR && \
    npm install --production && \
    npm install -g pm2 && \
    pm2 stop vision-api vision-engine || true && \
    pm2 start server.js --name vision-api && \
    pm2 start sequencer-engine.js --name vision-engine && \
    pm2 save"

echo "✅ Deployment Complete! Sequencer is running."
