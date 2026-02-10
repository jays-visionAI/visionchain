# Email Template Management System - 기획 문서

> 작성일: 2026-02-10 | 상태: 기획 단계

---

## 1. 문제 정의

### 1.1 현재 상태
- 백엔드에 **17개 이메일 발송 함수**가 하드코딩되어 있음
- 관리자 UI(AdminEmail.tsx)에는 **5개 템플릿만** 표시됨 (verification, suspicious, passwordReset, passwordChanged, weeklyReport)
- 나머지 12개 이메일 (staking, referral, bridge, welcome, onboarding 등)은 관리 불가
- 새로운 이메일 시나리오를 추가하려면 코드를 직접 수정하고 배포해야 함
- 이메일 발송 카테고리 / 트리거 조건을 관리하는 UI가 없음

### 1.2 목표
관리자가 **코드 수정 없이** 다음을 할 수 있어야 한다:
1. 기존 이메일 시나리오의 템플릿(제목, 본문 HTML) 편집
2. 새 이메일 시나리오 추가 (카테고리, 트리거, 변수 정의)
3. 발송 시나리오별 활성화/비활성화 토글
4. 테스트 이메일 발송 (수신 이메일 주소 지정)
5. 전체 이메일 시나리오 현황 대시보드

---

## 2. 전체 아키텍처

```
[Admin UI - AdminEmail.tsx]
        |
        v
[Firestore: emailTemplates/{templateId}]  <-- 관리자가 편집한 템플릿 저장
        |
        v
[Cloud Functions - generate*EmailHtml()]  <-- Firestore 우선, 없으면 하드코딩 fallback
        |
        v
[sendSecurityEmail()]  <-- 실제 SMTP 발송
```

### 2.1 Firestore 스키마: `emailTemplates/{templateId}`

```typescript
interface EmailTemplate {
  // 기본 정보
  id: string;                    // "verification", "staking_confirmed", "welcome" 등
  name: string;                  // "Device Verification"
  description: string;           // "Sent when user logs in from a new device"
  
  // 분류
  category: string;              // "security" | "staking" | "referral" | "bridge" | "weeklyReport" | "lifecycle" | "announcements"
  triggerType: string;           // "automatic" | "scheduled" | "manual"
  triggerDescription: string;    // "새 디바이스 로그인 시 자동 발송"
  
  // 템플릿 내용
  subject: string;               // "Your Vision Chain verification code: {{code}}"
  bodyHtml: string;              // HTML body with {{variable}} placeholders
  
  // 변수 정의
  variables: {
    name: string;                // "code"
    description: string;         // "6-digit verification code"
    example: string;             // "847291"
    required: boolean;           // true
  }[];
  
  // 상태 관리
  enabled: boolean;              // true = 활성, false = 비활성 (발송 중단)
  isSystemRequired: boolean;     // true = security 카테고리, 비활성화 불가
  
  // 메타
  updatedAt: string;             // ISO timestamp
  updatedBy: string;             // admin email
  createdAt: string;             // ISO timestamp
  version: number;               // 수정 횟수 (롤백 대비)
}
```

---

## 3. 관리자 UI 구조

### 3.1 탭 구성

```
+------------------+------------------+------------------+
|   Scenarios      |   Templates      |   Subscriptions  |
+------------------+------------------+------------------+
```

| 탭 | 기능 |
|----|------|
| **Scenarios** | 모든 이메일 발송 시나리오 목록, 카테고리별 필터, 활성화/비활성화, 새 시나리오 추가 |
| **Templates** | 선택한 시나리오의 제목/본문 HTML 편집, 변수 관리, 미리보기 |
| **Subscriptions** | 카테고리별 사용자 구독 통계 (기존 기능) |

### 3.2 Scenarios 탭 (핵심 신규 기능)

#### 3.2.1 시나리오 목록 뷰

