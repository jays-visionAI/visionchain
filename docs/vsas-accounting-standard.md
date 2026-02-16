# VisionScan Accounting Standard (VSAS) -- Design Document

블록체인 트랜잭션을 회계 소프트웨어가 즉시 소비할 수 있는 표준 형식으로 변환하는 **업계 최초의 회계 등급 블록 익스플로러** 설계.

> [!IMPORTANT]
> 핵심 전략: 개별 플랫폼 커넥터가 아닌 **VSAS 표준 자체**를 정의하고 공개하여 시장을 선점.
> ISO 20022 + XBRL GL 정렬. Xero, SAP, 더존 등 어떤 회계 소프트웨어든 **우리 API 하나로 연동**.

---

## 1. VSAS 데이터 모델: Accounting Transaction Object (ATO)

```json
{
  "vsas_version": "1.0",
  "ato_id": "vsas_2026021600001",
  "source": {
    "chain": "vision-chain",
    "chain_id": 7979,
    "tx_hash": "0xabc...",
    "block_number": 12345,
    "block_timestamp": "2026-02-16T15:00:00Z"
  },
  "classification": {
    "type": "transfer",
    "direction": "outgoing",
    "category": "operating_expense",
    "sub_category": "service_fee",
    "auto_classified": true,
    "confidence": 0.95
  },
  "entries": [
    {
      "line": 1,
      "account_code": "8130",
      "account_name": "디지털자산처분손실",
      "debit": "100.00",
      "credit": "0.00",
      "currency": "VCN",
      "description": "Agent operation fee"
    },
    {
      "line": 2,
      "account_code": "1081",
      "account_name": "디지털자산(VCN)",
      "debit": "0.00",
      "credit": "100.00",
      "currency": "VCN",
      "description": "VCN token outflow"
    }
  ],
  "fiat_valuation": {
    "base_currency": "KRW",
    "rates": { "VCN_KRW": 650, "VCN_USD": 0.50 },
    "total_fiat": { "KRW": 65000, "USD": 50.00 },
    "rate_source": "internal_oracle",
    "rate_timestamp": "2026-02-16T15:00:00Z"
  },
  "counterparty": {
    "address": "0xdef...",
    "name": "Staking Contract",
    "type": "smart_contract",
    "known": true
  },
  "tax": {
    "vat_applicable": false,
    "tax_type": "exempt",
    "withholding": false
  },
  "metadata": {
    "labels": ["agent-operation"],
    "memo": "",
    "fiscal_year": "2026",
    "period": "Q1",
    "department": "",
    "project": "",
    "cost_center": ""
  }
}
```

### 표준 정렬

| VSAS | XBRL GL | ISO 20022 | K-IFRS |
|------|---------|-----------|--------|
| `ato_id` | `documentNumber` | `EndToEndId` | 전표번호 |
| `entries[].account_code` | `accountMainID` | N/A | 계정과목코드 |
| `entries[].debit/credit` | `amount` + `debitCreditCode` | `Amount` | 차변/대변 |
| `fiat_valuation.rates` | `exchangeRate` | `XchgRate` | 환율 |
| `counterparty` | `identifierDescription` | `Nm` | 거래처 |
| `tax.vat_applicable` | `taxInformation` | N/A | 부가세 적용여부 |

---

## 2. 계정과목 체계 (Chart of Accounts)

> K-IFRS / K-GAAP / 더존 4자리 코드 체계 기반. 블록체인 특화 계정은 기존 체계 안에 자연스럽게 통합.

### 1000 -- 유동자산 (Current Assets)

