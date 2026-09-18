const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const { createRequire } = require('node:module')
const { createHash } = require('node:crypto')
const { Transaction, MerklePath, PrivateKey, P2PKH } = require('@bsv/sdk')
const { OpReturn } = require('@bsv/templates')
const HashPuzzle = require('../dist/HashPuzzle').default
const { inspectFile } = require('../dist/services/files')

function load(relative, replacements) {
    const filename = path.resolve(__dirname, '../dist', relative + '.js')
    const nativeRequire = createRequire(filename)
    const exports = {}
    for (const value of Object.values(replacements)) if (value?.default) value.__esModule = true
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        exports, require: id => Object.hasOwn(replacements, id) ? replacements[id] : nativeRequire(id),
        console: { log() {}, info() {}, warn() {}, error() {} }, Buffer, process, Date,
        AbortSignal, setTimeout, clearTimeout,
    }, { filename })
    return exports
}
function matches(doc, query) {
    return Object.entries(query).every(([key, expected]) => {
        if (key === '$or') return expected.some(item => matches(doc, item))
        const actual = doc[key]
        if (expected === null) return actual == null
        if (expected && typeof expected === 'object' && !Buffer.isBuffer(expected)) {
            return Object.entries(expected).every(([op, value]) => {
                if (op === '$ne') return actual !== value
                if (op === '$in') return value.includes(actual)
                if (op === '$nin') return !value.includes(actual)
                if (op === '$exists') return (actual !== undefined) === value
                throw Error('Unsupported test query ' + op)
            })
        }
        return actual === expected
    })
}
function memoryDb(initial = {}) {
    const data = { txs: [], utxos: [], fundingLocks: [], ...initial }
    let nextId = 1
    const update = (doc, change) => {
        Object.assign(doc, change.$set)
        for (const key of Object.keys(change.$unset || {})) delete doc[key]
        for (const [key, value] of Object.entries(change.$push || {})) (doc[key] ||= []).push(value)
        for (const [key, value] of Object.entries(change.$addToSet || {})) (doc[key] ||= []).push(value)
    }
    const db = { data, collection(name) {
        const docs = data[name] ||= []
        return {
            async findOne(query) { return docs.find(doc => matches(doc, query)) || null },
            async findOneAndUpdate(query, change) {
                const doc = docs.find(doc => matches(doc, query)); if (!doc) return null
                const previous = { ...doc }; update(doc, change); return previous
            },
            async insertOne(doc) { if (doc._id && docs.some(x => x._id === doc._id)) throw Object.assign(Error('Duplicate'), { code: 11000 }); docs.push({ _id: nextId++, ...doc }); return {} },
            async updateOne(query, change) { const doc = docs.find(doc => matches(doc, query)); if (doc) update(doc, change); return { matchedCount: doc ? 1 : 0, modifiedCount: doc ? 1 : 0 } },
            async updateMany(query, change) { docs.filter(doc => matches(doc, query)).forEach(doc => update(doc, change)) },
            async deleteMany(query) { for (let i = docs.length - 1; i >= 0; i--) if (matches(docs[i], query)) docs.splice(i, 1) },
            async bulkWrite(operations) { for (const { updateOne: op } of operations) if (!docs.some(doc => matches(doc, op.filter))) docs.push({ _id: nextId++, ...op.update.$setOnInsert }) },
            async distinct(key, query) { return [...new Set(docs.filter(doc => matches(doc, query)).map(doc => doc[key]))] },
            async countDocuments(query) { return docs.filter(doc => matches(doc, query)).length },
            find(query) { let found = docs.filter(doc => matches(doc, query)); return { sort() { return this }, limit(n) { found = found.slice(0, n); return this }, async toArray() { return found } } },
        }
    } }
    return db
}
async function invoke(fn, request) {
    let status = 200, body, sends = 0
    const headers = {}
    const response = {
        status(value) { status = value; return this },
        json(value) { return this.send(value) },
        send(value) { assert.equal(++sends, 1, 'handler must only send once'); body = value; return this },
        setHeader(key, value) { headers[key] = value }, attachment(value) { headers.filename = value },
    }
    await fn(request, response)
    return { status, body, headers, sends }
}
async function fixture() {
    const file = Buffer.from('Truth Machine regression fixture\n')
    const fileHash = createHash('sha256').update(file).digest('hex')
    const secret = HashPuzzle.generateSecretPair()
    const funding = new Transaction()
    funding.addOutput({ satoshis: 13, lockingScript: new HashPuzzle().lock(secret.hash) })
    funding.addOutput({ satoshis: 100000, lockingScript: new P2PKH().lock(PrivateKey.fromRandom().toAddress()) })
    funding.merklePath = new MerklePath(1, [[{ offset: 0, txid: true, hash: funding.id('hex') }]])
    const tx = new Transaction()
    tx.addInput({ sourceTransaction: funding, sourceOutputIndex: 0, unlockingScriptTemplate: new HashPuzzle().unlock(secret.secret) })
    tx.addOutput({ satoshis: 0, lockingScript: new OpReturn().lock(Array.from(Buffer.from(fileHash, 'hex'))) })
    await tx.sign()
    return {
        file, fileHash, tx,
        record: { txid: tx.id('hex'), fileHash, file, beef: tx.toHexBEEF(), fileName: 'fixture.txt', fileType: 'text/plain', time: 123, arc: [{ status: 'success' }] },
        source: { txid: funding.id('hex'), beef: funding.toHexBEEF() },
        token: { _id: 'token', txid: funding.id('hex'), vout: 0, secret, fileHash: null, spent: false, confirmed: true, satoshis: 13 },
    }
}
function integrity(db, proof = async (_, tx) => ({ inBlock: false, seen: false, tx })) {
    return load('functions/integrity', {
        '../db': { default: db },
        '../services/operations': { settleOperation: async () => {} },
        '../services/proofs': { checkProof: proof, bounded: promise => promise, tracker: { currentHeight: async () => 101 } },
    }).default
}
function operations(db, response) {
    return load('services/operations', { '../db': { default: db }, '../arc': { default: { broadcast: response } } })
}

