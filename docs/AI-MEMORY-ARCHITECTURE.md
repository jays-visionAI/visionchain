# Vision AI Memory Architecture
## 분산 노드 기반 Market Intelligence 메모리 시스템

---

## 1. 현재 상태 분석

### 1.1 Vision Insight (기존)
현재 Vision Insight는 Cloud Function(`getVisionInsight`)을 통해 다음 데이터를 수집/제공합니다:

| 데이터 | 설명 | 갱신 주기 |
|--------|------|----------|
| **NewsArticle** | 뉴스 기사 (title, sentiment, impact, keywords, oneLiner) | 실시간 |
| **ASI (Adaptive Sentiment Index)** | 시장 심리 점수 (0-100) + 트렌드 | 기사 분석 시 |
| **AlphaAlert** | 고-임팩트 기사 알림 | 실시간 |
| **WhaleWatch** | 대형 거래/거래소 유출입 | 실시간 |
| **MarketBrief** | AI 시장 분석 요약, 리스크, 기회 | 기사 분석 시 |
| **Narratives** | 트렌딩 키워드 + 경제 캘린더 | 주기적 |

### 1.2 AI Chat (기존)
- AI 챗은 **매 요청마다 독립적** -- 이전 시장 컨텍스트를 기억하지 못함
- 시세를 물어보면 Tool Call(CoinGecko)로 실시간 조회하지만, **왜 가격이 올랐는지** 설명할 수 없음
- Vision Insight에서 수집한 풍부한 기사/분석 데이터가 AI 챗에 전혀 활용되지 않음

### 1.3 분산 노드 (기존)
- 유저들이 Vision Node(Desktop/CLI)를 운영하여 스토리지 제공
- 현재는 블록 검증 + 보상(VCN/RP)에 활용
- **스토리지 용량은 확보되어 있으나, 지능형 데이터 저장에는 미활용**

---

## 2. 목표 아키텍처: Distributed RAG (Retrieval-Augmented Generation)

### 핵심 개념

```
[Vision Insight 기사 수집]
     |
     v
[Embedding 생성] → [벡터 + 메타데이터]
     |
     v
[분산 노드에 분산 저장] ← 유저 노드 스토리지
     |
     v
[AI 챗 질문 시 → 관련 기사 검색 (Semantic Search)]
     |
     v
[검색된 컨텍스트 + 실시간 시세 → AI 답변]
```

**결과**: "비트코인 왜 올랐어?" → 관련 뉴스 3-5개 + 실시간 가격 + AI 분석 = **근거 있는 답변**

---

## 3. 시스템 설계

### 3.1 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Chat (Frontend)                       │
│   유저 질문 → Embedding → 유사도 검색 → 컨텍스트 주입 → 답변  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│               Memory Gateway (Cloud Function)                │
│   queryMemory / ingestArticle / getMarketContext             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                  Vector Index Layer                           │
│   Firestore (메타데이터) + Distributed Nodes (벡터 청크)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
    │ Node A  │      │ Node B  │      │ Node C  │
    │(Storage)│      │(Storage)│      │(Storage)│
    └─────────┘      └─────────┘      └─────────┘
```

### 3.2 데이터 흐름 상세

#### Phase A: 수집 및 임베딩 (Ingestion Pipeline)

```
Vision Insight Cloud Function
  → 뉴스 기사 수집 (CryptoPanic, RSS, etc.)
  → 각 기사에 대해:
    1. 텍스트 추출: title + oneLiner + keywords
    2. Embedding 생성: Gemini text-embedding-004 (768차원)
    3. 메타데이터 구성:
       {
         articleId: "abc123",
         embedding: Float32Array(768),
         title: "Bitcoin ETF sees $1B inflow",
         sentiment: 0.85,
         sentimentLabel: "bullish",
         category: "bitcoin",
         keywords: ["btc", "etf", "inflow"],
         impactScore: 8.5,
         publishedAt: "2026-02-24T10:00:00Z",
         source: "CoinDesk",
         oneLiner: "Bitcoin ETF records highest single-day inflow..."
       }
    4. Firestore에 메타데이터 저장 (ai_memory/articles/{id})
    5. 벡터 데이터를 분산 노드에 배포
```

#### Phase B: 분산 노드 저장 전략

```
[벡터 청크 분산 방식]

