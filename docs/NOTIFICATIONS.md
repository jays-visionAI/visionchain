# Vision Chain Notification System

> 사용자에게 실시간 알림을 제공하는 통합 알림 시스템 문서

## 개요

Vision Chain의 Notification 시스템은 다양한 트랜잭션 및 이벤트에 대해 사용자에게 실시간 알림을 제공합니다. 알림은 Firebase Firestore에 저장되며, UI에서 실시간으로 표시됩니다.

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                       알림 생성 소스                              │
├─────────────┬─────────────┬─────────────┬─────────────────────────┤
│  Frontend   │ Scheduler   │   Bridge    │    Cloud Functions      │
│  (Wallet)   │  Runner     │  Component  │    (Backend)            │
└──────┬──────┴──────┬──────┴──────┬──────┴───────────┬─────────────┘
       │             │             │                  │
       ▼             ▼             ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    createNotification()                          │
│              services/firebaseService.ts                         │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Firebase Firestore                             │
│           users/{email}/notifications/{id}                       │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                 WalletNotifications.tsx                          │
│              (실시간 구독 및 UI 표시)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Firestore 구조

### 경로
```
users/{userEmail}/notifications/{notificationId}
```

### 문서 스키마
```typescript
interface Notification {
    id: string;                    // Firestore 문서 ID
    type: NotificationType;        // 알림 유형
    title: string;                 // 알림 제목
    content: string;               // 알림 내용
    timestamp: Timestamp;          // 생성 시간
    read: boolean;                 // 읽음 여부
    data?: NotificationData;       // 추가 데이터
    category?: NotificationCategory;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    actionable?: boolean;          // 액션 버튼 표시 여부
}
```

---

## 알림 유형 (NotificationType)

### Transfer 관련
| 유형 | 설명 | 트리거 시점 |
|------|------|------------|
| `transfer_received` | 토큰 수신 알림 | 타인으로부터 토큰 수신 시 |
| `transfer_sent` | 토큰 전송 완료 알림 | 전송 성공 시 |
| `transfer_scheduled` | 예약 전송 알림 | 예약 전송 등록/실행 시 |

### Staking 관련
| 유형 | 설명 | 트리거 시점 |
|------|------|------------|
| `staking_deposit` | 스테이킹 예치 알림 | 스테이킹 시작 시 |
| `staking_withdrawal` | 스테이킹 출금 알림 | 언스테이킹 시 |
| `staking_pending` | 스테이킹 대기 알림 | 락업 기간 중 |
| `staking_reward` | 보상 수령 알림 | 보상 클레임 시 |

### TimeLock (예약 전송)
| 유형 | 설명 | 트리거 시점 |
|------|------|------------|
| `timelock_scheduled` | 예약 등록 알림 | 예약 전송 생성 시 |
| `timelock_executed` | 예약 실행 알림 | 예약 시간 도래 시 |
| `timelock_cancelled` | 예약 취소 알림 | 예약 취소 시 |

### Multi-send (다중 전송)
| 유형 | 설명 | 트리거 시점 |
|------|------|------------|
| `multi_send_start` | 배치 전송 시작 알림 | 다중 전송 시작 시 |
| `multi_send_complete` | 배치 전송 완료 알림 | 모든 전송 완료 시 |
| `multi_send_partial` | 부분 성공 알림 | 일부 전송 실패 시 |

### Bridge (크로스체인)
| 유형 | 설명 | 트리거 시점 |
|------|------|------------|
| `bridge_started` | 브릿지 시작 알림 | 브릿지 요청 시 |
| `bridge_pending` | 브릿지 대기 알림 | 검증 대기 중 |
| `bridge_completed` | 브릿지 완료 알림 | 목적 체인 도착 시 |
| `bridge_finalized` | 브릿지 확정 알림 | 최종 확정 시 |
| `challenge_raised` | 이의 제기 알림 | 검증자 이의 제기 시 |

### Referral & Level
| 유형 | 설명 | 트리거 시점 |
|------|------|------------|
| `referral_signup` | 추천 가입 알림 | 추천인 가입 시 |
| `referral_reward` | 추천 보상 알림 | 추천 보상 지급 시 |
| `level_up` | 레벨업 알림 | 사용자 레벨 상승 시 |

### Events & Prizes
| 유형 | 설명 | 트리거 시점 |
|------|------|------------|
| `event_participation` | 이벤트 참여 알림 | 이벤트 참여 시 |
| `event_result` | 이벤트 결과 알림 | 이벤트 종료 시 |
| `prize_winner` | 당첨 알림 | 경품 당첨 시 |
| `ranking_update` | 순위 변동 알림 | 랭킹 변경 시 |

### System
| 유형 | 설명 | 트리거 시점 |
|------|------|------------|
| `system_announcement` | 시스템 공지 | 관리자 공지 시 |
| `system_notice` | 일반 알림 | 시스템 알림 시 |
| `security_alert` | 보안 경고 | 보안 이슈 감지 시 |
| `alert` | 일반 경고 | 오류/경고 발생 시 |

---

## 알림 생성 API

### Frontend (firebaseService.ts)

```typescript
import { createNotification } from '@/services/firebaseService';

await createNotification(userEmail, {
    type: 'transfer_received',
    title: 'Token Received',
    content: 'You received 100 VCN from alice@example.com',
    data: {
        txHash: '0x...',
        amount: '100',
        token: 'VCN',
        from: '0x...'
    }
});
```

