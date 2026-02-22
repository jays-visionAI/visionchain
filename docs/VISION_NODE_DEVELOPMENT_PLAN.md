# Vision Node Development Plan

**Version**: 1.0
**Date**: 2026-02-22
**Status**: Planning

---

## 1. Overview

Vision Node는 Vision Chain의 분산 인프라를 구성하는 핵심 소프트웨어입니다.
현재 Android 전용 모바일 노드(`vision-mobile-node`)에서 출발하여,
크로스 플랫폼 분산 스토리지 노드 시스템으로 확장합니다.

### 목표

- 모바일, 데스크탑, 서버 환경에서 동작하는 통합 노드 소프트웨어
- 분산 클라우드 스토리지 (Filecoin/IPFS의 경량 버전)
- OpenClaw 에이전트가 프로그래매틱하게 노드를 배포/운영
- 기여도 기반 VCN 토큰 보상 체계

---

## 2. Node Class System

환경과 기여도에 따라 4개 클래스로 분류합니다.

| Class | 이름 | 환경 | 스토리지 | 역할 | Weight |
|---|---|---|---|---|---|
| **Lite** | Vision Lite Node | Android / iOS | 100MB ~ 1GB | Heartbeat + 경량 캐시 | 0.01x |
| **Standard** | Vision Standard Node | Windows / macOS / Linux | 10GB ~ 100GB | 블록 검증 + 분산 스토리지 + 릴레이 | 0.1x |
| **Full** | Vision Full Node | 서버 / 데스크탑 (Linux) | 100GB ~ 1TB | 전체 체인 데이터 + Storage Provider + P2P 허브 | 1.0x |
| **Agent** | Vision Agent Node | 어디서든 (API 기반) | 가변 | OpenClaw 에이전트가 운영, 자동화된 노드 관리 | 0.05x ~ 1.0x |

### Lite Node (기존 Mobile Node 확장)

- 대상: 일반 사용자, 모바일 기기
- 스토리지 옵션: 100MB / 500MB / 1GB
- 기능: Heartbeat, 경량 데이터 캐싱, 블록 헤더 검증
- 특징: 배터리 최적화, 셀룰러/WiFi 적응형 동작

### Standard Node (데스크탑 노드)

- 대상: PC 사용자, 소규모 기여자
- 스토리지 옵션: 10GB / 25GB / 50GB / 100GB
- 기능: 블록 검증, 데이터 청킹 및 저장, 릴레이, P2P 참여
- 특징: 백그라운드 서비스로 상시 운영, 로컬 웹 대시보드

### Full Node (서버급 노드)

- 대상: 전문 노드 운영자, 스토리지 마이너
- 스토리지 옵션: 100GB / 250GB / 500GB / 1TB
- 기능: 전체 체인 데이터 보유, Storage Provider, P2P 허브, 데이터 복제 관리
- 특징: 높은 uptime 요구, 리워드 극대화, 서버 환경 최적화

### Agent Node (에이전트 운영 노드)

- 대상: OpenClaw AI 에이전트
- 스토리지: 에이전트가 동적으로 설정
- 기능: API 기반 노드 제어, 자동 모니터링, 스케일링
- 특징: 프로그래매틱 배포, 멀티 노드 클러스터 관리

---

## 3. Technology Stack

### Desktop/Server Node

| 구성 요소 | 기술 | 이유 |
|---|---|---|
| Runtime | Node.js (v20+) | 프로젝트 주력 언어, npm 생태계 활용 |
| CLI Framework | Commander.js | 표준 CLI 인터페이스 |
| 로컬 대시보드 | Express + 정적 HTML/JS | 경량, 추가 빌드 도구 불필요 |
| 스토리지 엔진 | 파일시스템 (fs) + SQLite (인덱스) | 대용량 바이너리 처리, 10GB+ 지원 |
| P2P 네트워크 | libp2p (js-libp2p) | 분산 네트워크 표준, IPFS와 호환 |
| 데이터 해싱 | SHA-256 (Node.js crypto) | 청크 무결성 + Content Addressing |
| 백엔드 통신 | REST API (fetch) | agentGateway와 통신 |
| 패키징 | npm 패키지 + Docker | 크로스 플랫폼 배포 |

### Mobile Node (기존 유지)

| 구성 요소 | 기술 |
|---|---|
| Framework | React Native 0.77 |
| Native Module | Kotlin (Android) |
| 스토리지 | react-native-fs (Phase 1에서 전환) |
| 통신 | REST API |

### 공통 코어 모듈

```
@visionchain/node-core
├── heartbeat.ts          # Heartbeat 로직
├── blockVerifier.ts      # 블록 검증
├── chunkManager.ts       # 데이터 청킹/무결성
├── storageEngine.ts      # 스토리지 인터페이스 (플랫폼별 구현)
├── replicationManager.ts # 데이터 복제 관리
├── proofGenerator.ts     # Storage Proof 생성
└── types.ts              # 공통 타입 정의
```

