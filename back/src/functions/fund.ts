import { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { P2PKH, SatoshisPerKilobyte, Transaction } from '@bsv/sdk'
import HashPuzzle from '../HashPuzzle'
import db from '../db'
import { address, key } from './address'
import woc from '../woc'
import { submitOperation, releaseUnsubmitted } from '../services/operations'

export default async function (req: Request, res: Response) {
    const value = String(req.params.number)
    const number = Number(value)
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > 1000) {
        res.status(400).json({ error: 'Choose a whole number of tokens between 1 and 1,000.' }); return
    }
    const reservation = randomUUID()
    try {
        const utxos = await woc.getUtxos(address)
        utxos.sort((a, b) => b.satoshis - a.satoshis)
        const utxo = utxos[0]
        const required = number * 13 + 100
        if (!utxo || utxo.satoshis < required) {
            res.status(409).json({ error: 'There are not enough available funds for this amount. Deposit BSV at the treasury address or choose fewer tokens.' }); return
        }
        try {
            await db.collection('fundingLocks').insertOne({ _id: `${utxo.txid}:${utxo.vout}` as any, reservation })
        } catch (error) {
            if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 11000) throw error
            res.status(409).json({ error: 'These funds are already being used by another action. Check pending actions before minting again.' }); return
        }
        const beef = await woc.getBeef(utxo.txid)
        if (!beef) throw new Error('Funding proof unavailable')
        const pairs = Array.from({ length: number }, () => HashPuzzle.generateSecretPair())
        const tx = new Transaction()
        tx.addInput({ sourceTransaction: Transaction.fromHexBEEF(beef), sourceOutputIndex: utxo.vout,
            unlockingScriptTemplate: new P2PKH().unlock(key) })
        for (const pair of pairs) tx.addOutput({ satoshis: 13, lockingScript: new HashPuzzle().lock(pair.hash) })
        tx.addOutput({ change: true, lockingScript: new P2PKH().lock(address) })
        await tx.fee(new SatoshisPerKilobyte(100))
        await tx.sign()
        const txid = tx.id('hex')
        const plannedTokens = pairs.map((secret, vout) => ({ txid, vout, script: tx.outputs[vout].lockingScript.toHex(),
            satoshis: 13, secret, fileHash: null, confirmed: false, spent: false }))
        const result = await submitOperation(tx, { type: 'mint', reservation, number, plannedTokens, time: Date.now() })
        if (result.outcome === 'rejected') {
            res.status(422).json({ error: 'The network rejected token creation. No tokens were added. Try again later.' }); return
        }
        res.status(result.outcome === 'accepted' ? 200 : 202).json({ txid, number,
            status: result.outcome === 'accepted' ? 'success' : 'pending',
            message: result.outcome === 'accepted' ? `${number} write token${number === 1 ? ' is' : 's are'} ready to use. You can upload a file now.` :
                'Token creation is awaiting network confirmation. Your funds are reserved. Check pending actions before minting again.' })
    } catch (error) {
        console.error('Token creation could not finish', error)
        const pending = await releaseUnsubmitted(reservation).catch(() => null)
        if (pending) { res.status(202).json({ status: 'pending', txid: pending.txid,
            message: 'Token creation is awaiting reconciliation. Check pending actions before minting again.' }); return }
        res.status(503).json({ error: 'We could not prepare token creation. Please try again shortly.' })
    }
}