```
+-------------------------------------------------------------------+
| Email Scenarios                                    [+ Add Scenario]|
|-------------------------------------------------------------------|
| Filter: [All] [Security] [Staking] [Referral] [Bridge] [Weekly]   |
|         [Lifecycle] [Announcements]                                |
|-------------------------------------------------------------------|
|                                                                   |
| SECURITY (6)                                        opt-out 불가   |
| +---------------------------------------------------------------+|
| | Device Verification          ACTIVE    Automatic  [Edit] [Test]||
| | Triggered: New device login                                    ||
| | Subject: Your Vision Chain verification code: {{code}}         ||
| +---------------------------------------------------------------+|
| | Suspicious Activity Alert    ACTIVE    Automatic  [Edit] [Test]||
| | ...                                                            ||
| +---------------------------------------------------------------+|
| | Password Reset Code          ACTIVE    Automatic  [Edit] [Test]||
| +---------------------------------------------------------------+|
| | Password Changed             ACTIVE    Automatic  [Edit] [Test]||
| +---------------------------------------------------------------+|
| | 2FA Enabled                  ACTIVE    Automatic  [Edit] [Test]||
| +---------------------------------------------------------------+|
| | 2FA Disabled                 ACTIVE    Automatic  [Edit] [Test]||
| +---------------------------------------------------------------+|
|                                                                   |
| STAKING (3)                                                       |
| +---------------------------------------------------------------+|
| | Staking Confirmed      [ON/OFF]  Automatic  [Edit] [Test]     ||
| | Unstaking Cooldown      [ON/OFF]  Automatic  [Edit] [Test]     ||
| | Rewards Claimed        [ON/OFF]  Automatic  [Edit] [Test]     ||
| +---------------------------------------------------------------+|
|                                                                   |
| LIFECYCLE (4)                                                     |
| +---------------------------------------------------------------+|
| | Welcome Email          [ON/OFF]  Automatic  [Edit] [Test]     ||
| | Wallet Created         [ON/OFF]  Automatic  [Edit] [Test]     ||
| | First Staking Guide    [ON/OFF]  Drip +24h  [Edit] [Test]     ||
| | Inactivity Nudge       [ON/OFF]  Drip +7d   [Edit] [Test]     ||
| +---------------------------------------------------------------+|
|                                                                   |
| ...                                                               |
+-------------------------------------------------------------------+
```

#### 3.2.2 시나리오 추가 모달

관리자가 새 이메일 시나리오를 추가할 때 사용합니다.

```
+---------------------------------------------------+
| Add Email Scenario                            [X] |
|---------------------------------------------------|
|                                                   |
| Scenario Name *                                   |
| [                                               ] |
|                                                   |
| Description                                       |
| [                                               ] |
|                                                   |
| Category *                                        |
| [Security   v]                                    |
|                                                   |
| Trigger Type *                                    |
| ( ) Automatic - 시스템 이벤트에 의해 자동 발송      |
| ( ) Scheduled - 스케줄러에 의해 정기 발송           |
| ( ) Manual    - 관리자가 수동 발송                  |
|                                                   |
| Trigger Description                               |
| [e.g. "VCN 전송 완료 시 발송"                    ] |
|                                                   |
| ---- Variables ----                                |
|                                                   |
| + Add Variable                                    |
| | Name: [txHash     ] Required: [v]              |
| | Description: [Transaction hash             ]   |
| | Example: [0x1234...abcd                    ]   |
| +                                                 |
| | Name: [amount     ] Required: [v]              |
| | Description: [Transfer amount in VCN       ]   |
| | Example: [1,000                            ]   |
|                                                   |
| ---- Template ----                                 |
|                                                   |
| Subject Line *                                    |
| [                                               ] |
|                                                   |
| Body HTML *                                       |
| [                                               ] |
| [                                               ] |
| [                                               ] |
|                                                   |
|                  [Cancel]  [Create Scenario]       |
+---------------------------------------------------+
```

#### 3.2.3 시나리오 상세/편집 뷰 (기존 Edit 모달 확장)

기존 편집 모달에 다음 기능을 추가합니다:

| 영역 | 기능 |
|------|------|
| **시나리오 정보** | 이름, 설명, 카테고리, 트리거 타입 수정 |
| **상태 토글** | 활성/비활성 (security 카테고리는 잠금) |
| **Subject 편집** | 제목 + 변수 삽입 |
| **Body HTML 편집** | 본문 HTML + 변수 삽입 |
| **변수 관리** | 변수 추가/삭제/수정 |
| **미리보기** | 예시 데이터로 렌더링된 이메일 |
| **테스트 발송** | 이메일 주소 입력 후 발송 |
| **기본값 초기화** | 하드코딩된 기본 템플릿으로 복원 (커스텀 시나리오는 N/A) |