---

## 4. Architecture

### 전체 시스템 구조

```
                    Vision Chain (L1 Blockchain)
                    [Merkle Root, Storage Contract, Rewards]
                              |
                    ──────────────────────
                    |                    |
              Backend (Firebase)    P2P Network (libp2p)
              [Chunk Registry]     [노드 간 직접 통신]
              [Node Registry]      [DHT 기반 청크 탐색]
              [Reward Calculator]  [데이터 복제/전파]
                    |                    |
        ┌───────────┼────────────────────┼───────────┐
        |           |                    |           |
   Lite Node   Standard Node       Full Node    Agent Node
   (Android)   (Win/Mac/Linux)   (Linux Server)  (API 제어)
   100MB~1GB   10GB~100GB        100GB~1TB      가변
```

### 데이터 흐름

```
사용자가 파일 업로드
    |
    v
Client-side AES-256 암호화
    |
    v
256KB 청크로 분할
    |
    v
각 청크 SHA-256 해싱 -> Content ID 생성
    |
    v
Merkle Tree 구성 -> Root Hash
    |
    v
Chunk Registry에 등록 (어떤 노드가 저장할지 결정)
    |
    v
최소 3개 노드에 청크 복제
    |
    v
Merkle Root를 On-chain에 기록 (Storage Contract)
```

### 디렉토리 구조 (Desktop Node)

```
vision-node/
├── package.json
├── bin/
│   └── vision-node.js              # CLI entry point
├── src/
│   ├── core/
│   │   ├── heartbeat.ts            # Heartbeat 서비스
│   │   ├── storage.ts              # 파일시스템 기반 스토리지 엔진
│   │   ├── blockObserver.ts        # WebSocket 블록 검증
│   │   ├── chunkManager.ts         # 데이터 청킹/무결성/Merkle Tree
│   │   ├── p2pNetwork.ts           # libp2p 기반 노드 간 통신
│   │   ├── proofOfStorage.ts       # 스토리지 보유 증명
│   │   └── replication.ts          # 데이터 복제 관리
│   ├── api/
│   │   ├── gateway.ts              # 백엔드 API 통신
│   │   └── agentApi.ts             # 에이전트용 REST API 노출
│   ├── dashboard/
│   │   ├── server.ts               # Express 로컬 웹서버
│   │   └── public/                 # 대시보드 UI (정적 파일)
│   │       ├── index.html
│   │       ├── dashboard.js
│   │       └── styles.css
│   └── config/
│       └── nodeConfig.ts           # 노드 설정 관리
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
└── README.md
```

---

## 5. Distributed Storage System

### 5.1 Chunking (데이터 청킹)

- 모든 데이터를 **256KB 고정 크기 청크**로 분할
- 각 청크에 **SHA-256 해시** 부여 (Content ID)
- 파일 전체의 **Merkle Tree 루트 해시** 계산
- 청크 크기는 모바일 환경의 네트워크 전송 최적화 기준

```
File "document.pdf" (2MB)
  -> Chunk 0: sha256_aaa... (256KB)
  -> Chunk 1: sha256_bbb... (256KB)
  -> ...
  -> Chunk 7: sha256_hhh... (256KB)
  -> Merkle Root: sha256_root...
```

### 5.2 Replication (데이터 복제)

- 각 청크는 최소 **3개 노드**에 복제 (Replication Factor = 3)
- Full Node는 복제 우선 대상 (높은 uptime, 큰 스토리지)
- 노드가 오프라인되면 자동으로 다른 노드에 복제 재배치
- Chunk Registry (백엔드)가 복제 상태를 추적

```
chunk_abc123:
  - node_001 (Seoul, online, Full Node)
  - node_047 (Busan, online, Standard Node)
  - node_182 (Tokyo, offline -> 새 복제 대상 선정)
```

### 5.3 Storage Proof (스토리지 증명)

노드가 실제로 데이터를 보유하고 있음을 증명하는 메커니즘:

1. 백엔드가 랜덤 청크 ID + 랜덤 offset을 challenge로 전송
2. 노드가 해당 위치의 데이터를 읽어 해시 응답
3. 백엔드가 원본 해시와 비교하여 검증
4. 주기적으로 (매 heartbeat마다) 1~3개 청크에 대해 수행

### 5.4 Content Addressing

URL이 아닌 해시 기반 주소 체계:

```
vcn://sha256_abc123def456...     # 특정 청크
vcn://merkle_root_789...         # 파일 전체 (Merkle Root)
```

### 5.5 암호화 및 프라이버시

