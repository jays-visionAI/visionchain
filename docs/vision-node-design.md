# Vision Node Architecture v2.1 -- Dual-Track + Mobile + OpenClaw

## 설계 원칙

| Track | 목적 | 운영자 |
|-------|------|--------|
| **Infra Track** | 블록체인 인프라 유지 | 서버 운영자 |
| **Service Track** | 온체인 부가서비스 | 개발자, 일반 유저, 모바일 유저 |

```
            Vision Node
           ┌─────┴─────┐
     Infra Track    Service Track
       (I-Class)      (S-Class)
      ┌────┴────┐    ┌────┴─────┐
     I-1  I-2  I-3  S-1  S-2  S-3  S-M
     RPC  Valid Full Relay Store AI  Mobile
                          │
                     Mac Mini Bundle
                     (I-1+S-1+S-2)
```

---

## Infra Track (I-Class)

### I-1: RPC Cache Node

| 항목 | 내용 |
|------|------|
| **역할** | RPC 요청 캐싱, 부하 분산 |
| **사양** | 2GB RAM, 2 Core, 5GB SSD |
| **Weight** | 3x |

### I-2: Validator Node

| 항목 | 내용 |
|------|------|
| **역할** | 블록 생성, TX 검증, 컨센서스 참여 |
| **사양** | 8GB RAM, 4 Core, 50GB SSD |
| **Weight** | 8x |
| **필수** | VCN 스테이킹 10,000+ |

### I-3: Full Archive Node

| 항목 | 내용 |
|------|------|
| **역할** | 전체 블록 아카이브, 히스토리 쿼리 |
| **사양** | 16GB RAM, 8 Core, 500GB+ SSD |
| **Weight** | 15x |

---

## Service Track (S-Class)

### S-1: Relay Node (온체인 메신저)

| 항목 | 내용 |
|------|------|
| **역할** | P2P 메시지 릴레이, NAT 트래버설, 오프라인 메시지 보관 |
| **사양** | 2GB RAM, 1 Core, 2GB SSD |
| **Weight** | 2x |
| **프로토콜** | WebSocket + libp2p gossipsub |

### S-2: Storage Node (분산 스토리지)

| 항목 | 내용 |
|------|------|
| **역할** | 파일 청크 저장, Proof of Storage 응답, 데이터 서빙 |
| **사양** | 4GB RAM, 2 Core, 100GB+ |
| **Weight** | 5x + 용량 보너스 |

### S-3: AI Worker Node

| 항목 | 내용 |
|------|------|
| **역할** | AI 추론 호스팅, 에이전트 실행 환경 |
| **사양** | 16GB RAM, GPU, 50GB SSD |
| **Weight** | 12x |

---

## S-M: Mobile Node (네이티브 앱)

### 왜 PWA가 아닌 네이티브 앱인가

| | PWA | 네이티브 앱 |
|---|-----|-----------|
| 브라우저 종료 시 | 연결 끊김 | 백그라운드 계속 실행 |
| 백그라운드 지속성 | iOS 5분 제한 | Android Foreground Service 무제한 |
| 네트워크 감지 | 제한적 | WiFi/셀룰러/오프라인 정확 감지 |
| 푸시 알림 | 제한적 | 네이티브 지원 |
| 배터리 최적화 | 브라우저 의존 | 직접 제어 가능 |

**결론**: React Native 앱으로 Play Store / App Store 배포.

### 네트워크 적응형 기여 (Dynamic Contribution)

모바일 노드는 현재 네트워크 상태에 따라 자동으로 기여 수준을 조절:

```
┌────────────────────────────────────────────┐
│           Network Adaptive Engine          │
│                                            │
│  WiFi 감지 ──→ Full Mode                   │
│   - Heartbeat 5분 간격                      │
│   - 블록 헤더 검증 ON                       │
│   - 메시지 릴레이 ON (micro relay)           │
│   - 메시지 캐시 저장 ON (50MB)              │
│   - Weight: 0.5x                           │
│                                            │
│  셀룰러 감지 ──→ Minimal Mode              │
│   - Heartbeat 30분 간격                     │
│   - 블록 헤더 검증 OFF                      │
│   - 메시지 릴레이 OFF                       │
│   - 캐시 저장 OFF                           │
│   - Weight: 0.1x (생존 증명만)              │
│                                            │
│  오프라인 ──→ Sleep Mode                    │
│   - 모든 활동 정지                           │
│   - 재연결 시 자동 복귀                      │
│   - Weight: 0x                             │
└────────────────────────────────────────────┘
```

### 데이터 사용량

| 모드 | Heartbeat | 검증 | 릴레이 | 월 예상 |
|------|-----------|------|--------|---------|
| WiFi Full | 5분 | ON | ON | 무제한 (WiFi) |
| Cellular Min | 30분 | OFF | OFF | **~3MB/월** |
| 혼합 사용 | 자동 전환 | 자동 | 자동 | **~15MB/월** |

### 앱 구조

```
Vision Node Mobile App (React Native)
├── 메인 화면
│   ├── 노드 상태 (Active/Sleep)
│   ├── 현재 모드 (WiFi Full / Cellular Min)
│   ├── 오늘 기여 시간
│   └── 누적 보상 VCN
├── 설정
│   ├── 셀룰러 허용 ON/OFF
│   ├── 배터리 20% 미만 시 자동 정지
│   └── 일일 데이터 상한 설정
├── 보상 내역
│   ├── 에폭별 수령 VCN
│   └── 현재 Weight / 전체 대비 %
└── 백그라운드 서비스
    ├── Android: Foreground Service + 알림바 표시
    └── iOS: Background App Refresh + Silent Push
```