1. 전체 벡터 인덱스를 N개의 샤드로 분할
2. 각 샤드를 R개의 노드에 복제 (Replication Factor = 3)
3. Consistent Hashing으로 샤드-노드 매핑

예시 (1000개 기사, 10개 노드):
  Shard 0 (기사 0-99):  Node A, Node D, Node G
  Shard 1 (기사 100-199): Node B, Node E, Node H
  ...

[노드 데이터 형식]
각 노드는 할당된 샤드를 로컬 파일로 저장:
  ~/.vision-node/memory/shard_{id}.vbin
  
  .vbin 형식:
  ┌─────────────┬──────────────┬──────────────┐
  │ Header (32B)│ Index (var)  │ Vectors (var)│
  │ version,    │ articleId →  │ Float32[768] │
  │ count,      │ offset map   │ per article  │
  │ dimension   │              │              │
  └─────────────┴──────────────┴──────────────┘
```

#### Phase C: 검색 (Query Flow)

```
[유저: "비트코인 왜 올랐어?"]
  │
  ├─ 1. 질문 Embedding 생성 (768차원)
  │
  ├─ 2. Memory Gateway 호출
  │     → 어떤 노드가 어떤 샤드를 가지고 있는지 확인 (Firestore 라우팅 테이블)
  │     → 관련 샤드의 노드들에 병렬 검색 요청
  │
  ├─ 3. 각 노드에서 Top-K 코사인 유사도 검색 (K=5)
  │     → 결과: [{articleId, score, title, oneLiner}, ...]
  │
  ├─ 4. 결과 병합 + 재순위화
  │     → 시간 가중치 (최신 기사 우대)
  │     → 임팩트 가중치 (high-impact 우대)
  │     → 최종 Top-5 선택
  │
  ├─ 5. Firestore에서 전체 메타데이터 조회
  │
  └─ 6. AI 프롬프트에 컨텍스트 주입:
        [MARKET INTELLIGENCE CONTEXT]
        Based on recent market analysis from Vision Insight:
        
        1. "Bitcoin ETF sees $1B inflow" (CoinDesk, 2h ago, Impact: 8.5/10, Bullish)
           → Bitcoin ETF records highest single-day inflow since launch...
        
        2. "Fed signals rate cut possibility" (Reuters, 5h ago, Impact: 7.2/10, Bullish)
           → Federal Reserve minutes suggest potential rate adjustments...
        
        3. "Whale accumulation reaches yearly high" (Glassnode, 8h ago, Impact: 6.8/10, Bullish)
           → On-chain data shows whale addresses accumulated 12,000 BTC...
        
        Use this context to explain WHY prices moved, not just what the price is.
```

---

## 4. 구현 계획

### Phase 1: 중앙화된 메모리 (1주) -- 즉시 효과

분산 노드 연동 전에 먼저 **Firestore 기반 벡터 검색**으로 빠르게 MVP를 구현합니다.

#### 4.1 Embedding Service (Cloud Function)

```typescript
// functions/src/memory/embedArticle.ts

import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({ project: 'visionchain-d19ed', location: 'us-central1' });
const embeddingModel = vertexAI.getGenerativeModel({ model: 'text-embedding-004' });

export async function embedArticle(article: {
    id: string;
    title: string;
    oneLiner: string;
    keywords: string[];
    sentiment: number;
    sentimentLabel: string;
    category: string;
    impactScore: number;
    source: string;
    publishedAt: string;
}): Promise<{ embedding: number[]; metadata: any }> {
    // Combine relevant text for embedding
    const textToEmbed = [
        article.title,
        article.oneLiner,
        article.keywords.join(', '),
        `sentiment: ${article.sentimentLabel}`,
        `category: ${article.category}`
    ].join(' | ');

    const result = await embeddingModel.embedContent(textToEmbed);
    const embedding = result.embedding.values;

    return {
        embedding,
        metadata: {
            articleId: article.id,
            title: article.title,
            oneLiner: article.oneLiner,
            sentiment: article.sentiment,
            sentimentLabel: article.sentimentLabel,
            category: article.category,
            impactScore: article.impactScore,
            source: article.source,
            publishedAt: article.publishedAt,
            embeddedAt: new Date().toISOString(),
            dimension: embedding.length,
        }
    };
}
```

#### 4.2 Memory Store (Firestore)

```typescript
// functions/src/memory/memoryStore.ts

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();
const COLLECTION = 'ai_memory';
const MAX_ARTICLES = 500; // 최근 500개 기사만 유지 (비용 관리)

