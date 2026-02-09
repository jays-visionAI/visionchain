# Vision Chain Email System - GTM 전략 종합 기획안

> 작성일: 2026-02-09 | 최종 수정: 2026-02-10 | 상태: Phase 1-2 완료, Phase 3 미구현

---

## 1. 현재 구현 상태 (Phase 1 - COMPLETE)

### 1.1 인프라
| 항목 | 상태 | 설명 |
|------|------|------|
| SMTP Transport | Done | Gmail/Google Workspace (nodemailer) |
| Base Email Layout | Done | Premium dark theme, inline styles, 모바일 호환 |
| Reusable Components | Done | sectionTitle, subtitle, infoCard, codeBox, button, alertBox, chainRoute, statusBadge, divider, monoText |
| Email Preferences API | Done | `updateEmailPreferences`, `getEmailPreferences` endpoints |
| Opt-in Check | Done | `checkEmailOptIn()` - 모든 발송 함수에 적용 |

### 1.2 구현된 이메일 템플릿 (12종)

| # | 이메일 | 트리거 | 카테고리 | 발송 조건 |
|---|--------|--------|----------|-----------|
| 1 | Device Verification | 새 디바이스 로그인 | security | 항상 (opt-out 불가) |
| 2 | Suspicious Activity Alert | IP 이상 감지 | security | 항상 |
| 3 | 2FA Enabled | TOTP 활성화 | security | 항상 |
| 4 | 2FA Disabled | TOTP 비활성화 | security | 항상 |
| 5 | Password Reset Code | 비밀번호 재설정 요청 | security | 항상 |
| 6 | Password Changed | 비밀번호 변경 완료 | security | 항상 |
| 7 | Staking Confirmed | VCN 스테이킹 완료 | staking | opt-in |
| 8 | Unstaking Cooldown | 언스테이킹 요청 | staking | opt-in |
| 9 | Rewards Claimed | 리워드 클레임 완료 | staking | opt-in |
| 10 | Referral Signup | 레퍼럴 가입 알림 | referral | opt-in |
| 11 | Bridge Complete | 크로스체인 전송 완료 | bridge | opt-in |
| 12 | Weekly Activity Report | 매주 월요일 09:00 KST | weeklyReport | opt-in |

### 1.3 구독 카테고리 (7종)
```
security     - 보안 알림 (잠금, 비활성화 불가) - 비밀번호 재설정 포함
staking      - 스테이킹 알림
referral     - 레퍼럴 알림
bridge       - 브릿지 알림
weeklyReport - 주간 보고서
lifecycle    - 온보딩/라이프사이클
announcements - 공지/업데이트
```

---

## 2. GTM 이메일 전략 - Phase 2 (신규 구현 필요)

### 2.1 Lifecycle / Onboarding 이메일 시리즈

사용자의 여정(Journey)에 맞춘 자동 드립 캠페인으로, **가입부터 첫 거래까지의 전환율**을 극대화합니다.

| # | 이메일 | 트리거 | 발송 시점 | 목적 | 우선순위 |
|---|--------|--------|-----------|------|----------|
| 1 | Welcome Email | 회원가입 완료 | 즉시 | 브랜드 첫인상, 지갑 생성 유도 | P0 |
| 2 | Wallet Created | 지갑 생성 완료 | 즉시 | 축하 + 첫 Faucet/스테이킹 유도 | P0 |
| 3 | First Staking Guide | 가입 후 24h 미활동 | +24h | 스테이킹 가이드, CTA | P1 |
| 4 | Referral Program Intro | 가입 후 48h | +48h | 레퍼럴 프로그램 안내 | P1 |
| 5 | Inactivity Nudge | 7일간 미로그인 | +7d | 재방문 유도, 신규 기능 소개 | P2 |
| 6 | Win-back | 30일간 미로그인 | +30d | 재활성화 인센티브 | P2 |

**구독 카테고리:** `lifecycle` (새로 추가)

### 2.2 Transaction / Activity 이메일

| # | 이메일 | 트리거 | 발송 시점 | 목적 | 상태 |
|---|--------|--------|-----------|------|------|
| 1 | ~~Transfer Sent~~ | ~~VCN 전송 완료~~ | ~~즉시~~ | ~~전송 확인~~ | 제거 (시스템 부하) |
| 2 | ~~Transfer Received~~ | ~~VCN 수신~~ | ~~즉시~~ | ~~입금 알림~~ | 제거 (시스템 부하) |
| 3 | Batch Transfer Complete | 대량 전송 완료 | 즉시 | 작업 완료 확인 | 미구현 (P2) |
| 4 | TimeLock Created | 예약 전송 생성 | 즉시 | 예약 확인 | 미구현 (P2) |
| 5 | TimeLock Executed | 예약 전송 실행 | 즉시 | 실행 알림 | 미구현 (P2) |
| 6 | Referral Reward Earned | 레퍼럴 보상 지급 | 즉시 | 보상 알림 + 추가 초대 유도 | 템플릿 완료 |

