import { Request, Response } from 'express'
import db from '../db'
import { MerklePath, Beef } from '@bsv/sdk'

export default async function (req: Request, res: Response) {
    // make sure this is ARC calling us
    console.log({ h: req.headers, b: req.body})
    if (req?.headers?.authorization !== 'Bearer ' + process.env.CALLBACK_TOKEN) {
        res.status(401).send({ error: 'Unauthorized' })
        return
    }
    const { txid, merklePath } = req.body
    if (merklePath) {
        const document = await db.collection('txs').findOne({ txid })
        if (!document) {
            res.status(404).send({ error: 'Not found' })
            return
        }
        const beef = Beef.fromString(document.beef, 'hex')
        beef.mergeBump(MerklePath.fromHex(merklePath))
        const updated = beef.toHex()
        await db.collection('txs').updateOne({ txid }, { $set: { beef: updated }, $addToSet: { arc: req.body } })
    } else {
        await db.collection('txs').updateOne({ txid }, { $addToSet: { arc: req.body } })
    }
    res.send({ accepted: 'true' })
}