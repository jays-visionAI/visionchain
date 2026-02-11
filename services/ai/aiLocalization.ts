
export interface LanguageConfig {
    chat: {
        analyzingIntent: string;
        simulating: string;
        responseGenerated: string;
        accountNotFound: (recipient: string) => string;
        scheduledConfirm: (amount: string, symbol: string, time: string) => string;
        intentPrepared: (intentName: string) => string;
        errorInvalidAmount: string;
    };
    intents: {
        keywords: {
            bridge: string[];
            schedule: string[];
            send: string[];
            timeAfter: string[];
        };
        patterns: {
            // Returns [amount, token, recipient] or [recipient, amount, token]
            send: {
                regex: RegExp;
                mapping: { amount: number; token: number; recipient: number };
            }[];
            // Returns [amount, token, recipient, timeVal, timeUnit] or similar
            schedule: {
                regex: RegExp;
                mapping: { amount: number; token: number; recipient: number; timeVal: number; timeUnit: number };
            }[];
            // Returns [amount, token, destinationChain] or [amount, token, sourceChain, destinationChain]
            bridge: {
                regex: RegExp;
                mapping: { amount: number; token: number; chain: number; recipient?: number; sourceChain?: number };
            }[];
        };
        intentNames: Record<string, string>;
        timeUnits: Record<string, string>; // min -> 분, etc.
    };
}

