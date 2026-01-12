# Vision Chain Deployment Guide

이 가이드는 Vision Chain 프로젝트를 실제 인터넷 환경(Production)에 배포하는 방법을 설명합니다.

---

## 🏗 아키텍처 개요
1. **Frontend (Cloudflare Pages)**: 사용자 인터페이스 및 지갑 웹앱
2. **Blockchain Node (Linux Server)**: Vision Testnet v1 (Hardhat Node)

---

## 1. 프론트엔드 배포 (Cloudflare Pages)

1. **GitHub 연동**:
   - GitHub 레포지토리에 최신 소스를 Push합니다.
2. **Cloudflare Pages 프로젝트 생성**:
   - Cloudflare Dash에서 **Workers & Pages > Create application > Pages > Connect to Git**을 선택합니다.
3. **빌드 설정**:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **환경 변수 설정**:
   - `Settings > Variables and Secrets`에서 `.env` 파일에 있던 API 키들(`VITE_FIREBASE_API_KEY` 등)을 추가합니다.

---

## 2. 테스트넷 노드 배포 (Ubuntu/Linux Server)

임시로 노드를 서버측에 구현하고 가동하는 방법입니다.

1. **서버 준비**: AWS EC2 혹은 GCP Compute Engine (Ubuntu 22.04 추천, RAM 4GB 이상)
2. **환경 구축**:
   ```bash
   # Node.js 설치
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. **코드 배포**:
   ```bash
   git clone [Your-Repo-URL]
   cd Vision-Chain/blockchain
   npm install
   ```
4. **노드 백그라운드 실행 (PM2 추천)**:
   ```bash
   sudo npm install -g pm2
   # 노드 실행 및 Chain ID 설정 보존
   pm2 start "npx hardhat node" --name vision-node
   ```
5. **컨트랙트 배포**:
   ```bash
   # 배포 스크립트 실행 (로컬 RPC 서버로)
   npx hardhat run scripts/deploy.js --network localhost
   ```
6. **포트 개방**: 클라우드 보안 그룹에서 **8545** 포트(RPC)를 공개(0.0.0.0/0)로 설정합니다.

---

## 3. Vision Scan v1 연동

노드가 서버에 올라가면, `http://[서버-IP]:8545`가 공식 RPC 주소가 됩니다.
- 프론트엔드의 `contractService.ts`와 `index.tsx`에서 RPC URL을 이 주소로 업데이트하여 배포하면 **Vision Scan v1**이 실제 서버의 블록 데이터를 읽어오기 시작합니다.
