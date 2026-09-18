import { Request, Response } from 'express'
import { createHash, randomUUID } from 'node:crypto'
import { Transaction } from '@bsv/sdk'
import { OpReturn } from '@bsv/templates'
import db from '../db'
import HashPuzzle from '../HashPuzzle'
import { MAX_FILE_BYTES } from '../services/files'
import { availableTokens, submitOperation, releaseUnsubmitted } from '../services/operations'

export default async function (req: Request, res: Response) {
    const file = req.body as Buffer
    if (!Buffer.isBuffer(file) || !file.length) { res.status(400).json({ error: 'This file is empty. Choose a file with content and try again.' }); return }
    if (file.length > MAX_FILE_BYTES) { res.status(413).json({ error: 'This file is too large. Choose a file smaller than 10 MB.' }); return }
    const reservation = randomUUID()
    try {
        const fileHash = createHash('sha256').update(file).digest('hex')
        const utxo = await db.collection('utxos').findOneAndUpdate(availableTokens, { $set: { reservedBy: reservation } })
        if (!utxo) { res.status(503).json({ error: 'No write tokens are available. Open Treasury to mint tokens or check pending actions, then try again.' }); return }
        const source = await db.collection('txs').findOne({ txid: utxo.txid })
        if (!source) throw new Error('Token source is missing')
        const tx = new Transaction()
        tx.addInput({ sourceTransaction: Transaction.fromHexBEEF(source.beef), sourceOutputIndex: utxo.vout,
            unlockingScriptTemplate: new HashPuzzle().unlock(utxo.secret.secret) })
        tx.addOutput({ satoshis: 0, lockingScript: new OpReturn().lock(Array.from(Buffer.from(fileHash, 'hex'))) })
        await tx.sign()
        let fileName = String(req.headers['x-original-filename'] || 'download.bin')
        try { fileName = decodeURIComponent(fileName) } catch { /* Older clients send plain filenames. */ }
        const result = await submitOperation(tx, { type: 'upload', reservation, fileHash, file,
            fileType: req.headers['x-original-content-type'] || 'application/octet-stream', fileName, time: Date.now() })
        const common = { txid: result.txid, fileHash, network: process.env.NETWORK }
        if (result.outcome === 'rejected') {
            res.status(422).json({ ...common, error: 'The network rejected this upload. Your token is available again. Please try again later.' }); return
        }
        res.status(result.outcome === 'accepted' ? 200 : 202).json({ ...common,
            status: result.outcome === 'accepted' ? 'accepted' : 'pending',
            message: result.outcome === 'accepted' ? 'Your file is saved and its transaction was accepted. Block confirmation is pending. Use the ID or hash below to check it.' :
                'Your file is saved, but network acceptance is not yet confirmed. Your token is reserved. Keep this ID and check its status before uploading again.' })
    } catch (error) {
        console.error('Upload could not finish', error)
        const pending = await releaseUnsubmitted(reservation).catch(() => null)
        if (pending) {
            res.status(202).json({ status: 'pending', txid: pending.txid, fileHash: pending.fileHash, network: process.env.NETWORK,
                message: 'Your upload is awaiting reconciliation. Keep this ID and check its status before trying again.' }); return
        }
        res.status(503).json({ error: 'We could not prepare your upload. Please check the treasury and try again shortly.' })
    }
}