---

## 4. 전체 이메일 시나리오 Registry

현재 백엔드에 구현된 모든 이메일을 하나의 Registry로 통합 관리합니다.

### 4.1 Registry 정의

```typescript
// 프론트엔드 DEFAULT_TEMPLATES를 확장하여 전체 시나리오 관리
const EMAIL_SCENARIO_REGISTRY = [
  // ========== SECURITY (opt-out 불가, isSystemRequired=true) ==========
  {
    id: 'verification',
    name: 'Device Verification',
    category: 'security',
    triggerType: 'automatic',
    triggerDescription: '새 디바이스에서 로그인 시 자동 발송',
    isSystemRequired: true,
    backendFunction: 'generateVerificationEmailHtml',
    variables: [
      { name: 'code', description: '6자리 인증 코드', example: '847291', required: true },
      { name: 'deviceInfo', description: '브라우저/OS/IP 정보', example: 'Chrome 120 / macOS 14.2 / Seoul', required: true },
    ],
  },
  {
    id: 'suspicious',
    name: 'Suspicious Activity Alert',
    category: 'security',
    triggerType: 'automatic',
    triggerDescription: '비정상적인 로그인 시도 감지 시 자동 발송',
    isSystemRequired: true,
    backendFunction: 'generateSuspiciousActivityEmailHtml',
    variables: [
      { name: 'reason', description: '의심 활동 유형', example: 'Multiple failed login attempts', required: true },
      { name: 'details', description: '상세 활동 내역', example: '5 failed attempts from IP 91.132.xxx.xxx', required: true },
    ],
  },
  {
    id: 'passwordReset',
    name: 'Password Reset Code',
    category: 'security',
    triggerType: 'automatic',
    triggerDescription: '비밀번호 재설정 요청 시 자동 발송',
    isSystemRequired: true,
    backendFunction: 'generatePasswordResetEmailHtml',
    variables: [
      { name: 'code', description: '재설정 인증 코드', example: '593721', required: true },
      { name: 'email', description: '사용자 이메일', example: 'user@example.com', required: true },
    ],
  },
  {
    id: 'passwordChanged',
    name: 'Password Changed Confirmation',
    category: 'security',
    triggerType: 'automatic',
    triggerDescription: '비밀번호 변경 완료 시 자동 발송',
    isSystemRequired: true,
    backendFunction: 'generatePasswordChangedEmailHtml',
    variables: [
      { name: 'email', description: '사용자 이메일', example: 'user@example.com', required: true },
      { name: 'timestamp', description: '변경 일시', example: '2026-02-10 09:15 KST', required: true },
    ],
  },
  {
    id: '2faEnabled',
    name: '2FA Enabled Notification',
    category: 'security',
    triggerType: 'automatic',
    triggerDescription: 'TOTP 2FA 활성화 시 자동 발송',
    isSystemRequired: true,
    backendFunction: 'inline (sendSecurityEmail)',
    variables: [],
  },
  {
    id: '2faDisabled',
    name: '2FA Disabled Notification',
    category: 'security',
    triggerType: 'automatic',
    triggerDescription: 'TOTP 2FA 비활성화 시 자동 발송',
    isSystemRequired: true,
    backendFunction: 'inline (sendSecurityEmail)',
    variables: [],
  },

  // ========== STAKING ==========
  {
    id: 'stakingConfirmed',
    name: 'Staking Confirmed',
    category: 'staking',
    triggerType: 'automatic',
    triggerDescription: 'VCN 스테이킹 완료 시 자동 발송',
    isSystemRequired: false,
    backendFunction: 'sendStakingEmail',
    variables: [
      { name: 'amount', description: '스테이킹 수량', example: '10,000 VCN', required: true },
      { name: 'txHash', description: '트랜잭션 해시', example: '0x1234...abcd', required: true },
    ],
  },
  {
    id: 'unstakingCooldown',
    name: 'Unstaking Cooldown Started',
    category: 'staking',
    triggerType: 'automatic',
    triggerDescription: '언스테이킹 요청 시 자동 발송',
    isSystemRequired: false,
    backendFunction: 'sendUnstakeEmail',
    variables: [
      { name: 'amount', description: '언스테이킹 수량', example: '5,000 VCN', required: true },
      { name: 'txHash', description: '트랜잭션 해시', example: '0x1234...abcd', required: true },
      { name: 'cooldownDays', description: '쿨다운 기간 (일)', example: '7', required: false },
    ],
  },
  {
    id: 'rewardsClaimed',
    name: 'Rewards Claimed',
    category: 'staking',
    triggerType: 'automatic',
    triggerDescription: '스테이킹 리워드 클레임 시 자동 발송',
    isSystemRequired: false,
    backendFunction: 'sendClaimRewardEmail',
    variables: [
      { name: 'txHash', description: '트랜잭션 해시', example: '0x1234...abcd', required: true },
    ],
  },

  // ========== REFERRAL ==========
  {
    id: 'referralSignup',
    name: 'Referral Signup Notification',
    category: 'referral',
    triggerType: 'automatic',
    triggerDescription: '레퍼럴 코드로 새 유저 가입 시 자동 발송',
    isSystemRequired: false,
    backendFunction: 'sendReferralSignupEmail',
    variables: [
      { name: 'newUserEmail', description: '신규 가입자 이메일 (마스킹)', example: 'u***@example.com', required: true },
      { name: 'totalReferrals', description: '총 레퍼럴 수', example: '5', required: true },
      { name: 'referralCode', description: '레퍼럴 코드', example: 'VCN-ABC123', required: true },
    ],
  },
  {
    id: 'referralReward',
    name: 'Referral Reward Earned',
    category: 'referral',
    triggerType: 'automatic',
    triggerDescription: '레퍼럴 보상 지급 시 자동 발송',
    isSystemRequired: false,
    backendFunction: 'sendReferralRewardEmail',
    variables: [
      { name: 'rewardAmount', description: '보상 수량 (VCN)', example: '500', required: true },
      { name: 'fromUser', description: '레퍼럴 사용자 (마스킹)', example: 'u***@example.com', required: true },
      { name: 'tier', description: '레퍼럴 레벨', example: 'Gold', required: false },
      { name: 'event', description: '보상 이벤트 유형', example: 'staking', required: false },
    ],
  },

  // ========== BRIDGE ==========
  {
    id: 'bridgeComplete',
    name: 'Bridge Transfer Completed',
    category: 'bridge',
    triggerType: 'automatic',
    triggerDescription: '크로스체인 브릿지 전송 완료 시 자동 발송',
    isSystemRequired: false,
    backendFunction: 'sendBridgeCompleteEmail',
    variables: [
      { name: 'amount', description: '전송 수량', example: '5,000 VCN', required: true },
      { name: 'sourceChain', description: '출발 체인', example: 'Ethereum', required: true },
      { name: 'destChain', description: '도착 체인', example: 'Vision Chain', required: true },
      { name: 'txHash', description: '트랜잭션 해시', example: '0x1234...abcd', required: true },
    ],
  },

  // ========== LIFECYCLE ==========
  {
    id: 'welcome',
    name: 'Welcome Email',
    category: 'lifecycle',
    triggerType: 'automatic',
    triggerDescription: '회원가입 완료 시 즉시 발송',
    isSystemRequired: false,
    backendFunction: 'sendWelcomeEmail',
    variables: [
      { name: 'email', description: '가입 이메일', example: 'user@example.com', required: true },
    ],
  },
  {
    id: 'walletCreated',
    name: 'Wallet Created',
    category: 'lifecycle',
    triggerType: 'automatic',
    triggerDescription: '지갑 생성 완료 시 즉시 발송',
    isSystemRequired: false,
    backendFunction: 'sendWalletCreatedEmail',
    variables: [
      { name: 'email', description: '사용자 이메일', example: 'user@example.com', required: true },
      { name: 'walletAddress', description: '생성된 지갑 주소', example: '0x6872...1d31', required: true },
    ],
  },
  {
    id: 'firstStakingGuide',
    name: 'First Staking Guide',
    category: 'lifecycle',
    triggerType: 'scheduled',
    triggerDescription: '가입 후 24시간 미활동 시 드립 발송',
    isSystemRequired: false,
    backendFunction: 'sendFirstStakingGuideEmail',
    variables: [],
  },
  {
    id: 'referralIntro',
    name: 'Referral Program Intro',
    category: 'lifecycle',
    triggerType: 'scheduled',
    triggerDescription: '가입 후 48시간 경과 시 드립 발송',
    isSystemRequired: false,
    backendFunction: 'sendReferralIntroEmail',
    variables: [
      { name: 'referralCode', description: '사용자 레퍼럴 코드', example: 'VCN-ABC123', required: false },
    ],
  },
  {
    id: 'inactivityNudge',
    name: 'Inactivity Nudge',
    category: 'lifecycle',
    triggerType: 'scheduled',
    triggerDescription: '7일간 미로그인 시 자동 발송',
    isSystemRequired: false,
    backendFunction: 'sendInactivityNudgeEmail',
    variables: [],
  },

  // ========== WEEKLY REPORT ==========
  {
    id: 'weeklyReport',
    name: 'Weekly Activity Report',
    category: 'weeklyReport',
    triggerType: 'scheduled',
    triggerDescription: '매주 월요일 09:00 KST 자동 발송',
    isSystemRequired: false,
    backendFunction: 'generateWeeklyReportEmailHtml',
    variables: [
      { name: 'weekRange', description: '주간 날짜 범위', example: 'Feb 3 - Feb 9, 2026', required: true },
      { name: 'walletAddress', description: '지갑 주소 (축약)', example: '0x6872...1d31', required: false },
      { name: 'vcnBalance', description: '현재 VCN 잔고', example: '12,500.00', required: false },
      { name: 'stakingActions', description: '스테이킹 횟수', example: '3', required: false },
      { name: 'bridgeTransfers', description: '브릿지 전송 횟수', example: '1', required: false },
      { name: 'newReferrals', description: '신규 레퍼럴 수', example: '2', required: false },
    ],
  },
];
```

