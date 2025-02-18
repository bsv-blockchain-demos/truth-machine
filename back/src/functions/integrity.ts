import { Request, Response } from 'express'
import { Transaction, WhatsOnChain, Beef, Utils } from '@bsv/sdk'
import db from '../db'
import dotenv from 'dotenv'
dotenv.config()
const { NETWORK } = process.env

export default async function (req: Request, res: Response) {
    try {
        // get the data by its txid or hash
        const { id } = req.params
        const { txid, fileHash, time, fileType, beef } = await db.collection('txs').findOne({
            $or: [
                { txid: id },
                { fileHash: id }
            ]
        })

        
        const b = Beef.fromString(beef)
        
        console.log(b.toLogString())
        
        // We're validating here what you could do client side if you wanted to be sure.
        const tx = Transaction.fromHexBEEF(beef)
        const txFileHash = Utils.toUTF8(Utils.toArray(tx.outputs[0].lockingScript.toASM().split(' ')[2], 'hex'))
        const spv = await tx.verify(new WhatsOnChain(NETWORK as "main" | "test" | "stn"))
        const matchedCommitment = txFileHash === fileHash
        const valid = matchedCommitment && spv

        
        if (!valid) {
            res.send({ error: 'something did not check out', id, txid, fileHash, spv, matchedCommitment })
            return
        }

        res.send({
            txid, fileHash, time, fileType, beef, valid
        })
    } catch (error) {
        res.send({ error: error.message })
    }
}