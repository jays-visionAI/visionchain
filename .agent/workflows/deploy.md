---
description: How to deploy changes to staging and production
---

# Deployment Workflow

## Principle
**Always deploy to staging first, then production after testing is confirmed.**

## Steps

### 1. Build and verify locally
```bash
npm run build
```

### 2. Commit changes
```bash
git add -A && git commit -m "your commit message"
```

### 3. Deploy to Staging FIRST
// turbo
```bash
git push origin main:staging
```

### 4. Wait for Cloudflare build (1-2 minutes)
- Staging URL: https://staging.visionchain.co

### 5. After user confirms testing is complete, deploy to Production
```bash
git push origin main
```
- Production URL: https://visionchain.co

## Notes
- Never push directly to production without staging test first
- If user explicitly says "deploy to production" or "release to production", then push to both
- Cloudflare Pages automatically builds on push to respective branches
