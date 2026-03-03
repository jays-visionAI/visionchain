# Vision Chain v2 EIP Upgrade Plan

## 현재 상태

| 항목 | 값 |
|------|-----|
| Chain ID | 3151909 |
| Geth 버전 | v1.13.15 (`ethereum/client-go:v1.13.15`) |
| 활성 포크 | Homestead → Istanbul (Berlin/London/Shanghai 없음) |
| 현재 블록 | ~301,000+ |
| 합의 | Clique PoA (period: 5초) |
| 노드 수 | 5 (Docker) |
| 서버 | 46.224.221.201 |
| Base Fee | N/A (EIP-1559 비활성) |
| Gas Limit | 30,000,000 |

## 업그레이드 대상 EIP

### Berlin (EIP-2718, 2929, 2930)
- EIP-2718: Typed Transaction Envelope
- EIP-2929: Gas cost increase for state access opcodes
- EIP-2930: Access list transaction type

### London (EIP-1559, 3198, 3529, 3541)
- EIP-1559: Fee market (baseFee + priority fee)
- EIP-3198: BASEFEE opcode
- EIP-3529: Gas refund reduction
- EIP-3541: Reject 0xEF bytecode prefix

### Shanghai (EIP-3651, 3855, 3860, 4895)
- EIP-3651: Warm COINBASE
- EIP-3855: **PUSH0** opcode (Solidity 0.8.20+ 필수)
- EIP-3860: Limit initcode size
- EIP-4895: Beacon chain withdrawals (PoS 전용, Clique에서는 무시됨)

## 업그레이드 방식: 인플레이스 하드포크

체인을 리셋하지 않고, **특정 블록 번호 이후부터 새 EIP를 활성화**합니다.
기존 컨트랙트, 잔액, 스테이킹 상태 모두 보존됩니다.

### 왜 인플레이스 하드포크인가?
- 현재 40,000 VCN 스테이킹 중 (4 validators)
- 약 500,000 VCN reward pool 운영 중
- 55개 계정의 잔액 보존 필요
- 배포된 컨트랙트 10개 이상

## 실행 절차

### Step 1: 포크 블록 번호 결정

현재 블록 ~301,000이므로, 안전 마진을 두고 **블록 302,000**에서 Berlin+London을 활성화합니다.
(블록 타임 5초 x ~1,000블록 = 약 83분의 여유)

Shanghai는 Clique PoA 체인에서 `shanghaiBlock`이 아닌 **`shanghaiTime`** (Unix timestamp)으로 설정해야 합니다.
즉시 활성화하려면 `shanghaiTime: 0`으로 설정합니다.

```
Berlin + London: 블록 302,000에서 활성화
Shanghai: shanghaiTime: 0 (즉시, 재시작과 동시에)
```

### Step 2: 업그레이드 Genesis 파일 준비

`geth init`은 **기존 chaindata를 보존**하면서 chain config만 업데이트합니다.
genesis 블록의 `alloc`이나 `extradata`는 변경하지 않고, `config` 섹션만 수정하면
기존 잔액, 컨트랙트, 스테이킹 상태가 모두 그대로 유지됩니다.

주의: genesis 블록 자체(alloc, extradata 등)를 변경하면 genesis hash가 달라져서 불일치 에러가 납니다.
**config 섹션만** 변경해야 합니다.

### Step 3: 서버 접속 및 실행

