'use strict';

// Run: node --test test/   (from blockchain/engine/vision-shared-sequencer)
// The /rpc-proxy test needs the sequencer's node_modules; it is skipped without them.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { checkRequest, PUBLIC_METHODS, MAX_BATCH } = require('../rpc-allowlist');
const { createGateway } = require('../rpc-gateway');

// Methods that let a caller change consensus, stop the node, or sign with its keys.
const DANGEROUS = [
    'admin_nodeInfo', 'admin_addPeer', 'admin_removePeer', 'admin_stopHTTP', 'admin_startHTTP',
    'admin_exportChain', 'admin_importChain',
    'clique_propose', 'clique_discard', 'clique_getSigners', 'clique_getSnapshot', 'clique_proposals',
    'miner_stop', 'miner_start', 'miner_setEtherbase', 'miner_setExtra', 'miner_setGasPrice',
    'debug_setHead', 'debug_traceTransaction', 'debug_chaindbCompact', 'debug_writeMemProfile',
    'personal_unlockAccount', 'personal_sendTransaction', 'personal_sign', 'personal_listWallets',
    'txpool_content', 'txpool_inspect',
    'eth_sendTransaction', 'eth_sign', 'eth_signTransaction', 'eth_signTypedData', 'eth_fillTransaction',
    'eth_accounts', 'eth_coinbase', 'eth_resend', 'eth_pendingTransactions', 'eth_subscribe',
];

const call = (method, id = 1, params = []) => ({ jsonrpc: '2.0', id, method, params });

// ---------------------------------------------------------------- allowlist

test('allowlist holds no privileged namespace and no node-side signing', () => {
    for (const m of PUBLIC_METHODS) {
        assert.match(m, /^(eth|net|web3|rpc)_/, `${m} is outside eth/net/web3`);
    }
    for (const m of DANGEROUS) {
        assert.ok(!PUBLIC_METHODS.includes(m), `${m} must not be allowed`);
    }
});

test('allowed single call passes unchanged', () => {
    const body = call('eth_sendRawTransaction', 7, ['0xf86c']);
    assert.deepEqual(checkRequest(body), { ok: true, payload: body });
});

test('every dangerous method is refused with -32601 and its id', () => {
    for (const m of DANGEROUS) {
        const r = checkRequest(call(m, `id-${m}`));
        assert.equal(r.ok, false, m);
        assert.equal(r.reply.error.code, -32601, m);
        assert.equal(r.reply.id, `id-${m}`);
        assert.deepEqual(r.rejected, [m]);
    }
});

test('look-alike method names are refused (exact match only)', () => {
    for (const m of ['Admin_nodeInfo', 'eth_SendTransaction', 'admin_nodeInfo ', ' eth_chainId',
        'eth_chainId\u0000', 'eth_chainid', 'eth', 'eth_', '', 'rpc_modules.admin']) {
        assert.equal(checkRequest(call(m)).ok, false, JSON.stringify(m));
    }
});

test('a duplicated "method" key is judged by the value that gets forwarded', () => {
    const last = checkRequest(JSON.parse('{"jsonrpc":"2.0","id":1,"method":"admin_nodeInfo","method":"eth_chainId"}'));
    assert.equal(last.ok, true);
    assert.equal(JSON.stringify(last.payload).includes('admin_'), false);

    const first = checkRequest(JSON.parse('{"jsonrpc":"2.0","id":1,"method":"eth_chainId","method":"admin_nodeInfo"}'));
    assert.equal(first.ok, false);
});

test('malformed requests are refused as invalid', () => {
    for (const body of [null, 42, 'eth_chainId', true, {}, { method: 5 }, { method: ['eth_chainId'] }]) {
        const r = checkRequest(body);
        assert.equal(r.ok, false, JSON.stringify(body));
        assert.equal(r.reply.error.code, -32600);
    }
});

test('an all-allowed batch passes', () => {
    const batch = [call('eth_chainId', 1), call('eth_blockNumber', 2), call('net_version', 3)];
    assert.deepEqual(checkRequest(batch), { ok: true, payload: batch });
});

test('a batch smuggling one disallowed method is refused entirely', () => {
    const batch = [call('eth_chainId', 1), call('clique_propose', 2, ['0x' + '11'.repeat(20), true]), call('eth_blockNumber', 'x')];
    const r = checkRequest(batch);
    assert.equal(r.ok, false);
    assert.equal(r.reply.length, 3);
    assert.deepEqual(r.reply.map((e) => e.id), [1, 2, 'x']);
    assert.deepEqual(r.reply.map((e) => e.error.code), [-32600, -32601, -32600]);
    assert.ok(r.reply.every((e) => !('result' in e)));
    assert.deepEqual(r.rejected, ['clique_propose']);
});

