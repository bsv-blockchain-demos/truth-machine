import { Request, Response } from 'express'
import { fromUtxo, MerklePath, P2PKH, SatoshisPerKilobyte, Transaction } from '@bsv/sdk'
import HashPuzzle from '../HashPuzzle'
import db from '../db'
import { ArcTaal } from '../arc'
import { address, key } from '../functions/address'
import woc from '../woc'

export default async function (req: Request, res: Response) {
  try {
    // Check funding availability - important to note that the assumption made here 
    // is that there's only one utxo which corresponds to this address.
    const utxos = await woc.getUtxos(address)
    const max = utxos.reduce((a, b) => a + b.satoshis, 0)

    const TOKEN_SATOSHIS = 13
    const MAX_TOKEN_OUTPUTS_PER_TX = 200
    const FUNDS_TX_FEE_BUFFER = 1000
    const TOKEN_TX_FEE_BUFFER = 1000

    const lockingScript = new P2PKH().lock(address).toHex()

    if (max < TOKEN_SATOSHIS + FUNDS_TX_FEE_BUFFER) {
      res.send({ error: 'not enough satoshis, use the fund/{number} endpoint', utxos })
      return 
    }

    // create a bunch of funding transactions which we'll use to create tokens
    const maxAvailableForFundingOutputs = max - FUNDS_TX_FEE_BUFFER
    let batches = Math.ceil(maxAvailableForFundingOutputs / (TOKEN_SATOSHIS * MAX_TOKEN_OUTPUTS_PER_TX + TOKEN_TX_FEE_BUFFER))
    if (batches < 1) {
      batches = 1
    }

    // temp limit during dev
    if (batches > 2) {
      batches = 2
    }
    // end of temp limit

    const batchBase = Math.floor(maxAvailableForFundingOutputs / batches)
    const batchRemainder = maxAvailableForFundingOutputs % batches
    const batchInputSatoshis = Array.from({ length: batches }, (_, i) => batchBase + (i < batchRemainder ? 1 : 0))

    const fundsTx = new Transaction()
    utxos.forEach((utxo) => {
      fundsTx.addInput(fromUtxo({
        txid: utxo.txid,
        vout: utxo.vout,
        satoshis: utxo.satoshis,
        script: lockingScript,
    }, new P2PKH().unlock(key)))
    })

    for (let i = 0; i < batches; i++) {
      fundsTx.addOutput({
        satoshis: batchInputSatoshis[i],
        lockingScript: new P2PKH().lock(address)
      })
    }
    fundsTx.addOutput({
      change: true,
      lockingScript: new P2PKH().lock(address)
    })

    await fundsTx.fee(new SatoshisPerKilobyte(100))
    await fundsTx.sign()
    const fundsTxId = fundsTx.id('hex')

    // Let's ensure this gets out quickly
    const fundsTxResponse = await fundsTx.broadcast(ArcTaal)

    if (fundsTxResponse.status !== 'success') {
      res.send({ error: 'fundsTxResponse', fundsTxResponse })
      return
    }

    // this tx is now valid and can be used as inputs to the token creation txs


    // Generate unique secret-hash pairs for each token
    const secretsByTx: any[] = []
    const tokenOutputsByTx: number[] = []

    const tokenCreationTxs: Transaction[] = []

    for (let batch = 0; batch < batches; batch++) {
      // Create transaction with hash-locked outputs
      const batchSatoshis = batchInputSatoshis[batch]
      let outputs = Math.floor((batchSatoshis - TOKEN_TX_FEE_BUFFER) / TOKEN_SATOSHIS)
      if (outputs < 1) {
        res.send({ error: 'not enough satoshis to fund token creation transaction', batch, batchSatoshis })
        return
      }
      if (outputs > MAX_TOKEN_OUTPUTS_PER_TX) {
        outputs = MAX_TOKEN_OUTPUTS_PER_TX
      }

      while (outputs > 0) {
        const tx = new Transaction()
        tx.addInput(fromUtxo({
          txid: fundsTxId,
          vout: batch,
          satoshis: batchSatoshis,
          script: lockingScript,
        }, new P2PKH().unlock(key)))

        const pairs = []
        for (let i = 0; i < outputs; i++) {
          const pair = HashPuzzle.generateSecretPair()
          pairs.push(pair)
          tx.addOutput({
            satoshis: TOKEN_SATOSHIS,
            lockingScript: new HashPuzzle().lock(pair.hash)
          })
        }

        tx.addOutput({
          change: true,
          lockingScript: new P2PKH().lock(address)
        })

        try {
          await tx.fee(new SatoshisPerKilobyte(100))
          await tx.sign()
          tokenCreationTxs.push(tx)
          secretsByTx.push(pairs)
          tokenOutputsByTx.push(outputs)
          break
        } catch (e) {
          outputs -= 1
        }
      }

      if (outputs === 0) {
        res.send({ error: 'not enough satoshis to fund token creation transaction', batch, batchSatoshis })
        return
      }
    }

    // Broadcast transactions
    const responses = await ArcTaal.broadcastMany(tokenCreationTxs)

    const tokenTxs = responses.map((txResponse: any, i) => {
      const tokenTx  = tokenCreationTxs[i]
      tokenTx.merklePath = new MerklePath(1, [[{ offset: 0, hash: txResponse.txid }]])
      return {
        txid: txResponse.txid,
        beef: tokenTx.toHexBEEF(),
        arc: txResponse,
      }
    })

    // Store transaction data
    const txDbResponse = await db.collection('txs').insertMany(tokenTxs)

    const tokenUtxos: any[] = []
    for (let creationTx = 0; creationTx < tokenTxs.length; creationTx++) {
      const txid = tokenTxs[creationTx].txid
      for (let vout = 0; vout < tokenOutputsByTx[creationTx]; vout++) {
        const secret = secretsByTx[creationTx][vout]
        const script = tokenCreationTxs[creationTx].outputs[vout].lockingScript.toHex()
        const satoshis = TOKEN_SATOSHIS
        const fileHash = null
        const confirmed = false
        const spent = false
        tokenUtxos.push({
          txid,
          vout,
          script,
          satoshis,
          secret,
          fileHash,
          confirmed,
          spent,
        })
      }
    }

    // Store token data
    const utxosDbResponse = await db.collection('utxos').insertMany(tokenUtxos, { bypassDocumentValidation: true, ordered: false, forceServerObjectId: true })

    res.send({ txid: tokenUtxos[0].txid, number: tokenUtxos.length, txDb: txDbResponse.insertedCount, utxosDb: utxosDbResponse.insertedCount })
  } catch (error) {
    console.log(error)
    res.status(500)
    res.send({ error })
  }
}