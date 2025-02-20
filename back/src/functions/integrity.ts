/**
 * File Integrity Verification Endpoint
 * 
 * This endpoint verifies the integrity and authenticity of files stored in the Truth Machine system
 * using BEEF (Background Evaluation Extended Format) transactions and SPV proofs.
 * 
 * BEEF Format:
 * BEEF is a comprehensive transaction format that combines:
 * - Raw Transaction Data (BRC-12)
 * - BSV Universal Merkle Path (BUMP) proofs (BRC-74)
 * - Transaction validation metadata
 * 
 * For detailed BEEF specification, see: https://bsv.brc.dev/transactions/0062
 * 
 * BEEF Structure:
 * 1. Version (4 bytes): 0100BEEF in little-endian
 * 2. Number of BUMPs (VarInt)
 * 3. BUMP data (if any)
 * 4. Number of transactions (VarInt)
 * 5. For each transaction:
 *    - Raw transaction data
 *    - BUMP association flag (0x01 if has BUMP, 0x00 if not)
 *    - BUMP index (VarInt, if has BUMP)
 * 
 * Verification Process:
 * 1. Parse BEEF data to extract transaction and BUMP information
 * 2. Verify transaction integrity using SPV (Simplified Payment Verification)
 * 3. Validate Merkle paths against block headers
 * 4. Confirm file hash matches the committed hash in the transaction
 * 
 * @route GET /api/verify/:id
 * @param {string} id - Transaction ID or file hash to verify
 * @returns {Object} Verification results
 *          - txid: Transaction ID
 *          - fileHash: Hash of the file
 *          - time: Timestamp
 *          - fileType: MIME type
 *          - beef: BEEF format transaction data
 *          - valid: Overall verification status
 * 
 * Error Cases:
 * - Invalid BEEF data structure
 * - SPV verification failure
 * - BUMP validation failure
 * - Hash mismatch between file and transaction
 */

import { Request, Response } from 'express'
import { Transaction, WhatsOnChain, Beef, Utils } from '@bsv/sdk'
import db from '../db'
import dotenv from 'dotenv'
dotenv.config()
const { NETWORK } = process.env

export default async function (req: Request, res: Response) {
    try {
        // Retrieve transaction and file data
        const { id } = req.params
        const { txid, fileHash, time, fileType, beef } = await db.collection('txs').findOne({
            $or: [
                { txid: id },
                { fileHash: id }
            ]
        })

        // Parse and validate BEEF data
        // BEEF includes transaction data and Merkle proofs in a single format
        const b = Beef.fromString(beef)
        console.log(b.toLogString())
        
        // Extract transaction from BEEF and verify file hash commitment
        const tx = Transaction.fromHexBEEF(beef)
        const txFileHash = Utils.toUTF8(Utils.toArray(tx.outputs[0].lockingScript.toASM().split(' ')[2], 'hex'))
        
        // Perform SPV verification using WhatsOnChain
        const spv = await tx.verify(new WhatsOnChain(NETWORK as "main" | "test" | "stn"))
        const matchedCommitment = txFileHash === fileHash
        const valid = matchedCommitment && spv

        // Return error if verification fails
        if (!valid) {
            res.send({ error: 'something did not check out', id, txid, fileHash, spv, matchedCommitment })
            return
        }

        // Return successful verification with BEEF data
        res.send({
            txid, fileHash, time, fileType, beef, valid
        })
    } catch (error) {
        res.send({ error: error.message })
    }
}