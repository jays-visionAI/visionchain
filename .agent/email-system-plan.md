# Vision Chain 이메일 시스템 기획서

> 최종 업데이트: 2026-02-09
> 파일 위치: `functions/index.js`
> 이메일 인프라: Nodemailer + Gmail SMTP (jays@visai.io)

---

## 1. 현재 구현된 이메일 (5종)

| # | 이메일 종류 | 함수명 | 위치 (line) | 발송 시점 | 상태 |
|---|-----------|--------|------------|----------|------|
| 1 | 디바이스 인증 코드 | `generateVerificationEmailHtml()` | ~177 | 새 디바이스에서 로그인 시도 시 | 구현 완료 |
| 2 | 의심스러운 활동 경고 | `generateSuspiciousActivityEmailHtml()` | ~367 | IP 이상 감지 시 | 구현 완료 |
| 3 | 2FA 활성화 확인 | (인라인) | ~2562 | TOTP 2FA 설정 완료 시 | 구현 완료 |
| 4 | 2FA 비활성화 알림 | (인라인) | ~2773 | TOTP 2FA 해제 시 | 구현 완료 |
| 5 | 브릿지 전송 완료 | `sendBridgeCompleteEmail()` | ~3392 | 브릿지 릴레이 완료 시 (sender + recipient) | 구현 완료 |

### 수정 방법
- **모든 이메일은** `functions/index.js` 파일에서 관리됩니다
- **공통 레이아웃**: `emailBaseLayout()` 함수 (header, footer, dark theme)
- **재사용 컴포넌트**: `emailComponents` 객체 (sectionTitle, infoCard, button, alertBox, chainRoute 등)
- **발송 함수**: `sendSecurityEmail(to, subject, htmlContent)` - 모든 이메일의 최종 발송 처리

---

## 2. 신규 구현 필요 이메일

### Category A: 레퍼럴 관련 (2종)

#### A-1. 피추천인 가입 알림 (추천인에게)
- **발송 대상**: 추천인 (referrer)
- **발송 시점**: 피추천인이 레퍼럴 코드를 사용하여 가입 완료 시
- **구현 위치**: `firebaseService.ts` > `userRegister()` 함수 (~line 1374)
  - 현재: referralCount 증가, contacts 추가는 하지만 **이메일 미발송**
  - 변경: Cloud Function `onUserRegistered` 트리거 또는 `userRegister` 내에서 직접 호출
- **이메일 내용**:
  - 제목: "Vision Chain - New Referral Signup"
  - 새 피추천인 이름/이메일
  - 현재 총 피추천인 수
  - 레퍼럴 보상 내역 (RP 등)
  - 레퍼럴 링크 공유 CTA 버튼

#### A-2. 레퍼럴 보상 지급 알림
- **발송 대상**: 추천인 (1차 + 2차)
- **발송 시점**: 피추천인의 활동으로 레퍼럴 보상 발생 시
- **구현 위치**: `firebaseService.ts` > `distributeReferralReward()` (~line 521)
  - 현재: RP/VCN 보상은 분배하지만 **이메일 미발송**
- **이메일 내용**:
  - 보상 금액 및 종류 (VCN/RP)
  - 발생 원인 (피추천인 활동 내용)
  - 누적 보상 총액

### Category B: 스테이킹 관련 (4종)

#### B-1. 스테이킹 완료 알림
- **발송 대상**: 스테이커
- **발송 시점**: `handleStaking()` > `case "stake"` 성공 후
- **구현 위치**: `functions/index.js` > `handleStaking()` (~line 1251)
- **이메일 내용**:
  - 스테이킹 금액
  - 현재 총 스테이킹 잔액
  - 예상 연간 이자율 (APY)
  - VisionScan 링크

#### B-2. 이자 인출(Claim) 완료 알림
- **발송 대상**: 스테이커
- **발송 시점**: `handleStaking()` > `case "claim"` 성공 후
- **구현 위치**: `functions/index.js` > `handleStaking()` (~line 1330+)
- **이메일 내용**:
  - 인출된 이자 금액
  - 현재 남은 스테이킹 잔액
  - 다음 이자 발생 예상 시점
  - 거래 해시 + Explorer 링크

