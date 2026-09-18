import { Request, Response } from 'express'
import { Transaction } from '@bsv/sdk'
import db from '../db'
import { checkProof } from '../services/proofs'
import { settleOperation } from '../services/operations'

export default async function (_req: Request, res: Response) {
    try {
        const tokens = await db.collection('utxos').distinct('txid', { confirmed: false, invalid: { $ne: true } })
        const query = { $or: [
            { operationStatus: { $in: ['broadcasting', 'unknown'] } },
            { operationStatus: { $in: ['accepted', 'rejected'] }, settled: false },
            { txid: { $in: tokens } },
        ] }
        const total = await db.collection('txs').countDocuments(query)
        const records = await db.collection('txs').find(query).sort({ lastCheckedAt: 1 }).limit(5).toArray()
        const results = await Promise.all(records.map(async record => {
            try {
                await db.collection('txs').updateOne({ txid: record.txid }, { $set: { lastCheckedAt: Date.now() } })
                if (['accepted', 'rejected'].includes(record.operationStatus) && !record.settled) await settleOperation(record, record.operationStatus)
                if (record.operationStatus === 'rejected') return { txid: record.txid, status: 'rejected' }
                const proof = await checkProof(record, Transaction.fromHexBEEF(record.beef))
                if (proof.invalidProof) return { txid: record.txid, status: 'unavailable' }
                if (proof.seen && record.reservation && record.operationStatus !== 'accepted') await settleOperation(record, 'accepted')
                return { txid: record.txid, status: proof.inBlock ? 'confirmed' : 'pending' }
            } catch { return { txid: record.txid, status: 'unavailable' } }
        }))
        const confirmed = results.filter(r => r.status === 'confirmed').length
        const pending = results.filter(r => r.status === 'pending').length
        const rejected = results.filter(r => r.status === 'rejected').length
        const unavailable = results.filter(r => r.status === 'unavailable').length
        res.json({ status: pending || unavailable || rejected || total > records.length ? 'pending' : 'success', confirmed, pending, unavailable, rejected, remaining: total - records.length,
            message: !results.length ? 'Your treasury is up to date. There are no pending actions to check.' :
                `${confirmed} transaction${confirmed === 1 ? '' : 's'} confirmed, ${pending} still pending, ${unavailable} temporarily unavailable${rejected ? `, ${rejected} rejected with reservations released` : ''}. ${pending || unavailable ? 'Check again later; do not repeat pending actions.' : 'Your treasury has been updated.'}${total > records.length ? ' More actions still need checking; run this check again.' : ''}`,
            results })
    } catch (error) {
        console.error('Status check unavailable', error)
        res.status(503).json({ error: 'We could not check pending actions right now. Please try again shortly.' })
    }
}
