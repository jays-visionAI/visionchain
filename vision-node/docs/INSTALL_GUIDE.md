# Vision Node CLI - Installation & Usage Guide

> Vision Chain 분산 저장 네트워크에 참여하여 VCN 리워드를 획득할 수 있는 노드 소프트웨어의 설치 및 운영 가이드입니다.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Installation](#2-installation)
   - [Method A: One-Line Install (권장)](#method-a-one-line-install-권장)
   - [Method B: Manual Install (수동 설치)](#method-b-manual-install-수동-설치)
   - [Method C: Docker](#method-c-docker)
3. [Quick Start](#3-quick-start)
4. [CLI Command Reference](#4-cli-command-reference)
   - [vision-node init](#vision-node-init)
   - [vision-node start](#vision-node-start)
   - [vision-node stop](#vision-node-stop)
   - [vision-node status](#vision-node-status)
   - [vision-node config](#vision-node-config)
   - [vision-node storage](#vision-node-storage)
5. [Node Classes](#5-node-classes)
6. [Configuration](#6-configuration)
7. [Dashboard](#7-dashboard)
8. [Agent API](#8-agent-api)
9. [Environment Variables](#9-environment-variables)
10. [Troubleshooting](#10-troubleshooting)
11. [Uninstall](#11-uninstall)

---

## 1. System Requirements

| 항목 | 최소 사양 |
|------|----------|
| **OS** | macOS, Linux (Ubuntu 20.04+), Windows (WSL2) |
| **Node.js** | v20.0.0 이상 |
| **Git** | 최신 버전 |
| **Disk** | 최소 100MB 여유 공간 (노드 클래스에 따라 추가 공간 필요) |
| **Network** | 인터넷 연결 필수 (Heartbeat 및 P2P 통신) |
| **RAM** | 512MB 이상 권장 |

### Node.js 설치 확인

```bash
node -v
# v20.x.x 이상이어야 합니다

npm -v
# Node.js와 함께 설치됩니다
```

Node.js가 설치되어 있지 않다면 [https://nodejs.org](https://nodejs.org) 에서 다운로드하거나, 아래 명령어로 설치할 수 있습니다:

```bash
# macOS (Homebrew)
brew install node@20

# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. Installation

### Method A: One-Line Install (권장)

가장 간단한 설치 방법입니다. 아래 명령어 한 줄로 자동 설치됩니다:

```bash
curl -fsSL https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/install.sh | bash
```

이 스크립트는 다음을 자동으로 수행합니다:
1. Node.js 버전 확인 (v20+)
2. `~/.vision-node/` 디렉토리 생성
3. GitHub에서 최신 소스 다운로드
4. 의존성 설치 (`npm ci`)
5. TypeScript 빌드 (`npm run build`)
6. 초기 설정 파일 생성
7. `vision-node` 명령어를 글로벌 PATH에 등록

설치 완료 후 `vision-node` 명령어를 바로 사용할 수 있습니다.

> **Note**: `/usr/local/bin`에 쓰기 권한이 없는 경우, 다음을 `.bashrc` 또는 `.zshrc`에 추가해야 합니다:
> ```bash
> export PATH="$HOME/.vision-node/bin:$PATH"
> ```

---

### Method B: Manual Install (수동 설치)

레포지토리를 직접 클론하여 설치합니다:

```bash
# 1. 레포지토리 클론
git clone https://github.com/jays-visionAI/visionchain.git
cd visionchain/vision-node

# 2. 의존성 설치
npm install

# 3. TypeScript 빌드
npm run build

# 4. (선택) 글로벌 명령어 등록
npm link
```

`npm link` 후에는 어디서든 `vision-node` 명령어를 사용할 수 있습니다.

**글로벌 명령어 없이 실행하는 방법:**

```bash
# 프로젝트 디렉토리 내에서 직접 실행
node dist/index.js <command> [options]

# 또는 npm script 사용
npm run start
```

---

### Method C: Docker

Docker를 사용하면 Node.js 설치 없이도 운영할 수 있습니다.

```bash
# 1. vision-node 디렉토리로 이동
cd visionchain/vision-node

# 2. Docker Compose로 실행
docker compose up -d
```

Docker Compose는 다음을 자동으로 설정합니다:
- **포트 9090**: 웹 대시보드
- **포트 9091**: P2P WebSocket
- **볼륨**: `vision-data` (영구 저장소)
- **자동 재시작**: 비정상 종료 시 자동 재시작
- **Health Check**: 30초 간격으로 상태 확인

**Docker 개별 명령어:**

```bash
# 빌드만 수행
docker compose build

# 로그 확인
docker compose logs -f vision-node

# 중지
docker compose down

# 데이터 포함 완전 삭제
docker compose down -v
```

---

## 3. Quick Start

설치 후 3단계로 노드를 시작할 수 있습니다:

```bash
# Step 1: 노드 초기화 (이메일 등록 필수)
vision-node init -e your@email.com -s 50GB

# Step 2: 노드 시작
vision-node start

# Step 3: 대시보드 접속
# 브라우저에서 http://localhost:9090 열기
```

**추천 래퍼럴 코드가 있는 경우:**

```bash
vision-node init -e your@email.com -s 50GB -r REFERRAL_CODE
```

**스테이징 환경에서 테스트:**

```bash
vision-node init -e your@email.com -s 10GB --staging
```

---

## 4. CLI Command Reference

### `vision-node init`

노드를 초기화하고 Vision Chain 네트워크에 등록합니다. **최초 1회만 실행**하면 됩니다.

```
vision-node init [options]
```

| 옵션 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `-e, --email <email>` | **필수** | - | 노드 등록에 사용할 이메일 주소 |
| `-s, --storage <size>` | 선택 | `50GB` | 저장 공간 할당량 (예: `10GB`, `100GB`, `1TB`) |
| `-r, --referral <code>` | 선택 | - | 추천인 래퍼럴 코드 |
| `--class <class>` | 선택 | 자동감지 | 노드 클래스: `lite`, `standard`, `full` |
| `--staging` | 선택 | `false` | 스테이징 환경 사용 |

**저장 공간 단위:** `MB`, `GB`, `TB` 지원 (예: `500MB`, `50GB`, `1TB`)

**사용 예시:**

```bash
# 기본 설정 (50GB Standard 노드)
vision-node init -e user@example.com

# 100GB Full 노드 + 래퍼럴
vision-node init -e user@example.com -s 100GB --class full -r ABC123

# 스테이징 환경 테스트
vision-node init -e test@example.com -s 10GB --staging
```

**초기화 결과 (성공 시):**

```
  Vision Node - Initialization

  Email:     user@example.com
  Storage:   50GB
  Class:     standard (auto-detected)
  Env:       production

  Registering with Vision Chain...

  Registration successful!
  Node ID:  node_abc123...
  Wallet:   0x1234...abcd

  Run vision-node start to begin earning rewards.
```

> **Note**: 이미 초기화된 노드를 재초기화하려면 `~/.visionnode/config.json`을 삭제한 후 다시 실행하세요.

---

### `vision-node start`

노드를 시작합니다. Heartbeat 전송, P2P 연결, 저장소 동기화, 웹 대시보드가 모두 시작됩니다.

```
vision-node start [options]
```

| 옵션 | 설명 |
|------|------|
| `-d, --daemon` | 백그라운드 데몬 모드 (향후 지원 예정) |

**사용 예시:**

```bash
# 포그라운드 실행 (기본)
vision-node start

# 또는 프로젝트 디렉토리 내에서
npm run start
```

**시작 시 출력:**

```
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║     V I S I O N   N O D E    v1.0.0     ║
  ║     Distributed Storage Network          ║
  ║                                          ║
  ╚══════════════════════════════════════════╝

  Email:    user@example.com
  Class:    standard
  Storage:  50GB
  Env:      production

  Node is running. Press Ctrl+C to stop.
```

**노드 실행 중 수행되는 작업:**
- Backend 서버에 주기적 Heartbeat 전송 (기본 5분 간격)
- P2P 네트워크 피어 연결
- 청크 레지스트리 동기화
- 웹 대시보드 서빙 (http://localhost:9090)
- Agent REST API 제공 (http://localhost:3001)

**노드 중지:** `Ctrl+C`를 누르면 정상적으로 종료됩니다.

---

### `vision-node stop`

실행 중인 노드를 중지합니다.

```
vision-node stop
```

> 현재 포그라운드 모드에서는 `Ctrl+C`로 직접 중지해야 합니다.
> 데몬 모드의 `stop` 명령은 향후 버전에서 지원될 예정입니다.

---

### `vision-node status`

노드의 현재 상태를 Vision Chain 백엔드에서 조회합니다.

```
vision-node status
```

**출력 예시:**

```
  Vision Node Status

  Node ID:      node_abc123...
  Class:        standard
  Status:       active
  Uptime:       24.5h
  Heartbeats:   288
  Reward:       12.3456 VCN
  Rank:         #42
  Storage:      50GB allocated
  Environment:  production
```

| 항목 | 설명 |
|------|------|
| **Status** | 노드 상태 (`active`, `inactive`) |
| **Uptime** | 총 운영 시간 |
| **Heartbeats** | 백엔드에 전송된 총 Heartbeat 수 |
| **Reward** | 미청구 VCN 리워드 |
| **Rank** | 전체 노드 중 순위 |

---

### `vision-node config`

노드 설정을 조회하거나 변경합니다.

```
vision-node config [options]
```

| 옵션 | 설명 |
|------|------|
| `--set <key=value>` | 특정 설정값 변경 |
| `--json` | JSON 형식으로 출력 |

**설정 조회:**

```bash
# 보기 좋은 형태로 출력
vision-node config

# JSON 형태로 출력
vision-node config --json
```

**출력 예시:**

```
  Vision Node Configuration

  Email:          user@example.com
  Node ID:        node_abc123...
  Class:          standard
  Environment:    production
  Storage Max:    50GB
  Storage Path:   /Users/you/.visionnode/storage
  HB Interval:    300s
  Dashboard Port: 9090
  P2P Port:       4001
  Registered:     yes
  Config Dir:     /Users/you/.visionnode
```

**설정 변경:**

```bash
# 저장 공간 변경
vision-node config --set storageMaxGB=100

# 대시보드 포트 변경
vision-node config --set dashboardPort=8080

# Heartbeat 간격 변경 (밀리초)
vision-node config --set heartbeatIntervalMs=600000

# P2P 포트 변경
vision-node config --set p2pPort=4002
```

**변경 가능한 숫자형 필드:** `storageMaxGB`, `heartbeatIntervalMs`, `dashboardPort`, `p2pPort`

---

### `vision-node storage`

분산 저장소를 관리합니다. 여러 서브 명령어를 제공합니다.

#### `vision-node storage stats`

저장소 통계를 조회합니다.

```bash
vision-node storage stats
```

**출력 예시:**

```
  Storage Statistics

  Status:      running
  Files:       15
  Chunks:      234
  Used:        1.2GB
  Max:         50.0GB
  Usage:       2%
  Path:        /Users/you/.visionnode/storage
```

#### `vision-node storage put <filepath>`

로컬 파일을 분산 저장소에 업로드합니다.

```bash
vision-node storage put ./my-data.json
vision-node storage put /absolute/path/to/file.txt
```

**출력 예시:**

```
  Storing 2.4MB...

  Stored successfully!
  File Key:    f_abc123def456
  CID:         bafybeig...
  Merkle Root: a1b2c3d4e5f6...
  Size:        2.4MB
  Chunks:      10
```

- **파일은 256KB 청크**로 분할됩니다.
- **SHA-256 콘텐츠 주소 지정**으로 무결성이 보장됩니다.
- **Merkle Tree**로 파일 전체 무결성을 검증합니다.

#### `vision-node storage get <fileKey> <outputPath>`

저장된 파일을 다운로드합니다.

```bash
vision-node storage get f_abc123def456 ./downloaded.json
```

#### `vision-node storage ls`

저장된 모든 파일 목록을 출력합니다.

```bash
vision-node storage ls
```

**출력 예시:**

```
  Stored Files (3)

  FILE KEY                SIZE         CHUNKS   CREATED
  ──────────────────────────────────────────────────────────────────────────
  f_abc123def456          2.4MB        10       2/22/2026, 3:15:00 PM
  f_def789ghi012          512.0KB      2        2/21/2026, 10:30:00 AM
  f_xyz345mno678          15.7MB       63       2/20/2026, 8:45:00 PM
```

#### `vision-node storage rm <fileKey>`

저장된 파일을 삭제합니다.

```bash
vision-node storage rm f_abc123def456
```

---

## 5. Node Classes

시스템 사양에 따라 적절한 노드 클래스를 선택하세요. `--class` 옵션을 생략하면 자동으로 감지됩니다.

| 클래스 | 저장 용량 | 설명 | 적합 환경 |
|--------|----------|------|----------|
| **Lite** | 100MB - 1GB | 최소 참여 | 저사양 PC, 테스트 |
| **Standard** | 1GB - 100GB | 기본 노드 (권장) | 일반 데스크탑, 노트북 |
| **Full** | 100GB - 1TB | 대용량 아카이벌 노드 | 서버, NAS |
| **Agent** | 10GB - 500GB | AI 에이전트 제어 노드 | AI 워크로드 서버 |

---

## 6. Configuration

### 설정 파일 위치

```
~/.visionnode/config.json
```

### 설정 파일 구조

```json
{
  "nodeId": "자동 생성",
  "email": "your@email.com",
  "apiKey": "자동 발급",
  "walletAddress": "자동 생성",
  "referralCode": "",
  "nodeClass": "standard",
  "environment": "production",
  "storagePath": "~/.visionnode/storage",
  "storageMaxGB": 50,
  "heartbeatIntervalMs": 300000,
  "dashboardPort": 9090,
  "p2pPort": 4001,
  "apiUrl": "https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway",
  "wsRpcUrl": "wss://ws.rpc.visionchain.co",
  "registered": true,
  "firstLaunch": "2026-02-22T00:00:00.000Z",
  "lastLaunch": "2026-02-23T00:00:00.000Z"
}
```

### 주요 설정 항목

| 키 | 타입 | 기본값 | 설명 |
|---|------|--------|------|
| `nodeId` | string | 자동 | 고유 노드 식별자 |
| `email` | string | - | 등록 이메일 |
| `apiKey` | string | 자동 | 백엔드 인증 키 |
| `walletAddress` | string | 자동 | VCN 수신 지갑 주소 |
| `nodeClass` | string | `standard` | `lite` / `standard` / `full` / `agent` |
| `environment` | string | `production` | `production` / `staging` |
| `storageMaxGB` | number | `50` | 최대 저장 용량 (GB) |
| `heartbeatIntervalMs` | number | `300000` | Heartbeat 간격 (ms, 기본 5분) |
| `dashboardPort` | number | `9090` | 웹 대시보드 포트 |
| `p2pPort` | number | `4001` | P2P WebSocket 포트 |

### 디렉토리 구조

```
~/.visionnode/
  config.json          # 노드 설정 파일
  storage/             # 분산 저장 데이터
    chunks/            # 256KB 청크 파일들
    index.db           # SQLite 메타데이터 인덱스
```

---

## 7. Dashboard

노드 실행 후 브라우저에서 **http://localhost:9090** 에 접속하면 실시간 웹 대시보드를 확인할 수 있습니다.

**대시보드에서 확인할 수 있는 정보:**

- 노드 상태, 업타임, 시스템 정보
- 저장소 사용량 및 파일 관리
- P2P 네트워크 피어 현황
- 청크 레지스트리 동기화 상태
- VCN 리워드 추적

> 대시보드 포트를 변경하려면: `vision-node config --set dashboardPort=8080`

---

## 8. Agent API

Agent 클래스 노드는 AI 에이전트가 프로그래밍 방식으로 제어할 수 있는 REST API를 제공합니다.

**기본 엔드포인트:** `http://localhost:3001`

```bash
# 노드 상태 확인
curl -X POST http://localhost:3001/agent/v1/status \
  -H "X-API-Key: YOUR_API_KEY"

# 파일 업로드
curl -X POST http://localhost:3001/agent/v1/storage/upload \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "file=@data.json"

# 청크 레지스트리 강제 동기화
curl -X POST http://localhost:3001/agent/v1/chunks/sync \
  -H "X-API-Key: YOUR_API_KEY"
```

> API Key는 `vision-node init` 시 자동 발급되며, `vision-node config --json` 명령으로 확인할 수 있습니다.

---

## 9. Environment Variables

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `VISION_NODE_DATA_DIR` | `~/.visionnode` | 데이터 저장 루트 디렉토리 |
| `NODE_ENV` | `development` | 실행 환경 모드 |

```bash
# 커스텀 데이터 디렉토리 설정
export VISION_NODE_DATA_DIR=/mnt/external-drive/vision-node

# 프로덕션 모드 실행
NODE_ENV=production vision-node start
```

---

## 10. Troubleshooting

### "Node not initialized" 오류

```
  Node not initialized. Run "vision-node init" first.
```

**해결:** `vision-node init -e your@email.com` 명령으로 초기화하세요.

---

### "Registration failed" 오류

```
  Registration failed: <error message>
```

**해결방법:**
1. 인터넷 연결 상태를 확인하세요.
2. 이메일 형식이 올바른지 확인하세요.
3. 스테이징 환경을 사용 중이라면 `--staging` 플래그를 추가하세요.
4. 설정이 저장되어 있으므로, 문제 해결 후 `vision-node start`로 재시도하세요.

---

### 포트 충돌

```
Error: listen EADDRINUSE :::9090
```

**해결:** 이미 해당 포트를 사용 중인 프로세스가 있습니다.

```bash
# 포트 사용 프로세스 확인
lsof -i :9090

# 대시보드 포트 변경
vision-node config --set dashboardPort=9091
```

---

### Node.js 버전 오류

```
[ERROR] Node.js v20+ required
```

**해결:** Node.js를 v20 이상으로 업그레이드하세요.

```bash
# macOS
brew upgrade node

# nvm 사용 시
nvm install 20
nvm use 20
```

---

### 빌드 실패 (`better-sqlite3` 관련)

`better-sqlite3`는 네이티브 모듈로, 빌드 도구가 필요합니다.

```bash
# macOS: Xcode Command Line Tools 설치
xcode-select --install

# Ubuntu: 빌드 도구 설치
sudo apt install -y python3 make g++
```

이후 다시 빌드합니다:

```bash
npm run clean
npm install
npm run build
```

---

### Heartbeat 401 오류

API 키가 유효하지 않을 수 있습니다.

**해결:** 설정을 삭제하고 재초기화하세요.

```bash
rm ~/.visionnode/config.json
vision-node init -e your@email.com -s 50GB
vision-node start
```

---

### 설정 초기화 (전체 리셋)

모든 데이터와 설정을 초기화하려면:

```bash
rm -rf ~/.visionnode
vision-node init -e your@email.com -s 50GB
```

> **주의:** 저장된 파일 데이터도 함께 삭제됩니다.

---

## 11. Uninstall

### npm link로 설치한 경우

```bash
cd visionchain/vision-node
npm unlink
```

### One-Line Install로 설치한 경우

```bash
# 글로벌 명령어 제거
sudo rm /usr/local/bin/vision-node

# 데이터 및 설정 제거
rm -rf ~/.vision-node
rm -rf ~/.visionnode
```

### Docker로 설치한 경우

```bash
cd visionchain/vision-node
docker compose down -v
```

---

## Quick Reference Card

```
vision-node init -e <email> [-s <size>] [-r <code>] [--class <class>] [--staging]
vision-node start [-d]
vision-node stop
vision-node status
vision-node config [--set <key=value>] [--json]
vision-node storage stats
vision-node storage put <filepath>
vision-node storage get <fileKey> <outputPath>
vision-node storage ls
vision-node storage rm <fileKey>
vision-node --version
vision-node --help
```

---

*Vision Chain Team | MIT License | [GitHub](https://github.com/jays-visionAI/visionchain)*