---

## 5. UI/UX 상세 설계

### 5.1 Scenarios 탭 - 필터 & 카드 레이아웃

**카테고리 필터 바:**
- 가로 스크롤 가능한 칩(chip) 형태
- 각 칩에 해당 카테고리 색상 + 시나리오 개수 표시
- "All"은 전체 표시 (기본)

**시나리오 카드:**
각 시나리오는 다음 정보를 표시합니다:

| 요소 | 설명 |
|------|------|
| 이름 | 시나리오 제목 (굵은 흰색) |
| 카테고리 배지 | 색상 코드된 라벨 (SECURITY ALERTS, STAKING, ...) |
| 트리거 배지 | Automatic / Scheduled / Manual (회색 배지) |
| 트리거 설명 | "새 디바이스에서 로그인 시 자동 발송" (회색 텍스트) |
| 변수 목록 | `{{code}}, {{deviceInfo}}` (모노스페이스, 시안색) |
| 활성 토글 | ON/OFF 슬라이드 토글 (security는 잠금 아이콘) |
| Edit 버튼 | 템플릿 편집 모달 열기 |
| Test 버튼 | 이메일 주소 입력 팝오버 + 발송 |

### 5.2 시나리오 추가 흐름

```
[+ Add Scenario] 클릭
      |
      v
Step 1: 기본 정보 입력
  - 시나리오 이름
  - 설명
  - 카테고리 선택 (드롭다운)
  - 트리거 타입 (radio: Automatic / Scheduled / Manual)
  - 트리거 설명
      |
      v
Step 2: 변수 정의
  - 동적 행 추가/삭제
  - 각 행: Name, Description, Example, Required 체크
      |
      v
Step 3: 템플릿 작성
  - Subject Line (변수 삽입 가능)
  - Body HTML (변수 삽입 가능)
  - 오른쪽에 변수 참조 패널 표시
  - 하단에 라이브 미리보기
      |
      v
[Create] -> Firestore에 저장
```

