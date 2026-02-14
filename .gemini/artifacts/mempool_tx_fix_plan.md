# Vision Chain Mempool TX 처리 문제 종합 수정 계획

## 1. 현재 구조 분석

### 노드 구성
| Node | Host Port | Clique Signer | --mine | 실제 역할 |
|------|-----------|---------------|--------|----------|
| node-1 | 8545 | No (`0xf39F...` 제외됨) | Yes (무효) | Bootnode & RPC |
| node-2 | 8546 | **Yes** (`0xd4Fe...`) | Yes | **유일한 Sealer** |
| node-3 | 8547 | No | No | Sync only |
| node-4 | 8548 | No | No | Sync only |
| node-5 | 8549 | No | No | Sync only |

### RPC 라우팅
- `rpc.visionchain.co` -> nginx -> `127.0.0.1:8545` -> **node-1** (non-sealer)
- `api.visionchain.co` -> nginx -> `127.0.0.1:3000` (API 서버)

### 합의 메커니즘
- **Clique PoA** (Proof of Authority)
- Block period: 5초
- 유일한 signer: `0xd4FeD8Fe5946aDA714bb664D6B5F2C954acf6B15` (node-2)

## 2. 근본 원인

### TX가 mempool에 stuck되는 이유

1. **RPC 노드 != Sealer 노드**: `rpc.visionchain.co`는 node-1(port 8545)로 라우팅되지만, 블록을 생성하는 sealer는 node-2(port 8546). TX가 node-1에 도착해도 node-2로 P2P 전파되어야 하는데, 이 전파가 불안정.

2. **Queued TX 오염**: node-2의 txpool에 9,371개의 queued TX가 있어 mempool이 포화 상태. 이로 인해 새로운 TX 수신/전파가 방해됨.

3. **Paymaster의 nonce 관리 부재**: 
   - ethers.js는 기본적으로 `pending` nonce를 사용
   - TX가 실패하면 해당 nonce slot이 점유된 상태로 남아 nonce gap 발생
   - 이후 모든 TX가 이전 nonce 처리를 기다리며 무한 대기

4. **에러 복구 메커니즘 없음**: TX 전송 실패 시 재시도/교체/정리 로직이 없음

## 3. 수정 계획

### Phase 1: 즉시 수정 (인프라)

#### 1-1. RPC를 Sealer 노드로 직접 라우팅
nginx 설정에서 `rpc.visionchain.co`를 node-2(sealer)의 port 8546으로 변경.
TX가 sealer에 직접 도착하므로 P2P 전파 의존성 제거.

```nginx
# 변경 전
proxy_pass http://127.0.0.1:8545;  # node-1 (non-sealer)

# 변경 후  
proxy_pass http://127.0.0.1:8546;  # node-2 (sealer)
```

#### 1-2. Mempool 정리
node-2의 queued TX 9,371개 제거를 위해 node-2 재시작:
```bash
docker restart vision-node-2
```
이렇게 하면 mempool이 초기화되고 stuck TX가 모두 제거됨.

#### 1-3. 모든 노드의 stuck TX 정리
전체 노드를 순차적으로 재시작하여 mempool 초기화:
```bash
# sealer를 마지막에 재시작
docker restart vision-node-1 vision-node-3 vision-node-4 vision-node-5
sleep 10
docker restart vision-node-2
```

### Phase 2: Paymaster 코드 수정

#### 2-1. Nonce 관리 강화
- TX 전송 시 항상 `latest` (confirmed) nonce 사용
- 동시 요청 시 nonce 충돌 방지를 위한 locking 메커니즘
- TX 실패 시 같은 nonce로 교체 TX 전송 (빈 TX)

#### 2-2. TX 전송 후 확인 프로세스
- TX 전송 후 receipt를 90초까지 대기
- 대기 중 stuck 감지 시 gas price를 높여 replacement TX 전송
- 최종 실패 시 해당 nonce를 빈 TX로 사용하여 gap 방지

#### 2-3. 에러 복구
- 요청 시작 시 nonce gap 자동 감지
- gap 발견 시 자동으로 빈 TX를 전송하여 gap 해소

### Phase 3: 모니터링 & 방어

#### 3-1. Health Check 강화
- 주기적으로 `latest` vs `pending` nonce 비교
- gap 발견 시 알림 및 자동 복구

#### 3-2. docker-compose.yml 정리
현재 docker-compose.yml이 실제 실행 중인 설정과 불일치. 
실제 실행 설정을 docker-compose.yml에 반영하여 재시작 시에도 올바른 설정 유지.

## 4. 실행 순서

1. [Phase 1-1] nginx 설정 변경 (rpc -> node-2 직접)
2. [Phase 1-2~3] 노드 재시작으로 mempool 정리
3. [Phase 2] Paymaster 코드 수정 & 배포
4. [Phase 3] 모니터링 추가
5. 전송 테스트 및 검증
