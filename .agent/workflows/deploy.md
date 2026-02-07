---
description: How to deploy changes to staging and production
---

# Deployment Workflow

## 핵심 원칙 / Core Principle
**스테이징에서 테스트 완료 후에만 프로덕션에 배포한다.**
**NEVER deploy to production without testing on staging first.**

---

## Cloudflare Pages 구조

| 프로젝트 | Git Branch | 도메인 |
|---------|------------|--------|
| `visionchain` | `main` → Production | `visionchain.co`, `www.visionchain.co` |
| `visionchain-staging` | `staging` → Production | `staging.visionchain.co` |

---

## 배포 시나리오

### 시나리오 A: "스테이징에 배포해줘" / "배포해줘"

1. **Commit changes**
```bash
git add -A && git commit -m "your commit message"
```

2. **Deploy to Staging ONLY**
// turbo
```bash
git push origin main:staging
```

3. **알림**
> 스테이징에 배포 완료했습니다: https://staging.visionchain.co
> 테스트 후 프로덕션 배포를 요청해 주세요.

**⚠️ 여기서 멈춤 - 프로덕션 배포하지 않음!**

---

### 시나리오 B: "프로덕션 배포해줘" / "릴리즈" / "테스트 완료"

**전제조건**: 스테이징에 이미 배포되어 있고 사용자가 테스트 완료를 확인함

1. **Deploy to Production**
// turbo
```bash
git push origin main
```

2. **알림**
> 프로덕션에 배포 완료했습니다: https://visionchain.co

---

### 시나리오 C: "스테이징이랑 프로덕션 둘 다 배포해줘"

**사용자가 명시적으로 요청한 경우에만:**

1. **Commit**
```bash
git add -A && git commit -m "your commit message"
```

2. **Deploy to Staging first**
// turbo
```bash
git push origin main:staging
```

3. **Deploy to Production**
// turbo
```bash
git push origin main
```

---

## 중요 규칙

1. **Staging First**: 항상 먼저 스테이징에 배포
2. **Wait for Confirmation**: 사용자 확인 없이 프로덕션 배포하지 않음
3. **Never Both Unless Asked**: 명시적 요청 없이 두 환경에 동시 배포 금지
4. **Rollback Ready**: 문제 시 이전 커밋으로 롤백 가능

## 금지 패턴

```bash
# ❌ 이렇게 하지 말 것 - 두 환경 동시 배포
git push origin main:staging && git push origin main
```

```bash
# ✅ 올바른 패턴 - 스테이징만
git push origin main:staging

# ✅ 올바른 패턴 - 프로덕션만 (테스트 완료 후)
git push origin main
```

## 배포 확인 URL

- **Staging**: https://staging.visionchain.co
- **Production**: https://visionchain.co
