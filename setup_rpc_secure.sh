#!/bin/bash

# Vision Chain Multi-Service Security & SSL Setup Script
# This script configures Nginx as a reverse proxy for both RPC and API/Sequencer.

echo "🔒 Vision Chain HTTPS Security Setup"
echo "====================================="

# 1. Ask for Domains
read -p "Enter your RPC domain (e.g., rpc.visionchain.co): " RPC_DOMAIN
read -p "Enter your API/Sequencer domain (e.g., api.visionchain.co): " API_DOMAIN

if [ -z "$RPC_DOMAIN" ] || [ -z "$API_DOMAIN" ]; then
    echo "❌ Both domains are required. Exiting."
    exit 1
fi

# 2. Install Nginx and Certbot
echo "📦 Installing Nginx and Certbot..."
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 3. Create Nginx Configuration for RPC (8545)
echo "⚙️ Configuring Nginx for RPC ($RPC_DOMAIN)..."
sudo tee /etc/nginx/sites-available/vision-rpc <<EOF
server {
    listen 80;
    server_name $RPC_DOMAIN;

    location / {
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        proxy_pass http://127.0.0.1:8545;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host localhost;
        proxy_cache_bypass \$http_upgrade;
        
        add_header 'Access-Control-Allow-Origin' '*' always;
    }
}
EOF

# 4. Create Nginx Configuration for API/Sequencer (3000)
echo "⚙️ Configuring Nginx for API ($API_DOMAIN)..."
sudo tee /etc/nginx/sites-available/vision-api <<EOF
server {
    listen 80;
    server_name $API_DOMAIN;

    location / {
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host localhost;
        proxy_cache_bypass \$http_upgrade;
        
        add_header 'Access-Control-Allow-Origin' '*' always;
    }
}
EOF

# 5. Enable Configurations
echo "🚀 Enabling configurations..."
sudo ln -sf /etc/nginx/sites-available/vision-rpc /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/vision-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 6. Obtain SSL Certificates
echo "🔐 Obtaining SSL Certificates via Let's Encrypt..."
sudo certbot --nginx -d $RPC_DOMAIN -d $API_DOMAIN --non-interactive --agree-tos --email jp@visai.io

echo "✅ Success!"
echo "🚀 RPC: https://$RPC_DOMAIN"
echo "🚀 API: https://$API_DOMAIN"