| 코드 | 계정과목 | 영문명 | 블록체인 확장 | 더존코드 |
|------|---------|--------|-------------|---------|
| **1010** | **당좌자산** | | | |
| 1011 | 현금 | Cash | | 101 |
| 1012 | 소액현금 | Petty Cash | | 102 |
| 1013 | 보통예금 | Checking Account | | 103 |
| 1014 | 정기예금 | Savings Deposit | | 104 |
| 1015 | 당좌예금 | Current Account | | 105 |
| 1016 | 단기금융상품 | Short-term Financial Instruments | | 106 |
| 1017 | 현금성자산 | Cash Equivalents | | 107 |
| **1080** | **디지털자산 (유동)** | **Digital Assets (Current)** | | |
| 1081 | 디지털자산 - 네이티브토큰(VCN) | Digital Assets - Native Token | 체인 네이티브 코인 | - |
| 1082 | 디지털자산 - ERC-20토큰 | Digital Assets - ERC-20 Tokens | 토큰별 세목 확장 | - |
| 1083 | 디지털자산 - 스테이블코인 | Digital Assets - Stablecoins | USDT/USDC 등 | - |
| 1084 | 디지털자산 - 타체인 보유분 | Digital Assets - Other Chain | 브릿지된 자산 | - |
| 1085 | 디지털자산 - 브릿지이체중 | Digital Assets - In Transit | 브릿지 진행중 | - |
| 1086 | 디지털자산 - NFT(유동) | Digital Assets - NFT (Current) | 단기매매 NFT | - |
| **1100** | **매출채권** | | | |
| 1101 | 외상매출금 | Accounts Receivable | | 108 |
| 1102 | 받을어음 | Notes Receivable | | 110 |
| 1103 | 매출채권(디지털) | Digital Receivables | 온체인 미수 토큰 | - |
| **1120** | **기타 당좌자산** | | | |
| 1121 | 미수금 | Other Receivables | | 120 |
| 1122 | 미수수익 | Accrued Revenue | | 121 |
| 1123 | 선급금 | Advance Payments | | 122 |
| 1124 | 선급비용 | Prepaid Expenses | | 123 |
| 1125 | 부가세대급금 | VAT Receivable | | 135 |
| 1126 | 가지급금 | Suspense Payments | | 132 |
| 1127 | 미수 스테이킹보상 | Accrued Staking Rewards | 클레임 가능 보상 | - |
| 1128 | 미수 노드보상 | Accrued Node Rewards | 노드 운영 보상 | - |
| **1200** | **재고자산** | | | |
| 1201 | 상품 | Merchandise | | 141 |
| 1202 | 제품 | Finished Goods | | 142 |
| 1203 | 반제품 | Semi-finished Goods | | 143 |
| 1204 | 재공품 | Work in Process | | 144 |
| 1205 | 원재료 | Raw Materials | | 146 |
| 1206 | 저장품 | Supplies | | 147 |
| 1207 | 미착품 | Goods in Transit | | 148 |

### 2000 -- 비유동자산 (Non-current Assets)

| 코드 | 계정과목 | 영문명 | 블록체인 확장 | 더존코드 |
|------|---------|--------|-------------|---------|
| **2010** | **투자자산** | | | |
| 2011 | 장기금융상품 | Long-term Financial Instruments | | 211 |
| 2012 | 매도가능금융자산 | Available-for-Sale Securities | | 212 |
| 2013 | 만기보유금융자산 | Held-to-Maturity Securities | | 213 |
| 2014 | 장기대여금 | Long-term Loans | | 214 |
| 2015 | 투자부동산 | Investment Property | | 215 |
| 2016 | 지분법적용투자주식 | Equity Method Investments | | 216 |
| 2017 | 디지털자산(비유동) | Digital Assets (Non-current) | 장기보유 토큰 | - |
| 2018 | 스테이킹자산 | Staked Digital Assets | 락업된 스테이킹 | - |
| 2019 | 디파이예치자산 | DeFi Deposited Assets | LP/Yield farming | - |
| **2100** | **유형자산** | | | |
| 2101 | 토지 | Land | | 221 |
| 2102 | 건물 | Buildings | | 222 |
| 2103 | 구축물 | Structures | | 223 |
| 2104 | 기계장치 | Machinery | 마이닝/노드 HW | 224 |
| 2105 | 차량운반구 | Vehicles | | 225 |
| 2106 | 비품 | Fixtures & Equipment | | 226 |
| 2107 | 공구와기구 | Tools & Instruments | | 227 |
| 2108 | 건설중인자산 | Construction in Progress | | 228 |
| 2109 | 감가상각누계액 | Accumulated Depreciation | | 229 |
| **2200** | **무형자산** | | | |
| 2201 | 영업권 | Goodwill | | 231 |
| 2202 | 산업재산권 | Industrial Property Rights | | 232 |
| 2203 | 개발비 | Development Costs | | 233 |
| 2204 | 소프트웨어 | Software | 스마트컨트랙트 | 234 |
| 2205 | 라이선스 | Licenses | | 235 |
| 2206 | SBT/DID | Soulbound Token / DID | 온체인 디지털 아이덴티티 | - |
| 2207 | 디지털자산(무형) | Digital Assets - Intangible | 거버넌스 토큰 등 | - |
| **2300** | **기타비유동자산** | | | |
| 2301 | 임차보증금 | Leasehold Deposits | | 241 |
| 2302 | 장기선급비용 | Long-term Prepaid Expenses | | 242 |
| 2303 | 이연법인세자산 | Deferred Tax Assets | | 243 |