**주의:** 새로 추가된 시나리오(Manual 타입)는 관리자가 수동으로 발송해야 합니다.
Automatic/Scheduled 타입은 백엔드 코드에 트리거 로직이 연결되어 있어야 실제로 발송됩니다.
-> UI에서 "이 시나리오는 백엔드 연동이 필요합니다" 경고 표시

### 5.3 편집 모달 (확장)

기존 편집 모달을 확장하여 시나리오 정보도 수정 가능하게 합니다:

```
+------------------------------------------------------------------+
| Edit: Device Verification                                    [X] |
|------------------------------------------------------------------|
| [Scenario Info]  [Template]  [Test Send]                         |
|------------------------------------------------------------------|
|                                                                  |
| << Scenario Info 탭 >>                                            |
|                                                                  |
| Name:        [Device Verification                ]               |
| Description: [Sent when user logs in from a new d]               |
| Category:    [Security       v]                                  |
| Trigger:     (x) Automatic  ( ) Scheduled  ( ) Manual           |
| Trigger Desc:[새 디바이스에서 로그인 시 자동 발송  ]               |
| Status:      [ACTIVE] (잠김 - security 카테고리)                  |
|                                                                  |
| Variables:                                                       |
| +------+------------------+----------+----------+               |
| | Name | Description      | Example  | Required |               |
| +------+------------------+----------+----------+               |
| | code | 6자리 인증 코드    | 847291   | [v]      |               |
| | deviceInfo | 기기 정보    | Chrome.. | [v]      |  [x 삭제]    |
| +------+------------------+----------+----------+               |
| [+ Add Variable]                                                 |
|                                                                  |
| << Template 탭 >>                                                 |
|  (기존 Subject / Body HTML / Preview 동일)                        |
|                                                                  |
| << Test Send 탭 >>                                                |
| Recipient Email: [admin@visionchain.co              ]            |
| [Send Test Email]                                                |
|                                                                  |
|                       [Cancel]  [Save Changes]                   |
+------------------------------------------------------------------+
```