### Backend (Cloud Functions)

```javascript
const { createBridgeNotification } = require('./index');

await createBridgeNotification(userEmail, {
    type: 'bridge_completed',
    title: 'Bridge Completed',
    content: '100 VCN has been successfully bridged to Sepolia.',
    data: {
        txHash: '0x...',
        amount: '100',
        destinationChain: 'sepolia'
    }
});
```

---

## 트랜잭션별 알림 플로우

### 1. Time Lock (예약 전송)

```
1. 사용자가 예약 전송 생성
   └─ [선택적] timelock_scheduled 알림

2. 예약 시간 도래 → Scheduler Runner 실행
   └─ 발신자에게 transfer_scheduled 알림 (TimeLock Executing)

3. 전송 완료
   ├─ 발신자: transfer_scheduled 알림 (Complete)
   └─ 수신자: transfer_received 알림

4. 전송 실패 (최대 재시도 후)
   └─ 발신자: alert 알림 (Failed)
```

**코드 위치:** `services/schedulerRunner.ts`

### 2. Multi-send (다중 전송)

```
1. 배치 전송 시작
   └─ 발신자: multi_send_start 알림

2. 각 전송 완료
   └─ 각 수신자: transfer_received 알림

3. 전체 완료
   └─ 발신자: multi_send_complete 또는 multi_send_partial 알림
```

**코드 위치:** `components/Wallet.tsx` (handleBatchAgent 함수)

### 3. Bridge (크로스체인)

```
1. 브릿지 요청
   └─ 발신자: transfer_received 알림 (Bridge Request Started)

2. 브릿지 실패 시
   └─ 발신자: alert 알림

3. 브릿지 완료 (Cloud Functions)
   └─ 발신자: bridge_completed 알림
```

**코드 위치:** 
- Frontend: `components/Bridge.tsx`
- Backend: `functions/index.js` (bridgeCompletionChecker)

---

## UI 컴포넌트

### WalletNotifications.tsx

알림을 표시하는 메인 UI 컴포넌트입니다.

**기능:**
- 실시간 Firebase 구독
- 알림 목록 표시 (페이지네이션)
- 읽음/안읽음 필터
- 알림 상세 보기
- 전체 읽음 표시
- 전체 삭제

**경로:** `components/wallet/WalletNotifications.tsx`

### 아이콘 매핑

각 알림 유형별로 고유한 아이콘과 색상이 지정됩니다:

```typescript
// 예시
case 'transfer_received':
    return { icon: ArrowDownLeft, color: 'text-green-400', bg: 'bg-green-400/10' };
case 'multi_send_complete':
    return { icon: Send, color: 'text-cyan-400', bg: 'bg-cyan-400/10' };
case 'alert':
    return { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-400/10' };
```

---

## 설정 및 환경

### 필수 환경 변수

알림 시스템은 Firebase 설정에 의존합니다:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

### Firebase Security Rules

```javascript
match /users/{email}/notifications/{notificationId} {
    allow read, write: if request.auth != null 
        && request.auth.token.email.lower() == email.lower();
}
```

---

## 확장 가이드

### 새 알림 유형 추가

1. **타입 정의 추가**
   ```typescript
   // services/firebaseService.ts
   export interface NotificationData {
       type: 
           // ... 기존 타입들
           | 'new_notification_type'
       // ...
   }
   ```

2. **UI 아이콘 매핑 추가**
   ```typescript
   // components/wallet/WalletNotifications.tsx
   case 'new_notification_type':
       return { icon: IconComponent, color: 'text-xxx-400', bg: 'bg-xxx-400/10', label: 'Label' };
   ```

3. **알림 생성 코드 추가**
   ```typescript
   await createNotification(email, {
       type: 'new_notification_type',
       title: 'Title',
       content: 'Content',
       data: { /* additional data */ }
   });
   ```

---

## 트러블슈팅

### 알림이 표시되지 않음

1. Firebase 연결 확인
2. 사용자 이메일이 올바른지 확인 (소문자로 저장됨)
3. 브라우저 콘솔에서 에러 확인

### 알림이 중복 생성됨

1. 알림 생성 코드가 중복 호출되는지 확인
2. useEffect 의존성 배열 확인

### Cloud Functions 알림 미도착

1. Cloud Functions 로그 확인
2. `findEmailByAddress` 함수가 올바른 이메일을 반환하는지 확인

---

## 관련 파일

| 파일 | 설명 |
|------|------|
| `services/firebaseService.ts` | 알림 생성 API |
| `services/schedulerRunner.ts` | Time Lock 알림 |
| `components/Wallet.tsx` | Multi-send 알림 |
| `components/Bridge.tsx` | Bridge 알림 |
| `components/wallet/WalletNotifications.tsx` | 알림 UI |
| `functions/index.js` | Cloud Functions 알림 |

---

## 버전 히스토리

| 버전 | 날짜 | 변경 사항 |
|------|------|----------|
| 1.0.0 | 2026-02-08 | 초기 문서 작성 |
| 1.1.0 | 2026-02-08 | Time Lock, Multi-send, Bridge 알림 추가 |

---

*Last Updated: 2026-02-08*