test('hash and transaction lookup normalise uppercase and padding', async () => {
    const f = await fixture(); const db = memoryDb({ txs: [f.record] })
    for (const id of [f.fileHash, f.record.txid, ` ${f.fileHash.toUpperCase()} `]) {
        const result = await invoke(integrity(db), { params: { id } })
        assert.equal(result.status, 200); assert.equal(result.body.txid, f.record.txid)
        assert.equal(result.body.status, 'pending'); assert.equal(result.body.valid, false)
        assert.equal(result.body.downloadAllowed, true)
    }
})
test('unknown and malformed identifiers return friendly 404 and 400', async () => {
    for (const [id, status] of [['0'.repeat(64), 404], ['not-a-hash', 400], ['', 400]]) {
        const result = await invoke(integrity(memoryDb()), { params: { id } })
        assert.equal(result.status, status); assert.doesNotMatch(result.body.error, /destructure|TypeError/)
    }
})
test('changed file bytes and changed commitment both fail verification', async () => {
    const f = await fixture()
    for (const record of [{ ...f.record, file: Buffer.from('Changed') }, { ...f.record, fileHash: '0'.repeat(64) }]) {
        const result = await invoke(integrity(memoryDb({ txs: [record] })), { params: { id: f.record.txid } })
        assert.equal(result.status, 422); assert.equal(result.body.valid, false); assert.equal(result.body.downloadAllowed, false)
    }
})
test('mined proof gives one complete success response with confirmations', async () => {
    const f = await fixture()
    const fn = integrity(memoryDb({ txs: [f.record] }), async (_, tx) => {
        tx.merklePath = { blockHeight: 100 }; return { inBlock: true, seen: true, tx }
    })
    const result = await invoke(fn, { params: { id: f.record.txid } })
    assert.equal(result.body.status, 'confirmed'); assert.equal(result.body.valid, true)
    assert.equal(result.body.depth, 2); assert.equal(result.body.time, 123); assert.equal(result.body.error, undefined)
})
test('unavailable proof service stays pending without falsely confirming', async () => {
    const f = await fixture()
    const result = await invoke(integrity(memoryDb({ txs: [f.record] }), async () => { throw Error('Offline') }), { params: { id: f.record.txid } })
    assert.equal(result.body.status, 'pending'); assert.equal(result.body.valid, false)
    assert.match(result.body.message, /temporarily unavailable/)
})
test('rejected broadcasts cannot pass by having a valid unlocking script', async () => {
    const f = await fixture(); f.record.arc = [{ status: 'error', code: 'REJECTED' }]
    const result = await invoke(integrity(memoryDb({ txs: [f.record] })), { params: { id: f.record.txid } })
    assert.equal(result.status, 422); assert.equal(result.body.valid, false)
})
test('download validates current bytes and handles absent records', async () => {
    const f = await fixture(); const db = memoryDb({ txs: [f.record] })
    const fn = load('functions/download', { '../db': { default: db } }).default
    const good = await invoke(fn, { params: { id: f.fileHash.toUpperCase() } })
    assert.deepEqual(good.body, f.file); assert.equal(good.headers.filename, 'fixture.txt')
    db.data.txs[0].file = Buffer.from('Changed')
    assert.equal((await invoke(fn, { params: { id: f.fileHash } })).status, 422)
    assert.equal((await invoke(fn, { params: { id: '0'.repeat(64) } })).status, 404)
})
test('accepted upload spends exactly one token and stores the file before broadcast', async () => {
    const f = await fixture(); const db = memoryDb({ txs: [f.source], utxos: [f.token] })
    const op = operations(db, async () => {
        assert.equal(db.data.txs.at(-1).operationStatus, 'broadcasting')
        assert.deepEqual(db.data.txs.at(-1).file, f.file)
        return { status: 'success' }
    })
    const fn = load('functions/upload', { '../db': { default: db }, '../services/operations': op }).default
    const result = await invoke(fn, { body: f.file, headers: { 'x-original-filename': 'test%20file.txt' } })
    assert.equal(result.status, 200); assert.equal(db.data.utxos[0].spent, true)
    assert.equal(db.data.utxos[0].reservedBy, undefined); assert.equal(db.data.txs.at(-1).fileName, 'test file.txt')
})
test('rejected upload releases token and returns failure', async () => {
    const f = await fixture(); const db = memoryDb({ txs: [f.source], utxos: [f.token] })
    const op = operations(db, async () => ({ status: 'error', code: 'REJECTED' }))
    const fn = load('functions/upload', { '../db': { default: db }, '../services/operations': op }).default
    const result = await invoke(fn, { body: f.file, headers: {} })
    assert.equal(result.status, 422); assert.equal(db.data.utxos[0].spent, false)
    assert.equal(db.data.utxos[0].reservedBy, undefined); assert.equal(db.data.txs.at(-1).operationStatus, 'rejected')
})
test('ambiguous broadcast reserves token and can be reconciled without another spend', async () => {
    const f = await fixture(); const db = memoryDb({ txs: [f.source], utxos: [f.token] })
    const op = operations(db, async () => { throw Error('Connection lost') })
    const fn = load('functions/upload', { '../db': { default: db }, '../services/operations': op }).default
    const result = await invoke(fn, { body: f.file, headers: {} })
    assert.equal(result.status, 202); assert.equal(result.body.status, 'pending')
    assert.equal(db.data.utxos[0].spent, false); assert.ok(db.data.utxos[0].reservedBy)
    await op.settleOperation(db.data.txs.at(-1), 'accepted')
    assert.equal(db.data.utxos[0].spent, true); assert.equal(db.data.utxos[0].reservedBy, undefined)
})
test('preparation failure releases the token without broadcasting', async () => {
    const f = await fixture(); const db = memoryDb({ utxos: [f.token] })
    const op = operations(db, async () => { assert.fail('Must not broadcast') })
    const fn = load('functions/upload', { '../db': { default: db }, '../services/operations': op }).default
    const result = await invoke(fn, { body: f.file, headers: {} })
    assert.equal(result.status, 503); assert.equal(db.data.utxos[0].reservedBy, undefined)
})
test('empty and oversized uploads do not allocate tokens', async () => {
    const db = memoryDb(); const op = operations(db, async () => assert.fail('Must not broadcast'))
    const fn = load('functions/upload', { '../db': { default: db }, '../services/operations': op }).default
    assert.equal((await invoke(fn, { body: Buffer.alloc(0) })).status, 400)
    assert.equal((await invoke(fn, { body: Buffer.alloc(10 * 1024 * 1024 + 1) })).status, 413)
    assert.equal(db.data.txs.length, 0)
})
test('two simultaneous uploads cannot reserve the same token', async () => {
    const f = await fixture(); const db = memoryDb({ txs: [f.source], utxos: [f.token] })
    const op = operations(db, async () => ({ status: 'success' }))
    const fn = load('functions/upload', { '../db': { default: db }, '../services/operations': op }).default
    const results = await Promise.all([invoke(fn, { body: f.file, headers: {} }), invoke(fn, { body: f.file, headers: {} })])
    assert.deepEqual(results.map(r => r.status).sort(), [200, 503])
    assert.equal(db.data.txs.length, 2)
})
test('mint success adds tokens once; rejection adds none and releases funding lock', async () => {
    for (const outcome of ['success', 'error']) {
        const f = await fixture(); const db = memoryDb(); const key = PrivateKey.fromRandom()
        const op = operations(db, async () => ({ status: outcome, code: outcome === 'error' ? 'REJECTED' : undefined }))
        const fn = load('functions/fund', { '../db': { default: db }, '../services/operations': op,
            './address': { address: key.toAddress(), key },
            '../woc': { default: { getUtxos: async () => [{ txid: f.source.txid, vout: 1, satoshis: 100000 }], getBeef: async () => f.source.beef } },
        }).default
        const result = await invoke(fn, { params: { number: '2' } })
        assert.equal(result.status, outcome === 'success' ? 200 : 422)
        assert.equal(db.data.utxos.length, outcome === 'success' ? 2 : 0)
        if (outcome === 'success') { await op.settleOperation(db.data.txs[0], 'accepted'); assert.equal(db.data.utxos.length, 2) }
        else assert.equal(db.data.fundingLocks.length, 0)
    }
})
test('mint rejects invalid counts before any funding lookup', async () => {
    const fn = load('functions/fund', { '../db': { default: memoryDb() }, '../services/operations': {},
        './address': {}, '../woc': { default: { getUtxos: async () => assert.fail('Must not fetch') } },
    }).default
    for (const number of ['0', '-1', '1.5', 'abc', '1001', '2junk']) assert.equal((await invoke(fn, { params: { number } })).status, 400)
})
test('consolidation rejection does not consume tokens', async () => {
    const f = await fixture(); const db = memoryDb({ txs: [f.source], utxos: [f.token] })
    const op = operations(db, async () => ({ status: 'error', code: 'REJECTED' }))
    const fn = load('functions/consolidate', { '../db': { default: db }, '../services/operations': op,
        './address': { address: PrivateKey.fromRandom().toAddress() },
    }).default
    const result = await invoke(fn, {})
    assert.equal(result.status, 422); assert.equal(db.data.utxos[0].spent, false); assert.equal(db.data.utxos[0].reservedBy, undefined)
})
test('file inspection supports MongoDB Binary storage', async () => {
    const f = await fixture(); const { Binary } = require('mongodb')
    const result = inspectFile({ ...f.record, file: new Binary(f.file) })
    assert.equal(result.contentValid, true); assert.deepEqual(result.bytes, f.file)
})