- 모든 데이터는 **Client-side AES-256-GCM** 암호화 후 저장
- 노드 운영자는 암호화된 청크만 보유 (내용 열람 불가)
- 복호화 키는 데이터 소유자만 보유
- 키 관리: Vision Chain 지갑의 파생 키 사용

---

## 6. Agent Node API

OpenClaw 에이전트가 노드를 프로그래매틱하게 제어하기 위한 API입니다.

### 6.1 로컬 REST API (노드가 노출)

```
# 노드 제어
POST   /api/node/start                  # 노드 시작
POST   /api/node/stop                   # 노드 중지
GET    /api/node/status                 # 상태 조회
POST   /api/node/config                 # 설정 변경
GET    /api/node/health                 # 헬스체크

# 스토리지
GET    /api/storage/stats               # 스토리지 현황
POST   /api/storage/allocate            # 할당량 변경
GET    /api/storage/chunks              # 보유 청크 목록
DELETE /api/storage/cache               # 캐시 클리어

# 보상
GET    /api/rewards/summary             # 리워드 요약
POST   /api/rewards/claim               # 리워드 청구
GET    /api/rewards/history             # 보상 내역

# 네트워크
GET    /api/network/peers               # P2P 연결 피어 목록
GET    /api/network/bandwidth           # 대역폭 사용량
```

### 6.2 agentGateway 확장 (백엔드 API)

기존 agentGateway Cloud Function에 추가되는 액션:

```
# 기존 (유지)
mobile_node.register
mobile_node.heartbeat
mobile_node.status
mobile_node.claim_reward
mobile_node.submit_attestation
mobile_node.leaderboard

# 신규
node.register                   # 노드 등록 (class 지정)
node.heartbeat                  # 통합 heartbeat (class 자동 감지)
node.storage_proof_challenge    # Storage Proof challenge 수신
node.storage_proof_response     # Storage Proof 응답 제출
node.chunk_assignment           # 저장해야 할 청크 할당 받기
node.chunk_stored               # 청크 저장 완료 보고
node.cluster_status             # 에이전트 관리 노드 클러스터 상태
node.scale_storage              # 스토리지 할당 동적 변경
```

### 6.3 에이전트 활용 시나리오

```
에이전트: "사용자의 클라우드 서버에 비전 노드를 배포하고 운영"

1. 에이전트가 SSH로 서버에 접속
2. Docker로 vision-node 컨테이너 실행
   $ docker run -d -v /data/vision:/data visionchain/node
3. REST API로 초기 설정 (이메일, 스토리지 할당)
   POST /api/node/config { storage: "100GB", class: "full" }
4. 주기적으로 /api/node/health 체크
5. 이상 발견 시 자동 재시작
6. 리워드 누적 시 자동 claim
7. 사용자에게 상태 리포트 전달
```

---

## 7. Incentive Model (보상 체계)

### 7.1 보상 구성 요소

| 기여 유형 | 측정 단위 | 보상 기준 |
|---|---|---|
| **Uptime** | 시간 | 노드 가동 시간 |
| **Storage** | GB-hours | 할당 용량 x 가동 시간 |
| **Retrieval** | 횟수 | 다른 노드/사용자에게 데이터 서빙 |
| **Proof of Storage** | 성공률 | Storage Proof 챌린지 통과율 |
| **Block Verification** | 블록 수 | 검증한 블록 수와 정확도 |
| **Relay** | 메시지 수 | 릴레이한 트랜잭션/메시지 |

### 7.2 보상 공식

```
일간 보상 = base_rate * weight * (1 + storage_bonus + verification_bonus + relay_bonus)

- base_rate: 일간 기본 보상 (전체 풀에서 분배)
- weight: 노드 클래스별 가중치 (0.01x ~ 1.0x)
- storage_bonus: (할당GB / 100) * 0.1  (최대 1.0)
- verification_bonus: (검증블록수 / 1000) * 0.05
- relay_bonus: (릴레이수 / 100) * 0.02
```

### 7.3 Penalty (페널티)

| 위반 | 페널티 |
|---|---|
| Storage Proof 실패 | 해당 회차 보상 0 |
| 연속 3회 Proof 실패 | 보상 50% 삭감 (7일간) |
| 데이터 손실 (복구 불가) | 해당 청크 보상 영구 삭감 |
| 7일 이상 오프라인 | 보유 청크 재배치, 등급 하락 |

---

## 8. Installation & Deployment

### 8.1 npm (모든 OS)

```bash
# 글로벌 설치
npm install -g @visionchain/node

# 초기 설정
vision-node init --email user@example.com --storage 50GB

# 노드 시작
vision-node start

# 백그라운드 실행 (Linux/macOS)
vision-node start --daemon

# 상태 확인
vision-node status
```

### 8.2 Docker

