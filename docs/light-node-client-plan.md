# Vision Chain Light Node Client - 기획 문서

> 작성일: 2026-02-12
> 상태: 기획 단계

---

## 1. 개요

일반 유저가 PC(Windows), Mac, 모바일(iOS/Android)에 다운로드하여 Vision Chain 네트워크에 리소스를 제공하고 보상을 받는 라이트노드 클라이언트 기획.

### 참여 모델

| 모델 | 역할 | 보상 원천 |
|------|------|----------|
| **Bridge Validator** | 스테이킹 풀에서 위임받아 브릿지 TX 검증 | Bridge Fee 분배 |
| **Data Storage Node** | P2P 방식으로 파편적 데이터 저장 | Storage Fee 분배 |

---

## 2. 현재 Vision Chain 인프라 현황

### 노드 구성 (docker-compose.yml 기준)

| 노드 | IP | 역할 |
|------|-----|------|
| node-1 | 172.20.0.11 | Bootnode + Primary RPC + Miner (Sealer) |
| node-2 | 172.20.0.12 | Validator 1 |
| node-3 | 172.20.0.13 | Validator 2 |
| node-4 | 172.20.0.14 | Validator 3 |
| node-5 | 172.20.0.15 | Validator 4 |

### 합의 알고리즘: Clique (PoA)

```json
{
  "clique": {
    "period": 3,
    "epoch": 30000
  }
}
```

- 5노드 P2P 네트워크 + 부트노드 구성
- Kafka + Zookeeper (Shared Sequencer) 인프라 존재
- 라이트노드가 bootnodes enode 주소로 P2P 네트워크에 참여 가능한 기반 구축됨

### 기존 스마트 컨트랙트

- `BridgeStaking.sol` - Validator Staking (depositFees / claimRewards 구조)
- `IntentCommitment.sol` - Bridge Intent Commitment
- `VisionBridgeSecure.sol` - Bridge Lock/Release
- `VCNToken.sol` - ERC-20 + EIP-2612 Permit

---

## 3. 크로스 플랫폼 기술 선택

### 기술 스택 비교

| 접근법 | Desktop (Mac/Windows) | Mobile (iOS/Android) | 코드 공유율 | 적합도 |
|--------|----------------------|---------------------|------------|--------|
| **A) Tauri 2.0** | Rust + WebView | Tauri Mobile (beta) | ~90% | 경량, 성능 우수 |
| **B) Flutter** | Flutter Desktop | Flutter Mobile | ~95% | 가장 높은 코드 공유 |
| **C) Electron + React Native** | Electron | React Native | ~40% | 성숙도 높음, 코드 분리 |
| **D) Go + 네이티브 UI** | Go binary + Wails | Go + Gomobile | ~70% | P2P/네트워크에 최적 |

### 추천: Go 코어 + Flutter UI

**이유:**
- **Go**: libp2p (IPFS 핵심), BitTorrent DHT, Geth LES 모두 Go로 작성됨. 네트워킹/스토리지 레이어에 최적
- **Flutter**: 단일 코드베이스로 Mac, Windows, iOS, Android 모두 커버
- Go 코어를 FFI (Foreign Function Interface)로 Flutter에 연결

### 전체 아키텍처

```
┌─────────────────────────────────────────────────┐
│                Flutter UI Layer                  │
│          (Mac / Windows / iOS / Android)         │
├─────────────────────────────────────────────────┤
│              Go Core (via FFI/Bridge)            │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Bridge       │  │ Storage Node             │ │
│  │ Validator    │  │ (P2P Fragmented Storage) │ │
│  │              │  │                          │ │
│  │ - Event 감청 │  │ - DHT Peer Discovery    │ │
│  │ - TX 검증    │  │ - Chunk Store/Retrieve  │ │
│  │ - 서명 제출  │  │ - Erasure Coding        │ │
│  │ - Staking    │  │ - Proof of Storage      │ │
│  └──────────────┘  └──────────────────────────┘ │
├─────────────────────────────────────────────────┤
│              libp2p / Networking Layer            │
│     (DHT, NAT Traversal, Peer Routing)           │
└─────────────────────────────────────────────────┘
```