test('empty, nested and oversized batches are refused', () => {
    assert.equal(checkRequest([]).ok, false);
    assert.equal(checkRequest([[call('admin_nodeInfo')]]).ok, false);
    assert.equal(checkRequest([[call('eth_chainId')]]).ok, false);
    const big = Array.from({ length: MAX_BATCH + 1 }, (_, i) => call('eth_chainId', i));
    assert.equal(checkRequest(big).ok, false);
    assert.equal(checkRequest(big.slice(0, MAX_BATCH)).ok, true);
});

// ---------------------------------------------------------------- gateway

function listen(server) {
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
    return new Promise((resolve) => server.close(resolve));
}

// A stand-in for geth: records what reached it and answers every call with "ok".
async function fakeGeth() {
    const received = [];
    const server = http.createServer((req, res) => {
        let data = '';
        req.on('data', (c) => { data += c; });
        req.on('end', () => {
            received.push(data);
            const body = JSON.parse(data);
            const answer = (c) => ({ jsonrpc: '2.0', id: c.id, result: 'ok' });
            const out = JSON.stringify(Array.isArray(body) ? body.map(answer) : answer(body));
            // geth itself sends CORS headers when --http.corsdomain is set; the gateway must not pass them on
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(out);
        });
    });
    const port = await listen(server);
    return { server, received, url: `http://127.0.0.1:${port}` };
}

function post(port, urlPath, body, { raw = false, method = 'POST', headers = {} } = {}) {
    const text = raw ? body : JSON.stringify(body);
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port, path: urlPath, method,
            headers: { 'Content-Type': 'application/json', ...headers },
        }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
                let json = null;
                try { json = data ? JSON.parse(data) : null; } catch { /* not json */ }
                resolve({ status: res.statusCode, headers: res.headers, json, text: data });
            });
        });
        req.on('error', reject);
        if (method === 'POST' && text !== undefined) req.write(text);
        req.end();
    });
}

const quietLog = { warn() {}, error() {}, log() {} };

test('gateway forwards allowed calls and never forwards refused ones', async (t) => {
    const geth = await fakeGeth();
    const node2 = await fakeGeth();
    const gw = createGateway({
        upstream: geth.url,
        nodeRoutes: { '/node-2': node2.url },
        maxBodyBytes: 4096,
    }, { log: quietLog });
    const port = await listen(gw);
    t.after(() => Promise.all([close(gw), close(geth.server), close(node2.server)]));

    const ok = await post(port, '/', call('eth_blockNumber'));
    assert.equal(ok.status, 200);
    assert.equal(ok.json.result, 'ok');
    assert.equal(ok.headers['access-control-allow-origin'], '*', 'exactly one CORS header');
    assert.equal(geth.received.length, 1);

    for (const m of DANGEROUS) {
        const r = await post(port, '/', call(m));
        assert.equal(r.status, 200);
        assert.equal(r.json.error.code, -32601, m);
    }
    const smuggled = await post(port, '/', [call('eth_chainId', 1), call('admin_addPeer', 2, ['enode://x'])]);
    assert.equal(smuggled.json.length, 2);
    assert.ok(smuggled.json.every((e) => e.error));
    assert.equal(geth.received.length, 1, 'nothing refused reached geth');

    // duplicate keys: geth must see the re-serialized call, not the raw bytes
    await post(port, '/', '{"jsonrpc":"2.0","id":1,"method":"admin_nodeInfo","method":"eth_chainId"}', { raw: true });
    assert.equal(geth.received.length, 2);
    assert.equal(geth.received[1].includes('admin_'), false);

    // per-node route: same allowlist
    assert.equal((await post(port, '/node-2', call('eth_mining'))).json.result, 'ok');
    assert.equal((await post(port, '/node-2/', call('net_peerCount'))).json.result, 'ok');
    assert.equal((await post(port, '/node-2', call('clique_propose', 1, ['0x' + '22'.repeat(20), false]))).json.error.code, -32601);
    assert.equal((await post(port, '/node-2', call('miner_stop'))).json.error.code, -32601);
    assert.equal(node2.received.length, 2);
});

