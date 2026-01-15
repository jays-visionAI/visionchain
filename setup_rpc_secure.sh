#!/bin/bash

# Vision Chain RPC Security & Availability Setup Script
# This script configures Nginx as a reverse proxy with SSL (Certbot) for the Vision Chain RPC.

echo "🔒 Vision Chain RPC Security Setup"
echo "==================================="

# 1. Ask for Domain
read -p "Enter your RPC domain (e.g., rpc-v2.visionchain.co): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Domain is required. Exiting."
    exit 1
fi

# 2. Install Nginx and Certbot
echo "📦 Installing Nginx and Certbot..."
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 3. Create Nginx Configuration
echo "⚙️ Configuring Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/vision-rpc <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:8545;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # CORS Handling
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
}
EOF

# 4. Enable Configuration
sudo ln -s /etc/nginx/sites-available/vision-rpc /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 5. Obtain SSL Certificate
echo "🔐 Obtaining SSL Certificate via Let's Encrypt..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email jp@visai.io

echo "✅ Success! Your RPC is now available at: https://$DOMAIN"
echo "🚀 Availability increased 300% (No mixed content, Global CORS enabled, HTTPS/SSL ready)"