export async function storeEmbedding(data: {
    articleId: string;
    embedding: number[];
    metadata: any;
}) {
    await db.collection(COLLECTION).doc(data.articleId).set({
        embedding: data.embedding,
        ...data.metadata,
        createdAt: FieldValue.serverTimestamp(),
    });
}

export async function searchSimilar(
    queryEmbedding: number[],
    topK: number = 5,
    maxAgeDays: number = 7
): Promise<Array<{ id: string; score: number; metadata: any }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    // Fetch recent articles (Firestore doesn't support vector search natively,
    // so we do brute-force cosine similarity on recent articles)
    const snapshot = await db.collection(COLLECTION)
        .where('embeddedAt', '>=', cutoffDate.toISOString())
        .orderBy('embeddedAt', 'desc')
        .limit(MAX_ARTICLES)
        .get();

    if (snapshot.empty) return [];

    // Compute cosine similarity
    const results: Array<{ id: string; score: number; metadata: any }> = [];
    
    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data.embedding) continue;

        const score = cosineSimilarity(queryEmbedding, data.embedding);
        results.push({
            id: doc.id,
            score,
            metadata: {
                title: data.title,
                oneLiner: data.oneLiner,
                sentiment: data.sentiment,
                sentimentLabel: data.sentimentLabel,
                category: data.category,
                impactScore: data.impactScore,
                source: data.source,
                publishedAt: data.publishedAt,
            }
        });
    }

    // Sort by combined score (similarity * recency * impact)
    const now = Date.now();
    results.sort((a, b) => {
        const aRecency = 1 / (1 + (now - new Date(a.metadata.publishedAt).getTime()) / 3600000);
        const bRecency = 1 / (1 + (now - new Date(b.metadata.publishedAt).getTime()) / 3600000);
        const aFinal = a.score * 0.6 + aRecency * 0.2 + (a.metadata.impactScore / 10) * 0.2;
        const bFinal = b.score * 0.6 + bRecency * 0.2 + (b.metadata.impactScore / 10) * 0.2;
        return bFinal - aFinal;
    });

    return results.slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

#### 4.3 Memory Gateway (Cloud Function)

```typescript
// functions/src/memory/memoryGateway.ts

export const queryMemory = onCall(async (request) => {
    const { query, topK = 5, maxAgeDays = 7 } = request.data;
    
    // 1. Embed the query
    const queryResult = await embeddingModel.embedContent(query);
    const queryEmbedding = queryResult.embedding.values;
    
    // 2. Search similar articles
    const results = await searchSimilar(queryEmbedding, topK, maxAgeDays);
    
    // 3. Also include current market snapshot
    const insightData = await getLatestInsightSnapshot();
    
    return {
        articles: results,
        marketSnapshot: {
            asi: insightData?.asi || null,
            marketBrief: insightData?.marketBrief || null,
            trendingKeywords: insightData?.narratives?.trendingKeywords || [],
        }
    };
});
```

#### 4.4 AI Chat 통합 (Frontend)

```typescript
// services/ai/marketMemory.ts -- 새 파일

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '../firebaseService';

const functions = getFunctions(getFirebaseApp(), 'us-central1');

/**
 * Query the AI memory for market context relevant to a user's question.
 * Returns formatted context string to inject into the AI prompt.
 */
export async function getMarketMemoryContext(userQuery: string): Promise<string> {
    try {
        const queryMemory = httpsCallable(functions, 'queryMemory');
        const result = await queryMemory({ query: userQuery, topK: 5, maxAgeDays: 7 });
        const data = result.data as any;
        
        if (!data.articles || data.articles.length === 0) {
            return ''; // No relevant context found
        }
        
        let context = '\n\n[MARKET INTELLIGENCE CONTEXT - from Vision Insight]\n';
        context += 'Use this context to provide informed, evidence-based answers about market movements.\n\n';
        
        data.articles.forEach((article: any, i: number) => {
            const timeAgo = getTimeAgo(article.metadata.publishedAt);
            const sentimentBadge = article.metadata.sentimentLabel === 'bullish' ? 'Bullish' 
                : article.metadata.sentimentLabel === 'bearish' ? 'Bearish' : 'Neutral';
            
            context += `${i + 1}. "${article.metadata.title}" `;
            context += `(${article.metadata.source}, ${timeAgo}, `;
            context += `Impact: ${article.metadata.impactScore}/10, ${sentimentBadge})\n`;
            context += `   -> ${article.metadata.oneLiner}\n\n`;
        });
        
        // Add market snapshot if available
        if (data.marketSnapshot?.asi) {
            context += `[Current Market Sentiment: ASI ${data.marketSnapshot.asi.score}/100 `;
            context += `(${data.marketSnapshot.asi.trend}) - ${data.marketSnapshot.asi.summary}]\n`;
        }
        
        if (data.marketSnapshot?.marketBrief) {
            context += `[Trading Bias: ${data.marketSnapshot.marketBrief.tradingBias}]\n`;
        }
        
        context += '\nIMPORTANT: Cite these sources when explaining market movements. ';
        context += 'Say "Vision Insight에 따르면..." or "According to Vision Insight...".\n';
        
        return context;
    } catch (err) {
        console.debug('[MarketMemory] Query failed (non-critical):', err);
        return ''; // Graceful degradation
    }
}

function getTimeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}
```

