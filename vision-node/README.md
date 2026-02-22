# Vision Node

Distributed storage node for Vision Chain. Stores, replicates, and serves data across the decentralized network while earning VCN rewards.

## Quick Start

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/install.sh | bash
```

### Manual Install

```bash
git clone https://github.com/jays-visionAI/visionchain.git
cd visionchain/vision-node
npm install
npm run build
```

### Docker

```bash
cd vision-node
docker compose up -d
```

## Usage

```bash
# Initialize configuration
vision-node init

# Start the node
vision-node start

# Check status
vision-node status

# Stop the node
vision-node stop
```

## Dashboard

After starting, visit **http://localhost:9090** for a real-time web dashboard showing:

- Node status, uptime, and system info
- Storage usage and file management
- P2P network peers
- Chunk registry sync status
- Reward tracking

## Architecture

```
vision-node/
  src/
    index.ts              # CLI entry point (Commander.js)
    config/
      config.ts           # Configuration management
    core/
      nodeManager.ts      # Node lifecycle orchestration
      heartbeat.ts        # Backend heartbeat service
      storage.ts          # File storage engine (chunking, Merkle tree)
      chunkRegistry.ts    # Chunk registry sync with backend
      p2pNetwork.ts       # WebSocket-based P2P layer
    api/
      agentRouter.ts      # REST API for AI agent control
      gateway.ts          # Backend gateway client
    dashboard/
      dashboardServer.ts  # Express web dashboard
      public/             # Dashboard HTML/CSS/JS
```

## Node Classes

| Class | Storage | Description |
|-------|---------|-------------|
| **Lite** | 100MB - 1GB | Minimal participation |
| **Standard** | 1GB - 100GB | Default node |
| **Full** | 100GB - 1TB | Heavy duty archival |
| **Agent** | 10GB - 500GB | AI-controlled programmatic node |

## Storage Engine

- **256KB chunk size** with SHA-256 content addressing
- **Merkle tree** integrity verification per file
- **LRU eviction** when storage limit is reached
- **SQLite index** for fast chunk metadata lookup
- **Replication factor 3** across the network

## Agent API

The Agent REST API allows programmatic control by AI agents:

```bash
# Check node status
curl -X POST http://localhost:3001/agent/v1/status \
  -H "X-API-Key: YOUR_KEY"

# Upload data
curl -X POST http://localhost:3001/agent/v1/storage/upload \
  -H "X-API-Key: YOUR_KEY" \
  -F "file=@data.json"

# Force chunk registry sync
curl -X POST http://localhost:3001/agent/v1/chunks/sync \
  -H "X-API-Key: YOUR_KEY"
```

See [Agent API Documentation](../docs/agent-api.md) for the full reference.

## Smart Contracts

On-chain storage economy contracts deployed on Vision Chain:

| Contract | Address | Purpose |
|----------|---------|---------|
| StorageRegistry | `0x26d4b785...D6739` | Node registration, capacity tracking, Merkle root storage |
| StorageProof | `0x4C8789B1...ADC4` | Challenge/response proof verification |
| StorageRewards | `0x30268b6f...ed4DF` | Reward accrual, claiming, slashing |

## Configuration

Configuration is stored in `~/.vision-node/config.json`:

```json
{
  "nodeId": "auto-generated",
  "nodeClass": "standard",
  "storageMaxGB": 10,
  "dataDir": "~/.vision-node/data",
  "dashboardPort": 9090,
  "agentApiPort": 3001,
  "p2pPort": 9091,
  "gatewayUrl": "https://agentgateway-sapjcm3s5a-uc.a.run.app"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VISION_NODE_DATA_DIR` | `~/.vision-node` | Data storage directory |
| `NODE_ENV` | `development` | Environment mode |

## Requirements

- Node.js 20+
- 100MB minimum free disk space
- Internet connection for heartbeat and P2P

## License

MIT
