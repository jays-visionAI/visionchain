import { contractService } from './contractService';
import { AI_LOCALIZATION, LanguageConfig } from './ai/aiLocalization';

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

export class IntentParserService {
    constructor() { }

    async parseIntent(input: string, locale: string = 'en'): Promise<UserIntent> {
        const lower = input.toLowerCase();
        const config = AI_LOCALIZATION[locale] || AI_LOCALIZATION['en'];

        // 1. Detect "Bridge" Intent
        if (config.intents.keywords.bridge.some(k => lower.includes(k))) {
            return this.parseBridgeIntent(input, config);
        }

        // 2. Detect "Schedule" Intent
        const hasSendKeyword = config.intents.keywords.send.some(k => lower.includes(k));
        const hasScheduleKeyword = config.intents.keywords.schedule.some(k => lower.includes(k));

        if (hasSendKeyword && hasScheduleKeyword) {
            return this.parseScheduledTransfer(input, config);
        }

        // 3. Detect "Send" Intent
        if (hasSendKeyword) {
            return this.parseTransferIntent(input, config);
        }

        return {
            action: 'UNKNOWN',
            params: {},
            raw: input,
            confidence: 0,
            explanation: locale === 'ko'
                ? "요청을 이해하지 못했습니다. '10 VCN을 @jays에게 보내줘' 또는 '@jays에게 100 VCN 브릿지 전송해줘'와 같이 입력해 보세요."
                : "I couldn't understand that request. Try 'Send 10 VCN to @jays' or 'Bridge 100 VCN to Ethereum'."
        };
    }

    private async parseTransferIntent(input: string, config: LanguageConfig): Promise<UserIntent> {
        let match: RegExpMatchArray | null = null;
        let mapping: any = null;

        for (const pattern of config.intents.patterns.send) {
            match = input.match(pattern.regex);
            if (match) {
                mapping = pattern.mapping;
                break;
            }
        }

        if (!match || !mapping) {
            return {
                action: 'UNKNOWN',
                params: {},
                raw: input,
                confidence: 0.2,
                explanation: "Please specify amount, token and recipient (e.g. 'Send 10 VCN to @jays')"
            };
        }

        const amount = match[mapping.amount];
        const token = match[mapping.token];
        const recipient = match[mapping.recipient];

        // Scenario: Auto-Settlement Check (Mock)
        if (recipient.toLowerCase() === '@alice' && token.toUpperCase() === 'USDC') {
            return {
                action: 'SWAP_AND_SEND',
                params: { to: recipient, token: token.toUpperCase(), amount: amount },
                raw: input,
                confidence: 0.95,
                explanation: `Detected intent to pay @alice. Her preference is WBTC. I will AUTO-SWAP ${amount} USDC -> WBTC and send it to her.`
            };
        }

        return {
            action: 'TRANSFER',
            params: { to: recipient, token: token.toUpperCase(), amount: amount },
            raw: input,
            confidence: 0.9,
            explanation: `Sending ${amount} ${token} to ${recipient}.`
        };
    }

    private async parseScheduledTransfer(input: string, config: LanguageConfig): Promise<UserIntent> {
        let match: RegExpMatchArray | null = null;
        let mapping: any = null;

        for (const pattern of config.intents.patterns.schedule) {
            match = input.match(pattern.regex);
            if (match) {
                mapping = pattern.mapping;
                break;
            }
        }

        if (!match || !mapping) {
            return this.parseTransferIntent(input, config);
        }

        const amount = match[mapping.amount];
        const token = match[mapping.token];
        const recipient = match[mapping.recipient];
        const timeVal = match[mapping.timeVal];
        let timeUnit = match[mapping.timeUnit];

        // Normalize time unit
        if (config.intents.timeUnits[timeUnit]) {
            timeUnit = config.intents.timeUnits[timeUnit];
        }

        const timeStr = `${timeVal} ${timeUnit}`;

        return {
            action: 'SCHEDULE_TRANSFER',
            params: { to: recipient, token: token.toUpperCase(), amount: amount, scheduleTime: timeStr },
            raw: input,
            confidence: 0.95,
            explanation: `I will schedule a transfer of ${amount} ${token} to ${recipient} in ${timeStr}.`
        };
    }

    private async parseBridgeIntent(input: string, config: LanguageConfig): Promise<UserIntent> {
        let match: RegExpMatchArray | null = null;
        let mapping: any = null;

        for (const pattern of config.intents.patterns.bridge) {
            match = input.match(pattern.regex);
            if (match) {
                mapping = pattern.mapping;
                break;
            }
        }

        if (!match || !mapping) {
            return {
                action: 'UNKNOWN',
                params: {},
                raw: input,
                confidence: 0.4,
                explanation: "Please specify amount, asset and destination chain."
            };
        }

        const amount = match[mapping.amount];
        const token = match[mapping.token];
        const chain = match[mapping.chain];

        return {
            action: 'BRIDGE',
            params: { token: token.toUpperCase(), amount: amount, destinationChain: chain.toUpperCase() },
            raw: input,
            confidence: 0.9,
            explanation: `Bridging ${amount} ${token} from Vision Chain to ${chain}.`
        };
    }
}

export const intentParser = new IntentParserService();