```bash
# 실행
docker run -d \
  --name vision-node \
  -v /data/vision:/data \
  -p 9090:9090 \    # 대시보드
  -p 4001:4001 \    # P2P
  -e EMAIL=user@example.com \
  -e STORAGE=100GB \
  visionchain/node:latest

# 로그 확인
docker logs -f vision-node
```

### 8.3 Windows 서비스

```bash
# 서비스 설치
vision-node service install

# 서비스 시작
vision-node service start

# 서비스 제거
vision-node service uninstall
```

### 8.4 systemd (Linux)

```bash
# 서비스 파일 생성
vision-node service install --systemd

# 시작
sudo systemctl start vision-node
sudo systemctl enable vision-node
```

### 8.5 Android APK (Lite Node)

```
다운로드: https://github.com/jays-visionAI/visionchain/releases/latest
설치 후 이메일 등록 -> 자동 운영
```

---

## 9. Smart Contract: Storage Economy

블록체인 EIP 업데이트 이후에 배포할 온체인 컨트랙트입니다.

### StorageRegistry.sol

```solidity
// 노드의 스토리지 할당을 온체인에 기록
function registerStorage(bytes32 nodeId, uint256 capacityGB) external;
function getStorageInfo(bytes32 nodeId) external view returns (StorageInfo);
```

### StorageProof.sol

```solidity
// Storage Proof 챌린지 및 검증
function submitChallenge(bytes32 nodeId, bytes32 chunkId, uint256 offset) external;
function respondToChallenge(bytes32 challengeId, bytes32 proofHash) external;
function verifyProof(bytes32 challengeId) external view returns (bool);
```

### StorageRewards.sol

```solidity
// 스토리지 기여 보상 분배
function calculateReward(bytes32 nodeId) external view returns (uint256);
function claimReward(bytes32 nodeId) external;
function slashNode(bytes32 nodeId, string reason) external; // Admin only
```

---

## 10. Development Roadmap

### Phase 1: CLI Node Core (2주)

- [ ] `vision-node` npm 패키지 구조 셋업
- [ ] Commander.js CLI 인터페이스 (`init`, `start`, `stop`, `status`)
- [ ] Heartbeat 서비스 (agentGateway API 통신)
- [ ] 노드 등록 / 인증 흐름
- [ ] 기본 설정 관리 (config.json)
- [ ] 노드 클래스 자동 감지 (환경 기반)

**결과물**: `npx @visionchain/node start`로 heartbeat 동작

### Phase 2: File Storage Engine (2주)

- [ ] 파일시스템 기반 스토리지 엔진
- [ ] 256KB 청킹 + SHA-256 해싱
- [ ] Merkle Tree 구성
- [ ] LRU 캐시 eviction
- [ ] 스토리지 용량 관리 (100MB ~ 1TB)
- [ ] SQLite 인덱스 (청크 메타데이터)
- [ ] 기본 Content Addressing (`vcn://hash`)

**결과물**: 로컬에서 데이터 저장/조회/삭제 동작

### Phase 3: Local Web Dashboard (1주)

- [ ] Express 기반 로컬 웹서버 (localhost:9090)
- [ ] 대시보드 UI (HTML/CSS/JS)
  - 노드 상태 (online/offline, uptime, class)
  - 스토리지 사용량 (용량 바, 청크 수)
  - 보상 현황 (pending, claimed, total)
  - 네트워크 피어 정보
  - 로그 뷰어
- [ ] 실시간 업데이트 (WebSocket 또는 SSE)

**결과물**: 브라우저에서 노드 상태를 시각적으로 확인

### Phase 4: Agent API (2주)

- [ ] 에이전트용 REST API 엔드포인트
- [ ] API 키 인증
- [ ] agentGateway에 노드 관리 액션 추가
- [ ] 멀티 노드 클러스터 관리 (에이전트가 여러 노드 운영)
- [ ] OpenClaw 에이전트 통합 테스트
- [ ] Docker 이미지 빌드 (Dockerfile)

**결과물**: 에이전트가 API로 노드를 배포/모니터/관리

### Phase 5: Backend Chunk Registry + Replication (2주)

- [ ] Firebase에 Chunk Registry 컬렉션
- [ ] 청크 할당 알고리즘 (지역, 용량, uptime 기반)
- [ ] Replication Factor 3 관리
- [ ] 노드 오프라인 시 자동 재복제
- [ ] heartbeat에 Storage Proof Challenge 포함
- [ ] Proof 검증 로직

**결과물**: 데이터가 3개 노드에 안전하게 복제

### Phase 6: P2P Network (3주)