#### B-3. 언스테이킹 요청 + 쿨다운 안내
- **발송 대상**: 스테이커
- **발송 시점**: `handleStaking()` > `case "unstake"` 성공 후
- **구현 위치**: `functions/index.js` > `handleStaking()` (~line 1310+)
- **이메일 내용**:
  - 언스테이킹 요청 금액
  - 쿨다운 기간 안내 (예: 7일)
  - 쿨다운 종료 예정 일시
  - 쿨다운 완료 후 출금 방법 안내

#### B-4. 쿨다운 완료 → 출금 가능 안내
- **발송 대상**: 스테이커
- **발송 시점**: 쿨다운 기간 종료 시 (스케줄 함수로 체크)
- **구현 위치**: 신규 Cloud Function `checkStakingCooldowns` (매 시간 실행)
- **이메일 내용**:
  - 출금 가능한 금액
  - 출금 방법 안내
  - 지갑 바로가기 CTA 버튼

### Category C: 주간 활동 리포트 (1종)

#### C-1. Weekly Activity Report
- **발송 대상**: 모든 활성 사용자
- **발송 시점**: 매주 월요일 오전 9시 (KST) - 스케줄 함수
- **구현 위치**: 신규 Cloud Function `weeklyActivityReport` (onSchedule)
- **이메일 내용**:

```
┌─────────────────────────────────────────────┐
│  Vision Chain Weekly Report                 │
│  2026.02.03 ~ 2026.02.09                    │
├─────────────────────────────────────────────┤
│                                             │
│  [자산 현황 요약]                             │
│  총 자산: 12,500.00 VCN                      │
│  전주 대비: +350.00 VCN (+2.8%)              │
│                                             │
│  [거래 활동]                                  │
│  전송: 3건 (1,200 VCN)                       │
│  수신: 2건 (800 VCN)                         │
│  브릿지: 1건 (500 VCN → Sepolia)             │
│                                             │
│  [스테이킹]                                   │
│  스테이킹 잔액: 5,000 VCN                     │
│  이번 주 이자 수익: +12.5 VCN                 │
│  APY: 13.0%                                  │
│                                             │
│  [노드 채굴 현황]                              │
│  운영 노드: 2대                               │
│  이번 주 채굴량: 45.2 VCN                     │
│  총 누적 채굴량: 1,230.5 VCN                  │
│  노드 가동률: 99.8%                           │
│                                             │
│  [추천 프로그램]                               │
│  나의 등급: Gold                              │
│  총 피추천인: 12명                            │
│  이번 주 신규 피추천인: 2명                    │
│  피추천인 활동 보상: +8.5 VCN (RP + Commission)│
│                                             │
│  [View Full Dashboard] 버튼                  │
│                                             │
└─────────────────────────────────────────────┘
```

**데이터 소스:**

| 섹션 | Firestore 컬렉션 | 필드 |
|------|-----------------|------|
| 자산 현황 | `users/{email}` | `walletAddress` → on-chain balance |
| 거래 활동 | `transactions` | `from_addr`, `to_addr`, `value`, `type`, `timestamp` |
| 스테이킹 | BridgeStaking 컨트랙트 | `getStake()`, `earned()` |
| 노드 채굴 | `node_mining_rewards` or 컨트랙트 | 노드별 채굴 기록 |
| 추천 프로그램 | `users/{email}` | `referralCount`, `tier`, `referralRP` |
| 추천 보상 | `referral_rewards` | `amount`, `type`, `timestamp` |

---

## 3. 구현 우선순위

### Phase 1 (이번 스프린트) - 즉시 발송 이메일
1. **B-1** 스테이킹 완료 알림
2. **B-2** 이자 인출 완료 알림
3. **B-3** 언스테이킹 + 쿨다운 안내
4. **A-1** 피추천인 가입 알림

### Phase 2 (다음 스프린트) - 이벤트 기반
5. **A-2** 레퍼럴 보상 지급 알림
6. **B-4** 쿨다운 완료 출금 가능 안내 (스케줄)