### 3000 -- 유동부채 (Current Liabilities)

| 코드 | 계정과목 | 영문명 | 블록체인 확장 | 더존코드 |
|------|---------|--------|-------------|---------|
| 3011 | 외상매입금 | Accounts Payable | | 251 |
| 3012 | 지급어음 | Notes Payable | | 252 |
| 3013 | 단기차입금 | Short-term Borrowings | | 253 |
| 3014 | 미지급금 | Accrued Payables | | 254 |
| 3015 | 미지급비용 | Accrued Expenses | | 255 |
| 3016 | 선수금 | Advance Received | | 256 |
| 3017 | 예수금 | Withholdings | | 257 |
| 3018 | 부가세예수금 | VAT Payable | | 258 |
| 3019 | 유동성장기부채 | Current Portion of LT Debt | | 259 |
| 3020 | 미지급법인세 | Income Tax Payable | | 260 |
| 3021 | 가수금 | Suspense Receipts | | 261 |
| 3022 | 디지털자산부채(유동) | Digital Asset Liability (Current) | 토큰 상환 의무 | - |
| 3023 | 스마트컨트랙트채무 | Smart Contract Obligation | 온체인 의무 이행 잔액 | - |

### 4000 -- 비유동부채 (Non-current Liabilities)

| 코드 | 계정과목 | 영문명 | 블록체인 확장 | 더존코드 |
|------|---------|--------|-------------|---------|
| 4011 | 사채 | Bonds Payable | | 271 |
| 4012 | 장기차입금 | Long-term Borrowings | | 272 |
| 4013 | 퇴직급여충당부채 | Retirement Benefit Obligation | | 273 |
| 4014 | 장기미지급금 | Long-term Payables | | 274 |
| 4015 | 이연법인세부채 | Deferred Tax Liability | | 275 |
| 4016 | 장기선수수익 | Long-term Unearned Revenue | | 276 |
| 4017 | 임대보증금 | Rental Deposits Received | | 277 |
| 4018 | 디지털자산부채(비유동) | Digital Asset Liability (Non-current) | 장기 토큰 의무 | - |

### 5000 -- 자본 (Equity)

| 코드 | 계정과목 | 영문명 | 블록체인 확장 | 더존코드 |
|------|---------|--------|-------------|---------|
| 5011 | 자본금 | Capital Stock | | 301 |
| 5012 | 보통주자본금 | Common Stock | | 302 |
| 5013 | 우선주자본금 | Preferred Stock | | 303 |
| 5021 | 주식발행초과금 | Share Premium | | 311 |
| 5022 | 감자차익 | Gain on Capital Reduction | | 312 |
| 5023 | 자기주식처분이익 | Gain on Treasury Stock | | 313 |
| 5031 | 이익준비금 | Legal Reserve | | 321 |
| 5032 | 임의적립금 | Voluntary Reserve | | 322 |
| 5033 | 미처분이익잉여금 | Retained Earnings | | 331 |
| 5034 | 전기이월이익잉여금 | Retained Earnings B/F | | 332 |
| 5035 | 당기순이익 | Net Income | | 333 |
| 5041 | 자기주식 | Treasury Stock | | 341 |
| 5042 | 기타포괄손익누계액 | Accumulated OCI | | 351 |
| 5043 | 매도가능평가손익 | AOCI - AFS Securities | | 352 |
| 5044 | 디지털자산평가손익 | AOCI - Digital Assets | 토큰 공정가치 변동 | - |
| 5045 | 토큰이코노미자본 | Token Economy Capital | 토큰 발행 자본 | - |