test('late timeout cannot downgrade accepted operation or release its inputs', async () => {
    const f = await fixture()
    const record = { txid: f.record.txid, operationStatus: 'accepted', settled: true, arc: [], reservation: 'r' }
    const db = memoryDb({ txs: [record], fundingLocks: [{ _id: 'funding', reservation: 'r' }] })
    const op = operations(db, async () => assert.fail('Must not broadcast'))
    assert.equal(await op.settleOperation(record, 'unknown'), 'accepted')
    assert.equal(await op.settleOperation(record, 'rejected'), 'accepted')
    assert.equal(record.operationStatus, 'accepted'); assert.equal(record.settled, true)
    assert.equal(db.data.fundingLocks.length, 1)
})
test('lookup reconciles an uncertain operation when the network confirms it', async () => {
    const f = await fixture(); f.record.reservation = 'r'; f.record.operationStatus = 'unknown'
    const db = memoryDb({ txs: [f.record], utxos: [{ ...f.token, reservedBy: 'r' }] })
    const op = operations(db, async () => assert.fail('Must not rebroadcast'))
    const fn = load('functions/integrity', { '../db': { default: db }, '../services/operations': op,
        '../services/proofs': { checkProof: async (_, tx) => ({ inBlock: false, seen: true, tx }), bounded: p => p, tracker: {} },
    }).default
    const result = await invoke(fn, { params: { id: f.fileHash } })
    assert.equal(result.body.status, 'pending'); assert.equal(f.record.operationStatus, 'accepted')
    assert.equal(db.data.utxos[0].spent, true); assert.equal(db.data.utxos[0].reservedBy, undefined)
})
test('proof lookup checks transaction identity before caching a proof', async () => {
    const f = await fixture(); const db = memoryDb({ txs: [f.record], utxos: [f.token] })
    const mined = Transaction.fromHexBEEF(f.record.beef)
    mined.merklePath = new MerklePath(100, [[{ offset: 0, hash: '00'.repeat(32) }, { offset: 1, txid: true, hash: f.record.txid }]])
    const proofs = load('services/proofs', { '../db': { default: db },
        '../woc': { default: { getBeef: async () => mined.toHexBEEF() } },
        '@bsv/wallet-toolbox': { ChaintracksServiceClient: class {}, ChaintracksChainTracker: class { async currentHeight() { return 101 } async isValidRootForHeight(root, height) { return root === mined.merklePath.computeRoot(f.record.txid) && height === 100 } } },
    })
    const result = await proofs.checkProof(f.record, f.tx)
    assert.equal(result.inBlock, true)
    assert.ok(Transaction.fromHexBEEF(db.data.txs[0].beef).merklePath)
    const other = await fixture()
    await assert.rejects(() => proofs.checkProof(other.record, other.tx), /Transaction mismatch/)
})
test('false Merkle proof never becomes a confirmed record', async () => {
    const f = await fixture(); const db = memoryDb({ txs: [f.record] })
    f.tx.merklePath = new MerklePath(100, [[{ offset: 0, hash: '00'.repeat(32) }, { offset: 1, txid: true, hash: f.record.txid }]])
    const proofs = load('services/proofs', { '../db': { default: db }, '../woc': { default: {} },
        '@bsv/wallet-toolbox': { ChaintracksServiceClient: class {}, ChaintracksChainTracker: class { async currentHeight() { return 101 } async isValidRootForHeight() { return false } } },
    })
    const result = await proofs.checkProof(f.record, f.tx)
    assert.equal(result.inBlock, false); assert.equal(result.invalidProof, true)
    assert.equal(Transaction.fromHexBEEF(db.data.txs[0].beef).merklePath, undefined)
})

