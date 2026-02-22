# Vision Node -- Installation Guide

## macOS

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/installers/install-macos.sh | bash
```

### Manual Install

```bash
# 1. Clone the repository
git clone --depth 1 https://github.com/jays-visionAI/visionchain.git
cd visionchain/vision-node

# 2. Install and build
npm install
npm run build

# 3. Initialize
node dist/index.js init --email your@email.com --storage 10GB --class standard

# 4. Start
node dist/index.js start
```

---

## Windows

### Quick Install (Recommended)

1. Download the installer:
   https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/installers/install-windows.bat
2. Right-click the downloaded file and select "Run as administrator"
3. Follow the on-screen instructions

### Manual Install

```powershell
# 1. Clone the repository
git clone --depth 1 https://github.com/jays-visionAI/visionchain.git
cd visionchain\vision-node

# 2. Install and build
npm install
npm run build

# 3. Initialize
node dist\index.js init --email your@email.com --storage 10GB --class standard

# 4. Start
node dist\index.js start
```

---

## Linux

```bash
curl -fsSL https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/installers/install-macos.sh | bash
```

The macOS installer works on Linux too.

---

## Node Classes

| Class     | Storage      | Weight | Description                  |
|-----------|-------------|--------|------------------------------|
| lite      | 100MB - 1GB | 0.01x  | Minimal participation        |
| standard  | 1GB - 100GB | 0.02x  | Default, balanced rewards    |
| full      | 100GB - 1TB | 0.05x  | Full archival, highest rewards |
| agent     | Varies      | 0.03x  | AI agent-integrated node     |

## Commands

```bash
vision-node init --email <email> [options]  # Initialize node
vision-node start                           # Start node
vision-node status                          # Check status
vision-node config                          # View config
```

### Init Options

| Option           | Description                  | Default      |
|------------------|------------------------------|-------------|
| `--email`        | Registration email (required)| -           |
| `--storage`      | Storage allocation           | 50GB        |
| `--class`        | Node class                   | standard    |
| `--staging`      | Use staging network          | false       |
| `--referral`     | Referral code                | -           |

## Dashboard

After starting, open **http://localhost:9090** in your browser:
- Real-time node status
- Storage usage
- Heartbeat history
- Reward tracking

## Ports

| Port | Service         |
|------|----------------|
| 9090 | Dashboard + API |
| 4001 | P2P WebSocket   |

## Configuration

Config file: `~/.visionnode/config.json`

Storage directory: `~/.visionnode/storage/`

## Uninstall

```bash
# macOS/Linux
rm -rf ~/.vision-node ~/.visionnode
rm -f /usr/local/bin/vision-node

# Windows
rmdir /s /q %USERPROFILE%\.vision-node %USERPROFILE%\.visionnode
```