### 6000 -- 매출 (Revenue)

| 코드 | 계정과목 | 영문명 | 블록체인 확장 | 더존코드 |
|------|---------|--------|-------------|---------|
| 6011 | 상품매출 | Sales of Merchandise | | 401 |
| 6012 | 제품매출 | Sales of Products | | 402 |
| 6013 | 용역매출 | Service Revenue | | 403 |
| 6014 | 기타매출 | Other Sales | | 404 |
| 6021 | 디지털자산매출 | Digital Asset Sales Revenue | 토큰 판매 수익 | - |
| 6022 | 노드운영수익 | Node Operation Revenue | 밸리데이터 보상 | - |
| 6023 | 스테이킹보상수익 | Staking Reward Revenue | 스테이킹 보상 | - |
| 6024 | 디파이수익 | DeFi Yield Revenue | LP 보상 등 | - |
| 6025 | 가스비수익 | Gas Fee Revenue | 밸리데이터 가스비 | - |
| 6026 | SBT발행수익 | SBT Minting Revenue | SBT 발행 수수료 | - |
| 6027 | 레퍼럴보상수익 | Referral Reward Revenue | 추천인 보상 | - |
| 6028 | 브릿지수수료수익 | Bridge Fee Revenue | 브릿지 수수료 수취 | - |

### 6500 -- 매출원가 (Cost of Sales)

| 코드 | 계정과목 | 영문명 | 블록체인 확장 | 더존코드 |
|------|---------|--------|-------------|---------|
| 6501 | 상품매출원가 | Cost of Merchandise Sold | | 451 |
| 6502 | 제품매출원가 | Cost of Products Sold | | 452 |
| 6503 | 기초재고액 | Beginning Inventory | | 453 |
| 6504 | 당기매입액 | Purchases | | 454 |
| 6505 | 기말재고액 | Ending Inventory | | 455 |
| 6511 | 재료비 | Material Costs | | 461 |
| 6512 | 노무비 | Labor Costs | | 462 |
| 6513 | 제조경비 | Manufacturing Overhead | | 463 |
| 6521 | 디지털자산취득원가 | Digital Asset Acquisition Cost | 토큰 매입 원가 | - |
| 6522 | 가스비원가 | Gas Fee Cost (COGS) | 필수 가스비 | - |

### 7000 -- 판매비와관리비 (SG&A Expenses)

| 코드 | 계정과목 | 영문명 | 블록체인 확장 | 더존코드 |
|------|---------|--------|-------------|---------|
| 7011 | 급여 | Salaries | | 801 |
| 7012 | 상여금 | Bonuses | | 802 |
| 7013 | 퇴직급여 | Retirement Benefits | | 803 |
| 7014 | 복리후생비 | Employee Benefits | | 804 |
| 7015 | 여비교통비 | Travel Expenses | | 811 |
| 7016 | 접대비 | Entertainment Expenses | | 812 |
| 7017 | 통신비 | Communication Expenses | | 813 |
| 7018 | 수도광열비 | Utilities | | 814 |
| 7019 | 세금과공과 | Taxes and Dues | | 815 |
| 7020 | 감가상각비 | Depreciation | | 816 |
| 7021 | 지급임차료 | Rent Expenses | | 817 |
| 7022 | 보험료 | Insurance | | 818 |
| 7023 | 수선비 | Repairs & Maintenance | | 819 |
| 7024 | 도서인쇄비 | Printing & Publication | | 820 |
| 7025 | 소모품비 | Office Supplies | | 821 |
| 7026 | 운반비 | Freight Expenses | | 823 |
| 7027 | 교육훈련비 | Training Expenses | | 824 |
| 7028 | 지급수수료 | Commission Expenses | | 825 |
| 7029 | 광고선전비 | Advertising | | 826 |
| 7030 | 연구비 | Research Expenses | | 827 |
| 7031 | 경상연구개발비 | R&D Expenses | | 828 |
| 7032 | 대손상각비 | Bad Debt Expense | | 829 |
| 7033 | 무형자산상각비 | Amortization | | 830 |
| 7034 | 차량유지비 | Vehicle Maintenance | | 831 |
| 7035 | 잡비 | Miscellaneous Expenses | | 839 |
| **7050** | **블록체인 운영비** | **Blockchain Operations** | | |
| 7051 | 가스수수료(운영) | Gas Fees (Operations) | 트랜잭션 가스비 | - |
| 7052 | 브릿지수수료(비용) | Bridge Fees | 크로스체인 수수료 | - |
| 7053 | 스마트컨트랙트배포비 | Contract Deployment Cost | 컨트랙트 배포 가스 | - |
| 7054 | SBT/DID발행비 | SBT/DID Minting Cost | 아이덴티티 발행 | - |
| 7055 | 노드운영비 | Node Operation Expenses | HW/인프라 비용 | - |
| 7056 | 오라클수수료 | Oracle Service Fees | 가격 피드 등 | - |
| 7057 | 디지털자산보관수수료 | Digital Asset Custody Fees | 커스터디 비용 | - |
| 7058 | 온체인거버넌스비용 | On-chain Governance Cost | 투표/프로포절 가스 | - |