### Phase 3 (이후) - 집계 리포트
7. **C-1** 주간 활동 리포트 (스케줄 함수 + 데이터 집계)

---

## 4. 기술 구현 방식

### 이벤트 기반 이메일 (Phase 1-2)
```
[사용자 액션] → [Cloud Function] → [sendSecurityEmail()] → [Gmail SMTP]
                                          ↓
                                   emailBaseLayout()
                                   emailComponents.*
```

- `handleStaking()` 함수 내에서 각 case 성공 후 바로 이메일 발송
- `userRegister()` 완료 시 referrer에게 이메일 발송 (Cloud Function 호출)

### 스케줄 기반 이메일 (Phase 2-3)
```
[Cloud Scheduler] → [onSchedule Function] → [Firestore Query] → [이메일 생성] → [발송]
```

- `checkStakingCooldowns`: 매 시간 실행, 쿨다운 만료된 사용자에게 알림
- `weeklyActivityReport`: 매주 월요일 09:00 KST 실행, 전체 사용자 대상

### 이메일 수신 거부 (Unsubscribe)
- `users/{email}` 문서에 `emailPreferences` 필드 추가:
  ```json
  {
    "emailPreferences": {
      "security": true,       // 보안 알림 (필수, 해제 불가)
      "transactions": true,   // 거래 알림
      "staking": true,        // 스테이킹 알림
      "referral": true,       // 추천 프로그램 알림
      "weeklyReport": true    // 주간 리포트
    }
  }
  ```

---

## 5. 이메일 템플릿 컴포넌트 레퍼런스

### 현재 사용 가능한 컴포넌트 (`functions/index.js`)

| 컴포넌트 | 용도 | 사용 예 |
|---------|------|--------|
| `emailBaseLayout(body, preview)` | 전체 레이아웃 래퍼 | 모든 이메일의 최외곽 |
| `emailComponents.sectionTitle(text)` | 제목 (h2) | "Bridge Transfer Complete" |
| `emailComponents.subtitle(text)` | 설명 텍스트 | 회색 본문 |
| `emailComponents.infoCard(rows)` | 키-값 테이블 | Amount: 100 VCN |
| `emailComponents.codeBox(value)` | 강조 코드 박스 | 인증 코드 표시 |
| `emailComponents.button(text, url)` | CTA 버튼 | "View on Explorer" |
| `emailComponents.alertBox(text, type)` | 알림 박스 (success/warning/info) | 경고 메시지 |
| `emailComponents.chainRoute(from, to)` | 체인 라우팅 시각화 | Vision → Sepolia |
| `emailComponents.statusBadge(text, type)` | 상태 뱃지 | "Delivered" |
| `emailComponents.divider()` | 구분선 | 섹션 구분 |
| `emailComponents.monoText(text)` | 모노스페이스 텍스트 | 해시, 주소 표시 |

### 새 이메일 작성 패턴
```javascript
async function sendXxxEmail(email, data) {
  const body = `
    ${emailComponents.sectionTitle("제목")}
    ${emailComponents.subtitle("설명")}
    ${emailComponents.infoCard([
      ["Label", "Value", true],  // true = accent color
    ])}
    ${emailComponents.button("CTA Text", "https://...")}
  `;
  await sendSecurityEmail(email, "Vision Chain - Subject", emailBaseLayout(body, "Preview text"));
}
```

---

## 6. 환경 변수

| 변수명 | 용도 | 설정 방법 |
|--------|------|----------|
| `EMAIL_USER` | 발신자 이메일 (jays@visai.io) | `firebase functions:secrets:set EMAIL_USER` |
| `EMAIL_APP_PASSWORD` | Gmail App Password | `firebase functions:secrets:set EMAIL_APP_PASSWORD` |

**중요**: Cloud Function 선언 시 `secrets` 배열에 반드시 포함해야 함:
```javascript
exports.myFunction = onSchedule({
  schedule: "...",
  secrets: ["EMAIL_USER", "EMAIL_APP_PASSWORD"],
}, async () => { ... });
```