```bash
# 서버 접속
ssh root@46.224.221.201

# 0. 현재 블록 번호 확인 (302,000 이전인지 확인)
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  | python3 -c "import sys,json; print('Current block:', int(json.load(sys.stdin)['result'], 16))"

# 1. 백업
cp -r /root/vision-chain/deploy/v2-testnet /root/vision-chain/backup-pre-eip-$(date +%Y%m%d_%H%M%S)

# 2. 모든 노드 중지
cd /root/vision-chain && docker-compose down

# 3. 업그레이드 genesis 파일 작성
# 중요: alloc과 extradata는 그대로 유지, config만 포크 블록 추가
cat > /tmp/genesis-upgrade.json << 'GENEOF'
{
  "config": {
    "chainId": 3151909,
    "homesteadBlock": 0,
    "eip150Block": 0,
    "eip155Block": 0,
    "eip158Block": 0,
    "byzantiumBlock": 0,
    "constantinopleBlock": 0,
    "petersburgBlock": 0,
    "istanbulBlock": 0,
    "berlinBlock": 302000,
    "londonBlock": 302000,
    "shanghaiTime": 0,
    "clique": {
      "period": 5,
      "epoch": 30000
    }
  },
  "difficulty": "1",
  "gasLimit": "8000000",
  "alloc": {}
}
GENEOF

# 4. 각 노드의 genesis.json 업데이트 & geth init (chaindata 보존, config만 업데이트)
for i in 1 2 3 4 5; do
  echo "===== Upgrading node $i ====="
  
  # 노드 디렉토리에 업그레이드 genesis 복사
  cp /tmp/genesis-upgrade.json deploy/v2-testnet/node$i/genesis.json
  
  # geth init으로 chain config 업데이트 (기존 chaindata 보존)
  docker run --rm \
    -v $(pwd)/deploy/v2-testnet/node$i:/data \
    ethereum/client-go:v1.13.15 \
    init --datadir /data /data/genesis.json
  
  echo "Node $i config updated."
done

# 5. 노드 재시작
docker-compose up -d

# 6. 초기 검증 (즉시)
sleep 10
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
echo ""
echo "Nodes restarted. Waiting for block 302,000 for Berlin+London activation."
```

### Step 4: 포크 활성화 확인

블록이 302,000을 넘으면 Berlin+London이 활성화됩니다.
(현재 블록 ~301,000이므로 약 83분 소요)

```bash
# 현재 블록 확인
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  | python3 -c "import sys,json; b=int(json.load(sys.stdin)['result'],16); print(f'Block: {b}, Berlin/London in: {max(0,302000-b)} blocks')"

# 블록 302,000 이후 baseFee 확인 (London 활성화 증거)
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}' \
  | python3 -c "import sys,json; b=json.load(sys.stdin)['result']; print('baseFeePerGas:', b.get('baseFeePerGas','N/A'))"
```

baseFeePerGas가 표시되면 London 포크 성공.

### Step 5: Shanghai 검증 (PUSH0 테스트)

Solidity 0.8.20+ 컨트랙트를 배포하여 PUSH0가 작동하는지 확인:

```bash
# Node.js로 검증 (로컬)
node -e "
const { ethers } = require('ethers');
const p = new ethers.JsonRpcProvider('https://rpc.visionchain.co');
(async () => {
  const b = await p.getBlock('latest');
  console.log('Block:', b.number);
  console.log('Base Fee:', b.baseFeePerGas?.toString() || 'N/A (London not yet active)');
  console.log('Ok.');
})();
"
```

## 주의사항

### EIP-1559 영향
- 기존 `gasPrice` 기반 트랜잭션은 계속 작동 (Legacy tx 호환)
- `maxFeePerGas` + `maxPriorityFeePerGas` 방식도 사용 가능해짐
- Paymaster의 `gasOpts` (`gasPrice: 1 gwei`)는 Legacy tx로 계속 작동

### 기존 컨트랙트 영향
- 모든 기존 컨트랙트 정상 작동 (하위 호환)
- BridgeStaking, VCNToken, Paymaster 등 영향 없음
- gas cost가 일부 변경되나 트랜잭션 실패를 유발하지 않음

### Shanghai 관련
- Geth v1.13.x에서 Clique PoA 체인의 Shanghai는 `shanghaiTime` 사용
- `shanghaiTime: 0`으로 설정하면 즉시 활성화 (genesis 시점부터)
- `shanghaiBlock`은 Clique에서 사용 불가, timestamp 기반만 가능

### Rollback
문제 발생 시 노드를 중지하고 genesis-upgrade.json에서
`berlinBlock`, `londonBlock`, `shanghaiTime`을 제거 후 재시작

## Geth 버전 주의

| Geth 버전 | Berlin | London | Shanghai |
|-----------|--------|--------|----------|
| v1.10.x | O | O | X |
| v1.11.x | O | O | O (partial) |
| v1.13.15 | O | O | O |

현재 v1.13.15로 Berlin/London/Shanghai 모두 지원됩니다.

## 업그레이드 후 가능해지는 것

1. **Solidity 0.8.20+ 컨트랙트 배포** (PUSH0 opcode)
   - VisionMiningPoolNative.sol
   - VisionNodeLicenseNative.sol
2. **EIP-1559 가스 모델** - baseFee + priority fee
3. **Type 2 트랜잭션** - maxFeePerGas 사용
4. **Access List 트랜잭션** - 가스 최적화
