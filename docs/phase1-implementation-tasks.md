# Phase 1: AI 포트폴리오 어드바이저 - 작업지시서

> 작성일: 2026-02-10
> 예상 기간: 6~7주 (Sprint 1~6)
> 기술 스택: SolidJS + TypeScript (Frontend) / Firebase Cloud Functions (Backend) / Firestore (DB)
> 선행 조건: 업비트/빗썸 개발자 계정 및 API Key 발급

---

## 아키텍처 개요

```
[Frontend - SolidJS]                    [Backend - Cloud Functions]
                                        
WalletSidebar                           cexProxy (onCall)
  └─ "CEX Portfolio" 메뉴 추가             ├─ registerCexApiKey
                                         ├─ deleteCexApiKey
WalletCexPortfolio.tsx (신규)             ├─ syncCexPortfolio
  ├─ API Key 등록 UI                      ├─ getCexPortfolioSnapshot
  ├─ 포트폴리오 대시보드                     └─ analyzeCexPortfolio (AI)
  ├─ AI 분석 리포트                        
  └─ 알림 설정                           cexService.ts (Cloud Functions 내부)
                                          ├─ UpbitClient
WalletDashboard.tsx (기존)                ├─ BithumbClient
  └─ AI Tool 추가: get_cex_portfolio     └─ PortfolioAggregator
                                        
services/cexService.ts (신규 - FE)      Firestore Schema
  └─ Cloud Function 호출 래퍼             ├─ /users/{uid}/cex_credentials/{id}
                                         ├─ /users/{uid}/cex_snapshots/{id}
services/ai/tools.ts (수정)               └─ /config/cex_settings
  └─ get_cex_portfolio tool 추가         
```

---

## Sprint 1: API Key 암호화 저장 인프라 (Week 1)

### Task 1.1: Firestore 스키마 설계 및 보안 규칙

**파일**: `firestore.rules` (수정), `firestore.indexes.json` (수정)

**작업 내용**:
- `/users/{uid}/cex_credentials/{credentialId}` 컬렉션 보안 규칙 추가
- `/users/{uid}/cex_snapshots/{snapshotId}` 컬렉션 보안 규칙 추가
- 사용자 본인만 읽기 가능, **쓰기는 Cloud Functions만 가능** (admin SDK)

**Firestore 문서 구조**:
```typescript
// /users/{uid}/cex_credentials/{credentialId}
{
  exchange: 'upbit' | 'bithumb',
  // 아래는 Cloud Functions에서 AES-256-GCM으로 암호화하여 저장
  encryptedAccessKey: string,   // 암호화된 Access Key
  encryptedSecretKey: string,   // 암호화된 Secret Key
  iv: string,                   // 초기화 벡터
  authTag: string,              // 인증 태그
  // 메타데이터 (평문)
  label: string,                // 사용자 지정 라벨 (예: "내 업비트")
  permissions: ['balance'],     // 부여된 권한 (balance만 허용)
  status: 'active' | 'validating' | 'expired' | 'error',
  statusMessage: string,        // 에러 시 메시지
  registeredAt: Timestamp,
  lastSyncAt: Timestamp | null,
  lastSyncStatus: 'success' | 'error' | null,
}

// /users/{uid}/cex_snapshots/{snapshotId}
{
  exchange: 'upbit' | 'bithumb',
  credentialId: string,         // 참조
  assets: [{
    currency: string,           // "BTC"
    balance: number,            // 보유 수량
    locked: number,             // 주문 잠금 수량
    avgBuyPrice: number,        // 평균 매수가 (KRW)
    currentPrice: number,       // 현재가 (KRW)
    currentPriceUsd: number,    // 현재가 (USD)
    valueKrw: number,           // 평가금 (KRW)
    valueUsd: number,           // 평가금 (USD)
    profitLoss: number,         // 손익 (KRW)
    profitLossPercent: number,  // 손익률 (%)
    allocationPercent: number,  // 비중 (%)
  }],
  totalValueKrw: number,
  totalValueUsd: number,
  totalProfitLoss: number,
  totalProfitLossPercent: number,
  snapshotAt: Timestamp,
  syncDurationMs: number,
}

// /config/cex_settings (Admin 전용)
{
  encryptionKeyVersion: number, // 암호화 키 버전
  syncIntervalMinutes: number,  // 자동 동기화 주기 (default: 30)
  supportedExchanges: ['upbit', 'bithumb'],
  maxCredentialsPerUser: number, // 사용자당 최대 API Key 수 (default: 4)
  rateLimits: {
    upbit: { perSecond: 5, perMinute: 100 },
    bithumb: { perSecond: 10, perMinute: 200 },
  }
}
```

**완료 조건**:
- Firestore Rules에 cex_credentials, cex_snapshots 규칙 반영
- cex_credentials는 클라이언트에서 직접 write 불가 (Cloud Functions admin만)
- cex_snapshots는 클라이언트에서 read만 가능

---

### Task 1.2: Cloud Functions - API Key 암호화/복호화 유틸리티

**파일**: `functions/index.js` (`serverEncrypt` / `serverDecrypt` 기존 패턴 활용)

**작업 내용**:
- 기존 `serverEncrypt` / `serverDecrypt` 패턴에 맞춰 CEX API Key 전용 암호화 함수 추가
- 환경 변수 `CEX_ENCRYPTION_KEY` 사용 (기존 `WALLET_ENCRYPTION_KEY`와 별도 관리)