- [ ] js-libp2p 통합
- [ ] DHT (Distributed Hash Table) 기반 청크 탐색
- [ ] 노드 간 직접 청크 전송 (중앙 서버 경유 없이)
- [ ] NAT traversal (가정 네트워크 뒤의 노드 연결)
- [ ] Gossip 프로토콜 (청크 가용성 전파)
- [ ] 대역폭 절약 모드 (모바일 노드용)

**결과물**: 노드끼리 직접 데이터를 주고받는 P2P 네트워크

### Phase 7: On-chain Storage Contracts (2주)

> **선행 조건**: Vision Chain L1 블록체인 EIP 업데이트 완료

- [ ] StorageRegistry.sol 개발 및 배포
- [ ] StorageProof.sol 개발 및 배포
- [ ] StorageRewards.sol 개발 및 배포
- [ ] Off-chain 보상을 On-chain으로 전환
- [ ] Merkle Root 온체인 기록 로직

**결과물**: 스토리지 보상이 스마트 컨트랙트로 자동 분배

### Phase 8: Polish & Production (1주)

- [ ] Docker Compose 멀티 서비스 구성
- [ ] CI/CD 파이프라인 (GitHub Actions)
- [ ] 설치 스크립트 (curl one-liner)
- [ ] 문서 작성 (README, API docs)
- [ ] 성능 벤치마크
- [ ] 보안 감사 (API 인증, 데이터 암호화 검증)

**결과물**: 프로덕션 배포 준비 완료

---

## 11. EIP Update와의 관계

### 블록체인 업데이트 시점

분산 스토리지 노드의 대부분(Phase 1~6)은 블록체인 서버와 **독립적**으로 개발 가능합니다.

```
Phase 1~4: 블록체인과 무관 (Firebase API만 사용)
Phase 5~6: 블록체인과 무관 (P2P + 백엔드 로직)
Phase 7:   블록체인 업데이트 필요 (on-chain 컨트랙트)
```

### 권장 순서

```
[1] Phase 1~4 개발 (스토리지 노드 MVP)
    -> 보상은 off-chain (Firebase) 처리

[2] Phase 5~6 개발 (P2P + 복제)
    -> 스토리지 요구사항이 명확해짐

[3] 블록체인 EIP 업데이트 실행
    -> 스토리지 노드 요구사항을 반영한 EIP 선별

[4] Phase 7~8 개발 (on-chain 컨트랙트 + 프로덕션)
    -> 업데이트된 체인 위에 배포
```

### 이유

1. 스토리지 노드를 먼저 개발하면 어떤 EIP가 실제로 필요한지 명확해짐
2. 블록체인 업데이트는 하드포크가 필요한 고위험 작업이므로 별도 계획 필요
3. Phase 1~6의 off-chain 보상 체계만으로도 완전히 동작하는 제품 출시 가능
4. 사용자 피드백을 받으면서 on-chain 전환을 준비할 수 있음

---

## 12. Mobile Node 관계

기존 Android 앱(`vision-mobile-node`)은 **Lite Node**로 유지하되,
핵심 로직을 공통 코어 모듈로 추출합니다.

```
@visionchain/node-core         공통 로직
  |
  ├── vision-mobile-node       Android (React Native) - Lite Node
  │     현재: v1.0.2
  │     스토리지: AsyncStorage -> react-native-fs로 전환
  │
  └── vision-node              CLI (Node.js) - Standard/Full/Agent Node
        신규 개발
        스토리지: 파일시스템 + SQLite 인덱스
```

### 공유 로직

- Heartbeat 프로토콜 (동일한 API 호출)
- 블록 검증 알고리즘
- 청크 해싱 및 Merkle Tree
- Storage Proof 응답 생성
- 보상 계산 공식

### 플랫폼별 구현

- 스토리지 I/O (AsyncStorage vs fs)
- 네트워크 감지 (NetInfo vs os.networkInterfaces)
- 백그라운드 동작 (Foreground Service vs systemd/daemon)
- P2P (제한적 vs 전체 libp2p)

---

## 13. Security Considerations

| 위협 | 대응 |
|---|---|
| 노드가 가짜 Storage Proof 제출 | 랜덤 offset challenge로 실제 데이터 보유 검증 |
| 데이터 위변조 | SHA-256 해시 + Merkle Tree로 무결성 보장 |
| 노드 운영자가 저장 데이터 열람 | Client-side AES-256-GCM 암호화 |
| API 인증 우회 | API 키 + JWT 토큰 이중 인증 |
| DDoS 공격 | Rate limiting + IP 제한 (에이전트 API) |
| Sybil 공격 (가짜 노드 대량 생성) | 이메일 인증 + 최소 uptime 요구 + 보증금 스테이킹 |

---

## 14. Metrics & Monitoring

### 노드별 수집 지표

