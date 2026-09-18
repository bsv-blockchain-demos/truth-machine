import { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { P2PKH, SatoshisPerKilobyte, Transaction } from '@bsv/sdk'
import HashPuzzle from '../HashPuzzle'
import db from '../db'
import { address } from './address'
import { availableTokens, submitOperation, releaseUnsubmitted } from '../services/operations'

export default async function (_req: Request, res: Response) {
    const reservation = randomUUID()
    try {
        const candidates = await db.collection('utxos').find({ ...availableTokens, confirmed: true }).limit(1000).toArray()
        const utxos = []
        for (const candidate of candidates) {
            const token = await db.collection('utxos').findOneAndUpdate({ ...availableTokens, _id: candidate._id }, { $set: { reservedBy: reservation } })
            if (token) utxos.push(token)
        }
        if (!utxos.length) {
            res.status(409).json({ error: 'No confirmed, unused tokens are ready to consolidate. Check pending actions or wait for block confirmation.' }); return
        }
        const tx = new Transaction()
        for (const utxo of utxos) {
            const source = await db.collection('txs').findOne({ txid: utxo.txid })
            if (!source) throw new Error('Token source is missing')
            tx.addInput({ sourceTransaction: Transaction.fromHexBEEF(source.beef), sourceOutputIndex: utxo.vout,
                unlockingScriptTemplate: new HashPuzzle().unlock(utxo.secret.secret) })
        }
        tx.addOutput({ change: true, lockingScript: new P2PKH().lock(address) })
        await tx.fee(new SatoshisPerKilobyte(100))
        await tx.sign()
        const totalSatoshis = utxos.reduce((sum, token) => sum + token.satoshis, 0)
        const result = await submitOperation(tx, { type: 'consolidation', reservation,
            utxosConsolidated: utxos.length, totalSatoshis, time: Date.now() })
        if (result.outcome === 'rejected') {
            res.status(422).json({ error: 'The network rejected consolidation. Your tokens are available again. Try again later.' }); return
        }
        res.status(result.outcome === 'accepted' ? 200 : 202).json({ txid: result.txid,
            status: result.outcome === 'accepted' ? 'success' : 'pending',
            message: result.outcome === 'accepted' ? `${utxos.length} tokens were consolidated. The remaining value was returned to the treasury after the network fee.` :
                'Consolidation is awaiting network confirmation. The tokens are reserved. Check pending actions before trying again.' })
    } catch (error) {
        console.error('Consolidation could not finish', error)
        const pending = await releaseUnsubmitted(reservation).catch(() => null)
        if (pending) { res.status(202).json({ status: 'pending', txid: pending.txid,
            message: 'Consolidation is awaiting reconciliation. Check pending actions before trying again.' }); return }
        res.status(503).json({ error: 'We could not prepare consolidation. Your tokens have not been intentionally spent. Check the treasury and try again.' })
    }
}
