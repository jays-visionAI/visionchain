# Vision Mobile Node

Android native app for contributing to the Vision Chain network. Nodes earn VCN rewards by verifying blocks, relaying messages, and caching data.

## Features

- **Block Observer**: Verifies block headers from Vision Chain Authority Nodes (WiFi only)
- **Heartbeat**: Network-adaptive heartbeat (5min WiFi / 30min Cellular)
- **Storage Cache**: Local cache for dApp data (future: on-chain messenger, NFT metadata)
- **Background Service**: Android Foreground Service keeps node running when app is closed

## Architecture

```
src/
├── screens/
│   ├── RegisterScreen.tsx     # Email registration + referral code
│   ├── DashboardScreen.tsx    # Node status, weight, rewards, block stats
│   └── SettingsScreen.tsx     # Network, battery, cache preferences
├── services/
│   ├── config.ts              # API endpoints, chain parameters
│   ├── api.ts                 # agentGateway API client
│   ├── networkAdapter.ts      # WiFi/Cellular/Offline detection
│   ├── blockObserver.ts       # Block header verification + attestation
│   ├── heartbeat.ts           # Periodic heartbeat with auto-interval
│   └── storage.ts             # AsyncStorage for credentials/settings
└── utils/
    └── crypto.ts              # Signature verification utilities
```

## Weight System

| Network | Base Weight | + Block Verify | + Relay | + Cache | Max |
|---------|------------|----------------|---------|---------|-----|
| WiFi    | 0.5x       | +0.2x          | +0.1x   | +0.1x   | 0.9x |
| Cellular| 0.1x       | -              | -       | -       | 0.1x |
| Offline | 0x         | -              | -       | -       | 0x   |

## Setup

```bash
# Install dependencies
npm install

# Run on Android device/emulator
npx react-native run-android
```

## API

Uses existing `agentGateway` endpoints:
- `mobile_node.register` - Node registration
- `mobile_node.heartbeat` - Heartbeat signal
- `mobile_node.status` - Node status query
- `mobile_node.claim_reward` - Claim VCN rewards
- `mobile_node.submit_attestation` - Submit block verification results

## Tech Stack

- React Native + TypeScript
- ethers.js (block header verification)
- @react-native-community/netinfo
- @react-native-async-storage/async-storage
