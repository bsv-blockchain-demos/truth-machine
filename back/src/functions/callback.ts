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
import { MerklePath, Beef } from '@bsv/sdk'
import { tracker, bounded } from '../services/proofs'
import { settleOperation } from '../services/operations'

const defineFailure = ['SEEN_IN_ORPHAN_MEMPOOL', 'DOUBLE_SPEND_ATTEMPTED', 'REJECTED']

export default async function (req: Request, res: Response) {
    try {
        // Validate ARC service authentication
        if (!process.env.CALLBACK_TOKEN || req?.headers?.authorization !== 'Bearer ' + process.env.CALLBACK_TOKEN) {
            res.status(401).send({ error: 'Unauthorized' })
            return
        }

        const { txid, merklePath, txStatus } = req.body

        // Validate txid is a well-formed 64-char hex string before it ever
        // reaches a database query — prevents NoSQL operator injection
        // (e.g. a JSON body sending txid as { $ne: null }).
        if (typeof txid !== 'string' || !/^[0-9a-fA-F]{64}$/.test(txid)) {
            res.status(400).send({ error: 'Invalid txid' })
            return
        }
        if (merklePath !== undefined && typeof merklePath !== 'string') {
            res.status(400).send({ error: 'Invalid merklePath' })
            return
        }

        const existing = await db.collection('txs').findOne({ txid })
        if (!existing) { res.status(404).json({ error: 'Transaction not found.' }); return }

        if (defineFailure.includes(txStatus)) {
            // Retain rejected outputs for diagnosis and exclude them from available tokens.
            await db.collection('utxos').updateMany({ txid }, { $set: { invalid: true } })
            if (existing.reservation) await settleOperation(existing, txStatus === 'REJECTED' ? 'rejected' : 'unknown', req.body)
            await db.collection('txs').updateOne({ txid }, { $addToSet: { arc: req.body } })
            res.send({ accepted: 'true' })
            return
        }

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
            if (!tx?.merklePath || !await bounded(tx.merklePath.verify(txid, tracker))) {
                res.status(422).json({ error: 'The blockchain proof could not be verified.' }); return
            }
            if (existing.reservation) await settleOperation(existing, 'accepted', req.body)
            const updated = tx.toHexBEEF()
            // set all the utxos associated to spendable
            await db.collection('utxos').updateMany({ txid }, { $set: { confirmed: true } })
            await db.collection('txs').updateOne({ txid }, { $set: { beef: updated }, $addToSet: { arc: req.body } })
        } else {
            if (existing.reservation && ['SENT_TO_NETWORK', 'ACCEPTED_BY_NETWORK', 'SEEN_ON_NETWORK', 'MINED'].includes(txStatus)) {
                await settleOperation(existing, 'accepted', req.body)
            }
            // Handle simple status update
            await db.collection('txs').updateOne({ txid }, { $addToSet: { arc: req.body } })
        }

        res.send({ accepted: 'true' })
    } catch (error) {
        console.error('Failed to handle ARC callback', error)
        res.status(500).send({ error: 'Internal Server Error' })
    }
}