- Uptime (가동 시간)
- Storage usage (사용량 / 할당량)
- Chunk count (보유 청크 수)
- Storage proof success rate (증명 성공률)
- Heartbeat interval (평균 / 최대)
- P2P peer count (연결 피어 수)
- Bandwidth usage (업로드 / 다운로드)
- Retrieval latency (데이터 서빙 응답 시간)

### Admin Dashboard 확장

기존 Admin Dashboard의 Mobile Nodes 페이지를 확장하여
모든 노드 클래스의 통합 관리 뷰를 제공합니다.

---

## 15. dApp Serverless Platform

Vision Node의 분산 스토리지가 충분히 확보되면,
dApp 개발사들이 **별도 서버 없이** 분산 인프라 위에서 서비스를 구현할 수 있습니다.

### 15.1 가능 여부

**가능합니다.** 이미 검증된 유사 모델이 존재합니다:

| 프로젝트 | 모델 | Vision Node 대비 |
|---|---|---|
| **IPFS + Filecoin** | 분산 파일 저장 + 인센티브 | 동일 구조, Vision Node는 경량화 |
| **Arweave** | 영구 스토리지 + permaweb | Vision Node는 TTL 기반 유연한 저장 |
| **Ceramic Network** | 분산 데이터 스트림 (SNS, 프로필) | Vision Node에서 동일 구현 가능 |
| **Livepeer** | 분산 영상 트랜스코딩 | 컴퓨팅 + 스토리지 혼합 모델 참고 |
| **The Graph** | 분산 인덱싱/쿼리 엔진 | Vision Node 위에 인덱서 구축 가능 |

핵심은 **Vision Node가 스토리지만 제공하는 것이 아니라,
그 위에 dApp이 올라갈 수 있는 플랫폼 레이어를 함께 제공**하는 것입니다.

### 15.2 Vision Storage SDK

dApp 개발사가 사용할 SDK를 제공합니다.
AWS S3 SDK처럼 직관적인 인터페이스를 목표로 합니다.

```typescript
import { VisionStorage } from '@visionchain/storage-sdk';

// 초기화 (API 키로 인증)
const storage = new VisionStorage({
  apiKey: 'vs_app_abc123...',
  region: 'asia',  // 가까운 노드 우선 사용
});

// 파일 업로드 (자동 암호화 + 청킹 + 복제)
const result = await storage.upload({
  data: fileBuffer,
  metadata: { name: 'profile.png', type: 'image/png' },
  encryption: true,           // Client-side AES-256
  replication: 3,             // 3개 노드에 복제
  ttl: 0,                     // 0 = 영구 저장
});
// result: { cid: 'vcn://sha256_abc...', size: 245000, merkleRoot: '0x...' }

// 파일 다운로드
const file = await storage.download('vcn://sha256_abc...');

// 파일 삭제
await storage.delete('vcn://sha256_abc...');

// 디렉토리 (가상 폴더) 관리
const folder = storage.folder('users/user123/photos');
await folder.upload(photoBuffer, 'vacation.jpg');
const photos = await folder.list();

// 스트리밍 데이터 (실시간 로그, 채팅)
const stream = storage.createStream('chat/room_001');
await stream.append({ sender: '0xabc', message: 'Hello', ts: Date.now() });
const messages = await stream.read({ limit: 50, after: timestamp });

// 접근 제어
await storage.setAccess('vcn://sha256_abc...', {
  owner: '0xOwnerAddress',
  readers: ['0xFriend1', '0xFriend2'],
  public: false,
});
```

### 15.3 서버리스 dApp 사용 사례

#### 사례 1: NFT 마켓플레이스

기존 방식: AWS S3에 NFT 이미지 저장, 중앙 서버에서 메타데이터 관리
Vision Node 방식: 이미지와 메타데이터 모두 분산 스토리지에 저장

```
NFT 민팅 흐름:
1. 크리에이터가 이미지 업로드 -> Vision Storage SDK
2. SDK가 자동으로 암호화, 청킹, 3개 노드에 복제
3. CID (Content ID)를 NFT 컨트랙트의 tokenURI에 기록
4. 구매자가 NFT 조회시 가장 가까운 노드에서 이미지 서빙

장점:
- 이미지 저장 서버 비용 0
- 중앙 서버 장애 시에도 NFT 이미지 접근 가능
- IPFS 호환 CID로 기존 NFT 생태계와 연동
```

#### 사례 2: 분산 메신저 / 소셜 네트워크

기존 방식: Firebase/Supabase에 채팅 데이터 저장
Vision Node 방식: 메시지를 분산 스트림으로 관리

```
메시지 흐름:
1. 유저 A가 메시지 전송
2. Client-side 암호화 (수신자 공개키로)
3. 암호화된 메시지를 Vision Storage 스트림에 append
4. 유저 B가 스트림에서 읽어 자신의 개인키로 복호화

장점:
- 서버가 메시지 내용을 알 수 없음 (E2E 암호화)
- 서버 다운 시에도 P2P로 메시지 전달 가능
- 메시지 이력이 영구 보존
```

