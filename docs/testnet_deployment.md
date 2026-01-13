# Vision Chain 퍼블릭 테스트넷 배포 가이드 (Contabo/VPS)

이 문서는 사용자의 PC가 아닌 외부 서버(VPS)에 Vision Chain 하드햇 노드를 성공적으로 배포하고, 외부 사용자가 접속할 수 있는 RPC 엔드포인트를 구축하는 방법을 설명합니다.

---

## 1. 서버 사양 권장 (Contabo 기준)
- **OS**: Ubuntu 22.04 LTS (추천)
- **vCPU**: 4개 이상
- **RAM**: 8GB 이상 (노드는 메모리 소비가 큽니다)
- **Storage**: 100GB NVMe SSD 이상

---

## 2. 기본 환경 설정
SSH를 통해 서버에 접속한 후 다음 명령어를 순서대로 실행합니다.

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 설치 (프로세스 관리용)
sudo npm install -g pm2
```

---

## 3. 노드 설정 및 구동 스크립트
서버의 작업 디렉토리(예: `~/vision-chain-node`)를 만든 후, 다음 파일을 작성합니다.

### [NEW] setup_node.sh
```bash
#!/bin/bash

# 프로젝트 폴더 생성
mkdir -p ~/vision-chain-node
cd ~/vision-chain-node

# 기본 package.json 생성
if [ ! -f "package.json" ]; then
  npm init -y
  npm install --save-dev hardhat
fi

# 하드햇 노드 실행 스크립트 (PM2)
pm2 start "npx hardhat node --hostname 0.0.0.0" --name vision-testnet
pm2 save
```

---

## 4. Nginx RPC 프록시 및 SSL 설정
보통 하드햇 노드는 `8545` 포트를 사용합니다. 보안과 표준화를 위해 Nginx를 앞에 두고 `https`로 접근할 수 있게 설정합니다.

### Nginx 설정 예시 (`/etc/nginx/sites-available/rpc`)
```nginx
server {
    listen 80;
    server_name testnet.visionchain.co; # 본인의 도메인으로 변경

    location / {
        proxy_pass http://127.0.0.1:8545;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. 클라이언트(웹/앱) 코드 수정
배포된 퍼블릭 테스트넷을 사용하려면, 프로젝트 내의 RPC URL 설정을 로컬(`localhost`)에서 서버 URL로 변경해야 합니다.

### [MODIFY] .env
```env
# 변경 전
VITE_RPC_URL=http://localhost:8545

# 변경 후
VITE_RPC_URL=https://testnet.visionchain.co
```

---

## 6. 보안 주의사항
- **방화벽 설정**: `8545` 포트는 직접 열지 마시고, Nginx(`80`, `443`)만 열어두는 것이 안전합니다.
- **개인키 유출 금지**: 서버의 `.env` 파일에 중요한 커스터디얼 키나 배포자 프라이빗 키가 노출되지 않도록 주의하십시오.