### 8000 -- 영업외수익/비용 (Non-operating)

| 코드 | 계정과목 | 영문명 | 블록체인 확장 | 더존코드 |
|------|---------|--------|-------------|---------|
| **8010** | **영업외수익** | | | |
| 8011 | 이자수익 | Interest Income | | 901 |
| 8012 | 배당금수익 | Dividend Income | | 902 |
| 8013 | 임대료수익 | Rental Income | | 903 |
| 8014 | 단기투자자산처분이익 | Gain on ST Investment | | 904 |
| 8015 | 유형자산처분이익 | Gain on Asset Disposal | | 905 |
| 8016 | 외환차익 | Foreign Exchange Gain | | 906 |
| 8017 | 외화환산이익 | FX Translation Gain | | 907 |
| 8018 | 잡이익 | Miscellaneous Income | | 908 |
| 8021 | 디지털자산처분이익 | Gain on Digital Asset Disposal | 토큰 매도 차익 | - |
| 8022 | 디지털자산평가이익 | Gain on Digital Asset Revaluation | 공정가치 평가 이익 | - |
| 8023 | 에어드롭수익 | Airdrop Income | 에어드롭 수령 | - |
| 8024 | 하드포크수익 | Hard Fork Income | 포크 토큰 수령 | - |
| **8100** | **영업외비용** | | | |
| 8111 | 이자비용 | Interest Expense | | 911 |
| 8112 | 기타대손상각비 | Other Bad Debt Expense | | 912 |
| 8113 | 단기투자자산처분손실 | Loss on ST Investment | | 913 |
| 8114 | 재고자산감모손실 | Inventory Write-down | | 914 |
| 8115 | 유형자산처분손실 | Loss on Asset Disposal | | 915 |
| 8116 | 외환차손 | Foreign Exchange Loss | | 916 |
| 8117 | 외화환산손실 | FX Translation Loss | | 917 |
| 8118 | 기부금 | Donations | | 918 |
| 8119 | 잡손실 | Miscellaneous Loss | | 919 |
| 8121 | 디지털자산처분손실 | Loss on Digital Asset Disposal | 토큰 매도 차손 | - |
| 8122 | 디지털자산평가손실 | Loss on Digital Asset Revaluation | 공정가치 평가 손실 | - |
| 8123 | 디지털자산손상차손 | Impairment of Digital Assets | 토큰 가치 급락 | - |
| 8124 | 해킹/사고손실 | Hacking/Incident Loss | 보안 사고 손실 | - |
| 8125 | 슬래싱패널티 | Slashing Penalty | 밸리데이터 패널티 | - |

### 9000 -- 법인세비용 (Income Tax)

| 코드 | 계정과목 | 영문명 | 더존코드 |
|------|---------|--------|---------|
| 9011 | 법인세비용 | Income Tax Expense | 951 |
| 9012 | 법인세추납액 | Additional Income Tax | 952 |
| 9013 | 법인세환급액 | Income Tax Refund | 953 |

---

## 3. 회계 소프트웨어별 매핑

### 3.1 매핑 테이블 (주요 계정)

