---
description: How to deploy changes to staging and production
---

# Deployment Workflow

## Core Principle
**스테이징에서 테스트 완료 후에만 프로덕션에 배포한다.**
**NEVER deploy to production without testing on staging first.**

## Deployment Steps

### Step 1: Commit changes
```bash
git add -A && git commit -m "your commit message"
```

### Step 2: Deploy to Staging ONLY
// turbo
```bash
git push origin main:staging
```

### Step 3: Wait for Cloudflare build (1-2 minutes)
- Staging URL: https://staging.visionchain.co (or `*.visionchain.pages.dev`)
- Inform the user that staging deployment is complete and ask them to test

### Step 4: Wait for User Confirmation
**DO NOT proceed to production until the user explicitly confirms:**
- "테스트 완료" / "Test complete"
- "프로덕션 배포해줘" / "Deploy to production"
- "릴리즈" / "Release"

### Step 5: Deploy to Production (ONLY after user confirmation)
```bash
git push origin main
```
- Production URL: https://visionchain.co

## Important Rules

1. **Staging First**: Always push to staging before production
2. **Wait for Confirmation**: Never auto-deploy to production
3. **User Decides**: Only deploy to production when user requests it
4. **Rollback Ready**: If production has issues, can rollback to previous commit

## Example Flow

```
User: "이 기능 배포해줘"
AI: [Pushes to staging only]
AI: "스테이징에 배포 완료했습니다. 테스트 후 프로덕션 배포 요청해 주세요."

User: "테스트 완료, 프로덕션 배포해줘"
AI: [Pushes to production]
AI: "프로덕션 배포 완료했습니다."
```
