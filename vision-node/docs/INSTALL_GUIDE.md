# Vision Node CLI -- 설치 및 사용 가이드

> Vision Chain 분산 스토리지 노드를 설치하고 운영하기 위한 초보자 가이드입니다.
> 명령어 하나하나를 따라하면 누구나 노드를 실행할 수 있습니다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [설치하기](#2-설치하기)
   - [macOS 설치](#macos-설치)
   - [Windows 설치](#windows-설치)
   - [Linux 설치](#linux-설치)
   - [수동 설치 (모든 OS 공통)](#수동-설치-모든-os-공통)
3. [노드 초기화 (init)](#3-노드-초기화-init)
4. [노드 실행 (start)](#4-노드-실행-start)
5. [노드 상태 확인 (status)](#5-노드-상태-확인-status)
6. [노드 중지 (stop)](#6-노드-중지-stop)
7. [설정 관리 (config)](#7-설정-관리-config)
8. [스토리지 관리 (storage)](#8-스토리지-관리-storage)
9. [대시보드](#9-대시보드)
10. [노드 클래스 선택 가이드](#10-노드-클래스-선택-가이드)
11. [설정 파일 구조](#11-설정-파일-구조)
12. [네트워크 포트](#12-네트워크-포트)
13. [문제 해결 (Troubleshooting)](#13-문제-해결-troubleshooting)
14. [삭제 (Uninstall)](#14-삭제-uninstall)
15. [자주 묻는 질문 (FAQ)](#15-자주-묻는-질문-faq)

---

## 1. 사전 준비

Vision Node를 설치하기 전에 아래 항목이 준비되어 있어야 합니다.

### 필수 요구 사항

| 항목 | 최소 요구 | 확인 방법 |
|------|----------|----------|
| **Node.js** | v20 이상 | `node -v` |
| **git** | 아무 버전 | `git --version` |
| **디스크 공간** | 100MB 이상 (여유 권장) | - |
| **인터넷 연결** | 상시 연결 필요 | - |

### Node.js 설치 (아직 없는 경우)

**macOS:**
```bash
# Homebrew 사용 (가장 쉬운 방법)
brew install node

# 또는 공식 사이트에서 다운로드
# https://nodejs.org/ 에서 LTS 버전을 다운로드하세요
```

**Windows:**
```
1. https://nodejs.org/ 접속
2. LTS (장기 지원) 버전 다운로드
3. 다운로드한 .msi 파일 실행
4. "Next" 를 눌러 기본 설정으로 설치
5. 설치 완료 후 새 터미널(cmd 또는 PowerShell) 열기
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 설치 확인

터미널(명령 프롬프트)을 열고 아래 명령어를 입력하세요:

```bash
node -v
# 출력 예: v20.11.0  (20 이상이면 OK)

git --version
# 출력 예: git version 2.39.0
```

> **Tip:** 버전 번호의 첫 번째 숫자가 20 이상이면 됩니다.

---

## 2. 설치하기

Vision Node는 **데스크탑 앱**과 **CLI(터미널)** 두 가지 방식으로 설치할 수 있습니다.

---

### 데스크탑 앱 (macOS) -- 권장

GUI 기반의 데스크탑 앱입니다. 별도의 Node.js 설치가 필요 없습니다.

**Step 1:** DMG 파일을 다운로드합니다.

- Apple Silicon (M1/M2/M3/M4): `Vision Node-1.0.0-arm64.dmg`
- Intel Mac: `Vision Node-1.0.0.dmg`

**Step 2:** DMG를 열고 `Vision Node.app`을 `Applications` 폴더로 드래그합니다.

**Step 3:** 앱을 실행합니다.

> **"손상된 파일" 오류가 발생하는 경우:**
>
> macOS의 Gatekeeper 보안 기능이 서명되지 않은 앱을 차단합니다.
> 아래 방법 중 하나로 해결하세요.
>
> **방법 1: 시스템 설정에서 허용 (가장 쉬움)**
> 1. DMG에서 앱을 Applications에 복사한 후 실행을 시도합니다.
> 2. "손상된 파일" 오류가 나옵니다.
> 3. **시스템 설정 > 개인 정보 보호 및 보안** 으로 이동합니다.
> 4. 하단에 "Vision Node" 앱이 차단되었다는 메시지가 표시됩니다.
> 5. **"확인 없이 열기"** 버튼을 클릭합니다.
>
> **방법 2: 터미널 명령어 (확실한 해결)**
> ```bash
> xattr -cr /Applications/Vision\ Node.app
> ```
> 이 명령어는 macOS가 다운로드 파일에 붙이는 격리(quarantine) 속성을 제거합니다.
> 실행 후 앱을 다시 열면 정상적으로 실행됩니다.

---

### macOS CLI 설치

터미널을 열고 아래 명령어를 복사-붙여넣기 하세요:

```bash
curl -fsSL https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/installers/install-macos.sh | bash
```


**이 명령어가 하는 일:**
1. Node.js와 git이 설치되어 있는지 확인
2. Vision Node 소스 코드를 `~/.vision-node/repo/` 에 다운로드
3. 필요한 패키지(라이브러리) 설치
4. TypeScript를 JavaScript로 빌드
5. `vision-node` 명령어를 터미널 어디서나 사용할 수 있도록 설정

설치가 완료되면 아래와 같은 메시지가 표시됩니다:
```
  Installation complete!

  Quick Start:

    1. Initialize your node:
       vision-node init --email your@email.com --class standard

    2. Start the node:
       vision-node start
```

---

### Windows 설치

1. 아래 링크를 브라우저에서 열어 설치 파일을 다운로드합니다:
   ```
   https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/installers/install-windows.bat
   ```

2. 다운로드한 `install-windows.bat` 파일을 **마우스 오른쪽 클릭** > **관리자 권한으로 실행**

3. 화면의 안내를 따릅니다.

4. 설치 완료 후 **새 터미널(cmd 또는 PowerShell)을 열어야** `vision-node` 명령어가 작동합니다.

---

### Linux 설치

macOS와 동일한 설치 스크립트를 사용합니다:

```bash
curl -fsSL https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/installers/install-macos.sh | bash
```

---

### 수동 설치 (모든 OS 공통)

자동 설치 스크립트 대신 직접 설치하고 싶다면 아래 단계를 따르세요.

**Step 1: 소스 코드 다운로드**
```bash
git clone --depth 1 https://github.com/jays-visionAI/visionchain.git
```
> `--depth 1` : 최신 커밋만 다운로드하여 용량을 절약합니다.

**Step 2: vision-node 디렉토리로 이동**
```bash
cd visionchain/vision-node
```

**Step 3: 패키지 설치**
```bash
npm install
```
> 필요한 라이브러리들(commander, chalk 등)을 자동으로 다운로드합니다.

**Step 4: 빌드**
```bash
npm run build
```
> TypeScript 소스 코드를 JavaScript로 변환합니다.
> 변환된 파일은 `dist/` 폴더에 생성됩니다.

**Step 5: 초기화 및 실행**
```bash
# 수동 설치의 경우 node dist/index.js 로 실행합니다
node dist/index.js init --email your@email.com --storage 10GB --class standard

# 노드 시작
node dist/index.js start
```

> **Tip:** 자동 설치를 하면 `vision-node` 명령어를 바로 사용할 수 있지만,
> 수동 설치의 경우 `node dist/index.js` 로 실행해야 합니다.

---

## 3. 노드 초기화 (init)

노드를 처음 사용할 때 반드시 한 번 실행해야 합니다.
이메일 주소를 등록하고, 스토리지 크기와 노드 유형을 설정합니다.

### 기본 사용법

```bash
vision-node init --email you@example.com --class standard
```

### 전체 옵션

```bash
vision-node init --email <이메일> [옵션]
```

| 옵션 | 축약 | 필수 여부 | 기본값 | 설명 |
|------|------|----------|--------|------|
| `--email <이메일>` | `-e` | **필수** | - | 노드 등록에 사용할 이메일 주소. 보상 수령 및 노드 식별에 사용됩니다. |
| `--storage <크기>` | `-s` | 선택 | `50GB` | 이 노드에 할당할 디스크 공간. 형식: `숫자+단위` (예: `10GB`, `500MB`, `1TB`) |
| `--class <클래스>` | - | 선택 | 자동 감지 | 노드 유형을 지정합니다. 아래 [노드 클래스 선택 가이드](#10-노드-클래스-선택-가이드) 참고. 가능한 값: `lite`, `standard`, `full` |
| `--referral <코드>` | `-r` | 선택 | - | 추천인 코드. 추천인이 있으면 입력하세요. |
| `--staging` | - | 선택 | `false` | 테스트 네트워크(staging)에 연결합니다. 실제 보상은 지급되지 않습니다. 개발/테스트용입니다. |

### 옵션 상세 설명

#### `--email` (필수)

```bash
vision-node init --email myemail@gmail.com
```

- Vision Chain 네트워크에 노드를 등록할 때 사용되는 이메일입니다.
- 이 이메일로 고유한 **Node ID**와 **지갑 주소**가 자동 생성됩니다.
- 보상(VCN 토큰)은 이 이메일에 연결된 지갑으로 지급됩니다.
- 한 번 등록하면 변경할 수 없으니 정확하게 입력하세요.

#### `--storage` (선택)

이 노드가 네트워크를 위해 제공할 디스크 공간을 설정합니다.

```bash
# 10GB 할당
vision-node init --email you@email.com --storage 10GB

# 500MB만 할당 (가벼운 참여)
vision-node init --email you@email.com --storage 500MB

# 1TB 할당 (대규모 참여)
vision-node init --email you@email.com --storage 1TB
```

| 입력 형식 | 설명 | 변환값 |
|----------|------|--------|
| `500MB` | 메가바이트 단위 | 0.49GB |
| `10GB` | 기가바이트 단위 | 10GB |
| `1TB` | 테라바이트 단위 | 1024GB |

> **주의:** 실제 디스크 여유 공간보다 크게 설정하면 안 됩니다.
> 기본값은 50GB입니다. 테스트 목적이라면 `500MB` 또는 `1GB` 로 작게 시작해 보세요.

#### `--class` (선택)

노드의 유형을 직접 지정합니다. 지정하지 않으면 시스템 사양에 따라 자동으로 결정됩니다.

```bash
# 가벼운 참여
vision-node init --email you@email.com --class lite

# 기본 노드 (권장)
vision-node init --email you@email.com --class standard

# 대규모 참여
vision-node init --email you@email.com --class full
```

자동 감지 기준:
- CPU 4코어 이상 + RAM 4GB 이상 -> `full`
- CPU 2코어 이상 + RAM 1GB 이상 -> `standard`
- 그 외 -> `lite`

> 자세한 내용은 [노드 클래스 선택 가이드](#10-노드-클래스-선택-가이드)를 참고하세요.

#### `--referral` (선택)

추천인 코드가 있으면 입력합니다:

```bash
vision-node init --email you@email.com --referral ABC123
```

#### `--staging` (선택)

개발/테스트 목적으로 스테이징(테스트) 네트워크에 연결합니다:

```bash
vision-node init --email you@email.com --staging
```

- 스테이징 환경에서는 실제 VCN 보상이 지급되지 않습니다.
- 기능을 테스트해보고 싶을 때 사용하세요.
- `--staging`을 생략하면 자동으로 프로덕션(실제) 네트워크에 연결됩니다.

### 사용 예시 (따라하기)

**예시 1: 가장 간단한 초기화**
```bash
vision-node init --email you@example.com --class standard
```
-> 이메일 등록, standard 클래스, 기본 50GB 스토리지로 초기화

**예시 2: 모든 옵션을 지정한 초기화**
```bash
vision-node init \
  --email you@example.com \
  --storage 100GB \
  --class full \
  --referral FRIEND_CODE
```
-> 100GB 스토리지, full 클래스, 추천인 코드 포함

**예시 3: 테스트 목적 초기화**
```bash
vision-node init --email test@example.com --storage 1GB --class lite --staging
```
-> 1GB 스토리지, lite 클래스, 스테이징 네트워크

### 초기화 성공 시 출력 예시

```
  Vision Node - Initialization

  Email:     you@example.com
  Storage:   10GB
  Class:     standard (auto-detected)
  Env:       production

  Registering with Vision Chain...

  Registration successful!
  Node ID:  vn_abc123def456
  Wallet:   0x1234...5678

  Run vision-node start to begin earning rewards.
```

### 이미 초기화된 경우

이미 초기화를 했다면 아래와 같은 메시지가 나옵니다:
```
  Node already initialized.
  Email: you@example.com
  Node ID: vn_abc123def456

  Use "vision-node start" to run the node.
  Use "vision-node init --force" to reinitialize.
```

---

## 4. 노드 실행 (start)

초기화가 완료된 노드를 실행합니다.

### 기본 사용법

```bash
vision-node start
```

### 전체 옵션

```bash
vision-node start [옵션]
```

| 옵션 | 축약 | 기본값 | 설명 |
|------|------|--------|------|
| `--daemon` | `-d` | `false` | 백그라운드(데몬) 모드로 실행합니다. (향후 지원 예정, 현재는 포그라운드로 실행됨) |

### 노드가 시작되면 일어나는 일

1. **스토리지 엔진** 시작 -- 파일을 청크(256KB 조각)로 나누어 저장하는 엔진
2. **하트비트 서비스** 시작 -- 5분마다 서버에 "노드가 살아있다"는 신호를 전송
3. **대시보드** 시작 -- 웹 브라우저에서 노드 상태를 확인할 수 있는 화면 (http://localhost:9090)
4. **P2P 네트워크** 시작 -- 다른 노드들과 데이터를 주고받는 네트워크 연결
5. **청크 레지스트리** 시작 -- 네트워크에서 이 노드가 보관할 데이터를 동기화

### 실행 시 출력 예시

```
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║     V I S I O N   N O D E    v1.0.0  ║
  ║     Distributed Storage Network          ║
  ║                                          ║
  ╚══════════════════════════════════════════╝

  Email:    you@example.com
  Class:    standard
  Storage:  10GB
  Env:      production

[Node] Starting Vision Node (standard)
[Node] ID: vn_abc123def456
[Node] Storage: /Users/you/.visionnode/storage (max 10GB)
[Node] API: production
[Node] All services started

  Node is running. Press Ctrl+C to stop.
```

### 다른 인스턴스가 이미 실행 중인 경우

```
  Another Vision Node instance is already running:
  cli (PID: 12345)

  Only one node per machine is allowed.
  Stop the other instance first, or delete ~/.visionnode/node.lock
```

> **Tip:** 하나의 컴퓨터에서는 하나의 노드만 실행할 수 있습니다.

### 노드 종료 방법

포그라운드에서 실행 중인 노드는 `Ctrl + C` 를 누르면 종료됩니다:

```
  Shutting down...
  Node stopped. Goodbye!
```

---

## 5. 노드 상태 확인 (status)

현재 노드의 상태를 Vision Chain 서버에서 조회합니다.

### 기본 사용법

```bash
vision-node status
```

> 이 명령어는 추가 옵션이 없습니다.

### 출력 예시

```
  Fetching status from Vision Chain...

  Vision Node Status

  Node ID:      vn_abc123def456
  Class:        standard
  Status:       active
  Uptime:       24.5h
  Heartbeats:   293
  Reward:       1.2345 VCN
  Rank:         #42
  Storage:      10GB allocated
  Environment:  production
```

### 출력 필드 설명

| 필드 | 설명 |
|------|------|
| **Node ID** | 노드의 고유 식별자 |
| **Class** | 노드 유형 (lite / standard / full) |
| **Status** | 현재 상태 (active = 정상 작동 중) |
| **Uptime** | 노드가 연속으로 실행된 시간 |
| **Heartbeats** | 서버에 전송된 하트비트(생존 신호)의 총 횟수 |
| **Reward** | 현재까지 누적된 보상 (VCN 토큰) |
| **Rank** | 전체 노드 중 순위 |
| **Storage** | 할당된 스토리지 용량 |
| **Environment** | 연결된 네트워크 (production 또는 staging) |

---

## 6. 노드 중지 (stop)

### 포그라운드 실행 중 중지

노드가 포그라운드에서 실행 중이라면 해당 터미널에서 `Ctrl + C` 를 누르세요.

### stop 명령어

```bash
vision-node stop
```

> 현재는 데몬(백그라운드) 모드가 지원되지 않으므로,
> 이 명령어는 안내 메시지만 표시합니다.
> 향후 데몬 모드가 추가되면 이 명령어로 백그라운드 노드를 중지할 수 있습니다.

---

## 7. 설정 관리 (config)

노드의 설정값을 확인하거나 변경합니다.

### 설정 보기

```bash
vision-node config
```

출력 예시:
```
  Vision Node Configuration

  Email:          you@example.com
  Node ID:        vn_abc123def456
  Class:          standard
  Environment:    production
  Storage Max:    10GB
  Storage Path:   /Users/you/.visionnode/storage
  HB Interval:    300s
  Dashboard Port: 9090
  P2P Port:       4001
  Registered:     yes
  Config Dir:     /Users/you/.visionnode
```

### JSON 형식으로 보기

프로그래밍이나 스크립트에서 활용하고 싶다면 JSON으로 출력할 수 있습니다:

```bash
vision-node config --json
```

출력 예시:
```json
{
  "nodeId": "vn_abc123def456",
  "email": "you@example.com",
  "apiKey": "sk_...",
  "walletAddress": "0x123...",
  "nodeClass": "standard",
  "environment": "production",
  "storagePath": "/Users/you/.visionnode/storage",
  "storageMaxGB": 10,
  "heartbeatIntervalMs": 300000,
  "dashboardPort": 9090,
  "p2pPort": 4001,
  "registered": true,
  ...
}
```

### 설정값 변경

```bash
vision-node config --set <키>=<값>
```

| 옵션 | 설명 |
|------|------|
| `--set <key=value>` | 설정값을 변경합니다. `키=값` 형식으로 입력합니다. |
| `--json` | 설정을 JSON 형식으로 출력합니다. |

### 변경 가능한 설정 키

| 키 | 타입 | 설명 | 예시 |
|----|------|------|------|
| `storageMaxGB` | 숫자 | 최대 스토리지 용량 (GB) | `--set storageMaxGB=100` |
| `heartbeatIntervalMs` | 숫자 | 하트비트 전송 간격 (밀리초). 기본값 300000 (5분) | `--set heartbeatIntervalMs=600000` |
| `dashboardPort` | 숫자 | 대시보드 웹 서버 포트 | `--set dashboardPort=8080` |
| `p2pPort` | 숫자 | P2P 네트워크 포트 | `--set p2pPort=5001` |
| `nodeClass` | 문자열 | 노드 클래스 | `--set nodeClass=full` |
| `environment` | 문자열 | 연결 환경 | `--set environment=staging` |

### 사용 예시

```bash
# 스토리지를 100GB로 변경
vision-node config --set storageMaxGB=100

# 대시보드 포트를 8080으로 변경
vision-node config --set dashboardPort=8080

# 하트비트 간격을 10분(600000ms)으로 변경
vision-node config --set heartbeatIntervalMs=600000
```

> **주의:** 설정을 변경한 후에는 노드를 **재시작**해야 반영됩니다.

---

## 8. 스토리지 관리 (storage)

분산 스토리지에 파일을 저장, 조회, 삭제할 수 있습니다.

### 8.1 스토리지 통계 보기

```bash
vision-node storage stats
```

출력 예시:
```
  Storage Statistics

  Status:      running
  Files:       42
  Chunks:      1,284
  Used:        3.2GB
  Max:         10.0GB
  Usage:       32%
  Path:        /Users/you/.visionnode/storage
```

| 필드 | 설명 |
|------|------|
| **Status** | 스토리지 엔진 상태 (running / stopped) |
| **Files** | 저장된 파일 수 |
| **Chunks** | 파일이 분할된 청크(조각) 수. 파일은 256KB 단위로 분할됩니다. |
| **Used** | 현재 사용 중인 디스크 공간 |
| **Max** | 최대 할당 용량 |
| **Usage** | 사용률 (80% 이상이면 빨간색으로 표시) |
| **Path** | 데이터가 저장되는 실제 디스크 경로 |

### 8.2 파일 저장하기

```bash
vision-node storage put <파일경로>
```

**예시:**
```bash
# 현재 경로의 파일 저장
vision-node storage put mydata.json

# 절대 경로로 파일 저장
vision-node storage put /Users/you/Documents/report.pdf
```

성공 시 출력 예시:
```
  Storing 2.4MB...

  Stored successfully!
  File Key:    f_a1b2c3d4e5
  CID:         bafybeig...
  Merkle Root: 3a4f5b6c7d8e9f0a1b2c...
  Size:        2.4MB
  Chunks:      10
```

| 필드 | 설명 |
|------|------|
| **File Key** | 파일을 조회/삭제할 때 사용하는 고유 키 |
| **CID** | 컨텐츠 기반 식별자 (Content ID) |
| **Merkle Root** | 파일 무결성 검증용 해시값 |
| **Chunks** | 파일이 나뉜 조각 수 (1 청크 = 256KB) |

### 8.3 저장된 파일 목록 보기

```bash
vision-node storage ls
```

출력 예시:
```
  Stored Files (3)

  FILE KEY              SIZE         CHUNKS   CREATED
  ----------------------------------------------------------------------
  f_a1b2c3d4e5          2.4MB        10       2026-02-23 10:30:00
  f_x9y8z7w6v5          512.0KB      2        2026-02-22 14:15:00
  f_m1n2o3p4q5          15.7MB       63       2026-02-21 09:00:00
```

### 8.4 파일 다운로드하기

```bash
vision-node storage get <파일키> <저장할경로>
```

**예시:**
```bash
# 파일을 현재 디렉토리에 다운로드
vision-node storage get f_a1b2c3d4e5 ./downloaded.json

# 특정 경로에 다운로드
vision-node storage get f_a1b2c3d4e5 /Users/you/Downloads/myfile.json
```

### 8.5 파일 삭제하기

```bash
vision-node storage rm <파일키>
```

**예시:**
```bash
vision-node storage rm f_a1b2c3d4e5
```

성공 시:
```
  Deleted: f_a1b2c3d4e5
```

---

## 9. 대시보드

노드를 시작하면 웹 대시보드가 자동으로 실행됩니다.

**접속 주소:** http://localhost:9090

### 대시보드에서 확인할 수 있는 정보

- 노드 상태, 가동 시간, 시스템 정보
- 스토리지 사용량 및 파일 관리
- P2P 네트워크 연결된 피어(peer) 목록
- 청크 레지스트리 동기화 상태
- VCN 보상 추적

> **Tip:** 대시보드 포트를 변경하고 싶다면:
> ```bash
> vision-node config --set dashboardPort=8080
> ```
> 변경 후 노드를 재시작하면 http://localhost:8080 으로 접속할 수 있습니다.

---

## 10. 노드 클래스 선택 가이드

어떤 클래스를 선택할지 모르겠다면 아래 표를 참고하세요.

| 클래스 | 스토리지 범위 | 보상 가중치 | 추천 대상 | 시스템 요구사항 |
|--------|-------------|-----------|----------|--------------|
| **lite** | 100MB ~ 1GB | 0.01x | 처음 시작하는 사용자, 테스트 목적 | CPU 1코어, RAM 512MB 이상 |
| **standard** | 1GB ~ 100GB | 0.02x | 일반 사용자 (권장) | CPU 2코어, RAM 1GB 이상 |
| **full** | 100GB ~ 1TB | 0.05x | 전문 노드 운영자, 높은 보상 희망 | CPU 4코어, RAM 4GB 이상 |
| **agent** | 10GB ~ 500GB | 0.03x | AI 에이전트 연동 노드 (프로그래밍 제어용) | CPU 2코어+, RAM 2GB 이상 |

### 보상 가중치란?

- 노드 보상은 `가동 시간 x 보상 가중치 x 스토리지 제공량`으로 계산됩니다.
- 예를 들어 `full` 클래스의 가중치(0.05x)는 `lite`(0.01x)보다 5배 높습니다.
- 더 많은 리소스를 제공할수록 더 많은 VCN 보상을 받을 수 있습니다.

### 선택 팁

- **처음이라면:** `--class standard --storage 10GB` 로 시작하세요.
- **단순 테스트:** `--class lite --storage 500MB --staging` 으로 부담 없이 시작하세요.
- **본격 운영:** `--class full --storage 500GB` -- 높은 보상을 기대할 수 있습니다.

---

## 11. 설정 파일 구조

### 설정 파일 위치

```
~/.visionnode/config.json
```

macOS/Linux: `/Users/<사용자이름>/.visionnode/config.json`
Windows: `C:\Users\<사용자이름>\.visionnode\config.json`

### 설정 파일 전체 구조

```json
{
  "nodeId": "vn_abc123def456",
  "email": "you@example.com",
  "apiKey": "sk_xxx...",
  "walletAddress": "0x1234...5678",
  "referralCode": "",

  "nodeClass": "standard",
  "environment": "production",
  "storagePath": "/Users/you/.visionnode/storage",
  "storageMaxGB": 50,

  "heartbeatIntervalMs": 300000,
  "dashboardPort": 9090,
  "p2pPort": 4001,

  "apiUrl": "https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway",
  "wsRpcUrl": "wss://ws.rpc.visionchain.co",

  "registered": true,
  "firstLaunch": "2026-02-23T01:30:00.000Z",
  "lastLaunch": "2026-02-23T10:00:00.000Z"
}
```

### 각 필드 설명

| 카테고리 | 필드 | 설명 |
|---------|------|------|
| **신원** | `nodeId` | 서버가 발급한 노드 고유 ID |
| | `email` | 등록 이메일 |
| | `apiKey` | 서버 통신용 API 키 (자동 발급) |
| | `walletAddress` | VCN 보상 수령용 지갑 주소 (자동 생성) |
| | `referralCode` | 추천인 코드 |
| **설정** | `nodeClass` | 노드 유형: lite, standard, full, agent |
| | `environment` | 연결 네트워크: production 또는 staging |
| | `storagePath` | 데이터 저장 디렉토리 경로 |
| | `storageMaxGB` | 최대 스토리지 용량 (GB) |
| **네트워크** | `heartbeatIntervalMs` | 하트비트 전송 간격 (밀리초, 기본 300000 = 5분) |
| | `dashboardPort` | 웹 대시보드 포트 (기본 9090) |
| | `p2pPort` | P2P 네트워크 포트 (기본 4001) |
| | `apiUrl` | 백엔드 API 엔드포인트 (자동 설정) |
| | `wsRpcUrl` | WebSocket RPC 엔드포인트 (자동 설정) |
| **상태** | `registered` | 백엔드 등록 완료 여부 (true/false) |
| | `firstLaunch` | 최초 실행 시각 |
| | `lastLaunch` | 마지막 실행 시각 |

---

## 12. 네트워크 포트

Vision Node는 아래 포트를 사용합니다. 방화벽 설정 시 참고하세요.

| 포트 | 프로토콜 | 서비스 | 설명 |
|------|---------|--------|------|
| **9090** | HTTP | 대시보드 | 웹 브라우저에서 노드 상태 확인. 외부에서 접속하려면 방화벽에서 허용 필요. |
| **4001** | WebSocket | P2P 네트워크 | 다른 노드들과 데이터 교환. 외부 연결을 허용하면 더 많은 피어와 연결됩니다. |

---

## 13. 문제 해결 (Troubleshooting)

### "Node not initialized" 오류

```
Node not initialized. Run "vision-node init" first.
```

**해결:** `vision-node init --email your@email.com --class standard` 로 초기화하세요.

### "Another Vision Node instance is already running" 오류

```
Another Vision Node instance is already running
```

**해결:**
1. 다른 터미널에서 실행 중인 노드를 먼저 종료하세요 (`Ctrl + C`).
2. 프로세스를 찾을 수 없다면 Lock 파일을 삭제하세요:
   ```bash
   rm ~/.visionnode/node.lock
   ```

### "Registration failed" 오류

```
Registration failed: <에러 메시지>
```

**해결:**
1. 인터넷 연결을 확인하세요.
2. 이메일 주소가 올바른지 확인하세요.
3. 잠시 후 다시 시도하세요: `vision-node start`

### 대시보드에 접속이 안 되는 경우

1. 노드가 실행 중인지 확인: `vision-node status`
2. 포트가 이미 사용 중인지 확인:
   ```bash
   # macOS/Linux
   lsof -i :9090

   # Windows
   netstat -ano | findstr :9090
   ```
3. 포트를 변경해 보세요:
   ```bash
   vision-node config --set dashboardPort=8080
   ```

### Node.js 버전 오류

```
Node.js v20+ required
```

**해결:**
```bash
# 현재 버전 확인
node -v

# macOS에서 업그레이드
brew upgrade node

# 또는 nvm 사용
nvm install 20
nvm use 20
```

### "command not found: vision-node" 오류

설치 후 `vision-node` 명령어를 찾지 못하는 경우:

**해결 1:** 새 터미널을 열어보세요.

**해결 2:** PATH에 수동 등록:
```bash
# macOS/Linux - ~/.zshrc 또는 ~/.bashrc 에 추가
export PATH="$HOME/.vision-node:$PATH"

# 추가 후 적용
source ~/.zshrc
```

**해결 3:** 직접 실행:
```bash
~/.vision-node/vision-node start
```

---

## 14. 삭제 (Uninstall)

Vision Node를 완전히 제거하려면:

### macOS / Linux

```bash
# 데이터 및 설정 삭제
rm -rf ~/.vision-node ~/.visionnode

# 글로벌 명령어 삭제
rm -f /usr/local/bin/vision-node
rm -f /opt/homebrew/bin/vision-node
```

### Windows

```cmd
rmdir /s /q %USERPROFILE%\.vision-node %USERPROFILE%\.visionnode
```

> **경고:** 삭제하면 저장된 데이터, 설정, API 키가 모두 사라집니다.
> 필요한 데이터가 있다면 먼저 백업하세요.

---

## 15. 자주 묻는 질문 (FAQ)

### Q: 노드를 실행하면 보상은 어떻게 받나요?

노드가 실행 중이면 5분마다 하트비트가 자동 전송됩니다.
하트비트 횟수, 가동 시간, 노드 클래스에 따라 VCN 보상이 자동으로 누적됩니다.
`vision-node status` 명령어로 현재 보상을 확인할 수 있습니다.

### Q: 여러 대의 컴퓨터에서 같은 이메일로 노드를 운영할 수 있나요?

네, 가능합니다. 각 컴퓨터에서 같은 이메일로 `vision-node init`을 실행하면 됩니다.
각 노드는 고유한 Node ID를 발급받으며, 보상은 같은 이메일의 지갑에 합산됩니다.

### Q: 노드를 꺼도 기존 보상은 유지되나요?

네, 이미 누적된 보상은 서버에 기록되어 있으므로 노드를 꺼도 사라지지 않습니다. 단, 노드가 꺼져 있는 동안에는 새로운 보상이 누적되지 않습니다.

### Q: staging과 production의 차이는 무엇인가요?

- **production**: 실제 Vision Chain 네트워크. 실제 VCN 보상이 지급됩니다.
- **staging**: 테스트 네트워크. 기능 테스트 목적이며 실제 보상은 지급되지 않습니다.

### Q: 스토리지 할당량을 나중에 변경할 수 있나요?

네, 가능합니다:
```bash
vision-node config --set storageMaxGB=100
```
변경 후 노드를 재시작하면 적용됩니다.

### Q: 어떤 데이터가 내 노드에 저장되나요?

Vision Chain 네트워크의 분산 스토리지 데이터가 청크(256KB 조각) 단위로 저장됩니다.
데이터는 SHA-256 해시로 주소화되며 Merkle 트리로 무결성이 보장됩니다.

---

## 명령어 요약표 (Quick Reference)

```
vision-node init -e <email> [옵션]     노드 초기화 (최초 1회)
vision-node start [-d]                 노드 실행
vision-node stop                       노드 중지 안내
vision-node status                     노드 상태 조회
vision-node config [--json]            설정 보기
vision-node config --set key=value     설정 변경
vision-node storage stats              스토리지 통계
vision-node storage put <file>         파일 저장
vision-node storage get <key> <path>   파일 다운로드
vision-node storage ls                 파일 목록
vision-node storage rm <key>           파일 삭제
```

---

*Vision Chain Team | https://visionchain.co*
