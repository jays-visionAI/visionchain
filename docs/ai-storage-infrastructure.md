# AI Storage Infrastructure

> Distributed Storage Node - AI Data Layer Management

## 개요

AI Storage는 Vision Chain의 AI가 유저 파일을 **이해하고 검색하고 기억**할 수 있게 해주는 데이터 인프라입니다.
일반 파일 저장소(Disk)에 올린 파일을 AI가 활용 가능한 형태(청크, 임베딩, 메모리)로 변환하는 **RAG (Retrieval-Augmented Generation)** 파이프라인을 제공합니다.

### 핵심 기능

- **파일 인덱싱**: 문서/이미지/오디오/비디오를 파싱하여 시맨틱 청크로 분할
- **듀얼 임베딩**: OpenAI(1536d) + Gemini(768d) 벡터 동시 생성
- **하이브리드 검색**: 벡터 유사도 + 키워드 매칭 + 메타데이터 필터 조합
- **장기 메모리**: 에피소드/시맨틱/절차적 메모리 저장 및 자동 통합
- **컨텍스트 캐시**: Gemini API의 context cache로 비용 절감
- **워크스페이스**: 멀티 테넌트 접근 제어 및 공유

---

## 아키텍처

### 6-Phase 구조

| Phase | 이름 | Cloud Functions | 역할 |
|-------|------|-----------------|------|
| 1 | Foundation Data Layer | `aiRequestIndexing`, `aiGetIndexStatus` | 파일 AI 메타데이터 확장, 인덱싱 요청/상태 관리 |
| 2 | Ingestion & Processing | `aiProcessIngestion` | 파일 파싱 → 시맨틱 청크 분할 → 메타데이터 추출 |
| 3 | Dual Index & Retrieval | `aiGenerateEmbeddings`, `aiRetrieve` | 듀얼 임베딩 생성, 하이브리드 검색 |
| 4 | Cache & Memory | `aiCreateContextCache`, `aiMemoryStore`, `aiMemoryConsolidate` | Gemini 캐시, 장기 메모리 CRUD, 메모리 통합 |
| 5 | Access Control | `aiWorkspaceManage`, `aiDataShare`, `aiAuditLog` | 워크스페이스, 공유 링크, 감사 로그 |
| 6 | Monitoring & Analytics | `aiAnalytics`, `aiHealthCheck` | 대시보드 통계, 시스템 헬스체크, 비용 추정 |

### 데이터 흐름

```
유저 파일 업로드 (Disk)
       │
       ▼
  ① 인덱싱 요청 (aiRequestIndexing)
       │
       ▼
  ② 파일 처리 (aiProcessIngestion)
       │   - 파일 파싱 (텍스트 추출)
       │   - 시맨틱 청크 분할
       │   - 키워드/엔티티 추출
       │   - 요약 생성
       │
       ▼
  ③ 임베딩 생성 (aiGenerateEmbeddings)
       │   - OpenAI text-embedding-3-small (1536d)
       │   - Gemini text-embedding-004 (768d)
       │
       ▼
  ④ AI 대화 중 검색 (aiRetrieve)
       │   - 벡터 유사도 검색
       │   - 키워드 매칭
       │   - 결과 병합 및 랭킹
       │
       ▼
   관련 청크를 AI 컨텍스트에 주입 → 정확한 답변
```

---

## Firestore 데이터 구조

```
users/{email}/
├── disk_files/{fileId}                  ← 기존 파일 + AI 확장 필드
├── ai_chunks/{chunkId}                  ← 시맨틱 청크 문서
├── ai_index_jobs/{jobId}                ← 인덱싱 작업 기록
├── ai_retrieval_policy/default          ← 검색 정책
├── ai_embeddings_openai/{chunkId}       ← OpenAI 벡터 (1536d)
├── ai_embeddings_gemini/{chunkId}       ← Gemini 벡터 (768d)
├── ai_memories/{memoryId}               ← 장기 메모리
├── ai_memory_consolidations/{id}        ← 메모리 통합 기록
├── ai_context_cache/{cacheId}           ← Gemini 컨텍스트 캐시
├── ai_workspaces/{workspaceId}          ← 워크스페이스
├── ai_data_shares/{shareId}             ← 공유 링크
├── ai_audit_logs/{logId}                ← 감사 로그
└── ai_usage_metrics/{date}              ← 일별 사용량
```

---

## 핵심 데이터 모델

### FileChunk (시맨틱 청크)

파일을 AI가 처리 가능한 크기의 의미 단위로 분할한 것.

| 필드 | 타입 | 설명 |
|------|------|------|
| `chunkId` | string | 청크 고유 ID |
| `fileId` | string | 원본 파일 ID |
| `chunkIndex` | number | 파일 내 순서 (0-based) |
| `chunkType` | enum | `text`, `table`, `code`, `heading`, `list`, `image_caption`, `transcript`, `chat_turn` |
| `text` | string | 청크 텍스트 |
| `summary` | string? | AI 생성 요약 |
| `keywords` | string[]? | 추출된 키워드 |
| `entities` | string[]? | 네임드 엔티티 (인물, 조직 등) |
| `tokenCount` | number | 토큰 수 (컨텍스트 예산 관리용) |

### MemoryEntry (장기 메모리)

| 타입 | 설명 | 예시 |
|------|------|------|
| **Episodic** | 대화/이벤트 기반 기억 | "유저가 3/10에 BTC를 매수했다" |
| **Semantic** | 사실/지식 기반 기억 | "유저는 보수적 투자 성향이다" |
| **Procedural** | 선호/습관 기반 기억 | "유저는 한국어로 답변받기를 선호한다" |

