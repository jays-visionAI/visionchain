# Git Branch Strategy & Deployment Workflow

## Branch Structure

```
main (production)     ← 실제 사용자가 접속하는 버전
  │
  └── staging         ← 배포 전 최종 테스트
        │
        └── develop   ← 일상적인 개발 작업
              │
              └── feature/*  ← 기능별 브랜치
```

## Branches

| Branch | Environment | URL | Auto-Deploy |
|--------|-------------|-----|-------------|
| `main` | Production | app.visionchain.co | Yes |
| `staging` | Staging | staging.visionchain.co | Yes |
| `develop` | Development | - | No |
| `feature/*` | Local | localhost:3000 | No |

## Workflow

### 1. 새 기능 개발

```bash
# develop에서 feature 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b feature/my-new-feature

# 개발 작업...
git add .
git commit -m "feat: Add my new feature"

# develop으로 PR 생성
git push -u origin feature/my-new-feature
# GitHub에서 PR 생성 → develop으로 머지
```

### 2. 스테이징 테스트

```bash
# develop 변경사항을 staging으로 머지
git checkout staging
git pull origin staging
git merge develop
git push origin staging
# → 자동으로 staging.visionchain.co에 배포됨
```

### 3. 프로덕션 배포

```bash
# 스테이징 테스트 완료 후 main으로 머지
git checkout main
git pull origin main
git merge staging
git push origin main
# → 자동으로 app.visionchain.co에 배포됨
```

## Quick Commands

```bash
# 로컬 개발 (기본 환경)
npm run dev

# 로컬에서 스테이징 환경으로 테스트
npm run dev:staging

# 스테이징 빌드
npm run build:staging

# 프로덕션 빌드
npm run build:production
```

## Environment Files

| File | Used When | Firebase Project |
|------|-----------|------------------|
| `.env` | `npm run dev` | Development/Local |
| `.env.staging` | `npm run dev:staging`, `npm run build:staging` | visionchain-staging |
| `.env.production` | `npm run build:production` | visionchain-d19ed |

## GitHub Secrets Required

### For Staging (`deploy-staging.yml`)
- `STAGING_FIREBASE_API_KEY`
- `STAGING_FIREBASE_MESSAGING_SENDER_ID`
- `STAGING_FIREBASE_APP_ID`
- `STAGING_FIREBASE_MEASUREMENT_ID`

### For Production (`deploy-production.yml`)
- `PROD_FIREBASE_API_KEY`
- `PROD_FIREBASE_MESSAGING_SENDER_ID`
- `PROD_FIREBASE_APP_ID`
- `PROD_FIREBASE_MEASUREMENT_ID`

### Cloudflare (Both)
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Setting Up GitHub Secrets

1. Go to: https://github.com/jays-visionAI/visionchain/settings/secrets/actions
2. Click "New repository secret"
3. Add each secret listed above

## Cloudflare Pages Setup

### Staging Project
1. Cloudflare Dashboard → Pages → Create a project
2. Connect to Git → Select `jays-visionAI/visionchain`
3. Project name: `visionchain-staging`
4. Production branch: `staging`
5. Build command: `npm run build:staging`
6. Output directory: `dist`

### Production Project
1. Cloudflare Dashboard → Pages → Create a project
2. Connect to Git → Select `jays-visionAI/visionchain`
3. Project name: `visionchain`
4. Production branch: `main`
5. Build command: `npm run build:production`
6. Output directory: `dist`
