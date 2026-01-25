import { contractService } from './contractService';

export interface UserIntent {
    action: 'TRANSFER' | 'BRIDGE' | 'SWAP_AND_SEND' | 'SCHEDULE_TRANSFER' | 'UNKNOWN';
    params: {
        to?: string; // e.g. "jays" or "0x..."
        token?: string; // "VCN", "USDC"
        amount?: string;
        sourceChain?: string;
        destinationChain?: string; // "ETHEREUM", "POLYGON"
        scheduleTime?: string; // "30m", "1h"
    };
    raw: string;
    confidence: number;
    explanation: string;
}

/**
 * Service to parse natural language into structured Intents.
 * Future: Connect to OpenAI/Gemini API.
 * Current: Advanced Regex/Heuristic Parser.
 */
export class IntentParserService {

    constructor() { }

    async parseIntent(input: string): Promise<UserIntent> {
        const lower = input.toLowerCase();

        // 1. Detect "Bridge" Intent (English & Korean)
        if (lower.includes('bridge') || lower.includes('move to') || lower.includes('cross-chain') || lower.includes('브릿지') || lower.includes('옮겨')) {
            return this.parseBridgeIntent(input);
        }

        // 2. Detect "Schedule" Intent (English & Korean)
        const isSchedule = (lower.includes('send') || lower.includes('transfer') || lower.includes('보내') || lower.includes('이체') || lower.includes('송금')) &&
            (lower.includes(' in ') || lower.includes(' after ') || lower.includes(' 뒤에') || lower.includes(' 후에') || lower.includes(' 예약'));

        if (isSchedule) {
            return this.parseScheduledTransfer(input);
        }

        // 3. Detect "Send" Intent (possibly Auto-Swap) (English & Korean)
        if (lower.includes('send') || lower.includes('pay') || lower.includes('transfer') || lower.includes('보내') || lower.includes('이체') || lower.includes('송금') || lower.includes('결제')) {
            return this.parseTransferIntent(input);
        }

        return {
            action: 'UNKNOWN',
            params: {},
            raw: input,
            confidence: 0,
            explanation: "I couldn't understand that request. Try 'Send 10 VCN to @jays' or 'Bridge 100 VCN to Ethereum'."
        };
    }

    private async parseTransferIntent(input: string): Promise<UserIntent> {
        // Regex for: "Send 10 VCN to @jays"
        // Also supports Korean: "노장협에게 10 VCN 보내"
        const regex = /(?:send|pay|transfer|보내|이체|송금|결제)\s+([0-9.]+)\s+([a-zA-Z]+)\s+(?:to|for|에게)\s+(@?[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣@.]+)/i;
        const koRegex = /(@?[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣@.]+)(?:에게|께)\s+([0-9.]+)\s*([a-zA-Z]+)\s*(?:보내|이체|송금|전송)/i;

        let match = input.match(regex);
        let final_amount = "";
        let final_token = "";
        let final_recipient = "";

        if (match) {
            [, final_amount, final_token, final_recipient] = match;
        } else {
            match = input.match(koRegex);
            if (match) {
                [, final_recipient, final_amount, final_token] = match;
            }
        }

        if (!match) {
            return {
                action: 'UNKNOWN',
                params: {},
                raw: input,
                confidence: 0.2,
                explanation: "Please specify amount, token and recipient (e.g. 'Send 10 VCN to @jays')"
            };
        }

        // Scenario: Auto-Settlement Check
        // If recipient is a VNS handle (@), we check their preference.
        let explanation = `Sending ${final_amount} ${final_token} to ${final_recipient}.`;

        // Mocking the "Smart" logic:
        if (final_recipient.toLowerCase() === '@alice' && final_token.toUpperCase() === 'USDC') {
            return {
                action: 'SWAP_AND_SEND',
                params: {
                    to: final_recipient,
                    token: final_token.toUpperCase(),
                    amount: final_amount
                },
                raw: input,
                confidence: 0.95,
                explanation: `Detected intent to pay @alice. Her preference is WBTC. I will AUTO-SWAP ${final_amount} USDC -> WBTC and send it to her.`
            };
        }

        return {
            action: 'TRANSFER',
            params: {
                to: final_recipient,
                token: final_token.toUpperCase(),
                amount: final_amount
            },
            raw: input,
            confidence: 0.9,
            explanation: explanation
        };
    }

    private async parseScheduledTransfer(input: string): Promise<UserIntent> {
        // Regex: "Send 10 VCN to @jays in 30 mins"
        const regex = /(?:send|pay|transfer)\s+([0-9.]+)\s+([a-zA-Z]+)\s+(?:to|for|에게)\s+(@?[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣@.]+)\s+(?:in|after|뒤에|후에)\s+(\d+)\s*(mins?|minutes?|hours?|h|m|분|시간)/i;
        const koRegex = /(@?[a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣@.]+)(?:에게|께)\s+([0-9.]+)\s*([a-zA-Z]+)\s+(\d+)\s*(mins?|minutes?|hours?|h|m|분|시간)\s*(?:뒤에|후에|시간 후에|이후에)\s*(?:보내|이체|송금|예약)/i;

        let match = input.match(regex);
        let s_amount = "";
        let s_token = "";
        let s_recipient = "";
        let s_timeVal = "";
        let s_timeUnit = "";

        if (match) {
            [, s_amount, s_token, s_recipient, s_timeVal, s_timeUnit] = match;
        } else {
            match = input.match(koRegex);
            if (match) {
                [, s_recipient, s_amount, s_token, s_timeVal, s_timeUnit] = match;
            }
        }

        if (!match) {
            return this.parseTransferIntent(input); // Fallback to normal transfer if time parse fails
        }

        const timeStr = `${s_timeVal} ${s_timeUnit}`;

        return {
            action: 'SCHEDULE_TRANSFER',
            params: {
                to: s_recipient,
                token: s_token.toUpperCase(),
                amount: s_amount,
                scheduleTime: timeStr
            },
            raw: input,
            confidence: 0.95,
            explanation: `I will schedule a transfer of ${s_amount} ${s_token} to ${s_recipient} in ${timeStr}. funds will be locked now.`
        };
    }

    private async parseBridgeIntent(input: string): Promise<UserIntent> {
        // Regex for: "Bridge 100 VCN to Ethereum"
        const regex = /(?:bridge|move)\s+([0-9.]+)\s+([a-zA-Z]+)\s+to\s+([a-zA-Z]+)/i;
        const match = input.match(regex);

        if (!match) {
            return {
                action: 'UNKNOWN',
                params: {},
                raw: input,
                confidence: 0.4,
                explanation: "Please specify amount, asset and destination chain."
            };
        }

        const [_, amount, token, chain] = match;

        return {
            action: 'BRIDGE',
            params: {
                token: token.toUpperCase(),
                amount: amount,
                destinationChain: chain.toUpperCase()
            },
            raw: input,
            confidence: 0.9,
            explanation: `Bridging ${amount} ${token} from Vision Chain to ${chain}.`
        };
    }
}

export const intentParser = new IntentParserService();
