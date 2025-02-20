/**
 * ARC Callback Handler
 * 
 * This module handles callbacks from the TAAL ARC service for transaction status updates.
 * It processes transaction confirmations and Merkle path updates, storing them in the database.
 * 
 * The callback handles two types of updates:
 * 1. Simple transaction status updates
 * 2. Merkle path updates for transaction verification
 * 
 * Security:
 * - Validates requests using a Bearer token authentication
 * - Only accepts callbacks from authorized ARC service endpoints
 * 
 * @requires CALLBACK_TOKEN environment variable for authentication
 */

import { Request, Response } from 'express'
import db from '../db'
import { MerklePath, Beef, Transaction } from '@bsv/sdk'

export default async function (req: Request, res: Response) {
    // Validate ARC service authentication
    console.log({ h: req.headers, b: req.body})
    if (req?.headers?.authorization !== 'Bearer ' + process.env.CALLBACK_TOKEN) {
        res.status(401).send({ error: 'Unauthorized' })
        return
    }

    const { txid, merklePath } = req.body

    // Handle Merkle path updates
    if (merklePath) {
        const document = await db.collection('txs').findOne({ txid })
        if (!document) {
            res.status(404).send({ error: 'Not found' })
            return
        }
        // Update transaction with Merkle path proof
        const beef = Beef.fromString(document.beef, 'hex')
        beef.mergeBump(MerklePath.fromHex(merklePath))
        const tx = beef.findAtomicTransaction(txid)
        const updated = tx.toHexBEEF()
        await db.collection('txs').updateOne({ txid }, { $set: { beef: updated }, $addToSet: { arc: req.body } })
    } else {
        // Handle simple status update
        await db.collection('txs').updateOne({ txid }, { $addToSet: { arc: req.body } })
    }

    res.send({ accepted: 'true' })
}