**구현 코드 스켈레톤**:
```javascript
// CEX API Key 전용 암호화 키 (서버 환경 변수)
const CEX_ENCRYPTION_KEY = process.env.CEX_ENCRYPTION_KEY || 
  "vcn-cex-key-2026-very-secure-32b";

function cexEncrypt(plainText) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm', 
    Buffer.from(CEX_ENCRYPTION_KEY, 'utf-8'), 
    iv
  );
  let encrypted = cipher.update(plainText, 'utf-8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag,
  };
}

function cexDecrypt(encryptedData, ivBase64, authTagBase64) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(CEX_ENCRYPTION_KEY, 'utf-8'),
    Buffer.from(ivBase64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));
  let decrypted = decipher.update(encryptedData, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}
```

**완료 조건**:
- `cexEncrypt()` / `cexDecrypt()` 함수가 functions/index.js에 추가
- 단위 테스트: 암호화 -> 복호화 시 원본 값 일치 확인

---

### Task 1.3: Cloud Functions - API Key 등록/삭제/목록 조회

**파일**: `functions/index.js`

**작업 내용**: 3개의 onCall Cloud Functions 추가

#### 1.3.1 `registerCexApiKey`
```javascript
exports.registerCexApiKey = onCall({ 
  region: "asia-northeast3",
  secrets: ["CEX_ENCRYPTION_KEY"]
}, async (request) => {
  // 1. 인증 확인
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');
  const uid = request.auth.uid;
  
  // 2. 입력 검증
  const { exchange, accessKey, secretKey, label } = request.data;
  if (!['upbit', 'bithumb'].includes(exchange)) 
    throw new HttpsError('invalid-argument', 'Unsupported exchange.');
  if (!accessKey || !secretKey) 
    throw new HttpsError('invalid-argument', 'API Keys required.');
  
  // 3. 등록 개수 제한 확인 (최대 4개)
  const existing = await admin.firestore()
    .collection(`users/${uid}/cex_credentials`).get();
  if (existing.size >= 4) 
    throw new HttpsError('resource-exhausted', 'Max 4 API keys allowed.');
  
  // 4. API Key 유효성 검증 (실제 거래소에 잔고 조회 시도)
  const isValid = await validateCexApiKey(exchange, accessKey, secretKey);
  if (!isValid.success) 
    throw new HttpsError('invalid-argument', `API Key validation failed: ${isValid.error}`);
  
  // 5. 암호화 후 저장
  const encAccess = cexEncrypt(accessKey);
  const encSecret = cexEncrypt(secretKey);
  
  const docRef = await admin.firestore()
    .collection(`users/${uid}/cex_credentials`).add({
      exchange,
      encryptedAccessKey: encAccess.encrypted,
      accessKeyIv: encAccess.iv,
      accessKeyAuthTag: encAccess.authTag,
      encryptedSecretKey: encSecret.encrypted,
      secretKeyIv: encSecret.iv,
      secretKeyAuthTag: encSecret.authTag,
      label: label || `My ${exchange}`,
      permissions: ['balance'],
      status: 'active',
      statusMessage: '',
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSyncAt: null,
      lastSyncStatus: null,
    });
  
  return { 
    success: true, 
    credentialId: docRef.id,
    exchange,
    label: label || `My ${exchange}`,
  };
});
```

#### 1.3.2 `deleteCexApiKey`
```javascript
exports.deleteCexApiKey = onCall({
  region: "asia-northeast3"
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');
  const uid = request.auth.uid;
  const { credentialId } = request.data;
  
  // 해당 credential 삭제
  await admin.firestore()
    .doc(`users/${uid}/cex_credentials/${credentialId}`).delete();
  
  // 관련 스냅샷도 삭제
  const snapshots = await admin.firestore()
    .collection(`users/${uid}/cex_snapshots`)
    .where('credentialId', '==', credentialId).get();
  const batch = admin.firestore().batch();
  snapshots.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  return { success: true };
});
```

#### 1.3.3 `listCexApiKeys`
```javascript
exports.listCexApiKeys = onCall({
  region: "asia-northeast3"
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');
  const uid = request.auth.uid;
  
  const snapshot = await admin.firestore()
    .collection(`users/${uid}/cex_credentials`)
    .orderBy('registeredAt', 'desc').get();
  
  // API Key 원본은 절대 반환하지 않음!
  return snapshot.docs.map(doc => ({
    id: doc.id,
    exchange: doc.data().exchange,
    label: doc.data().label,
    status: doc.data().status,
    statusMessage: doc.data().statusMessage,
    lastSyncAt: doc.data().lastSyncAt?.toDate?.()?.toISOString() || null,
    lastSyncStatus: doc.data().lastSyncStatus,
    registeredAt: doc.data().registeredAt?.toDate?.()?.toISOString() || null,
  }));
});
```

**완료 조건**:
- 3개 Cloud Functions 배포 완료
- API Key 등록 시 유효성 검증 통과 후 암호화 저장
- 목록 조회 시 원본 Key 절대 노출 안 됨
- 삭제 시 credentials + snapshots 모두 정리

---

## Sprint 2: CEX API 프록시 (Week 2)

### Task 2.1: 업비트 API 클라이언트 (Cloud Functions 내부)

**파일**: `functions/index.js` (또는 `functions/cex/upbit.js`로 분리 가능)

**작업 내용**: 업비트 REST API 호출 래퍼 구현