### Phase 2: Ingestion 파이프라인 연결 (1주)

`getVisionInsight` Cloud Function에서 기사 수집 시 자동으로 임베딩 생성/저장:

```typescript
// getVisionInsight의 기사 수집 후 훅
async function onArticlesCollected(articles: NewsArticle[]) {
    const batch = [];
    for (const article of articles) {
        // 이미 임베딩된 기사는 스킵
        const exists = await db.collection('ai_memory').doc(article.id).get();
        if (exists.exists) continue;
        
        batch.push(embedAndStore(article));
    }
    // 병렬 처리 (배치당 10개)
    for (let i = 0; i < batch.length; i += 10) {
        await Promise.all(batch.slice(i, i + 10));
    }
}
```

### Phase 3: 분산 노드 연동 (2-3주)

#### 3.1 노드측 구현 (vision-node 확장)

```
vision-node/
├── existing node code...
├── memory/
│   ├── shard_manager.js     # 샤드 수신/저장/검색
│   ├── vector_store.js      # 로컬 벡터 인덱스 (HNSW)
│   └── memory_api.js        # HTTP API for search queries
```

노드가 수행할 새 역할:
1. **Memory Shard 수신**: Cloud에서 벡터 청크를 수신하여 로컬에 저장
2. **벡터 검색 처리**: queryMemory 요청 시 로컬 샤드에서 검색 후 결과 반환
3. **헬스 보고**: 어떤 샤드를 보유하고 있는지 주기적으로 보고

#### 3.2 라우팅 및 장애 대응

```
[Cloud Function: queryMemory]
  │
  ├─ 1. Firestore에서 샤드 라우팅 테이블 조회
  │     shard_routing: {
  │       shard_0: [nodeA, nodeD, nodeG],
  │       shard_1: [nodeB, nodeE, nodeH],
  │       ...
  │     }
  │
  ├─ 2. 질문의 임베딩으로 연관 샤드 결정 (locality-sensitive hashing)
  │
  ├─ 3. 해당 샤드의 노드들에 병렬 검색 요청 (1개만 성공하면 OK)
  │     └─ 타임아웃: 2초, 실패 시 다음 복제 노드로 fallback
  │
  └─ 4. Firestore 브루트포스 검색을 최종 fallback으로 유지
       (분산 노드 전부 응답 없을 때)
```

#### 3.3 노드 보상 모델

Memory 관련 작업에 대한 추가 보상:

| 작업 | 보상 |
|------|------|
| 샤드 저장 (월간) | +5 RP / 샤드 |
| 검색 쿼리 처리 | +0.1 RP / 쿼리 |
| 가용성 99%+ 유지 | +20 RP / 월 보너스 |

---

## 5. 비용 분석

### Phase 1 (Firestore 기반)

| 항목 | 예상 비용/월 |
|------|------------|
| Gemini Embedding API (500기사 x 30일) | ~$2 |
| Firestore 읽기 (검색당 500doc, 일 1000검색) | ~$15 |
| Firestore 저장 (500 x 768 x 4B = 1.5MB/기사 x 500) | ~$0.5 |
| **합계** | **~$17.5/월** |

### Phase 3 (분산 노드 이전 후)

