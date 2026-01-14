#!/bin/bash

# Simply run the Node.js service
# In production, use PM2
echo "🧠 Starting Vision AI Oracle..."
cd blockchain/engine/vision-ai-oracle
node oracle_service.js