#### 사례 3: DeFi 데이터 피드

기존 방식: Chainlink 오라클 + 중앙 API 서버
Vision Node 방식: 가격 데이터를 분산 캐시로 관리

```
데이터 피드 흐름:
1. Full Node들이 외부 가격 데이터를 수집
2. 합의된 가격을 Vision Storage에 타임스탬프와 함께 저장
3. dApp이 가장 가까운 노드에서 최신 가격 데이터 조회
4. Merkle Proof로 데이터 무결성 검증

장점:
- 오라클 비용 절감
- 과거 가격 데이터 영구 보존
- 지역별 낮은 레이턴시
```

#### 사례 4: AI 모델 / 데이터셋 호스팅

기존 방식: Hugging Face Hub, AWS S3에 모델 파일 저장
Vision Node 방식: 분산 모델 레지스트리

```
AI 모델 배포 흐름:
1. 개발자가 학습된 모델 파일 (수백 MB ~ 수 GB) 업로드
2. Vision Storage가 청킹하여 여러 노드에 분산 저장
3. 추론 서비스가 필요한 청크만 가까운 노드에서 스트리밍 로드
4. 모델 버전 관리: Merkle Root로 각 버전 식별

장점:
- 대용량 모델 호스팅 비용 대폭 절감
- 모델 무결성 온체인 검증
- 전 세계 분산 CDN 효과로 모델 로딩 빠름
```

#### 사례 5: 웹사이트 / dApp 프론트엔드 호스팅

기존 방식: Cloudflare Pages, Vercel, Netlify
Vision Node 방식: 분산 웹 호스팅 (Arweave permaweb과 유사)

```
배포 흐름:
1. 개발자가 빌드된 정적 파일 (HTML/CSS/JS) 업로드
2. Vision Storage에 저장, 전 세계 노드에 복제
3. vcn://도메인 또는 ENS 연동으로 접근
4. CDN 역할을 분산 노드가 담당

장점:
- 호스팅 비용 0 (VCN 토큰으로 결제)
- 검열 저항성 (중앙 서버 없음)
- 자동 글로벌 CDN
```

### 15.4 dApp 개발사를 위한 Best Practices

#### 데이터 모델링

```
권장: 작은 단위의 불변 데이터 (Immutable Small Objects)
비권장: 자주 변경되는 대용량 단일 파일

좋은 예:
  - NFT 메타데이터 JSON (1~10KB) -> 개별 CID
  - 유저 프포필 이미지 (100KB~5MB) -> 개별 CID
  - 채팅 메시지 배치 (1000개 메시지 = 100KB) -> 스트림 append
  - 블록 데이터 스냅샷 (1MB) -> 시간별 CID

나쁜 예:
  - 100GB 데이터베이스를 통째로 저장 -> 청크 관리 비효율
  - 초당 100회 업데이트되는 실시간 데이터 -> 스트림 사용 권장
```

#### 복제 전략

```
중요도 높은 데이터: replication = 5, ttl = 0 (영구)
  예: NFT 이미지, 컨트랙트 메타데이터, 법적 문서

중요도 보통: replication = 3, ttl = 0
  예: 유저 프로필, 게시글, 채팅 이력

임시 데이터: replication = 2, ttl = 24h
  예: 세션 데이터, 캐시, 임시 파일

핫 데이터: replication = 5 + region pinning
  예: 자주 접근되는 인기 콘텐츠, API 응답 캐시
```

#### 비용 최적화

```
1. 배치 업로드: 작은 파일 여러 개를 묶어서 한 번에 업로드
   - 개별 업로드: 1000 파일 x 1KB = 1000 트랜잭션
   - 배치 업로드: 1 파일 x 1MB = 1 트랜잭션

2. 핫/콜드 티어링: 자주 접근하는 데이터만 높은 복제
   - 최근 7일 데이터: replication = 5
   - 그 이전 데이터: replication = 2

3. 압축: 텍스트 데이터는 gzip 압축 후 저장
   - JSON 메타데이터: 평균 70% 용량 절감

4. 중복 제거 (De-duplication)
   - 동일 해시 청크는 한 번만 저장
   - SDK가 자동으로 중복 감지
```

### 15.5 dApp Storage 과금 모델

dApp 개발사는 VCN 토큰으로 스토리지 비용을 지불합니다.
이 비용이 노드 운영자의 보상 재원이 됩니다.

