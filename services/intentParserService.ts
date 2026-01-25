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

        // 1. Detect "Bridge" Intent
        if (lower.includes('bridge') || lower.includes('move to') || lower.includes('cross-chain')) {
            return this.parseBridgeIntent(input);
        }

        // 2. Detect "Schedule" Intent
        if ((lower.includes('send') || lower.includes('transfer')) && (lower.includes(' in ') || lower.includes(' after '))) {
            return this.parseScheduledTransfer(input);
        }

        // 3. Detect "Send" Intent (possibly Auto-Swap)
        if (lower.includes('send') || lower.includes('pay') || lower.includes('transfer')) {
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
        // Captures: Amount, Token, Recipient
        const regex = /(?:send|pay|transfer)\s+([0-9.]+)\s+([a-zA-Z]+)\s+(?:to|for)\s+(@?[a-zA-Z0-9]+)/i;
        const match = input.match(regex);

        if (!match) {
            return {
                action: 'UNKNOWN',
                params: {},
                raw: input,
                confidence: 0.2,
                explanation: "Please specify amount, token and recipient (e.g. 'Send 10 VCN to @jays')"
            };
        }

        const [_, amount, token, recipient] = match;

        // Scenario: Auto-Settlement Check
        // If recipient is a VNS handle (@), we check their preference.
        let explanation = `Sending ${amount} ${token} to ${recipient}.`;

        // (In real AI Agent, we would fetch Profile here)
        // Mocking the "Smart" logic:
        // If recipient is "@alice", she usually wants WBTC.
        if (recipient.toLowerCase() === '@alice' && token.toUpperCase() === 'USDC') {
            return {
                action: 'SWAP_AND_SEND',
                params: {
                    to: recipient,
                    token: token.toUpperCase(),
                    amount: amount
                },
                raw: input,
                confidence: 0.95,
                explanation: `Detected intent to pay @alice. Her preference is WBTC. I will AUTO-SWAP ${amount} USDC -> WBTC and send it to her.`
            };
        }

        return {
            action: 'TRANSFER',
            params: {
                to: recipient,
                token: token.toUpperCase(),
                amount: amount
            },
            raw: input,
            confidence: 0.9,
            explanation: explanation
        };
    }

    private async parseScheduledTransfer(input: string): Promise<UserIntent> {
        // Regex: "Send 10 VCN to @jays in 30 mins"
        const regex = /(?:send|pay|transfer)\s+([0-9.]+)\s+([a-zA-Z]+)\s+(?:to|for)\s+(@?[a-zA-Z0-9]+)\s+(?:in|after)\s+(\d+)\s*(mins?|minutes?|hours?|h|m)/i;
        const match = input.match(regex);

        if (!match) {
            return this.parseTransferIntent(input); // Fallback to normal transfer if time parse fails
        }

        const [_, amount, token, recipient, timeVal, timeUnit] = match;
        const timeStr = `${timeVal} ${timeUnit}`;

        return {
            action: 'SCHEDULE_TRANSFER',
            params: {
                to: recipient,
                token: token.toUpperCase(),
                amount: amount,
                scheduleTime: timeStr
            },
            raw: input,
            confidence: 0.95,
            explanation: `I will schedule a transfer of ${amount} ${token} to ${recipient} in ${timeStr}. funds will be locked now.`
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