### 이머징 마켓 유저 확보

```
Phase 1: 무료 참여
  - 앱 다운로드 → 전화번호 인증 → 즉시 노드 시작
  - 스테이킹 불필요
  - 셀룰러 데이터 3MB/월 이내

Phase 2: 커뮤니티 성장
  - 레퍼럴: 추천인 + 피추천인 양쪽 보상
  - 지역 리더보드 (국가별, 도시별)
  - 현지 언어 지원

Phase 3: 실물 가치
  - VCN → 현지 모바일 머니 환전
  - 온체인 메신저로 P2P 소액 송금
```

---

## Mac Mini Bundle (OpenClaw 전용)

Mac Mini (M1/M2/M4)는 상시 가동 서버로 **복수 모듈 동시 운영**에 최적.

### 프리셋: OpenClaw Node Bundle

| 모듈 | Class | Weight | RAM 사용 | 디스크 |
|------|-------|--------|---------|--------|
| RPC Cache | I-1 | 3x | 1GB | 3GB |
| Relay | S-1 | 2x | 512MB | 1GB |
| Storage | S-2 | 5x | 1GB | 50GB+ |
| **합계** | | **10x** | **~2.5GB** | **~55GB** |

Mac Mini 8GB 기준 RAM 여유 5.5GB, 256GB SSD 기준 디스크 여유 200GB+.

### 설치

```bash
# 1줄 설치
curl -fsSL https://get.visionchain.co/openclaw | sh

# 또는 Docker Compose
docker compose -f docker-compose.openclaw.yml up -d
```

`docker-compose.openclaw.yml` 내용:
```yaml
services:
  rpc-cache:
    image: visionchain/node:latest
    environment:
      - MODULE=rpc-cache
      - API_KEY=${VCN_API_KEY}
    ports: ["8545:8545"]

  relay:
    image: visionchain/node:latest
    environment:
      - MODULE=relay
      - API_KEY=${VCN_API_KEY}
    ports: ["9000:9000"]

  storage:
    image: visionchain/node:latest
    environment:
      - MODULE=storage
      - API_KEY=${VCN_API_KEY}
      - STORAGE_PATH=/data/chunks
      - STORAGE_LIMIT=50GB
    volumes:
      - ./node-storage:/data/chunks
    ports: ["9001:9001"]
```

### 대시보드

`localhost:9090`에서 통합 대시보드 제공:
- 3개 모듈 상태 실시간 모니터링
- 에폭별 보상 내역
- RPC 캐시 히트율, 릴레이 메시지 수, 스토리지 사용량
- Weight 10x 확인

### Mac Mini 사양별 추천

| Mac Mini | RAM | 추천 구성 | Weight |
|----------|-----|----------|--------|
| M1 8GB | 8GB | I-1 + S-1 + S-2 | 10x |
| M2 16GB | 16GB | I-1 + S-1 + S-2 + S-3(CPU) | 14x |
| M4 Pro 24GB | 24GB | I-1 + I-2 + S-1 + S-2 | 18x |

---

## 보상: 트랙별 풀 분리

```
에폭 보상 (반감기 적용)
├── Infra Pool: 40%  -- 블록체인 보안/안정성
└── Service Pool: 60% -- 부가서비스 성장
```

각 풀 내에서 Weight 비례 분배:

```
내 보상 = 해당 Pool 총량 x (내 Weight x Uptime%) / Pool 내 전체 Weight 합
```

---

## 전체 Class 요약

| Track | Class | 역할 | Weight | 최소 사양 | 대상 |
|-------|-------|------|--------|----------|------|
| Infra | I-1 | RPC 캐시 | 3x | 2GB/2Core | VPS |
| Infra | I-2 | 밸리데이터 | 8x | 8GB/4Core | 서버 |
| Infra | I-3 | 풀 아카이브 | 15x | 16GB/8Core | 데이터센터 |
| Service | S-1 | 메시지 릴레이 | 2x | 2GB/1Core | VPS/PC |
| Service | S-2 | 분산 스토리지 | 5x+ | 4GB/2Core/100GB | NAS/서버 |
| Service | S-3 | AI 추론 | 12x | 16GB/GPU | GPU 서버 |
| Service | S-M | 모바일 | 0.5x(WiFi) / 0.1x(셀룰러) | 스마트폰 | 일반 유저 |
| Bundle | OpenClaw | I-1+S-1+S-2 | 10x | Mac Mini 8GB | OpenClaw 유저 |

---

## MVP 우선순위

| 순서 | 노드 | 이유 | 소요 |
|------|------|------|------|
| 1 | **S-M Mobile** | 유저 수 폭발적 확보 | 3주 (React Native) |
| 2 | **OpenClaw Bundle** | 기존 유저 즉시 전환 | 2주 (Docker) |
| 3 | **S-1 Relay** | 메신저 인프라 선행 | 3주 |
| 4 | **I-1 RPC Cache** | 네트워크 안정성 | 2주 |
| 5 | **S-2 Storage** | 분산 스토리지 기반 | 4주 |
| 6 | **I-2 Validator** | 탈중앙화 완성 | 6주+ |
