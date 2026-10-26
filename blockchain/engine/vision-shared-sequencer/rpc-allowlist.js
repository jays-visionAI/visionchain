'use strict';

/**
 * JSON-RPC method allowlist for the public Vision Chain RPC endpoints:
 *   - https://rpc.visionchain.co          (nginx -> rpc-gateway.js)
 *   - https://api.visionchain.co/rpc-proxy (nginx -> server.js /rpc-proxy)
 *
 * Only the methods below reach geth. Everything else is answered here with a
 * JSON-RPC error: admin_*, clique_*, miner_*, debug_*, personal_*, txpool_*,
 * and the eth_* methods that sign with keys held by the node
 * (eth_sendTransaction, eth_sign, eth_signTransaction, eth_fillTransaction,
 * eth_accounts, ...). A batch is forwarded only if every entry is allowed.
 *
 * Callers must forward `payload` (re-serialized from the parsed request), never
 * the raw request bytes, so geth sees exactly what was checked here.
 */

const PUBLIC_METHODS = Object.freeze([
    // chain and node status
    'eth_chainId',
    'eth_blockNumber',
    'eth_syncing',
    'eth_mining', // nodeHealth (Cloud Functions) reads it
    'net_version',
    'net_listening',
    'net_peerCount', // nodeHealth and the admin dashboard read it
    'web3_clientVersion',
    'web3_sha3',
    'rpc_modules', // lets anyone verify from outside which modules the node serves

    // gas and fees
    'eth_gasPrice',
    'eth_maxPriorityFeePerGas',
    'eth_feeHistory',
    'eth_estimateGas',
    'eth_createAccessList',

    // state
    'eth_getBalance',
    'eth_getCode',
    'eth_getStorageAt',
    'eth_getTransactionCount',
    'eth_call',
    'eth_getProof',

    // blocks
    'eth_getBlockByNumber',
    'eth_getBlockByHash',
    'eth_getBlockReceipts',
    'eth_getBlockTransactionCountByNumber',
    'eth_getBlockTransactionCountByHash',
    'eth_getHeaderByNumber',
    'eth_getHeaderByHash',
    'eth_getUncleCountByBlockNumber',
    'eth_getUncleCountByBlockHash',
    'eth_getUncleByBlockNumberAndIndex',
    'eth_getUncleByBlockHashAndIndex',

    // transactions (signed by the caller, never by the node)
    'eth_getTransactionByHash',
    'eth_getTransactionByBlockNumberAndIndex',
    'eth_getTransactionByBlockHashAndIndex',
    'eth_getTransactionReceipt',
    'eth_sendRawTransaction',

    // logs and filters (ethers v6 uses filters for contract.on / provider.on)
    'eth_getLogs',
    'eth_newFilter',
    'eth_newBlockFilter',
    'eth_newPendingTransactionFilter',
    'eth_getFilterChanges',
    'eth_getFilterLogs',
    'eth_uninstallFilter',
]);

const PUBLIC_METHOD_SET = new Set(PUBLIC_METHODS);
const MAX_BATCH = 100;

const INVALID_REQUEST = -32600;
const METHOD_NOT_ALLOWED = -32601; // "method not found" in JSON-RPC; clients treat it as unsupported

function replyId(item) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
        const { id } = item;
        if (typeof id === 'string' || typeof id === 'number' || id === null) return id;
    }
    return null;
}

function errorReply(id, code, message) {
    return { jsonrpc: '2.0', id, error: { code, message } };
}

function describeMethod(method) {
    return method.length > 64 ? `${method.slice(0, 64)}...` : method;
}

// Returns null when the call may be forwarded, otherwise the JSON-RPC error to send back.
function checkCall(item, allowed) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.method !== 'string') {
        return errorReply(replyId(item), INVALID_REQUEST, 'invalid request');
    }
    if (!allowed.has(item.method)) {
        return errorReply(replyId(item), METHOD_NOT_ALLOWED, `method not allowed: ${describeMethod(item.method)}`);
    }
    return null;
}

/**
 * Checks a parsed JSON-RPC request (single call or batch).
 *
 * @returns {{ok: true, payload: object|object[]} |
 *           {ok: false, reply: object|object[], rejected: string[]}}
 *   `payload` is what to forward; `reply` is what to send back instead (HTTP 200);
 *   `rejected` lists the refused method names, for logging.
 */
function checkRequest(body, { allowed = PUBLIC_METHOD_SET, maxBatch = MAX_BATCH } = {}) {
    if (!Array.isArray(body)) {
        const error = checkCall(body, allowed);
        if (error) {
            const rejected = body && typeof body.method === 'string' ? [body.method] : ['(invalid)'];
            return { ok: false, reply: error, rejected };
        }
        return { ok: true, payload: body };
    }

    if (body.length === 0) {
        return { ok: false, reply: errorReply(null, INVALID_REQUEST, 'empty batch'), rejected: ['(empty batch)'] };
    }
    if (body.length > maxBatch) {
        return {
            ok: false,
            reply: errorReply(null, INVALID_REQUEST, `batch too large (max ${maxBatch})`),
            rejected: ['(batch too large)'],
        };
    }

    const errors = body.map((item) => checkCall(item, allowed));
    if (errors.every((e) => e === null)) {
        return { ok: true, payload: body };
    }

    // One refused entry refuses the whole batch: nothing in it reaches geth.
    const reply = body.map((item, i) => errors[i]
        || errorReply(replyId(item), INVALID_REQUEST, 'not run: another call in this batch is not allowed'));
    const rejected = body
        .filter((item, i) => errors[i])
        .map((item) => (item && typeof item.method === 'string' ? item.method : '(invalid)'));
    return { ok: false, reply, rejected };
}

/**
 * Logs refused methods at most once per route+method per window, with a count,
 * so a client looping on a refused method does not flood the logs.
 */
function createRejectLog(log = console, windowMs = 60000) {
    const seen = new Map();
    return (route, methods, client) => {
        const now = Date.now();
        for (const method of methods) {
            const key = `${route} ${method}`;
            const entry = seen.get(key);
            if (entry && now - entry.since < windowMs) {
                entry.count += 1;
                continue;
            }
            const suppressed = entry ? entry.count - 1 : 0;
            seen.set(key, { since: now, count: 1 });
            log.warn(`[rpc] refused ${method} on ${route} from ${client}`
                + (suppressed > 0 ? ` (+${suppressed} more in the previous minute)` : ''));
        }
    };
}

module.exports = {
    PUBLIC_METHODS,
    MAX_BATCH,
    checkRequest,
    createRejectLog,
    isAllowedMethod: (method) => PUBLIC_METHOD_SET.has(method),
};