---

## 4. 모듈 A: Bridge Validator Node

스테이킹 풀에서 위임받아 브릿지 트랜잭션을 검증하는 역할.

### 동작 흐름

```
1. 유저가 VCN Staking Pool에 스테이킹
2. 라이트노드 클라이언트 설치 & 지갑 연결
3. 스테이킹 풀로부터 검증 권한 위임 (on-chain delegation)
4. Vision Chain RPC WebSocket으로 IntentCommitted 이벤트 수신
5. 각 intent에 대해:
   - amount, recipient, nonce 무결성 검증
   - 소스 체인 잔액 확인
   - 중복 intent 탐지
6. 검증 결과를 ECDSA 서명하여 Attestation Contract에 제출
7. N/M 다중 서명 달성 시 → Relayer가 목적지 체인에 전송
8. 보상: Bridge Fee의 일부를 검증자들에게 분배
```

### 필요한 스마트 컨트랙트

```solidity
// BridgeAttestation.sol
contract BridgeAttestation {
    struct Attestation {
        bytes32 intentHash;
        address validator;
        bool approved;
        bytes signature;
    }
    
    uint256 public requiredAttestations = 3; // 최소 3명 검증
    
    function submitAttestation(bytes32 intentHash, bool approved, bytes sig) external;
    function isFullyAttested(bytes32 intentHash) view returns (bool);
}

// DelegatedStaking.sol  
contract DelegatedStaking {
    function delegate(address validator, uint256 amount) external;
    function undelegate(address validator) external;
    function getVotingPower(address validator) view returns (uint256);
}
```

---

## 5. 모듈 B: P2P Data Storage Node

BitTorrent과 유사한 파편적 데이터 스토리지.

### 아키텍처: Content-Addressed Fragmented Storage

```
[원본 데이터]
     │
     ▼
[Erasure Coding] ─── 원본을 N개 조각으로 분할 + M개 패리티 조각 생성
     │                (예: 10개 중 7개만 있으면 복원 가능)
     ▼
[Content Hashing] ─── 각 조각의 해시 생성 (Merkle Tree)
     │
     ▼
[DHT 분배] ────────── 조각을 네트워크의 여러 노드에 분산 저장
     │
     ▼
[On-chain 등록] ────── Merkle Root + 메타데이터를 스마트 컨트랙트에 기록
```

### BitTorrent와의 비교

| 항목 | BitTorrent | Vision Storage |
|------|-----------|----------------|
| 피어 탐색 | DHT (Kademlia) | libp2p DHT (Kademlia) |
| 데이터 주소 | info hash | Content Hash (CID) |
| 조각 관리 | piece/chunk | Erasure-coded shards |
| 인센티브 | 없음 (선의) | VCN 토큰 보상 |
| 가용성 보장 | 없음 | Proof of Storage + 슬래싱 |
| 데이터 무결성 | SHA-1 | Merkle Proof |

### 핵심 기술 요소

```
1. libp2p DHT     ─ 피어 탐색 & 라우팅 (Go 구현체 성숙)
2. Erasure Coding ─ Reed-Solomon 코딩 (Go: klauspost/reedsolomon)
3. NAT Traversal  ─ libp2p AutoRelay + Hole Punching
4. PoStorage      ─ 주기적으로 랜덤 chunk에 대한 증명 제출
```

### 필요한 스마트 컨트랙트

```solidity
// StorageRegistry.sol
contract StorageRegistry {
    struct StorageFile {
        bytes32 merkleRoot;
        uint256 totalShards;
        uint256 requiredShards; // erasure coding threshold
        uint256 fileSize;
        address uploader;
        uint256 rewardPerEpoch;
    }
    
    // 저장 노드가 자신이 보관중인 shard를 등록
    function registerShard(bytes32 merkleRoot, uint256 shardIndex) external;
    
    // Proof of Storage: 랜덤 챌린지에 대한 merkle proof 제출
    function submitStorageProof(
        bytes32 merkleRoot, 
        uint256 shardIndex, 
        bytes32[] calldata merkleProof
    ) external;
    
    // 보상 수령
    function claimStorageRewards() external;
}
```