| 항목 | 단가 (예시) | 비교 (AWS S3) |
|---|---|---|
| 저장 | 0.001 VCN / GB / 월 | $0.023 / GB / 월 |
| 업로드 | 0.0001 VCN / 요청 | $0.005 / 1000 요청 |
| 다운로드 | 0.0005 VCN / GB | $0.09 / GB |
| 스트림 append | 0.00001 VCN / 건 | 해당 없음 |

**무료 티어**: 월 1GB 저장 + 10GB 다운로드 (생태계 활성화 목적)

```
비용 흐름:
dApp 개발사 ---(VCN 지불)---> Storage Contract ---(보상 분배)---> 노드 운영자

- 개발사가 지불한 VCN의 70%가 실제 데이터를 저장하는 노드에 분배
- 20%는 데이터를 서빙(retrieval)하는 노드에 분배
- 10%는 프로토콜 재단 (운영/개발 비용)
```

### 15.6 실제 프로젝트 사례 분석

#### Filecoin + NFT.Storage

NFT.Storage는 Filecoin 위에 구축된 무료 NFT 저장 서비스입니다.
OpenSea, Rarible 등 주요 NFT 마켓플레이스가 사용합니다.

```
NFT.Storage가 하는 일:
1. 개발자가 SDK로 NFT 메타데이터 + 이미지 업로드
2. IPFS CID 생성 -> NFT 컨트랙트에 기록
3. Filecoin 스토리지 딜로 데이터 영구 보존
4. IPFS 게이트웨이로 누구나 접근 가능

Vision Node에서 동일하게 구현 가능:
- Vision Storage SDK -> vcn:// CID 생성
- Vision Node 네트워크에 복제
- Vision Gateway (HTTP 게이트웨이)로 웹 접근
```

#### Ceramic Network (분산 데이터 스트림)

Ceramic은 분산 소셜 프로필, 자격 증명, 채팅 등에 사용됩니다.
Lens Protocol, CyberConnect 등이 Ceramic 위에 구축되었습니다.

```
Ceramic이 하는 일:
1. 뮤터블 데이터 스트림 (프로필, 게시글 수정 가능)
2. DID (Decentralized Identity) 기반 접근 제어
3. 스트림 동기화 (여러 노드가 동일 스트림 상태 유지)

Vision Node에서 구현:
- VisionStorage.createStream() -> 뮤터블 스트림
- Vision Chain 지갑 주소 기반 접근 제어
- P2P gossip으로 스트림 동기화
```

#### Arweave + Bundlr (영구 웹)

Arweave는 데이터를 영구적으로 저장하는 블록체인입니다.
Mirror.xyz (분산 블로그), Bundlr (대량 업로드) 등이 활용합니다.

```
Arweave가 하는 일:
1. 한 번 저장하면 영구 보존 (200년 설계 목표)
2. 정적 웹사이트를 Arweave에 배포 (permaweb)
3. 일회성 비용으로 영구 저장

Vision Node에서의 참고점:
- ttl: 0 (영구) 옵션 제공
- 영구 저장은 더 높은 VCN 비용
- permaweb 스타일 웹 호스팅 지원
```

### 15.7 Vision Storage Gateway

dApp이 웹에서 분산 스토리지에 접근할 수 있도록
HTTP 게이트웨이를 제공합니다.

```
https://gateway.visionchain.co/vcn/sha256_abc123...
  -> 가장 가까운 노드에서 데이터를 가져와 HTTP 응답으로 변환

https://gateway.visionchain.co/vcn/sha256_abc123.../metadata.json
  -> JSON 메타데이터 직접 접근

https://gateway.visionchain.co/stream/chat_room_001?limit=50&after=1709000000
  -> 스트림 데이터를 REST API처럼 조회
```

이 게이트웨이 역시 Full Node들이 분산으로 운영할 수 있으며,
Cloudflare Workers나 Edge Function과 연동하여 글로벌 성능을 확보합니다.

### 15.8 dApp에 필요한 추가 개발 항목

| 항목 | 설명 | Phase |
|---|---|---|
| Vision Storage SDK (JS/TS) | npm 패키지, 위 코드 예시의 구현 | Phase 4 이후 |
| Vision Gateway | HTTP 게이트웨이 서비스 | Phase 6 이후 |
| Developer Portal | API 키 발급, 사용량 대시보드, 문서 | Phase 8 |
| 과금 컨트랙트 | StorageBilling.sol, 사용량 기반 VCN 결제 | Phase 7 |
| dApp 예제 프로젝트 | NFT 저장소, 분산 채팅 등 데모 | Phase 8 |
| Rate Limiting / Quotas | 앱별 사용량 제한, 남용 방지 | Phase 5 이후 |

---

## 16. Version History

| 버전 | 날짜 | 변경 사항 |
|---|---|---|
| v1.0 | 2026-02-22 | 최초 작성 |
| v1.1 | 2026-02-22 | dApp Serverless Platform 섹션 추가 |
