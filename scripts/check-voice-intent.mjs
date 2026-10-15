#!/usr/bin/env node
/**
 * Regression checks for the voice transfer intent parser.
 *
 *   node scripts/check-voice-intent.mjs
 *
 * This is a money path: `processVoiceTranscript` in components/Wallet.tsx opens
 * the send confirmation straight from what this parser returns, so a parse bug
 * is a wrong amount or a wrong recipient one tap from being signed.
 *
 * The cases below are the ones that were actually wrong:
 *
 *   "30분 뒤에 jays에게 10 VCN 보내줘"  → amount 30, sent immediately
 *
 * The time value was the first number in the sentence and `extractAmount`
 * takes the first number, so the delay became the amount; and the parser had
 * no notion of a delay at all, so a request to send later was proposed as a
 * send now. It resolved to a real contact and opened the modal, which is the
 * part that makes it dangerous rather than merely wrong.
 *
 * There is no frontend test runner in this repo, so the service is bundled
 * with esbuild (already present via vite) and imported here.
 */

import { build } from 'esbuild';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = mkdtempSync(join(tmpdir(), 'voice-intent-'));
const bundle = join(out, 'service.mjs');

await build({
    entryPoints: [join(root, 'services/voiceIntentService.ts')],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'error',
});

const { parseVoiceIntent, resolveIntentRecipient } = await import(bundle);

const CONTACTS = [
    { internalName: 'jays', address: '0x6605Acc98E5F9dE16D82885ad84a25D95C94F794' },
    { internalName: '박지현', address: '0x805E8DB0175aeC75d2e2852aD14092466C281e3b' },
];

/** [utterance, expected, why this case is here] */
const CASES = [
    // plain sends, in both languages and both Korean word orders
    ['jays에게 10 VCN 보내줘', { amount: '10', recipient: 'jays', delayed: false }, 'baseline'],
    ['10 VCN을 jays에게 보내줘', { amount: '10', recipient: 'jays', delayed: false }, 'amount first'],
    ['jays에게 10 VCN을 보내줘', { amount: '10', recipient: 'jays', delayed: false }, 'object particle on the token'],
    ['박지현에게 2 VCN 송금해줘', { amount: '2', recipient: '박지현', delayed: false }, 'Korean name'],
    ['send 10 VCN to jays', { amount: '10', recipient: 'jays', delayed: false }, 'English'],
    ['transfer 5.5 VCN to jays', { amount: '5.5', recipient: 'jays', delayed: false }, 'decimal'],
    ['jays에게 1,000 VCN 보내줘', { amount: '1000', recipient: 'jays', delayed: false }, 'thousands separator'],
    ['jays에게 10만 VCN 보내줘', { amount: '100000', recipient: 'jays', delayed: false }, 'Korean numeral unit'],
    ['0x6605Acc98E5F9dE16D82885ad84a25D95C94F794에게 10 VCN 보내줘',
        { amount: '10', recipient: '0x6605Acc98E5F9dE16D82885ad84a25D95C94F794', delayed: false },
        'a pasted address must not be read as the amount'],

    // the delayed ones — none of these may look like an immediate send
    ['30분 뒤에 jays에게 10 VCN 보내줘', { amount: '10', recipient: 'jays', delayed: true }, 'delay first: used to send 30 VCN now'],
    ['jays에게 10 VCN 30분 뒤에 보내줘', { amount: '10', recipient: 'jays', delayed: true }, 'delay last'],
    ['1시간 후에 jays에게 10 VCN 보내줘', { amount: '10', recipient: 'jays', delayed: true }, 'hours'],
    ['30초 뒤에 jays에게 5 VCN 보내줘', { amount: '5', recipient: 'jays', delayed: true }, 'seconds'],
    ['send 10 VCN to jays in 30 minutes', { amount: '10', recipient: 'jays', delayed: true }, 'English delay'],
    ['send 10 VCN to jays after 2 hours', { amount: '10', recipient: 'jays', delayed: true }, 'English "after"'],
    ['jays에게 10 VCN 내일 보내줘', { amount: '10', recipient: 'jays', delayed: true }, 'delay with no number'],
    ['send 10 VCN to jays tomorrow', { amount: '10', recipient: 'jays', delayed: true }, 'English, no number'],

    // incomplete requests must not look complete
    ['jays에게 전부 보내줘', { amount: null, recipient: 'jays', delayed: false }, 'no amount'],
];

let failed = 0;
for (const [text, want, why] of CASES) {
    const got = parseVoiceIntent(text);
    const problems = [];

    if (got.amount !== want.amount) problems.push(`amount ${JSON.stringify(got.amount)} != ${JSON.stringify(want.amount)}`);
    if (got.recipient !== want.recipient) problems.push(`recipient ${JSON.stringify(got.recipient)} != ${JSON.stringify(want.recipient)}`);
    if (Boolean(got.delay) !== want.delayed) problems.push(`delay ${JSON.stringify(got.delay)}, expected delayed=${want.delayed}`);

    // The UI rule, asserted here so a change to it has to change this file:
    // the immediate-send modal opens only for an undelayed send that has an
    // amount. A delayed utterance must never reach it.
    const opensImmediateSend = !got.delay && got.action === 'send' && got.confidence >= 0.7 && Boolean(got.amount);
    if (want.delayed && opensImmediateSend) problems.push('a delayed request would open the immediate-send modal');

    if (problems.length) {
        failed += 1;
        console.error(`FAIL  ${JSON.stringify(text)}  (${why})`);
        for (const p of problems) console.error(`        ${p}`);
    } else {
        console.log(`  ok  ${JSON.stringify(text)}  (${why})`);
    }
}

// A resolvable name must still resolve after the cleanup, or the fix traded one
// bug for another.
for (const [text] of CASES) {
    const got = parseVoiceIntent(text);
    if (got.recipient === 'jays') {
        assert.equal(
            resolveIntentRecipient(got, CONTACTS),
            CONTACTS[0].address,
            `"${text}" no longer resolves to a contact`,
        );
    }
}

rmSync(out, { recursive: true, force: true });
console.log(`\n${CASES.length - failed}/${CASES.length} as intended`);
process.exit(failed ? 1 : 0);