```javascript
// JWT 라이브러리 필요: functions/package.json에 jsonwebtoken 추가
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

class UpbitClient {
  constructor(accessKey, secretKey) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.baseUrl = 'https://api.upbit.com/v1';
  }
  
  // JWT 토큰 생성
  _generateToken(queryString = null) {
    const payload = {
      access_key: this.accessKey,
      nonce: uuidv4(),
      timestamp: Date.now(),
    };
    if (queryString) {
      const queryHash = crypto.createHash('sha512')
        .update(queryString, 'utf-8').digest('hex');
      payload.query_hash = queryHash;
      payload.query_hash_alg = 'SHA512';
    }
    return jwt.sign(payload, this.secretKey);
  }
  
  // 계정 잔고 조회
  async getAccounts() {
    const token = this._generateToken();
    const response = await axios.get(`${this.baseUrl}/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    return response.data; 
    // 반환 형태: [{ currency, balance, locked, avg_buy_price, ... }]
  }
  
  // 현재가 조회 (여러 마켓 한 번에)
  async getTickers(markets) {
    // markets: ["KRW-BTC", "KRW-ETH", ...]
    const query = `markets=${markets.join(',')}`;
    const response = await axios.get(
      `${this.baseUrl}/ticker?${query}`,
      { timeout: 10000 }
    );
    return response.data;
    // 반환 형태: [{ market, trade_price, signed_change_rate, ... }]
  }
  
  // 마켓 코드 조회
  async getMarkets() {
    const response = await axios.get(
      `${this.baseUrl}/market/all`,
      { timeout: 10000 }
    );
    return response.data;
  }
}
```

**완료 조건**:
- `UpbitClient.getAccounts()` 호출 시 잔고 배열 반환
- `UpbitClient.getTickers()` 호출 시 현재가 배열 반환
- Rate Limit 초과 시 429 에러 핸들링
- 네트워크 타임아웃 10초 설정

---

### Task 2.2: 빗썸 API 클라이언트 (Cloud Functions 내부)

**파일**: `functions/index.js`

**작업 내용**: 빗썸 REST API v2 호출 래퍼 구현

```javascript
class BithumbClient {
  constructor(accessKey, secretKey) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.baseUrl = 'https://api.bithumb.com';
  }
  
  // JWT 토큰 생성 (빗썸 v2)
  _generateToken() {
    const payload = {
      access_key: this.accessKey,
      nonce: uuidv4(),
      timestamp: Date.now(),
    };
    return jwt.sign(payload, this.secretKey);
  }
  
  // 전체 계좌 조회 (API 2.0)
  async getAccounts() {
    const token = this._generateToken();
    const response = await axios.get(
      `${this.baseUrl}/v2/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    return response.data;
  }
  
  // 현재가 조회
  async getTickers(markets) {
    const query = `markets=${markets.join(',')}`;
    const response = await axios.get(
      `${this.baseUrl}/v2/ticker?${query}`,
      { timeout: 10000 }
    );
    return response.data;
  }
}
```

**완료 조건**:
- 빗썸 API 2.0 전체 계좌 조회 성공
- 현재가 조회 성공
- 에러 핸들링 (인증 실패, Rate Limit 등)

---

### Task 2.3: Cloud Function - 포트폴리오 동기화 (`syncCexPortfolio`)

**파일**: `functions/index.js`

**작업 내용**: 사용자의 CEX 잔고를 가져와서 Firestore 스냅샷으로 저장

```javascript
exports.syncCexPortfolio = onCall({
  region: "asia-northeast3",
  secrets: ["CEX_ENCRYPTION_KEY"],
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');
  const uid = request.auth.uid;
  const { credentialId } = request.data;
  
  // 1. credential 복호화
  const credDoc = await admin.firestore()
    .doc(`users/${uid}/cex_credentials/${credentialId}`).get();
  if (!credDoc.exists) throw new HttpsError('not-found', 'Credential not found.');
  const cred = credDoc.data();
  
  const accessKey = cexDecrypt(
    cred.encryptedAccessKey, cred.accessKeyIv, cred.accessKeyAuthTag
  );
  const secretKey = cexDecrypt(
    cred.encryptedSecretKey, cred.secretKeyIv, cred.secretKeyAuthTag
  );
  
  // 2. 거래소 클라이언트 생성
  const client = cred.exchange === 'upbit' 
    ? new UpbitClient(accessKey, secretKey)
    : new BithumbClient(accessKey, secretKey);
  
  const startTime = Date.now();
  
  try {
    // 3. 잔고 조회
    const accounts = await client.getAccounts();
    
    // 4. 잔고가 있는 자산만 필터 (KRW 포함)
    const nonZeroAssets = accounts.filter(a => 
      parseFloat(a.balance) > 0 || parseFloat(a.locked) > 0
    );
    
    // 5. 현재가 조회 (KRW 마켓 기준)
    const markets = nonZeroAssets
      .filter(a => a.currency !== 'KRW')
      .map(a => `KRW-${a.currency}`);
    
    let tickers = [];
    if (markets.length > 0) {
      tickers = await client.getTickers(markets);
    }
    const tickerMap = {};
    tickers.forEach(t => {
      const currency = t.market.replace('KRW-', '');
      tickerMap[currency] = t;
    });
    
    // 6. USD/KRW 환율 (간단한 고정값 또는 외부 API)
    const usdKrwRate = 1350; // TODO: 실시간 환율 API 연동
    
    // 7. 포트폴리오 집계
    let totalValueKrw = 0;
    const assets = nonZeroAssets.map(a => {
      const balance = parseFloat(a.balance);
      const locked = parseFloat(a.locked);
      const avgBuyPrice = parseFloat(a.avg_buy_price || '0');
      
      let currentPriceKrw = 0;
      if (a.currency === 'KRW') {
        currentPriceKrw = 1;
      } else if (tickerMap[a.currency]) {
        currentPriceKrw = tickerMap[a.currency].trade_price;
      }
      
      const totalBalance = balance + locked;
      const valueKrw = totalBalance * currentPriceKrw;
      const valueUsd = valueKrw / usdKrwRate;
      const costBasis = totalBalance * avgBuyPrice;
      const profitLoss = valueKrw - costBasis;
      const profitLossPercent = costBasis > 0 
        ? ((valueKrw - costBasis) / costBasis) * 100 : 0;
      
      totalValueKrw += valueKrw;
      
      return {
        currency: a.currency,
        balance: totalBalance,
        locked,
        avgBuyPrice,
        currentPrice: currentPriceKrw,
        currentPriceUsd: currentPriceKrw / usdKrwRate,
        valueKrw,
        valueUsd,
        profitLoss,
        profitLossPercent,
        allocationPercent: 0, // 나중에 계산
      };
    });
    
    // allocationPercent 계산
    assets.forEach(a => {
      a.allocationPercent = totalValueKrw > 0 
        ? (a.valueKrw / totalValueKrw) * 100 : 0;
    });
    
    // KRW 자산 제외하고 내림차순 정렬
    assets.sort((a, b) => b.valueKrw - a.valueKrw);
    
    const totalProfitLoss = assets.reduce((sum, a) => sum + a.profitLoss, 0);
    const totalCostBasis = assets.reduce((sum, a) => 
      sum + (a.balance * a.avgBuyPrice), 0);
    
    // 8. 스냅샷 저장 (최신 1개만 유지, 이전 것 덮어쓰기)
    const snapshotData = {
      exchange: cred.exchange,
      credentialId,
      assets,
      totalValueKrw,
      totalValueUsd: totalValueKrw / usdKrwRate,
      totalProfitLoss,
      totalProfitLossPercent: totalCostBasis > 0 
        ? (totalProfitLoss / totalCostBasis) * 100 : 0,
      snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
      syncDurationMs: Date.now() - startTime,
    };
    
    // credentialId를 doc ID로 사용 (항상 덮어쓰기)
    await admin.firestore()
      .doc(`users/${uid}/cex_snapshots/${credentialId}`)
      .set(snapshotData);
    
    // 9. credential 상태 업데이트
    await credDoc.ref.update({
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSyncStatus: 'success',
      status: 'active',
      statusMessage: '',
    });
    
    return { 
      success: true, 
      snapshot: snapshotData,
    };
    
  } catch (error) {
    // credential 상태를 error로 업데이트
    await credDoc.ref.update({
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSyncStatus: 'error',
      statusMessage: error.message || 'Sync failed',
    });
    throw new HttpsError('internal', `Sync failed: ${error.message}`);
  }
});
```

**완료 조건**:
- 유저의 API Key를 복호화 -> 거래소 API 호출 -> 스냅샷 저장 풀플로우 동작
- 에러 발생 시 credential 상태에 반영
- 스냅샷에 각 자산별 수량/현재가/손익/비중 포함

---

### Task 2.4: Cloud Function - 포트폴리오 스냅샷 조회 (`getCexPortfolio`)

**파일**: `functions/index.js`

```javascript
exports.getCexPortfolio = onCall({
  region: "asia-northeast3",
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');
  const uid = request.auth.uid;
  
  // 모든 거래소의 최신 스냅샷 조회
  const snapshots = await admin.firestore()
    .collection(`users/${uid}/cex_snapshots`)
    .orderBy('snapshotAt', 'desc').get();
  
  if (snapshots.empty) return { portfolios: [], aggregated: null };
  
  const portfolios = snapshots.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    snapshotAt: doc.data().snapshotAt?.toDate?.()?.toISOString(),
  }));
  
  // 전체 합산 집계
  const allAssets = {};
  let grandTotalKrw = 0;
  let grandTotalUsd = 0;
  
  portfolios.forEach(p => {
    grandTotalKrw += p.totalValueKrw || 0;
    grandTotalUsd += p.totalValueUsd || 0;
    (p.assets || []).forEach(a => {
      if (a.currency === 'KRW') return;
      if (!allAssets[a.currency]) {
        allAssets[a.currency] = { ...a, sources: [p.exchange] };
      } else {
        allAssets[a.currency].balance += a.balance;
        allAssets[a.currency].valueKrw += a.valueKrw;
        allAssets[a.currency].valueUsd += a.valueUsd;
        allAssets[a.currency].sources.push(p.exchange);
      }
    });
  });
  
  // allocationPercent 재계산
  Object.values(allAssets).forEach(a => {
    a.allocationPercent = grandTotalKrw > 0 
      ? (a.valueKrw / grandTotalKrw) * 100 : 0;
  });
  
  return {
    portfolios,
    aggregated: {
      totalValueKrw: grandTotalKrw,
      totalValueUsd: grandTotalUsd,
      assets: Object.values(allAssets).sort((a, b) => b.valueKrw - a.valueKrw),
      lastUpdated: portfolios[0]?.snapshotAt || null,
    }
  };
});
```

**완료 조건**:
- 여러 거래소의 스냅샷을 합산한 통합 포트폴리오 반환
- 동일 자산(BTC 등)이 여러 거래소에 있을 경우 합산

---

## Sprint 3: Frontend - CEX 서비스 & API Key 관리 UI (Week 3)

### Task 3.1: Frontend CEX 서비스 래퍼

**파일**: `services/cexService.ts` (신규 생성)

**작업 내용**: Cloud Functions 호출을 래핑하는 프론트엔드 서비스

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

// 타입 정의
export interface CexCredential {
  id: string;
  exchange: 'upbit' | 'bithumb';
  label: string;
  status: 'active' | 'validating' | 'expired' | 'error';
  statusMessage: string;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'error' | null;
  registeredAt: string;
}

export interface CexAsset {
  currency: string;
  balance: number;
  locked: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentPriceUsd: number;
  valueKrw: number;
  valueUsd: number;
  profitLoss: number;
  profitLossPercent: number;
  allocationPercent: number;
  sources?: string[];
}

export interface CexPortfolioSnapshot {
  id: string;
  exchange: string;
  assets: CexAsset[];
  totalValueKrw: number;
  totalValueUsd: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  snapshotAt: string;
}

export interface AggregatedPortfolio {
  totalValueKrw: number;
  totalValueUsd: number;
  assets: CexAsset[];
  lastUpdated: string | null;
}

// 서비스 함수들
const functions = getFunctions(undefined, 'asia-northeast3');

export async function registerCexApiKey(params: {
  exchange: 'upbit' | 'bithumb';
  accessKey: string;
  secretKey: string;
  label?: string;
}): Promise<{ credentialId: string }> {
  const fn = httpsCallable(functions, 'registerCexApiKey');
  const result = await fn(params);
  return result.data as any;
}

export async function deleteCexApiKey(credentialId: string): Promise<void> {
  const fn = httpsCallable(functions, 'deleteCexApiKey');
  await fn({ credentialId });
}

export async function listCexApiKeys(): Promise<CexCredential[]> {
  const fn = httpsCallable(functions, 'listCexApiKeys');
  const result = await fn({});
  return result.data as CexCredential[];
}

export async function syncCexPortfolio(
  credentialId: string
): Promise<CexPortfolioSnapshot> {
  const fn = httpsCallable(functions, 'syncCexPortfolio');
  const result = await fn({ credentialId });
  return (result.data as any).snapshot;
}

export async function getCexPortfolio(): Promise<{
  portfolios: CexPortfolioSnapshot[];
  aggregated: AggregatedPortfolio | null;
}> {
  const fn = httpsCallable(functions, 'getCexPortfolio');
  const result = await fn({});
  return result.data as any;
}
```

**완료 조건**:
- 모든 Cloud Function 호출에 대한 TypeScript 타입 정의
- import 후 즉시 사용 가능한 함수 export
- 기존 `firebaseService.ts` 패턴과 일관된 에러 핸들링

---

### Task 3.2: ViewType 확장 및 사이드바 메뉴 추가

**파일**: `components/wallet/WalletSidebar.tsx` (수정), `components/Wallet.tsx` (수정)

**작업 내용**:

1. `WalletSidebar.tsx`의 `ViewType`에 `'cex'` 추가:
```typescript
export type ViewType = 'chat' | 'assets' | 'campaign' | 'mint' | 'profile' | 
  'settings' | 'contacts' | 'nodes' | 'notifications' | 'referral' | 
  'history' | 'quest' | 'bridge' | 'staking' | 'cex';
```

2. `allMenuItems` 배열에 메뉴 추가 (`{ id: 'cex', label: 'CEX Portfolio', icon: ... }`):
- `assets` 메뉴 바로 아래에 위치
- 아이콘: `BarChart3` (lucide-solid)

3. `Wallet.tsx`에 `WalletCexPortfolio` 컴포넌트 lazy import & 라우팅 추가:
```typescript
const WalletCexPortfolio = lazy(() => import('./wallet/WalletCexPortfolio'));
```

**완료 조건**:
- 사이드바에 "CEX Portfolio" 메뉴 표시
- 클릭 시 해당 뷰로 전환
- URL 라우팅 (`?view=cex`) 동작

---

### Task 3.3: WalletCexPortfolio 컴포넌트 - API Key 관리 섹션

**파일**: `components/wallet/WalletCexPortfolio.tsx` (신규 생성)

**작업 내용**: API Key 등록/조회/삭제 UI

**UI 구성**:
```
+--------------------------------------------------+
| [CEX PORTFOLIO]                                   |
| "Connect your exchange to get AI-powered insights"|
+--------------------------------------------------+
|                                                    |
|  [Connected Exchanges]                             |
|  +-------------------------------------------+    |
|  | UPBIT  | My Upbit  | Active  | [Sync][Del] |   |
|  | BITHUMB| My Bithumb| Error   | [Sync][Del] |   |
|  +-------------------------------------------+    |
|                                                    |
|  [+ Connect Exchange] 버튼                         |
|                                                    |
+--------------------------------------------------+
```

**"Connect Exchange" 모달**:
```
+----------------------------------------------+
| Connect Exchange                              |
|                                               |
| [Upbit] [Bithumb]  <- 탭 선택                  |
|                                               |
| Label:  [내 업비트 계정         ]               |
| Access Key: [___________________________]     |
| Secret Key: [___________________________]     |
|                                               |
| ! Keys are encrypted and stored securely.      |
|   Only balance-read permission is needed.      |
|                                               |
| [Cancel]              [Connect]               |
+----------------------------------------------+
```

**핵심 구현 요소**:
- `createSignal` 기반 상태 관리 (credentials, loading, modal 등)
- `onMount`에서 `listCexApiKeys()` 호출
- 등록 버튼 클릭 시 `registerCexApiKey()` -> 성공 시 자동 `syncCexPortfolio()`
- 삭제 시 확인 다이얼로그 후 `deleteCexApiKey()`
- 각 credential 카드에 상태 표시 (Active/Error/Validating)
- **디자인**: 기존 `WalletSettings.tsx`의 카드 스타일 + `WalletAssets.tsx`의 레이아웃 참고

**완료 조건**:
- API Key 등록 모달 동작
- 등록된 거래소 목록 표시 (상태 포함)
- 동기화/삭제 버튼 동작
- 로딩 상태 및 에러 메시지 표시
- 기존 디자인 시스템과 일관된 스타일

---

## Sprint 4: 포트폴리오 대시보드 UI (Week 4)

### Task 4.1: WalletCexPortfolio - 포트폴리오 대시보드 섹션

**파일**: `components/wallet/WalletCexPortfolio.tsx` (Task 3.3에 이어서)

**작업 내용**: 스냅샷 데이터를 시각화하는 대시보드

**UI 디자인 (WalletAssets.tsx 스타일 참고)**:

```
[총 자산 가치]        [총 손익]         [자산 수]       [마지막 동기화]
 $12,345.67          +$234 (+5.2%)    8 assets       2 min ago
 
[포트폴리오 도넛 차트]     [자산 목록 테이블]
  BTC 45%                  BTC | $45,230 | 0.12 | +12.3%
  ETH 30%                  ETH | $3,120  | 1.5  | -2.1%
  XRP 10%                  XRP | $0.52   | 5000 | +5.6%
  기타 15%                 SOL  | $98     | 10   | +1.2%
```

**핵심 구현 요소**:
1. **Stats 카드 (4칸 그리드)**: `WalletAssets.tsx`의 stats row 패턴 그대로 활용
   - Total Value (KRW + USD 토글)
   - Total P&L (금액 + 퍼센트)
   - Asset Count
   - Last Synced (상대 시간)

2. **도넛 차트**: `WalletAssets.tsx`의 SVG 도넛 차트 패턴 재활용
   - 상위 5개 자산 + "기타"
   - 호버 시 상세 정보 표시

3. **자산 목록 테이블**: `WalletAssets.tsx`의 토큰 로우 패턴 재활용
   - 컬럼: Asset | Price | Holdings | Value | P&L | Allocation
   - 정렬 기능 (가치순/수익률순)
   - 각 자산 아이콘은 CoinGecko ID 기반 (이미지 URL 매핑)

4. **거래소별 필터 탭**: All / Upbit / Bithumb

**완료 조건**:
- Stats 카드에 실시간 데이터 표시
- 도넛 차트에 자산 비중 시각화
- 자산 목록 테이블에 상세 정보
- 수익 양수 = 초록, 음수 = 빨강 색상 적용
- 동기화 버튼 눌러서 실시간 업데이트 가능
- KRW/USD 통화 전환 토글

---

### Task 4.2: 자산 아이콘 매핑 유틸리티

**파일**: `services/cexService.ts` (추가) 또는 `utils/cryptoIcons.ts` (신규)

**작업 내용**: 거래소의 currency 심볼을 CoinGecko 이미지 URL로 매핑

```typescript
// 주요 코인 아이콘 매핑 (CoinGecko CDN)
const COIN_ICON_MAP: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  // ... 확장 가능
};

export function getCoinIconUrl(symbol: string): string {
  return COIN_ICON_MAP[symbol.toUpperCase()] || '';
}
```

**완료 조건**:
- 주요 코인(20개+) 아이콘 매핑 완성
- 매핑 없는 코인 fallback 처리 (첫 글자 아바타)

---

## Sprint 5: AI 분석 통합 (Week 5)

### Task 5.1: AI Tool 추가 - `get_cex_portfolio`

**파일**: `services/ai/tools.ts` (수정)

**작업 내용**: AI가 유저의 CEX 포트폴리오를 조회할 수 있는 Tool 추가

```typescript
// tools.ts의 AI_TOOLS 배열에 추가
{
  name: "get_cex_portfolio",
  description: "Get the user's cryptocurrency portfolio from connected exchanges (Upbit, Bithumb). Returns holdings, current prices, profit/loss, and allocation percentages. Use this when the user asks about their portfolio, holdings, investment performance, or wants portfolio advice.",
  parameters: {
    type: "object",
    properties: {
      exchange: {
        type: "string",
        description: "Optional. Filter by specific exchange: 'upbit' or 'bithumb'. If omitted, returns aggregated portfolio from all exchanges."
      }
    }
  }
}
```

**완료 조건**:
- Tool 정의가 AI_TOOLS 배열에 추가됨

---

### Task 5.2: AI Tool 실행 로직 추가

**파일**: `services/ai/index.ts` (수정)

**작업 내용**: `generateText` 함수의 tool execution loop에 `get_cex_portfolio` 핸들러 추가

```typescript
// generateText 함수 내 tool 실행 분기에 추가 (약 line 229~ 부근)
} else if (name === 'get_cex_portfolio') {
  const { getCexPortfolio } = await import('../cexService');
  try {
    const portfolio = await getCexPortfolio();
    if (portfolio.aggregated && portfolio.aggregated.assets.length > 0) {
      const agg = portfolio.aggregated;
      toolResult = {
        totalValueUsd: agg.totalValueUsd.toFixed(2),
        totalValueKrw: agg.totalValueKrw.toLocaleString(),
        lastUpdated: agg.lastUpdated,
        holdings: agg.assets.slice(0, 20).map(a => ({
          symbol: a.currency,
          balance: a.balance,
          currentPriceKrw: a.currentPrice,
          currentPriceUsd: a.currentPriceUsd?.toFixed(4),
          valueUsd: a.valueUsd?.toFixed(2),
          valueKrw: a.valueKrw?.toLocaleString(),
          profitLossPercent: a.profitLossPercent?.toFixed(2) + '%',
          allocationPercent: a.allocationPercent?.toFixed(1) + '%',
          sources: a.sources, 
        })),
        exchangeCount: portfolio.portfolios.length,
        assetCount: agg.assets.length,
      };
    } else {
      toolResult = "No CEX portfolio found. The user has not connected any exchange yet. Suggest them to connect Upbit or Bithumb in the CEX Portfolio menu.";
    }
  } catch (e) {
    toolResult = "Failed to fetch CEX portfolio. The user may need to reconnect their exchange API key.";
  }
}
```

**완료 조건**:
- "내 포트폴리오 분석해줘" -> AI가 `get_cex_portfolio` tool 호출 -> 실제 데이터 기반 답변
- 거래소 미연동 시 연동 안내 메시지

---

### Task 5.3: AI 시스템 프롬프트에 포트폴리오 분석 가이드 추가

**파일**: `services/ai/index.ts` (수정)

**작업 내용**: `dynamicSystemPrompt`에 포트폴리오 분석 관련 지침 추가

```
7. PORTFOLIO ANALYSIS (when get_cex_portfolio returns data):
   - ALWAYS display a donut chart showing allocation using vision-chart format
   - Provide clear risk assessment (concentration risk, volatile asset ratio)
   - Suggest rebalancing if any single asset > 50% allocation
   - Compare user's portfolio performance vs BTC, ETH benchmarks
   - Use both KRW and USD values
   - Highlight top gainers and losers
   - If asked for advice, provide actionable suggestions with rationale
   
   EXAMPLE ANALYSIS FORMAT:
   1. Portfolio Summary (total value, P&L)
   2. Allocation Chart (vision-chart donut)
   3. Performance Analysis (top gainers/losers)
   4. Risk Assessment (concentration, volatility)
   5. Recommendations (rebalancing suggestions)
   
   DISCLAIMER: Always end with "This is not financial advice. Please do your own research."
