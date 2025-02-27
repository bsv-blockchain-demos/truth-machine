/**
 * File Upload Endpoint
 * 
 * This endpoint handles file uploads to the Truth Machine system, committing file hashes
 * to the Bitcoin blockchain and storing the actual file data in the database.
 * 
 * Process Flow:
 * 1. Receives and buffers file data
 * 2. Calculates file hash and required token count
 * 3. Allocates necessary tokens (UTXOs) based on file size
 * 4. Creates a transaction committing the file hash to blockchain
 * 5. Stores file data and transaction metadata in BEEF format
 * 
 * BEEF Storage:
 * The transaction is stored in BEEF (Background Evaluation Extended Format) which includes:
 * - Raw transaction data
 * - Merkle proofs (BUMPs) when received from ARC callbacks
 * - Transaction validation metadata
 * 
 * For detailed BEEF specification, see: https://bsv.brc.dev/transactions/0062
 * 
 * This format enables:
 * - Complete transaction verification
 * - SPV proof validation
 * - Chain of custody tracking
 * 
 * Token Allocation:
 * - Base cost: 1 token
 * - Additional tokens: 1 per KB after first 200 bytes
 * - Each token is a 1-satoshi UTXO
 * 
 * @route POST /api/upload
 * @consumes multipart/form-data
 * @returns {Object} Upload status
 *          - txid: Transaction ID of the commitment
 *          - fileHash: SHA256 hash of the file
 *          - network: Current network (main/test)
 * 
 * Database Storage:
 * - File content
 * - Transaction data (raw and BEEF format)
 * - File metadata (hash, type, timestamp)
 * - ARC responses for BUMP updates
 */

import { Request, Response } from 'express'
import { Utils, Hash, Transaction } from '@bsv/sdk'
import db from '../db'
import { OpReturn } from '@bsv/templates'
import HashPuzzle from '../HashPuzzle'
import Arc from '../arc'
import dotenv from 'dotenv'
dotenv.config()
const Data = OpReturn.default

const { NETWORK } = process.env

export default async function (req: Request, res: Response) {
  try {
    const time = Date.now()
  
    // Buffer file data from stream
    const b = []
    req.on('data', (chunk) => {
      console.log('data being uploaded...')
      b.push(chunk)
    })
    
    req.on('end', async () => {
      const file = Buffer.concat(b)
      console.log({ file })

      // Calculate file hash and required token count
      const length = 32 // just the hash
      const fileHash = Utils.toHex(Hash.sha256(Utils.toArray(file.toString('hex'), 'hex')))
      console.log({ fileHash })
      
      // For a 32 byte hash fees will always be 1
      const fees = 1
      const utxo = await db.collection('utxos').findOneAndUpdate({ fileHash: null, confirmed: true }, { $set: { fileHash } })

      console.log({ utxo })

      // Create transaction with file hash commitment
      const sourceTransaction = await db.collection('txs').findOne({ txid: utxo.txid })
      console.log({ sourceTransaction })
      const tx = new Transaction()
      
      // Add input from allocated tokens
      tx.addInput({
        sourceTransaction: Transaction.fromHex(sourceTransaction.rawtx),
        sourceOutputIndex: utxo.vout,
        unlockingScriptTemplate: new HashPuzzle().unlock(utxo.secret.secret),
      })

      // Add OP_RETURN output with file hash
      tx.addOutput({
        satoshis: 0,
        lockingScript: new Data().lock(fileHash)
      })

      // Sign and broadcast transaction
      await tx.sign()
      console.log({ tx: tx.toHex() })
      const initialResponse = await tx.broadcast(Arc)
      console.log({ initialResponse })
      
      const txid = tx.id('hex')

      // Store file data and metadata in BEEF format
      // BEEF will be updated with BUMPs via ARC callbacks
      const document = {
        txid,
        fileHash,
        rawtx: tx.toHex(),
        beef: tx.toHexBEEF(),  // Initial BEEF without BUMPs
        arc: [initialResponse], // ARC responses track BUMP updates
        file,
        fileType: req.headers['content-type'],
        time,
      }
      await db.collection('txs').insertOne(document)

      // Return success response
      res.send({ txid, fileHash, network: NETWORK })
    })
  } catch (error) {
    console.error('Failed to upload file', error)
    res.status(500).json({ error: error.message })
  }
}