test('gateway rejects unknown paths, wrong verbs, bad JSON and huge bodies', async (t) => {
    const geth = await fakeGeth();
    const gw = createGateway({ upstream: geth.url, maxBodyBytes: 4096 }, { log: quietLog });
    const port = await listen(gw);
    t.after(() => Promise.all([close(gw), close(geth.server)]));

    assert.equal((await post(port, '/node-3', call('eth_chainId'))).status, 404);
    assert.equal((await post(port, '/node-10', call('eth_chainId'))).status, 404);
    assert.equal((await post(port, '/admin', call('eth_chainId'))).status, 404);
    assert.equal((await post(port, '/', undefined, { method: 'GET' })).status, 405);

    const pre = await post(port, '/', undefined, { method: 'OPTIONS' });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers['access-control-allow-origin'], '*');

    const bad = await post(port, '/', '{"jsonrpc":', { raw: true });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error.code, -32700);

    const huge = await post(port, '/', call('eth_call', 1, [{ data: '0x' + 'ab'.repeat(5000) }, 'latest']));
    assert.equal(huge.status, 413);
    assert.equal(geth.received.length, 0);
});

test('gateway answers 502 when geth is down', async (t) => {
    const dead = http.createServer();
    const deadPort = await listen(dead);
    await close(dead);
    const gw = createGateway({ upstream: `http://127.0.0.1:${deadPort}` }, { log: quietLog });
    const port = await listen(gw);
    t.after(() => close(gw));

    const r = await post(port, '/', call('eth_chainId'));
    assert.equal(r.status, 502);
    assert.equal(r.json.error.code, -32603);
});

test('gateway refuses node routes that are not /node-N', () => {
    assert.throws(() => createGateway({ upstream: 'http://127.0.0.1:1', nodeRoutes: { '/admin': 'http://127.0.0.1:2' } }));
    assert.throws(() => createGateway({ upstream: 'file:///etc/passwd' }));
});

// ---------------------------------------------------------------- server.js /rpc-proxy

function canLoadSequencerDeps() {
    try {
        for (const dep of ['express', 'body-parser', 'cors', 'kafkajs', 'firebase-admin', 'dotenv']) {
            require.resolve(dep, { paths: [path.join(__dirname, '..'), ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)] });
        }
        return true;
    } catch {
        return false;
    }
}

async function waitForPort(port, child, ms = 15000) {
    const until = Date.now() + ms;
    while (Date.now() < until) {
        if (child.exitCode !== null) throw new Error(`server.js exited with ${child.exitCode}`);
        try {
            const r = await post(port, '/rpc-proxy', call('eth_chainId'));
            if (r.status) return;
        } catch { /* not up yet */ }
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('server.js did not start');
}

test('server.js /rpc-proxy applies the same allowlist', { skip: !canLoadSequencerDeps() && 'sequencer node_modules not installed (set NODE_PATH)' }, async (t) => {
    const geth = await fakeGeth();
    const probe = http.createServer();
    const port = await listen(probe);
    await close(probe);

    // No Google credentials (empty HOME, no GOOGLE_APPLICATION_CREDENTIALS): the routes
    // tested here never touch Firestore, and nothing should be able to.
    const env = { ...process.env };
    delete env.GOOGLE_APPLICATION_CREDENTIALS;
    const home = require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(), 'seq-test-'));
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
        cwd: path.join(__dirname, '..'),
        env: {
            ...env,
            HOME: home,
            PORT: String(port),
            HOST: '127.0.0.1',
            GETH_RPC_URL: geth.url,
            KAFKA_BROKER: '127.0.0.1:9', // nothing listens there; the producer just retries
        },
        stdio: ['ignore', 'ignore', process.env.DEBUG_SERVER ? 'inherit' : 'ignore'],
    });
    t.after(async () => { child.kill('SIGKILL'); await close(geth.server); });
    await waitForPort(port, child);
    const before = geth.received.length;

    const ok = await post(port, '/rpc-proxy', call('eth_blockNumber', 9));
    assert.equal(ok.json.result, 'ok');
    assert.equal(ok.json.id, 9);

    const refused = await post(port, '/rpc-proxy', call('admin_nodeInfo', 3));
    assert.equal(refused.json.error.code, -32601);
    assert.equal(refused.json.id, 3);

    const smuggled = await post(port, '/rpc-proxy', [call('eth_chainId', 1), call('personal_unlockAccount', 2)]);
    assert.ok(Array.isArray(smuggled.json) && smuggled.json.every((e) => e.error));

    const batch = await post(port, '/rpc-proxy', [call('eth_chainId', 1), call('net_version', 2)]);
    assert.deepEqual(batch.json.map((e) => e.result), ['ok', 'ok']);

    // only the two allowed requests above (plus the start-up probe) reached geth
    assert.equal(geth.received.length - before, 2);
    assert.ok(geth.received.every((b) => !/admin_|personal_/.test(b)));
});
