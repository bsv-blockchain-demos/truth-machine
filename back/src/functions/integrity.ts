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
import { Transaction, WhatsOnChain, Beef, Utils, MerklePath } from '@bsv/sdk'
import db from '../db'
import dotenv from 'dotenv'
dotenv.config()
const { NETWORK } = process.env

const blockHeaderService = new WhatsOnChain(NETWORK as "main" | "test" | "stn")

/**
 * 
 * @method verifyTipScript
 * @param {Transaction} tx - The transaction to verify.
 * 
 * @returns {Promise<boolean>} - A promise that resolves when the verification is complete.
 * 
 * This function is used to verify the tip script of a transaction by checking the script execution only.
 * It assumes that the Merkle path is valid and sets it to a default value.
 */
async function verifyTipScript(tx: Transaction): Promise<boolean> {
    tx.inputs = tx.inputs.map((input, vin) => {
        input.sourceTransaction.merklePath = new MerklePath(1, [[{ offset: 0, txid: true, hash: '0000000000000000000000000000000000000000000000000000000000000000'}]]) // assume valid
        return input
    })
    return await tx.verify('scripts only')
}

export default async function (req: Request, res: Response) {
    try {
        // Retrieve transaction and file data
        const { id } = req.params
        const { txid, fileHash, time, fileType, beef, arc } = await db.collection('txs').findOne({
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

        const matchedCommitment = txFileHash === fileHash
        
        // Perform SPV verification using WhatsOnChain - ONLY for the tip transaction
        let inBlock, broadcast
        try {
            inBlock = await tx.merklePath?.verify(txid, blockHeaderService)
        } catch (error) {
            console.error('SPV verification error:', error)
        }
        if (!inBlock) {
            try {
                let arcStatus = arc[0].status === 'success'
                console.log({ arcStatus })
                broadcast = await verifyTipScript(tx) || arcStatus
            } catch (error) {
                console.error('Broadcast verification error:', error)
            }
        }
        const valid = matchedCommitment && (broadcast || inBlock)

        if (!broadcast) {
            res.send({ error: 'Broadcast was unsuccessful', id, txid, fileHash, valid, broadcast, inBlock, matchedCommitment })
        }

        // Return error if verification fails
        if (!valid) {
            res.send({ error: 'something did not check out', id, txid, fileHash, valid, broadcast, inBlock, matchedCommitment })
            return
        }

        const currentHeight = await blockHeaderService.currentHeight()
        const height = tx.merklePath?.blockHeight
        const depth = currentHeight - height

        // Return successful verification with BEEF data
        res.send({
            id, txid, fileHash, time, fileType, valid, broadcast, inBlock, matchedCommitment, depth, beef
        })
    } catch (error) {
        res.send({ error: error.message })
    }
}