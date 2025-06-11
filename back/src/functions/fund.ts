/**
 * Treasury Funding Endpoint
 * 
 * This endpoint creates new tokens (UTXOs) for file storage in the Truth Machine system.
 * It splits a single UTXO into multiple 1-satoshi outputs, each locked with a unique hash puzzle.
 * These outputs serve as tokens that can later be used to store file data.
 * 
 * Process:
 * 1. Validates requested token count (max 1000)
 * 2. Checks available funding
 * 3. Generates unique secret-hash pairs for each token
 * 4. Creates and broadcasts a transaction with hash-locked outputs
 * 5. Stores transaction and token data in the database
 * 
 * @route POST /api/fund/:number
 * @param {string} number - Number of tokens to create (max 1000)
 * @returns {Object} Creation status
 *          - txid: Transaction ID
 *          - number: Number of tokens created
 *          - txDbResponse: Database response for transaction storage
 *          - utxosDbResponse: Database response for UTXO storage
 * 
 * Security:
 * - Each token is locked with a unique hash puzzle
 * - Secrets are stored securely in the database
 * - Change is returned to the treasury address
 */

import { Request, Response } from 'express'
import { P2PKH, SatoshisPerKilobyte, Transaction } from '@bsv/sdk'
import HashPuzzle from '../HashPuzzle'
import db from '../db'
import Arc from '../arc'
import { address, key } from '../functions/address'
import woc from '../woc'

export default async function (req: Request, res: Response) {
  try {
    const { number: strNum } = req.params
    const number = parseInt(strNum)

    console.log({ number })

    // Validate token count
    if (number > 1000) {
      res.send({ error: 'too many outputs, keep it to 1000 max', number })
      return
    }

    // Check funding availability
    const utxos = await woc.getUtxos(address)
    const beef = await woc.getBeef(utxos[0].txid)
    const max = utxos.reduce((a, b) => a + b.satoshis - 1, 0)

    if (max < number) {
      res.send({ error: 'not enough satoshis', number, utxos })
      return 
    }

    // Generate unique secret-hash pairs for each token
    const secretPairs = []
    for (let i = 0; i < number; i++) {
      const pair = HashPuzzle.generateSecretPair()
      secretPairs.push(pair)
    }

    const sourceTransaction = Transaction.fromHexBEEF(beef)

    // Create transaction with hash-locked outputs
    const tx = new Transaction()
    tx.addInput({
      sourceTransaction,
      sourceOutputIndex: utxos[0].vout,
      unlockingScriptTemplate: new P2PKH().unlock(key)
    })
    for (const pair of secretPairs) {
      tx.addOutput({
        satoshis: 1,
        lockingScript: new HashPuzzle().lock(pair.hash)
      })
    }
    tx.addOutput({
      change: true,
      lockingScript: new P2PKH().lock(address)
    })
    await tx.fee(new SatoshisPerKilobyte(1))
    await tx.sign()

    // Broadcast transaction
    const initialResponse = await tx.broadcast(Arc)

    const txid = tx.id('hex')

    // Store transaction data
    const txDbResponse = await db.collection('txs').insertOne({
      txid,
      beef: tx.toHexBEEF(),
      arc: [initialResponse],
      number,
    })

    // Store token data
    const utxosDbResponse = await db.collection('utxos').insertMany(
      secretPairs.map((secret, vout) => ({
        txid,
        vout,
        script: tx.outputs[vout].lockingScript.toHex(),
        satoshis: 1,
        secret,
        fileHash: null,
        confirmed: false,
      }))
    )

    res.send({ txid, number, txDbResponse, utxosDbResponse })
  } catch (error) {
    console.log(error)
    res.status(500)
    res.send({ error })
  }
}