| VSAS | 계정명 | Xero Account Type | SAP G/L | 더존 코드 |
|------|--------|-------------------|---------|----------|
| 1081 | 디지털자산(VCN) | CURRLIAB.610 | 100800 | 108 (세목) |
| 1085 | 브릿지이체중 | CURRENT.611 | 100850 | 108 (세목) |
| 2018 | 스테이킹자산 | NONCURRENT.620 | 201800 | 211 (세목) |
| 1127 | 미수스테이킹보상 | CURRENT.612 | 112700 | 121 (세목) |
| 6023 | 스테이킹보상수익 | REVENUE.310 | 602300 | 404 (세목) |
| 7051 | 가스수수료 | OVERHEADS.477 | 705100 | 825 (세목) |
| 8021 | 디지털자산처분이익 | OTHERINCOME.320 | 802100 | 904 (세목) |
| 8121 | 디지털자산처분손실 | EXPENSE.490 | 812100 | 913 (세목) |

### 3.2 포맷별 내보내기

| 포맷 | 대상 | 용도 |
|------|------|------|
| **VSAS JSON** | 모든 플랫폼 | 표준 (우리가 정의) |
| **Xero Manual Journal CSV** | Xero | ManualJournals import |
| **SAP JournalEntries JSON** | SAP B1 Service Layer | OData POST |
| **더존 전표 Excel** | 더존 iCUBE/Smart | 일괄 전표 업로드 |
| **OFX 2.3** | 범용 금융 | 은행 거래로 import |
| **XBRL GL** | 감사/규제 | 금감원 공시 |
| **CSV (Universal)** | 범용 | 어떤 시스템이든 import |

---

## 4. Auto-Classification Engine

| 온체인 패턴 | 감지 방법 | VSAS 계정 (차변) | VSAS 계정 (대변) |
|------------|----------|-----------------|-----------------|
| ERC-20 transfer (out) | Transfer event, sender=self | 7051 or 7028 | 1081 |
| ERC-20 transfer (in) | Transfer event, recipient=self | 1081 | 6014 or 6023 |
| Staking deposit | stakeFor() call | 2018 | 1081 |
| Staking reward | claimReward() call | 1081 | 6023 |
| Bridge send | Bridge contract interaction | 1085 | 1081 |
| Bridge receive | Bridge mint event | 1084 | 1085 |
| Contract deploy | Contract creation tx | 2204 | 1081 |
| SBT mint | mintAgentIdentity() | 2206 (또는 7054) | 1081 |
| Gas fee | Every tx gas used | 7051 | 1081 |
| Token sell (fiat) | DEX/CEX swap | 1013 | 1081 + 8021 or 8121 |

사용자가 분류를 수정하면 같은 패턴의 향후 거래에 자동 적용 (규칙 학습).

---

## 5. API 설계

```
GET  /api/v1/accounting/transactions
     ?wallet=&start_date=&end_date=&type=&direction=
     &sender=&recipient=&min_amount=&max_amount=
     &chain=&cursor=&limit=500&format=vsas

GET  /api/v1/accounting/journal-entries?wallet=&period=2026-Q1
GET  /api/v1/accounting/trial-balance?wallet=&as_of=
GET  /api/v1/accounting/income-statement?wallet=&period=
GET  /api/v1/accounting/balance-sheet?wallet=&as_of=

POST /api/v1/accounting/classify  (수동 분류 / 규칙 생성)
POST /api/v1/accounting/export    { format: "xero", period: "2026-Q1" }
GET  /api/v1/accounting/chart-of-accounts?standard=vsas|ifrs|kgaap
POST /api/v1/accounting/chart-of-accounts/customize (세목 추가)
```

---

## 6. 구현 로드맵

### Phase 1 (2주): tx_history 고도화 + VSAS Core
- 커서 페이지네이션, 다중 필터 지원
- ATO 데이터 모델 구현, fiat 환율 기록
- 계정과목 마스터 테이블 (200+ accounts)

### Phase 2 (3주): Bookkeeping Engine
- 복식부기 분개 자동 생성, 자동 분류 엔진
- Trial Balance / P&L / BS API
- VisionScan UI 회계 탭

### Phase 3 (4주): Platform Integration
- Xero / SAP / 더존 포맷 내보내기
- CSV / OFX / XBRL GL 내보내기

### Phase 4: Standard Leadership
- VSAS 스펙 OpenAPI 3.0 공개, SDK 배포