메모리는 `importance` (0~1) 점수를 가지며, `aiMemoryConsolidate`로 오래되거나 중복된 메모리를 자동 통합할 수 있습니다.

---

## API 사용법

### 파일 인덱싱 (전체 파이프라인)

```typescript
import { orchestrateFile } from '../../services/aiStorage/aiStorageService';

// 한번에 인덱싱 → 처리 → 임베딩 실행
const result = await orchestrateFile('file-abc-123', 'both');
// result: { fileId, status, chunksCreated, ... }
```

### 단계별 실행

```typescript
import {
  requestIndexing,
  triggerIngestion,
  generateEmbeddings
} from '../../services/aiStorage/aiStorageService';

// Step 1: 인덱싱 요청
await requestIndexing({ fileId: 'file-abc-123', modelTarget: 'both' });

// Step 2: 파일 처리 (파싱 + 청킹)
await triggerIngestion('file-abc-123');

// Step 3: 임베딩 생성
await generateEmbeddings('file-abc-123', 'both');
```

### 검색 (Retrieval)

```typescript
import { retrieve } from '../../services/aiStorage/aiStorageService';

const results = await retrieve(
  '비트코인 투자 전략',     // 검색 쿼리
  'openai',                 // 사용할 임베딩 모델
  10,                       // top-K
  { tags: ['crypto'] },     // 필터
  true                      // 청크 텍스트 포함
);
// results: { results: RetrievalHit[], searchTimeMs, ... }
```

### 메모리 관리

```typescript
import {
  storeMemory,
  searchMemories,
  consolidateMemories
} from '../../services/aiStorage/aiStorageService';

// 메모리 저장
await storeMemory(
  '유저는 DCA 전략을 선호한다',
  'semantic',        // 타입
  0.8,               // 중요도
  { type: 'conversation', referenceId: 'conv-123' },
  ['투자', 'DCA']    // 키워드
);

// 메모리 검색
const memories = await searchMemories('투자 성향', 'semantic', 5, 0.3);

// 메모리 통합 (30일 이상 된 메모리 요약)
await consolidateMemories('summarize', 30, 5, 0.3);
```

### 컨텍스트 캐시

```typescript
import { createContextCache } from '../../services/aiStorage/aiStorageService';

// 여러 파일의 내용을 Gemini 컨텍스트 캐시로 생성
const cache = await createContextCache(
  ['file-1', 'file-2'],    // 대상 파일 ID
  'gemini-2.0-flash',      // 모델
  3600,                     // TTL (초)
  '투자 보고서 캐시'        // 이름
);
```

### 워크스페이스 & 공유

```typescript
import { manageWorkspace, manageShareLink } from '../../services/aiStorage/aiStorageService';

// 워크스페이스 생성
await manageWorkspace('create', { name: 'Trading Team', description: '...' });

// 멤버 초대
await manageWorkspace('invite', { workspaceId: 'ws-123', email: 'user@example.com', role: 'editor' });

// 공유 링크 생성
await manageShareLink('create', {
  resourceType: 'file',
  resourceIds: ['file-1'],
  permissions: ['read', 'search'],
  expireAt: '2026-04-01T00:00:00Z'
});
```

---

## 어드민 대시보드

어드민 패널의 **AI Storage** 메뉴에서 전체 인프라 상태를 모니터링합니다.

### Storage Overview
- **Total Files**: AI 인덱싱이 완료된 파일 수
- **Chunks**: 시맨틱 분할된 청크 총 수
- **OpenAI/Gemini Vectors**: 각 모델별 생성된 임베딩 벡터 수
- **Memories**: 장기 메모리 총 수
- **Workspaces**: 생성된 워크스페이스 및 멤버 수

### Memory Types
4가지 메모리 타입별 저장 현황

### Cache & Sharing
- 활성/만료된 컨텍스트 캐시
- 공유 링크 현황
- 인덱싱 대기/오류 파일 수

### Cost Estimation
월별 AI 모델 토큰 사용량 및 추정 비용 (OpenAI, Gemini, DeepSeek)

### System Health
`Health Check` 버튼으로 각 컴포넌트 (Firestore, OpenAI API, Gemini API, DeepSeek API, Context Cache) 상태 및 레이턴시를 확인합니다.

---

## 관련 파일

| 파일 | 설명 |
|------|------|
| `components/admin/AIStorageAdmin.tsx` | 어드민 대시보드 UI |
| `services/aiStorage/aiStorageService.ts` | 프론트엔드 서비스 (Cloud Function 호출) |
| `services/aiStorage/types.ts` | 타입 정의 (모든 데이터 모델) |

### Cloud Functions

| 함수명 | 용도 |
|--------|------|
| `aiRequestIndexing` | 파일 인덱싱 요청 |
| `aiGetIndexStatus` | 인덱싱 상태 조회 |
| `aiProcessIngestion` | 파일 파싱/청킹/메타데이터 추출 |
| `aiGenerateEmbeddings` | 듀얼 임베딩 생성 |
| `aiRetrieve` | 하이브리드 검색 |
| `aiCreateContextCache` | Gemini 컨텍스트 캐시 생성 |
| `aiMemoryStore` | 메모리 CRUD |
| `aiMemoryConsolidate` | 메모리 통합 |
| `aiWorkspaceManage` | 워크스페이스 CRUD |
| `aiDataShare` | 공유 링크 관리 |
| `aiAuditLog` | 감사 로그 조회 |
| `aiAnalytics` | 통계/비용 조회 |
| `aiHealthCheck` | 시스템 헬스체크 |
| `aiOrchestrate` | 인덱싱→처리→임베딩 원스텝 실행 |