**구독 카테고리:** `transaction` (새로 추가)

### 2.3 Admin / Announcement 이메일

| # | 이메일 | 트리거 | 발송 시점 | 목적 | 우선순위 |
|---|--------|--------|-----------|------|----------|
| 1 | System Announcement | Admin 수동 발송 | 즉시 | 공지사항, 업데이트 | P1 |
| 2 | Mainnet Migration Notice | Admin 수동 발송 | 예약 | Testnet -> Mainnet 전환 안내 | P0 |
| 3 | Staking APY Change | APY 변경 시 | 즉시 | APY 변경 알림 | P2 |

**구독 카테고리:** `announcements` (새로 추가)

---

## 3. 확장된 구독 카테고리 (Phase 2)

```javascript
const EMAIL_PREFERENCE_DEFAULTS = {
  security: true,        // 보안 (잠금) - 비밀번호 재설정 포함
  staking: true,         // 스테이킹
  referral: true,        // 레퍼럴
  bridge: true,          // 브릿지
  weeklyReport: true,    // 주간 보고서
  // --- Phase 2 ---
  lifecycle: true,       // 온보딩/라이프사이클
  announcements: true,   // 공지/업데이트
};
```

---

## 4. 기술 구현 계획

### 4.1 Phase 2A: Lifecycle 드립 캠페인 (P0)

**구현 방식:** Firestore trigger + Scheduled Function

```
[회원가입] -> Firestore `users` doc 생성
           -> Cloud Function (onDocumentCreated) 
           -> Welcome Email 즉시 발송
           -> drip_queue 컬렉션에 후속 이메일 예약

[Scheduled Function - 매시간 실행]
           -> drip_queue에서 발송 시간 도래한 이메일 조회
           -> 조건 확인 (유저가 이미 행동했으면 스킵)
           -> 이메일 발송 & queue 업데이트
```

**Firestore 구조:**
```
drip_queue/{docId}
  ├── userEmail: string
  ├── templateId: "first_staking_guide" | "referral_intro" | ...
  ├── scheduledAt: Timestamp
  ├── sent: boolean
  ├── sentAt: Timestamp | null
  ├── skippedReason: string | null  // "already_staked", "opted_out"
  └── createdAt: Timestamp
```

### 4.2 Phase 2B: Transaction 이메일 (P1)

**구현 방식:** Paymaster 함수 내에서 직접 호출 (기존 staking/bridge 패턴과 동일)

```javascript
// handleTransfer 완료 후
const senderEmail = await getUserEmailByWallet(user);
if (senderEmail) {
  await sendTransferSentEmail(senderEmail, { recipient, amount, txHash });
}

const recipientEmail = await getUserEmailByWallet(recipient);
if (recipientEmail) {
  await sendTransferReceivedEmail(recipientEmail, { sender: user, amount, txHash });
}
```

### 4.3 Phase 2C: Admin Broadcast (P1)

**구현 방식:** Admin API endpoint + 전체 유저 대상 발송

```
exports.sendAnnouncement = onRequest(...)
  ├── Admin 인증 확인
  ├── 공지 내용 수신 (title, body, ctaUrl, ctaText)
  ├── users 컬렉션 전체 조회 (announcements opt-in 필터)
  ├── 배치 발송 (Promise.allSettled, rate limiting)
  └── 발송 결과 로깅 (sent_count, failed_count)
```

---

## 5. GTM 퍼널별 이메일 매핑

```
  [인지 Awareness]
       |
       v
  회원가입 ──> Welcome Email (즉시)
       |
       v
  지갑 생성 ──> Wallet Created Email (즉시)
       |          First Staking Guide (+24h, 미활동시)
       v
  [활성화 Activation]
       |
       v
  첫 스테이킹 ──> Staking Confirmed (즉시)
       |
       v
  [수익 Revenue]
       |
       v
  레퍼럴 초대 ──> Referral Program Intro (+48h)
  보상 수령   ──> Referral Reward Earned (즉시)
       |
       v
  [유지 Retention]
       |
       v
  주간 보고서 ──> Weekly Activity Report (매주 월)
  미활동 알림 ──> Inactivity Nudge (+7d)
       |
       v
  [재활성화 Re-engagement]
       |
       v
  Win-back ──> Win-back Email (+30d)
```

---

