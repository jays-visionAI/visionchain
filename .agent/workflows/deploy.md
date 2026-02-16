---
description: How to deploy changes to staging and production
---

# Deployment Workflow

## 핵심 원칙 / Core Principle
**스테이징에서 테스트 완료 후에만 프로덕션에 배포한다.**
**NEVER deploy to production without testing on staging first.**
**프로덕션과 스테이징은 절대 섞이면 안 된다.**

---

## 환경 매핑 (CRITICAL - 절대 혼용 금지)

| 환경 | Git Branch | Cloudflare Pages | Firebase Project | 도메인 |
|------|-----------|-----------------|-----------------|--------|
| **Staging** | `staging` | `visionchain-staging` | `visionchain-staging` | `staging.visionchain.co` |
| **Production** | `main` | `visionchain` | `visionchain-d19ed` | `visionchain.co` |

### Firebase CLI 프로젝트 ID 규칙
```
스테이징:  --project visionchain-staging
프로덕션:  --project visionchain-d19ed
```

> **절대 금지**: staging 환경에 `--project visionchain-d19ed`를 사용하거나,
> production 환경에 `--project visionchain-staging`을 사용하는 것은 금지.

---

## 배포 시나리오

### 시나리오 A: "스테이징에 배포해줘" / "배포해줘"

1. **Commit changes**
```bash
git add -A && git commit -m "your commit message"
```

2. **Deploy frontend to Staging**
// turbo
```bash
git push origin main:staging
```

3. **Deploy Cloud Functions to Staging (필요시)**
```bash
firebase deploy --only functions:함수명 --project visionchain-staging
```

4. **Deploy Firestore indexes to Staging (필요시)**
```bash
firebase deploy --only firestore:indexes --project visionchain-staging
```

5. **알림**
> 스테이징에 배포 완료했습니다: https://staging.visionchain.co
> 테스트 후 프로덕션 배포를 요청해 주세요.

**⚠️ 여기서 멈춤 - 프로덕션 배포하지 않음!**

---

### 시나리오 B: "프로덕션 배포해줘" / "릴리즈" / "테스트 완료"

**전제조건**: 스테이징에 이미 배포되어 있고 사용자가 테스트 완료를 확인함

1. **Deploy frontend to Production**
// turbo
```bash
git push origin main
```

2. **Deploy Cloud Functions to Production (필요시)**
```bash
firebase deploy --only functions:함수명 --project visionchain-d19ed
```

3. **Deploy Firestore indexes to Production (필요시)**
```bash
firebase deploy --only firestore:indexes --project visionchain-d19ed
```

4. **알림**
> 프로덕션에 배포 완료했습니다: https://visionchain.co

---

### 시나리오 C: "스테이징이랑 프로덕션 둘 다 배포해줘"

**사용자가 명시적으로 요청한 경우에만:**

1. **Commit**
```bash
git add -A && git commit -m "your commit message"
```

2. **Deploy to Staging first (frontend + Firebase)**
// turbo
```bash
git push origin main:staging
```
```bash
firebase deploy --only functions:함수명 --project visionchain-staging
firebase deploy --only firestore:indexes --project visionchain-staging
```

3. **Deploy to Production (frontend + Firebase)**
// turbo
```bash
git push origin main
```
```bash
firebase deploy --only functions:함수명 --project visionchain-d19ed
firebase deploy --only firestore:indexes --project visionchain-d19ed
```

---

## 중요 규칙

1. **Staging First**: 항상 먼저 스테이징에 배포
2. **Wait for Confirmation**: 사용자 확인 없이 프로덕션 배포하지 않음
3. **Never Both Unless Asked**: 명시적 요청 없이 두 환경에 동시 배포 금지
4. **Rollback Ready**: 문제 시 이전 커밋으로 롤백 가능
5. **Firebase 프로젝트 ID 반드시 확인**: 매 배포마다 `--project` 값이 환경과 일치하는지 확인

## 금지 패턴

```bash
# ❌ 절대 금지 - 스테이징에 프로덕션 Firebase 사용
firebase deploy --only functions --project visionchain-d19ed   # ← staging 배포 중에 이거 쓰면 안됨

# ❌ 절대 금지 - 프로덕션에 스테이징 Firebase 사용
firebase deploy --only functions --project visionchain-staging  # ← production 배포 중에 이거 쓰면 안됨

# ❌ 절대 금지 - 두 환경 동시 배포 (명시적 요청 없이)
git push origin main:staging && git push origin main
```

```bash
# ✅ 올바른 패턴 - 스테이징
git push origin main:staging
firebase deploy --only functions:함수명 --project visionchain-staging

# ✅ 올바른 패턴 - 프로덕션 (테스트 완료 후)
git push origin main
firebase deploy --only functions:함수명 --project visionchain-d19ed
```

## 배포 확인 URL

- **Staging**: https://staging.visionchain.co
- **Production**: https://visionchain.co

## 자주 사용하는 Cloud Functions

| 함수명 | 용도 |
|--------|------|
| `agentGateway` | AI Agent API 엔드포인트 |

배포 예시:
```bash
# 스테이징
firebase deploy --only functions:agentGateway --project visionchain-staging

# 프로덕션
firebase deploy --only functions:agentGateway --project visionchain-d19ed
```
