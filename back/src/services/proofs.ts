import { Transaction } from '@bsv/sdk'
import { ChaintracksServiceClient, ChaintracksChainTracker } from '@bsv/wallet-toolbox'
import db from '../db'
import woc from '../woc'

const network = process.env.NETWORK === 'main' ? 'main' : 'test'
const url = network === 'main' ? 'https://chaintracks-us-1.bsvb.tech' : 'https://chaintracks-testnet-us-1.bsvb.tech'
export const tracker = new ChaintracksChainTracker(network, new ChaintracksServiceClient(network, url))

export async function bounded<T>(promise: Promise<T>, ms = 12000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([promise, new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Verification service timed out')), ms)
        })])
    } finally { clearTimeout(timer) }
}

export async function checkProof(record: any, tx: Transaction) {
    let candidate = tx
    let seen = false
    if (!candidate.merklePath) {
        const beef = await woc.getBeef(record.txid)
        if (!beef) return { inBlock: false, seen, tx }
        const fetched = Transaction.fromHexBEEF(beef)
        if (fetched.id('hex') !== record.txid || fetched.toHex() !== tx.toHex()) throw new Error('Transaction mismatch')
        candidate = fetched
        seen = true
    }
    if (!candidate.merklePath) return { inBlock: false, seen, tx: candidate }
    const inBlock = await bounded(candidate.merklePath.verify(record.txid, tracker))
    if (!inBlock) return { inBlock: false, seen, invalidProof: true, tx: candidate }
    await db.collection('txs').updateOne({ txid: record.txid }, { $set: { beef: candidate.toHexBEEF() } })
    await db.collection('utxos').updateMany({ txid: record.txid }, { $set: { confirmed: true } })
    return { inBlock: true, seen: true, tx: candidate }
}
