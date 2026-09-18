/**
 * Treasury Status Check Endpoint
 * 
 * This endpoint provides information about the application's treasury status, including:
 * - Available token count (unused UTXOs)
 * - Current balance in satoshis
 * - Treasury address
 * 
 * The treasury consists of:
 * - Unused UTXOs (tokens) that can be allocated for file storage
 * - Total balance of all UTXOs at the treasury address
 * 
 * @route GET /api/treasury
 * @returns {Object} Treasury status
 *          - address: The treasury Bitcoin address
 *          - balance: Total balance in satoshis
 *          - tokens: Number of available unused tokens
 */

import { Request, Response } from 'express'
import db from '../db'
import { address } from '../functions/address'
import woc from '../woc'
import { availableTokens } from '../services/operations'

export default async function (req: Request, res: Response) {
    try {
        // Count available tokens (UTXOs not yet assigned to files)
        const tokens = await db.collection('utxos').countDocuments(availableTokens)
        
        // Get current UTXO set and calculate total balance
        const utxos = await woc.getUtxos(address)
        const balance = utxos.reduce((a, b) => a + b.satoshis, 0)
        
        const pending = await db.collection('txs').countDocuments({ operationStatus: { $in: ['broadcasting', 'unknown'] } })
        res.send({ address, balance, tokens, pending })
    } catch (error) {
        console.error('Failed to get utxos', error)
        res.status(503).json({ error: 'Treasury information is temporarily unavailable. Please try again shortly.' })
    }
}