---

## 6. 백엔드 연동 설계

### 6.1 기존 함수의 Firestore 우선 로직 (구현 완료)

```javascript
// 이미 구현된 패턴:
async function generateVerificationEmailHtml(code, deviceInfo) {
  const custom = await loadCustomTemplate("verification");
  if (custom) {
    const body = renderTemplate(custom.bodyHtml, { code, deviceInfo });
    const subject = renderTemplate(custom.subject, { code });
    return emailBaseLayout(body, subject);
  }
  // fallback: 하드코딩된 기본 템플릿
  const body = `...`;
  return emailBaseLayout(body, `Your verification code: ${code}`);
}
```

### 6.2 나머지 함수들에 Firestore 지원 추가 필요

현재 5개만 Firestore를 체크합니다. 나머지 12개도 동일한 패턴을 적용해야 합니다:

| 함수명 | Template ID | Firestore 지원 |
|--------|-------------|----------------|
| generateVerificationEmailHtml | verification | Done |
| generateSuspiciousActivityEmailHtml | suspicious | Done |
| generatePasswordResetEmailHtml | passwordReset | Done |
| generatePasswordChangedEmailHtml | passwordChanged | Done |
| generateWeeklyReportEmailHtml | weeklyReport | Done |
| sendStakingEmail | stakingConfirmed | **TODO** |
| sendUnstakeEmail | unstakingCooldown | **TODO** |
| sendClaimRewardEmail | rewardsClaimed | **TODO** |
| sendReferralSignupEmail | referralSignup | **TODO** |
| sendReferralRewardEmail | referralReward | **TODO** |
| sendBridgeCompleteEmail | bridgeComplete | **TODO** |
| sendWelcomeEmail | welcome | **TODO** |
| sendWalletCreatedEmail | walletCreated | **TODO** |
| sendFirstStakingGuideEmail | firstStakingGuide | **TODO** |
| sendReferralIntroEmail | referralIntro | **TODO** |
| sendInactivityNudgeEmail | inactivityNudge | **TODO** |
| (inline 2FA enabled) | 2faEnabled | **TODO** |
| (inline 2FA disabled) | 2faDisabled | **TODO** |

### 6.3 시나리오 활성/비활성 체크

모든 이메일 발송 함수에 활성 상태 체크를 추가합니다:

```javascript
async function isScenarioEnabled(templateId) {
  try {
    const doc = await db.collection("emailTemplates").doc(templateId).get();
    if (doc.exists && doc.data().enabled === false) {
      console.log(`[Email] Scenario "${templateId}" is disabled, skipping`);
      return false;
    }
    return true; // 기본값은 활성
  } catch (err) {
    return true; // 에러 시 안전하게 활성 처리
  }
}

// 사용 예시:
async function sendStakingEmail(email, data) {
  if (!await isScenarioEnabled('stakingConfirmed')) return;
  if (!await checkEmailOptIn(email, 'staking')) return;
  // ... 기존 로직
}
```

### 6.4 커스텀 시나리오 발송 API

관리자가 추가한 Manual 타입 시나리오를 발송할 수 있는 API:

```javascript
exports.sendCustomEmail = onRequest(async (req, res) => {
  // Admin 인증 확인
  // req.body: { templateId, recipients: string[], variables: {} }
  
  const template = await loadCustomTemplate(templateId);
  if (!template) return res.status(404).json({ error: "Template not found" });
  
  const body = renderTemplate(template.bodyHtml, variables);
  const subject = renderTemplate(template.subject, variables);
  const html = emailBaseLayout(body, subject);
  
  // 배치 발송
  const results = await Promise.allSettled(
    recipients.map(email => sendSecurityEmail(email, subject, html))
  );
  
  return res.json({ sent: results.filter(r => r.status === 'fulfilled').length });
});
```

---

## 7. 구현 우선순위

### Phase A: Scenarios 목록 + 전체 시나리오 표시 (P0)
1. `DEFAULT_TEMPLATES`를 전체 18개 시나리오로 확장
2. Scenarios 탭 UI 구현 (카테고리 필터, 카드 목록)
3. 활성/비활성 토글 + Firestore 저장
4. 편집 모달에 Scenario Info 탭 추가

### Phase B: 나머지 백엔드 함수 Firestore 연동 (P0)
1. 나머지 12개 send*Email 함수에 `loadCustomTemplate` 적용
2. `isScenarioEnabled` 체크 추가
3. Cloud Functions 재배포

### Phase C: 시나리오 추가 기능 (P1)
1. "Add Scenario" 모달 구현
2. 변수 동적 추가/삭제 UI
3. Firestore 저장 + 목록 갱신

### Phase D: Manual 발송 기능 (P2)
1. 수동 발송 API (`sendCustomEmail`)
2. 수신자 선택 UI (전체/카테고리별/개별)
3. 발송 이력 로깅

---

## 8. 데이터 이관 계획

현재 하드코딩된 템플릿을 Firestore `emailTemplates`에 초기 데이터로 저장하는 마이그레이션 스크립트:

```javascript
// 1회성 실행 스크립트
async function seedEmailTemplates() {
  for (const scenario of EMAIL_SCENARIO_REGISTRY) {
    const docRef = db.collection('emailTemplates').doc(scenario.id);
    const existing = await docRef.get();
    if (!existing.exists) {
      await docRef.set({
        name: scenario.name,
        description: scenario.description || '',
        category: scenario.category,
        triggerType: scenario.triggerType,
        triggerDescription: scenario.triggerDescription,
        variables: scenario.variables,
        enabled: true,
        isSystemRequired: scenario.isSystemRequired,
        createdAt: new Date().toISOString(),
        version: 0,
        // subject, bodyHtml는 저장하지 않음 -> 하드코딩 fallback 사용
      });
    }
  }
}
```

---

## 9. 제약사항 및 주의사항

| 항목 | 설명 |
|------|------|
| **Security 카테고리** | 활성/비활성 토글 잠금. UI에서 비활성화 불가 |
| **Automatic 트리거** | 백엔드 코드에 로직이 있어야 실제 발송됨. UI에서 추가해도 자동 연동되지 않음 |
| **변수 일관성** | 백엔드 함수가 전달하는 변수와 템플릿의 `{{variable}}`이 일치해야 함 |
| **Gmail 발송 한도** | 일 2,000건. 대량 발송 시 제한 고려 |
| **Cold Start** | Cloud Function 첫 호출 시 템플릿 로드에 ~200ms 추가 지연 |
| **HTML 호환성** | 이메일 클라이언트(Outlook, Gmail, Apple Mail)마다 HTML 렌더링이 다름. 인라인 스타일 필수 |