test('pending-action check reconciles accepted transactions and explains remaining confirmation', async () => {
    const f = await fixture(); f.record.reservation = 'r'; f.record.operationStatus = 'unknown'
    const db = memoryDb({ txs: [f.record], utxos: [{ ...f.token, reservedBy: 'r' }] })
    const op = operations(db, async () => assert.fail('Must not rebroadcast'))
    const fn = load('functions/utxoStatusUptate', { '../db': { default: db }, '../services/operations': op,
        '../services/proofs': { checkProof: async (_, tx) => ({ inBlock: false, seen: true, tx }) },
    }).default
    const result = await invoke(fn, {})
    assert.equal(result.body.status, 'pending'); assert.equal(result.body.pending, 1)
    assert.equal(f.record.operationStatus, 'accepted'); assert.equal(db.data.utxos[0].spent, true)
    assert.match(result.body.message, /do not repeat/)
})
test('callback validates proof before confirming or settling an operation', async () => {
    const previousToken = process.env.CALLBACK_TOKEN
    process.env.CALLBACK_TOKEN = 'test-callback-token'
    const f = await fixture(); const db = memoryDb({ txs: [f.record] })
    let settled = false
    const fn = load('functions/callback', { '../db': { default: db },
        '../services/operations': { settleOperation: async () => { settled = true } },
        '../services/proofs': { bounded: p => p, tracker: { currentHeight: async () => 101, isValidRootForHeight: async () => false } },
    }).default
    const proof = new MerklePath(100, [[{ offset: 0, txid: true, hash: f.record.txid }]])
    const response = await invoke(fn, { headers: { authorization: 'Bearer ' + process.env.CALLBACK_TOKEN }, body: { txid: f.record.txid, merklePath: proof.toHex() } })
    if (previousToken === undefined) delete process.env.CALLBACK_TOKEN
    else process.env.CALLBACK_TOKEN = previousToken
    assert.equal(response.status, 422); assert.equal(settled, false)
    assert.equal(Transaction.fromHexBEEF(f.record.beef).merklePath, undefined)
})
