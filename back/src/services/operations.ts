import { Transaction } from '@bsv/sdk'
import db from '../db'
import broadcaster from '../arc'

interface TransactionRecord { txid: string; arc: unknown[]; operationStatus: string; settled: boolean }

export const availableTokens = {
    fileHash: null, invalid: { $ne: true }, spent: { $ne: true },
    available: { $ne: false }, reservedBy: null,
}

export type Outcome = 'accepted' | 'rejected' | 'unknown'

export function broadcastOutcome(response: any): Outcome {
    if (response?.status === 'success') return 'accepted'
    // Network errors and conflicting spends need reconciliation, not a new spend.
    if (['REJECTED', 'INVALID', 'MALFORMED'].includes(response?.code)) return 'rejected'
    return 'unknown'
}

export async function releaseReservation(reservation: string) {
    await db.collection('utxos').updateMany({ reservedBy: reservation }, { $unset: { reservedBy: '' } })
    await db.collection('fundingLocks').deleteMany({ reservation })
}

export async function settleOperation(record: any, outcome: Outcome, response?: any) {
    const update = await db.collection<TransactionRecord>('txs').updateOne({ txid: record.txid,
        ...(outcome !== 'accepted' ? { operationStatus: { $ne: 'accepted' } } : {}),
    }, {
        $set: { operationStatus: outcome, settled: false },
        ...(response ? { $push: { arc: response } } : {}),
    })
    // A late timeout or rejection must not overwrite observed network acceptance.
    if (!update.matchedCount) {
        const current = await db.collection('txs').findOne({ txid: record.txid })
        return (current?.operationStatus === 'accepted' ? 'accepted' : outcome) as Outcome
    }
    if (outcome === 'accepted') {
        if (record.plannedTokens?.length) {
            await db.collection('utxos').bulkWrite(record.plannedTokens.map((token: any) => ({
                updateOne: { filter: { _id: `${record.txid}:${token.vout}` }, update: { $setOnInsert: { ...token, _id: `${record.txid}:${token.vout}` } }, upsert: true },
            })))
        }
        if (record.reservation) {
            await db.collection('utxos').updateMany({ reservedBy: record.reservation }, {
                $set: { spent: true, spentInTx: record.txid, ...(record.fileHash ? { fileHash: record.fileHash } : {}) },
                $unset: { reservedBy: '' },
            })
        }
    } else if (outcome === 'rejected' && record.reservation) {
        await releaseReservation(record.reservation)
    }
    await db.collection('txs').updateOne({ txid: record.txid }, { $set: { settled: outcome !== 'unknown' } })
    return outcome
}

// Persist the signed transaction before contacting the network. A timeout can
// then be reconciled without discarding the file or spending the input twice.
export async function submitOperation(tx: Transaction, metadata: Record<string, any>) {
    const record = { ...metadata, txid: tx.id('hex'), beef: tx.toHexBEEF(), arc: [], operationStatus: 'prepared', settled: false }
    await db.collection('txs').insertOne(record)
    await db.collection('txs').updateOne({ txid: record.txid }, { $set: { operationStatus: 'broadcasting' } })
    let response: any
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        response = await Promise.race([tx.broadcast(broadcaster), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Broadcast timed out')), 30000)
        })])
        if (response.status === 'success' && response.txid && response.txid !== record.txid) {
            response = { status: 'error', code: 'UNEXPECTED_TRANSACTION' }
        }
    } catch {
        response = { status: 'error', code: 'NETWORK_UNAVAILABLE' }
    } finally { clearTimeout(timer) }
    const outcome = broadcastOutcome(response)
    try {
        const settled = await settleOperation(record, outcome, response)
        return { txid: record.txid, outcome: settled }
    } catch (error) {
        console.error('Transaction needs reconciliation', record.txid, error)
        return { txid: record.txid, outcome: 'unknown' as Outcome }
    }
}


export async function releaseUnsubmitted(reservation: string) {
    const pending = await db.collection('txs').findOne({ reservation, operationStatus: { $in: ['broadcasting', 'unknown', 'accepted'] } })
    if (!pending) await releaseReservation(reservation)
    return pending
}
