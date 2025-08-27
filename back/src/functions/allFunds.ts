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
    const max = utxos.reduce((a, b) => a + b.satoshis - 1, 0)

    const lockingScript = new P2PKH().lock(address).toHex()

    if (max < 1000) {
      res.send({ error: 'not enough satoshis, use the fund/{number} endpoint', utxos })
      return 
    }

    // create a bunch of funding transactions which we'll use to create tokens
    let batches = Math.floor(max / 1000)
    let change = max % 1000

    // temp limit during dev
    if (batches > 2) {
      batches = 2
    }
    // end of temp limit

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
      // for each batch we create an output of 1000 satoshis
      fundsTx.addOutput({
        satoshis: 1000,
        lockingScript: new P2PKH().lock(address)
      })
    }
    if (change > 0) {
      fundsTx.addOutput({
        change: true,
        lockingScript: new P2PKH().lock(address)
      })
    }

    await fundsTx.fee(new SatoshisPerKilobyte(1))
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
    const secretPairs = []
    for (let i = 0; i < batches * 957; i++) {
      const pair = HashPuzzle.generateSecretPair()
      secretPairs.push(pair)
    }

    const tokenCreationTxs: Transaction[] = []

    for (let batch = 0; batch < batches; batch++) {
      // Create transaction with hash-locked outputs
      const tx = new Transaction()
      tx.addInput(fromUtxo({
        txid: fundsTxId,
        vout: batch,
        satoshis: 1000,
        script: lockingScript,
      }, new P2PKH().unlock(key)))
      secretPairs.slice(batch * 957, (batch + 1) * 957).forEach(( pair ) => {
        tx.addOutput({
          satoshis: 1,
          lockingScript: new HashPuzzle().lock(pair.hash)
        })
      })
      await tx.fee(new SatoshisPerKilobyte(1))
      await tx.sign()
      tokenCreationTxs.push(tx)
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

    const tokenUtxos = secretPairs.map((secret, idx) => {
      const vout = idx % 957
      const creationTx = Math.floor(idx / 957)
      const txid = tokenTxs[creationTx].txid
      const script = tokenCreationTxs[creationTx].outputs[vout].lockingScript.toHex()
      const satoshis = 1
      const fileHash = null
      const confirmed = false
      return {
        txid,
        vout,
        script,
        satoshis,
        secret,
        fileHash,
        confirmed,
      }
    })

    // Store token data
    const utxosDbResponse = await db.collection('utxos').insertMany(tokenUtxos, { bypassDocumentValidation: true, ordered: false, forceServerObjectId: true })

    res.send({ txid: tokenUtxos[0].txid, number: batches * 957, txDb: txDbResponse.insertedCount, utxosDb: utxosDbResponse.insertedCount })
  } catch (error) {
    console.log(error)
    res.status(500)
    res.send({ error })
  }
}