| 항목 | 예상 비용/월 |
|------|------------|
| Gemini Embedding API | ~$2 |
| Firestore (메타데이터만, 벡터 제거) | ~$3 |
| 노드 통신 (Cloud Run 중계) | ~$5 |
| **합계** | **~$10/월** |

벡터 데이터를 분산 노드로 이전하면 Firestore 비용이 약 70% 절감됩니다.

---

## 6. AI 챗 프롬프트 통합 예시

### Before (현재)
```
유저: "비트코인 왜 올랐어?"
AI: "비트코인이 현재 $64,371입니다. 가격 변동은 다양한 요인에 의해..."
(구체적 근거 없는 일반적 답변)
```

### After (개선 후)
```
유저: "비트코인 왜 올랐어?"

[AI가 수신하는 프롬프트]:
...
[MARKET INTELLIGENCE CONTEXT - from Vision Insight]
1. "Bitcoin ETF sees record $1.2B single-day inflow" 
   (CoinDesk, 3h ago, Impact: 9.1/10, Bullish)
   -> BlackRock's IBIT leads with $580M...

2. "Fed minutes hint at June rate cut" 
   (Reuters, 5h ago, Impact: 7.8/10, Bullish) 
   -> FOMC minutes reveal dovish pivot...

3. "Bitcoin whale addresses accumulate 15,000 BTC in 48h"
   (Glassnode, 8h ago, Impact: 7.2/10, Bullish)
   -> On-chain data shows significant whale buying...

[Current Market Sentiment: ASI 78/100 (BULLISH)]
[Trading Bias: LONG]
...

AI 답변:
"비트코인이 현재 $64,371로 24시간 동안 4.2% 상승했습니다.

Vision Insight에 따르면 주요 상승 요인은:

1. **ETF 대규모 유입**: BlackRock IBIT를 중심으로 하루에 $12억이 유입되며 
   역대 최대 기록을 경신했습니다.

2. **연준 금리 인하 신호**: FOMC 회의록에서 6월 금리 인하 가능성이 시사되며 
   위험 자산 선호가 강화되었습니다.

3. **고래 축적**: 지난 48시간 동안 대형 지갑에서 15,000 BTC가 
   축적되어 매수세가 강한 것으로 분석됩니다.

현재 ASI(시장 심리 지수)는 78/100으로 강한 강세를 보이고 있습니다."
```

---

## 7. 구현 우선순위

```
Week 1: [Phase 1 - Firestore MVP]
├─ Cloud Function: embedArticle (Gemini text-embedding-004)
├─ Cloud Function: queryMemory (brute-force cosine similarity)
├─ getVisionInsight 훅: 기사 수집 시 자동 임베딩
├─ services/ai/marketMemory.ts 생성
└─ AI 챗 프롬프트에 Market Memory 컨텍스트 주입

Week 2: [Phase 2 - 최적화]
├─ 임베딩 캐시 (중복 기사 방지)
├─ 시간 기반 자동 정리 (30일 이상 삭제)
├─ 검색 결과 품질 튜닝 (가중치 조정)
└─ AI 챗에서 "Vision Insight 기반" 답변 품질 검증

Week 3-4: [Phase 3 - 분산 노드]
├─ vision-node에 Memory Shard Manager 추가
├─ 샤드 분배/복제 로직 구현
├─ 노드 검색 API + Cloud Function 라우팅
├─ 장애 대응 (fallback to Firestore)
└─ 노드 보상 모델 적용
```

---

## 8. 기술 선택 근거

| 결정 | 선택 | 이유 |
|------|------|------|
| 임베딩 모델 | Gemini text-embedding-004 | 이미 Firebase/GCP 생태계, 768차원으로 충분, 비용 효율 |
| Phase 1 저장소 | Firestore | 이미 사용 중, 빠른 MVP, 500개 기사 기준 brute-force 시 ~50ms |
| 분산 인덱스 | HNSW (Hierarchical Navigable Small World) | 검색 속도 O(log N), 메모리 효율, Node.js 구현체 있음 (hnswlib-node) |
| 샤드 전략 | Consistent Hashing + Replication Factor 3 | 노드 추가/이탈 시 최소 재분배, 3중 복제로 가용성 보장 |
| 벡터 직렬화 | Float32 Binary (.vbin) | JSON 대비 75% 용량 절감, 파싱 속도 빠름 |
