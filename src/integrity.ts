import { Request, Response } from 'express'
import { Transaction, WhatsOnChain } from '@bsv/sdk'
import db from './db'

export default async function (req: Request, res: Response) {
    // get the data by its txid or hash
    const { id } = req.query
    const { txid, fileHash, file, time, fileType, beef } = await db.collection('files').findOne({
        $or: [
            { txid: id },
            { fileHash: id }
        ]
    })

    // We're validating here what you could do client side if you wanted to be sure.
    const tx = Transaction.fromHexBEEF(beef)
    const spv = await tx.verify(new WhatsOnChain())
    const matchedCommitment = tx.outputs[0].lockingScript.toASM().split(' ')[2] === fileHash
    const valid = matchedCommitment && spv
    
    if (!valid) {
        res.send({ error: 'something did not check out', id, txid, fileHash, spv, matchedCommitment })
        return
    }

    res.send({
        txid, fileHash, file, time, fileType, beef, valid
    })
}