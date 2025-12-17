/**
 * UTXO Consolidation Endpoint
 *
 * This endpoint consolidates all available hash-locked UTXOs in the database into a single output.
 * It gathers all the tokens created by the fund endpoint and combines them back into one UTXO
 * locked to the treasury address.
 *
 * Process:
 * 1. Retrieves all confirmed, unused UTXOs from the database
 * 2. Creates a transaction with all UTXOs as inputs
 * 3. Unlocks each input using its stored secret
 * 4. Creates a single change output locked to the treasury address
 * 5. Broadcasts the consolidation transaction
 *
 * @route POST /api/consolidate
 * @returns {Object} Consolidation status
 *          - txid: Transaction ID of the consolidation
 *          - utxosConsolidated: Number of UTXOs combined
 *          - totalSatoshis: Total satoshis consolidated
 *
 * Use Cases:
 * - Reclaim unused tokens
 * - Reduce UTXO fragmentation
 * - Prepare treasury for new funding rounds
 */

import { Request, Response } from 'express'
import { P2PKH, SatoshisPerKilobyte, Transaction } from '@bsv/sdk'
import HashPuzzle from '../HashPuzzle'
import db from '../db'
import Arc from '../arc'
import { address } from '../functions/address'

export default async function (_req: Request, res: Response) {
  try {
    // Retrieve all confirmed, unused UTXOs from the database
    const utxos = await db.collection('utxos').find({
      confirmed: true,
      fileHash: null,
      invalid: null,
      spent: { $ne: true }
    }).toArray()

    console.log({ utxosFound: utxos.length })

    if (utxos.length === 0) {
      res.send({ error: 'No UTXOs available to consolidate' })
      return
    }

    // Calculate total satoshis being consolidated
    const totalSatoshis = utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0)

    // Create consolidation transaction
    const tx = new Transaction()

    // Add each UTXO as an input
    for (const utxo of utxos) {
      // Retrieve the source transaction from the database
      const sourceTransactionDoc = await db.collection('txs').findOne({ txid: utxo.txid })

      if (!sourceTransactionDoc) {
        console.error(`Source transaction not found for UTXO ${utxo.txid}:${utxo.vout}`)
        continue
      }

      const sourceTransaction = Transaction.fromHexBEEF(sourceTransactionDoc.beef)

      // Add input with hash puzzle unlock
      tx.addInput({
        sourceTransaction,
        sourceOutputIndex: utxo.vout,
        unlockingScriptTemplate: new HashPuzzle().unlock(utxo.secret.secret)
      })
    }

    // Add single output back to treasury address
    tx.addOutput({
      change: true,
      lockingScript: new P2PKH().lock(address)
    })

    // Calculate fees and sign transaction
    await tx.fee(new SatoshisPerKilobyte(100))
    await tx.sign()

    // Broadcast transaction
    const initialResponse = await tx.broadcast(Arc)
    console.log({ initialResponse })

    const txid = tx.id('hex')

    // Store consolidation transaction in database
    const txDbResponse = await db.collection('txs').insertOne({
      txid,
      beef: tx.toHexBEEF(),
      arc: [initialResponse],
      type: 'consolidation',
      utxosConsolidated: utxos.length,
      totalSatoshis
    })

    // Mark consolidated UTXOs as spent
    await db.collection('utxos').updateMany(
      {
        _id: { $in: utxos.map(u => u._id) }
      },
      {
        $set: { spent: true, spentInTx: txid }
      }
    )

    res.send({
      txid,
      utxosConsolidated: utxos.length,
      totalSatoshis,
      txDbResponse
    })
  } catch (error) {
    console.error('Failed to consolidate UTXOs', error)
    res.status(500).json({ error: error.message })
  }
}