export const AI_LOCALIZATION: Record<string, LanguageConfig> = {
    en: {
        chat: {
            analyzingIntent: 'Analyzing Intent...',
            simulating: 'Comparing Portfolio & Simulating...',
            responseGenerated: 'Response Generated',
            accountNotFound: (name) => `I couldn't find a wallet address for '${name}'. Please check your contacts or enter the 0x address manually.`,
            scheduledConfirm: (amount, symbol, time) => `I've prepared your scheduled transfer of ${amount} ${symbol} (${time}).`,
            intentPrepared: (intent) => `I've prepared the ${intent} for you. Please review the details on your screen to proceed!`,
            errorInvalidAmount: "Please enter a valid amount."
        },
        intents: {
            keywords: {
                // Include Ethereum-related keywords since testnet uses Sepolia
                bridge: ['bridge', 'move to', 'cross-chain', 'to ethereum', 'to eth', 'to erc-20', 'erc20', 'to sepolia', 'to mainnet'],
                schedule: [' in ', ' after '],
                send: ['send', 'pay', 'transfer'],
                timeAfter: ['in', 'after']
            },
            patterns: {
                send: [
                    {
                        regex: /(?:send|pay|transfer)\s+([0-9.]+)\s+([a-zA-Z]+)\s+(?:to|for)\s+(@?[a-zA-Z0-9@.]+)/i,
                        mapping: { amount: 1, token: 2, recipient: 3 }
                    }
                ],
                schedule: [
                    {
                        regex: /(?:send|pay|transfer)\s+([0-9.]+)\s+([a-zA-Z]+)\s+(?:to|for)\s+(@?[a-zA-Z0-9@.]+)\s+(?:in|after)\s+(\d+)\s*(mins?|minutes?|hours?|h|m)/i,
                        mapping: { amount: 1, token: 2, recipient: 3, timeVal: 4, timeUnit: 5 }
                    }
                ],
                bridge: [
                    // Reverse bridge: "bridge 1.1 VCN from sepolia to vision chain"
                    {
                        regex: /(?:bridge|move|transfer)\s+([0-9.]+)\s+([a-zA-Z]+)\s+(?:from|on)\s+(sepolia|ethereum|eth|erc-?20)\s+to\s+(vision\s*chain|vcn|vision)/i,
                        mapping: { amount: 1, token: 2, sourceChain: 3, chain: 4 }
                    },
                    // Reverse bridge with "sepolia VCN": "bridge 1.1 sepolia VCN to vision chain"
                    {
                        regex: /(?:bridge|move|transfer)\s+([0-9.]+)\s+(?:sepolia|ethereum|eth)\s+([a-zA-Z]+)\s+to\s+(vision\s*chain|vcn|vision)/i,
                        mapping: { amount: 1, token: 2, chain: 3, sourceChain: -1 }
                    },
                    // Bridge to recipient: "bridge 2 VCN to sepolia for @jays"
                    {
                        regex: /(?:bridge|move)\s+([0-9.]+)\s+([a-zA-Z]+)\s+to\s+([a-zA-Z0-9-]+)\s+(?:for|to)\s+(@?[a-zA-Z0-9@.]+)/i,
                        mapping: { amount: 1, token: 2, chain: 3, recipient: 4 }
                    },
                    // Standard bridge pattern (no recipient)
                    {
                        regex: /(?:bridge|move)\s+([0-9.]+)\s+([a-zA-Z]+)\s+to\s+([a-zA-Z0-9-]+)/i,
                        mapping: { amount: 1, token: 2, chain: 3 }
                    },
                    // "Convert to Ethereum" pattern
                    {
                        regex: /(?:convert|change|swap)\s+([0-9.]+)\s+([a-zA-Z]+)\s+to\s+(?:ethereum|eth|erc-?20|sepolia)/i,
                        mapping: { amount: 1, token: 2, chain: 3 }
                    },
                    // "Send to Ethereum network" pattern
                    {
                        regex: /(?:send|transfer)\s+([0-9.]+)\s+([a-zA-Z]+)\s+to\s+(?:ethereum|eth|erc-?20|sepolia)(?:\s+network)?/i,
                        mapping: { amount: 1, token: 2, chain: 3 }
                    }
                ]
            },
            intentNames: { 'send': 'transfer', 'swap': 'swap', 'bridge': 'bridge', 'stake': 'staking', 'schedule': 'scheduled transfer', 'transaction': 'transaction' },
            timeUnits: {}
        }
    },
    ko: {
        chat: {
            analyzingIntent: '의도 분석 중...',
            simulating: '포트폴리오 분석 및 시뮬레이션...',
            responseGenerated: '응답 생성 완료',
            accountNotFound: (name) => `죄송합니다. '${name}' 님의 지갑 주소를 찾을 수 없습니다. 주소록을 확인하거나 직접 0x 주소를 입력해 주세요.`,
            scheduledConfirm: (amount, symbol, time) => `일정을 확인했습니다. ${amount} ${symbol} (${time}) 예약 이체 설정을 시작합니다.`,
            intentPrepared: (intent) => `요청하신 ${intent} 업무를 준비했습니다. 화면의 내용을 확인하고 진행해 주세요!`,
            errorInvalidAmount: "유효한 수량을 입력해주세요."
        },
        intents: {
            keywords: {
                // 테스트넷에서는 이더리움 = Sepolia로 매핑
                bridge: ['브릿지', '브릿징', '옮겨', '이동', '이더리움', '이더로', '이더계열', 'erc-20', 'erc20', '세폴리아', '비전체인', '비전체인으로', '비전으로'],
                schedule: [' 뒤에', ' 후에', ' 예약'],
                send: ['보내', '이체', '송금', '결제', '전송'],
                timeAfter: ['뒤에', '후에', '이후에']
            },
            patterns: {
                send: [
                    {
                        regex: /(@?[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣@.]+)(?:에게|께)\s+([0-9.]+)\s*([a-zA-Z]+)\s*(?:보내|이체|송금|전송|결제)/i,
                        mapping: { recipient: 1, amount: 2, token: 3 }
                    },
                    {
                        regex: /(?:보내|이체|송금|전송|결제)\s+([0-9.]+)\s+([a-zA-Z]+)\s+(?:에게|께)\s+(@?[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣@.]+)/i,
                        mapping: { amount: 1, token: 2, recipient: 3 }
                    }
                ],
                schedule: [
                    {
                        regex: /(@?[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣@.]+)(?:에게|께)\s+([0-9.]+)\s*([a-zA-Z]+)\s+(\d+)\s*(mins?|minutes?|hours?|h|m|분|시간)\s*(?:뒤에|후에|시간 후에|이후에)\s*(?:보내|이체|송금|예약)/i,
                        mapping: { recipient: 1, amount: 2, token: 3, timeVal: 4, timeUnit: 5 }
                    }
                ],
                bridge: [
                    // ===== REVERSE BRIDGE PATTERNS (Sepolia -> Vision Chain) =====
                    // 핵심 역브릿지 패턴: "내 1.1 VCN 세폴리아를 비전체인으로 브릿징 해줘"
                    // "VCN 세폴리아" = Sepolia VCN (소스), "비전체인으로" = to Vision Chain (목적지)
                    {
                        regex: /(?:내\s+)?([0-9.]+)\s*(?:VCN|vcn)\s*(?:세폴리아|이더리움|이더)\s*(?:를|을)?\s*(?:비전체인|비전|vision\s*chain|vision)\s*(?:으로|로)?\s*(?:브릿지|브릿징|옮겨|이동|보내|전송)/i,
                        mapping: { amount: 1, token: 2, sourceChain: -1, chain: 3 }
                    },
                    // "세폴리아 VCN을 비전체인으로 브릿징 해줘"
                    {
                        regex: /(?:내\s+)?(?:세폴리아|이더리움|이더)\s*(?:VCN|vcn)\s+([0-9.]+)\s*(?:를|을)?\s*(?:비전체인|비전|vision\s*chain|vision)\s*(?:으로|로)?\s*(?:브릿지|브릿징|옮겨|이동|보내|전송)/i,
                        mapping: { amount: 1, token: 2, sourceChain: -1, chain: 3 }
                    },
                    // "세폴리아에서 비전체인으로 1.1 VCN 브릿지"
                    {
                        regex: /(?:세폴리아|이더리움|이더)\s*(?:에서|부터)?\s*(?:비전체인|비전|vision\s*chain|vision)\s*(?:으로|로)?\s*([0-9.]+)\s*([a-zA-Z]+)\s*(?:브릿지|브릿징|옮겨|이동|보내|전송)/i,
                        mapping: { amount: 1, token: 2, sourceChain: -1, chain: 3 }
                    },
                    // "1.1 VCN을 세폴리아에서 비전체인으로 브릿지"
                    {
                        regex: /([0-9.]+)\s*([a-zA-Z]+)\s*(?:을|를)?\s*(?:세폴리아|이더리움|이더)\s*(?:에서|부터)\s*(?:비전체인|비전|vision\s*chain|vision)\s*(?:으로|로)?\s*(?:브릿지|브릿징|옮겨|이동|보내|전송)/i,
                        mapping: { amount: 1, token: 2, sourceChain: -1, chain: 3 }
                    },
                    // "비전체인으로 1.1 세폴리아 VCN 브릿지"
                    {
                        regex: /(?:비전체인|비전|vision\s*chain|vision)\s*(?:으로|로)\s+([0-9.]+)\s*(?:세폴리아|이더리움|이더)?\s*([a-zA-Z]+)\s*(?:브릿지|브릿징|옮겨|이동|보내|전송)/i,
                        mapping: { amount: 1, token: 2, sourceChain: -1, chain: 3 }
                    },

                    // ===== FORWARD BRIDGE PATTERNS (Vision Chain -> Sepolia) =====
                    // 수신자 + 브릿지 패턴: "박지현에게 2vcn 세폴리아로 브릿징해서 보내줘"
                    {
                        regex: /(@?[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣@.]+)(?:에게|께)\s+([0-9.]+)\s*([a-zA-Z]+)\s*(?:을|를)?\s*(?:이더리움|이더|erc-?20|세폴리아)(?:으로|로)?\s*(?:브릿지|브릿징|옮겨|이동)(?:해서)?\s*(?:보내|전송)/i,
                        mapping: { recipient: 1, amount: 2, token: 3, chain: 4 }
                    },
                    // 수신자 + 브릿지 패턴2: "박지현에게 2 VCN 브릿지 전송해줘" (세폴리아 = default)
                    {
                        regex: /(@?[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣@.]+)(?:에게|께)\s+([0-9.]+)\s*([a-zA-Z]+)\s*(?:브릿지|브릿징)\s*(?:보내|전송)/i,
                        mapping: { recipient: 1, amount: 2, token: 3, chain: 4 }
                    },
                    // 기본 브릿지 패턴: "1 VCN 브릿지 to Ethereum"
                    {
                        regex: /([0-9.]+)\s+([a-zA-Z]+)\s+(?:브릿지|옮겨|이동)\s+(?:to|로|으로)\s+([a-zA-Zㄱ-ㅎㅏ-ㅣ가-힣0-9-]+)/i,
                        mapping: { amount: 1, token: 2, chain: 3 }
                    },
                    // 이더리움으로 변환 패턴: "1 VCN을 이더리움으로 바꿔줘"
                    {
                        regex: /([0-9.]+)\s*([a-zA-Z]+)\s*(?:을|를)?\s*(?:이더리움|이더|erc-?20|세폴리아)(?:으로|로)?\s*(?:바꿔|변환|전환|보내)/i,
                        mapping: { amount: 1, token: 2, chain: 3 }
                    },
                    // 이더리움 계열로 보내기: "이더리움으로 1 VCN 보내줘"
                    {
                        regex: /(?:이더리움|이더|erc-?20|세폴리아)(?:으로|로)?\s+([0-9.]+)\s*([a-zA-Z]+)\s*(?:보내|이동|옮겨|브릿지)/i,
                        mapping: { amount: 1, token: 2, chain: 3 }
                    },
                    // "1 VCN을 이더리움으로 보내줘" 패턴
                    {
                        regex: /([0-9.]+)\s*([a-zA-Z]+)\s*(?:이더리움|이더|erc-?20|세폴리아)(?:으로|로)\s*(?:보내|전송|이동)/i,
                        mapping: { amount: 1, token: 2, chain: 3 }
                    }
                ]
            },
            intentNames: { 'send': '송금', 'swap': '스왑', 'bridge': '브릿지', 'stake': '스테이킹', 'schedule': '예약 송금', 'transaction': '트랜잭션' },
            timeUnits: { '분': 'min', '시간': 'hour', '초': 'sec' }
        }
    },
    ja: {
        chat: {
            analyzingIntent: '意図を分析中...',
            simulating: 'ポートフォリオ分析とシュミレーション...',
            responseGenerated: '回答の生成完了',
            accountNotFound: (name) => `'${name}' さんのウォレットアドレスが見つかりませんでした。連絡先を確認するか、0xアドレスを直接入力してください。`,
            scheduledConfirm: (amount, symbol, time) => `スケジュールを確認しました。${amount} ${symbol} (${time}) の予約送金設定を開始します。`,
            intentPrepared: (intent) => `ご依頼の ${intent} の準備ができました。画面の内容を確認して進めてください。`,
            errorInvalidAmount: "有効な数量を入力してください。"
        },
        intents: {
            keywords: {
                bridge: ['ブリッジ', '移動'],
                schedule: ['後で', '予約'],
                send: ['送って', '送金', '支払い'],
                timeAfter: ['後', '以降']
            },
            patterns: {
                send: [
                    {
                        regex: /(@?[a-zA-Z0-9@.]+)\s*(?:に|え)\s*([0-9.]+)\s*([a-zA-Z]+)\s*(?:送って|送金|支払い)/i,
                        mapping: { recipient: 1, amount: 2, token: 3 }
                    }
                ],
                schedule: [],
                bridge: []
            },
            intentNames: { 'send': '送金', 'swap': 'スワップ', 'bridge': 'ブリッジ', 'stake': 'ステーキング', 'schedule': '予約送金', 'transaction': 'トランザクション' },
            timeUnits: { '分': 'min', '時間': 'hour', '秒': 'sec' }
        }
    }
};