## 6. 이메일 성과 KPI 추적

### 6.1 추적 지표 (Phase 3에서 구현)

| 지표 | 수집 방법 | 목적 |
|------|-----------|------|
| 발송 수 (Sent) | Cloud Function 로그 | 시스템 정상 작동 확인 |
| 발송 성공률 | sendSecurityEmail 결과 | 메일 서버 건강도 |
| 카테고리별 opt-out률 | Firestore emailPreferences | 이메일 피로도 모니터링 |
| Drip 캠페인 전환률 | drip_queue skippedReason 분석 | 온보딩 퍼널 효과 측정 |

### 6.2 Firestore 분석 구조 (Phase 3)

```
email_analytics/{yearMonth}
  ├── sent: { security: 120, staking: 45, ... }
  ├── failed: { security: 2, staking: 0, ... }
  ├── optOuts: { staking: 3, weeklyReport: 5, ... }
  └── dripConversions: { welcome_to_wallet: 78%, wallet_to_stake: 34%, ... }
```

---

## 7. 구현 우선순위 로드맵

### Phase 1: Foundation (COMPLETE)
- [x] SMTP 인프라 (Nodemailer + Gmail)
- [x] Base layout + 재사용 컴포넌트
- [x] Security 이메일 (verification, suspicious, 2FA)
- [x] Staking 이메일 (stake, unstake, claim)
- [x] Referral 가입 알림
- [x] Bridge 완료 알림
- [x] 주간 활동 보고서 (Scheduled Function)
- [x] 이메일 구독 설정 API

### Phase 2: GTM Growth (COMPLETE)
- [x] **2A: Welcome + Wallet Created 이메일** (P0)
- [x] **2A: Drip queue 시스템 + Scheduler** (P0) - dripEmailProcessor (매시간)
- [x] **2B: Referral Reward Earned 이메일** (P1) - 템플릿 완료, 보상 로직 연결 시 활성화
- [x] **2C: Admin Broadcast 시스템** (P1) - sendAdminBroadcast endpoint
- [x] **2A: First Staking Guide (+24h)** (P1) - drip queue로 자동 발송
- [x] **2A: Referral Program Intro (+48h)** (P1) - drip queue로 자동 발송
- [x] **2A: Inactivity Nudge (+7d)** (P2) - inactivityNudge 스케줄러
- [x] **Password Reset Flow** (P0) - 3-step (이메일 코드 + TOTP + 비밀번호 변경)
- [x] **구독 카테고리 확장** (lifecycle, announcements)
- [ ] **2A: Win-back (+30d)** (P2) - 추후 구현
- ~~Transfer Sent/Received 이메일~~ - 제거 (시스템 부하 + 유저 피로도)

### Phase 3: Analytics (FUTURE)
- [ ] 이메일 발송 로그 수집
- [ ] opt-out 추적 대시보드
- [ ] Drip 캠페인 전환율 분석
- [ ] Admin 대시보드 통합 (AdminEmailAnalytics 컴포넌트)

---

## 8. 파일 구조

```
functions/
  index.js                    # 모든 Cloud Functions + 이메일 템플릿
    ├── EMAIL SERVICE          # SMTP 설정, sendSecurityEmail
    ├── EMAIL BASE LAYOUT      # emailBaseLayout, emailComponents
    ├── EMAIL TEMPLATES        # 개별 generate/send 함수들
    │   ├── Security           # verification, suspicious, 2FA
    │   ├── Staking            # stake, unstake, claim
    │   ├── Referral           # signup notification
    │   ├── Bridge             # completion notification  
    │   └── Weekly Report      # generateWeeklyReportEmailHtml
    ├── EMAIL PREFERENCES      # getEmailPrefs, checkEmailOptIn
    │   ├── updateEmailPreferences (HTTPS endpoint)
    │   └── getEmailPreferences (HTTPS endpoint)
    └── SCHEDULED              # weeklyActivityReport (cron)
```

---

## 9. 주의사항 / 제약

1. **Gmail 발송 한도**: Google Workspace 기준 일 2,000건. 사용자 수 증가 시 SendGrid/Mailgun 전환 필요.
2. **Cold Start**: Cloud Function cold start로 인한 이메일 지연 가능. Lazy loading으로 일부 완화.
3. **보안 이메일 opt-out 불가**: `security` 카테고리는 사용자가 비활성화할 수 없음.
4. **Rate Limiting**: 동일 사용자에게 짧은 시간 내 다수 이메일 발송 방지 로직 필요 (Phase 2).
5. **Unsubscribe Link**: CAN-SPAM 준수를 위해 모든 마케팅 이메일에 구독 해제 링크 필요.
