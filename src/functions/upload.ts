import { Request, Response } from 'express'
import { Utils, Hash, Transaction } from '@bsv/sdk'
import db from '../db'
import { OpReturn } from '@bsv/templates'
import HashPuzzle from '../HashPuzzle'
import Arc from '../arc'
const Data = OpReturn.default


export default async function (req: Request, res: Response) {
  const time = Date.now()
  // parse raw image data
  const b = []
  req.on('data', (chunk) => {
    b.push(chunk)
  })
  req.on('end', async () => {
    const file = Buffer.concat(b)
    console.log({ file })

    // hash file and get length in bytes
    const length = file.length

    const fileHash = Utils.toHex(Hash.sha256(Utils.toArray(file.toString('hex'), 'hex')))
    
    console.log({ fileHash })
    // grab funding tokens as required (1 per kB assuming we start at 200 bytes rather than 0)
    const fees = Math.ceil(Math.max(1, (length - 200)) / 1000)
    console.log({ fees })
    const utxos = await Promise.all(Array(fees).fill(0).map(async () => {
      return await db.collection('utxos').findOneAndUpdate({ fileHash: null }, { $set: { fileHash } })
    }))

    console.log({ utxos })

    // build the data commitment transaction
    const sourceTransactions = await db.collection('txs').find({ txid: { $in: utxos.map(utxo => utxo.txid) } }).toArray()
    console.log({ sourceTransactions })
    const tx = new Transaction()
    for (const utxo of utxos) {
      tx.addInput({
        sourceTransaction: Transaction.fromHex(sourceTransactions.find(d => d.txid === utxo.txid).rawtx),
        sourceOutputIndex: utxo.vout,
        unlockingScriptTemplate: new HashPuzzle().unlock(utxo.secret.secret),
      })
    }

    // add the hash of the file to an output
    tx.addOutput({
      satoshis: 0,
      lockingScript: new Data().lock(fileHash)
    })

    // tx.broadcast and get a txid
    await tx.sign()

    console.log({ tx: tx.toHex() })

    const initialResponse = await tx.broadcast(Arc)

    console.log({ initialResponse })
    
    const txid = tx.id('hex')

    // store file in database
    const document = {
      txid,
      fileHash,
      rawtx: tx.toHex(),
      beef: tx.toHexBEEF(),
      arc: [initialResponse],
      file,
      fileType: req.headers['content-type'],
      time,
    }
    await db.collection('txs').insertOne(document)

    // respond to client with confirmation

    res.send({ txid, fileHash })
  })
}