---

## 6. 클라이언트 UI 구성

```
┌────────────────────────────────────────────────┐
│  Vision Chain Node                    ─ □ X    │
├────────────────────────────────────────────────┤
│                                                │
│  ┌─ Dashboard ─────────────────────────────┐  │
│  │                                          │  │
│  │  Status: Online         Uptime: 14h 32m │  │
│  │  Peers: 47              Network: Testnet │  │
│  │                                          │  │
│  │  ┌─ Bridge Validator ──────────────┐    │  │
│  │  │ Verified: 124 txs    Today: 8  │    │  │
│  │  │ Staked: 5,000 VCN              │    │  │
│  │  │ Delegated: 12,500 VCN         │    │  │
│  │  │ Earned: 45.2 VCN              │    │  │
│  │  └────────────────────────────────┘    │  │
│  │                                          │  │
│  │  ┌─ Storage Node ─────────────────┐    │  │
│  │  │ Allocated: 50 GB / 200 GB     │    │  │
│  │  │ Shards: 1,247                  │    │  │
│  │  │ Proof Success: 99.8%          │    │  │
│  │  │ Earned: 23.7 VCN              │    │  │
│  │  └────────────────────────────────┘    │  │
│  │                                          │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [Settings]  [Wallet]  [Logs]                 │
└────────────────────────────────────────────────┘
```

---

## 7. 모바일 특수 제약사항

| 제약 | 영향 | 해결책 |
|------|------|--------|
| 백그라운드 제한 (iOS) | 앱이 백그라운드에서 제한됨 | Background Tasks API + 경량 작업만 |
| 배터리 소모 | P2P 연결 유지 비용 | 배터리 절약 모드, Wi-Fi 전용 옵션 |
| 저장공간 | 모바일은 스토리지 제한 | 사용자 설정 할당량 (예: 1-10GB) |
| NAT/방화벽 | 직접 연결 어려움 | libp2p Relay + QUIC 프로토콜 |

---

## 8. 개발 로드맵

| Phase | 기간 | 내용 | 결과물 |
|-------|------|------|--------|
| **Phase 1** | 4-6주 | Go 코어: libp2p 네트워킹, Bridge Watcher 로직, 위임 스테이킹 컨트랙트 | Go 바이너리 |
| **Phase 2** | 3-4주 | Flutter Desktop UI (Mac + Windows) + Go FFI 바인딩 | Desktop 클라이언트 |
| **Phase 3** | 4-6주 | P2P Storage: Erasure coding, DHT shard 분배, StorageRegistry 컨트랙트 | Storage 기능 추가 |
| **Phase 4** | 3-4주 | Flutter Mobile (iOS + Android) + 배터리/대역폭 최적화 | Mobile 클라이언트 |
| **Phase 5** | 2-3주 | Proof of Storage, 슬래싱, 보상 분배 로직 | 보상 시스템 |
| **Phase 6** | 2주 | 자동 업데이트, 서명된 바이너리 배포, CI/CD | 배포 파이프라인 |
| **Total** | **약 4-6개월** | | |

### MVP 전략 (빠른 출시)

- **Phase 1-2만으로 출시 가능**: Desktop-only Bridge Validator
- Storage Node는 Phase 3에서 추가
- Mobile은 Phase 4에서 추가

---

## 9. 요약

| 질문 | 답변 |
|------|------|
| PC/Mac/Mobile 3가지 가능한가? | 가능 - Flutter + Go 코어로 단일 코드베이스 |
| Bridge Validator 위임 모델 가능한가? | 가능 - DelegatedStaking 컨트랙트 + Attestation 추가 필요 |
| P2P 스토리지 노드 가능한가? | 가능 - libp2p + Erasure Coding + PoStorage |
| 총 소요 기간 | MVP(Desktop Bridge만): 6-8주 / 전체: 4-6개월 |
| 가장 큰 기술적 난제 | 모바일 백그라운드 제한, NAT traversal, Proof of Storage |