```

**완료 조건**:
- AI가 포트폴리오 데이터를 받으면 구조화된 분석 리포트 생성
- vision-chart 도넛 차트 포함
- 면책 조항 자동 포함

---

### Task 5.4: Quick Action 추가

**파일**: Firestore `/config/quickActions` (또는 `WalletDashboard.tsx` DEFAULT_QUICK_ACTIONS)

**작업 내용**: "포트폴리오 분석" Quick Action 추가

```typescript
// WalletDashboard.tsx의 DEFAULT_QUICK_ACTIONS에 추가
{
  id: '5',
  label: 'Portfolio Analysis',
  prompt: '내 거래소 포트폴리오를 분석하고 투자 조언을 해줘',
  icon: 'BarChart3',
  iconColor: 'text-emerald-400',
  actionType: 'chat' as const,
  order: 5,
  enabled: true,
}
```

**완료 조건**:
- 채팅 화면에 "Portfolio Analysis" Quick Action 버튼 표시
- 클릭 시 자동으로 프롬프트 전송 -> AI 분석 시작

---

## Sprint 6: 자동 동기화 & 폴리싱 (Week 6-7)

### Task 6.1: Cloud Scheduler - 자동 포트폴리오 동기화

**파일**: `functions/index.js`

**작업 내용**: 30분마다 모든 active credential의 포트폴리오를 자동 동기화

```javascript
exports.scheduledCexSync = onSchedule({
  schedule: "every 30 minutes",
  region: "asia-northeast3",
  secrets: ["CEX_ENCRYPTION_KEY"],
  timeoutSeconds: 120,
  memory: "256MiB",
}, async (event) => {
  // 모든 active credentials 조회
  const usersSnapshot = await admin.firestore()
    .collectionGroup('cex_credentials')
    .where('status', '==', 'active')
    .get();
  
  console.log(`[CexSync] Found ${usersSnapshot.size} active credentials to sync.`);
  
  const batchSize = 5; // 동시 처리 수
  const docs = usersSnapshot.docs;
  
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (doc) => {
        const uid = doc.ref.parent.parent.id;
        const credentialId = doc.id;
        try {
          // syncCexPortfolio 로직 재사용 (내부 함수로 분리)
          await performSync(uid, credentialId);
          console.log(`[CexSync] Synced ${credentialId} for ${uid}`);
        } catch (error) {
          console.error(`[CexSync] Failed ${credentialId}:`, error.message);
        }
      })
    );
  }
});
```

**완료 조건**:
- 30분 스케줄로 자동 동기화 실행
- 배치 처리로 Rate Limit 방지
- 실패 시 에러 로그 + credential 상태 업데이트
- Firebase console에서 실행 로그 확인 가능

---

### Task 6.2: 포트폴리오 변동 알림

**파일**: `functions/index.js` (Task 6.1의 스케줄러 확장)

**작업 내용**: 동기화 시 이전 스냅샷과 비교하여 큰 변동이 있을 때 알림 전송

```javascript
// performSync 함수 내부에 추가
async function checkAndNotify(uid, previousSnapshot, newSnapshot) {
  // 변동 기준
  const SIGNIFICANT_CHANGE_PERCENT = 10; // 10% 이상 변동
  
  if (!previousSnapshot) return;
  
  const prevTotal = previousSnapshot.totalValueKrw;
  const newTotal = newSnapshot.totalValueKrw;
  const changePercent = prevTotal > 0 
    ? ((newTotal - prevTotal) / prevTotal) * 100 : 0;
  
  if (Math.abs(changePercent) >= SIGNIFICANT_CHANGE_PERCENT) {
    // 기존 notificationService 패턴 활용
    const userDoc = await admin.firestore().doc(`users/${uid}`).get();
    const email = userDoc.data()?.email;
    
    await admin.firestore()
      .collection(`users/${uid}/notifications`).add({
        type: 'portfolio_alert',
        title: changePercent > 0 
          ? 'Portfolio Value Increased' 
          : 'Portfolio Value Decreased',
        message: `Your CEX portfolio changed by ${changePercent.toFixed(1)}%. Total: ${newTotal.toLocaleString()} KRW`,
        read: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
```

**완료 조건**:
- 10% 이상 변동 시 in-app 알림 생성
- 기존 `WalletNotifications.tsx`에서 표시됨

---

### Task 6.3: WalletCexPortfolio - UX 폴리싱

**파일**: `components/wallet/WalletCexPortfolio.tsx` (수정)

**작업 내용**:

1. **Pull-to-refresh**: 동기화 버튼 + 마지막 동기화 시간 표시
2. **Skeleton 로딩**: 데이터 로딩 중 스켈레톤 UI 표시
3. **빈 상태**: 거래소 미연동 시 온보딩 안내 카드
4. **거래소 로고 SVG**: 업비트/빗썸 브랜드 로고 (SVG 아이콘)
5. **반응형**: 모바일 최적화 (카드 스택, 테이블 -> 카드 변환)
6. **애니메이션**: Motion 라이브러리로 진입/전환 애니메이션
7. **에러 상태**: API Key 만료/에러 시 재연결 안내

**빈 상태 디자인**:
```
+--------------------------------------------------+
|                                                    |
|        [거래소 아이콘 일러스트]                       |
|                                                    |
|    Connect Your Exchange                           |
|    Link Upbit or Bithumb to get AI-powered         |
|    portfolio analysis and investment insights.      |
|                                                    |
|    [Connect Upbit]  [Connect Bithumb]              |
|                                                    |
|    ! Your API keys are encrypted with AES-256      |
|      and only balance-read access is used.         |
|                                                    |
+--------------------------------------------------+
```

**완료 조건**:
- 모든 상태 (로딩/빈/데이터/에러)에 대한 UI 완성
- 모바일/데스크톱 반응형 완성
- 기존 Vision Chain 디자인 시스템 (다크 테마, 글래스모피즘) 일관성

---

### Task 6.4: aiLocalization 확장

**파일**: `services/ai/aiLocalization.ts` (수정)

**작업 내용**: 한국어/영어/일본어 CEX 관련 인텐트 키워드 추가

```typescript
// ko.intents.keywords에 추가
cex_portfolio: ['포트폴리오', '내 자산', '투자현황', '수익률', '잔고', '보유', '업비트', '빗썸', '거래소'],

// en.intents.keywords에 추가  
cex_portfolio: ['portfolio', 'my holdings', 'investments', 'returns', 'balance', 'upbit', 'bithumb', 'exchange'],

// ja.intents.keywords에 추가
cex_portfolio: ['ポートフォリオ', '保有資産', '投資', '残高', 'アップビット', 'ビッサム'],
```

**완료 조건**:
- 한/영/일 3개 언어로 포트폴리오 관련 키워드 인식

---

### Task 6.5: Settings에 CEX 관리 섹션 추가

**파일**: `components/wallet/WalletSettings.tsx` (수정)

**작업 내용**: 설정 페이지에 "Connected Exchanges" 섹션 추가
- API Key 관리 바로가기
- 자동 동기화 on/off
- 알림 설정 (변동률 임계값)
- 데이터 삭제 (모든 CEX 데이터 제거)

**완료 조건**:
- Settings에서 CEX 연동 관리 가능
- WalletCexPortfolio 페이지로의 딥링크

---

## 테스트 체크리스트

### 기능 테스트
- [ ] API Key 등록: 유효한 키 -> 성공
- [ ] API Key 등록: 무효한 키 -> 에러 메시지
- [ ] API Key 등록: 중복 등록 -> 허용 (라벨로 구분)
- [ ] API Key 등록: 5개째 -> 거부
- [ ] API Key 삭제: 관련 스냅샷 함께 삭제
- [ ] 포트폴리오 동기화: 잔고 + 현재가 정상 조회
- [ ] 포트폴리오 동기화: 잔고 0인 자산 필터링
- [ ] 멀티 거래소: 동일 자산 합산 로직
- [ ] AI 분석: "포트폴리오 분석해줘" -> 차트 포함 리포트
- [ ] AI 분석: 거래소 미연동 -> 연동 안내
- [ ] 자동 동기화: 30분 스케줄 동작
- [ ] 변동 알림: 10% 변동 시 알림 생성

### 보안 테스트
- [ ] 클라이언트에서 API Key 원본 조회 불가
- [ ] Firestore Rules: 타인의 credentials 접근 불가
- [ ] Cloud Functions: 인증 없이 호출 시 거부
- [ ] 네트워크 탭에서 API Key 노출 없음

### UI/UX 테스트
- [ ] 모바일 반응형 정상 동작
- [ ] 로딩 스켈레톤 표시
- [ ] 에러 상태 안내 메시지
- [ ] 빈 상태 온보딩 카드
- [ ] 다크 테마 일관성
- [ ] 애니메이션 부드러움

---

## 참고: functions/package.json 추가 의존성

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.0",
    "uuid": "^9.0.0",
    "axios": "^1.6.0"
  }
}
```

> **Note**: `axios`와 `uuid`는 이미 설치되어 있을 수 있음. `jsonwebtoken`만 추가 필요할 수 있음.

---

## 배포 순서

1. **Cloud Functions 배포** (Sprint 1-2 완료 후)
   ```bash
   cd functions && npm install jsonwebtoken
   firebase deploy --only functions:registerCexApiKey,deleteCexApiKey,listCexApiKeys,syncCexPortfolio,getCexPortfolio
   ```

2. **Firestore Rules 배포**
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Frontend 배포** (Sprint 3-4 완료 후)
   ```bash
   npm run build && firebase deploy --only hosting
   ```

4. **Scheduler 배포** (Sprint 6 완료 후)
   ```bash
   firebase deploy --only functions:scheduledCexSync
   ```
