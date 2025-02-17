import { Request, Response } from 'express'
import db from './db'
import { MerklePath, Beef } from '@bsv/sdk'

export default async function (req: Request, res: Response) {
    // make sure this is ARC calling us
    if (req?.headers?.authorization !== process.env.CALLBACK_TOKEN) {
        res.status(401).send({ error: 'Unauthorized' })
        return
    }
    const { txid, merklePath } = req.body
    if (merklePath) {
        const document = await db.collection('files').findOne({ txid })
        if (!document) {
            res.status(404).send({ error: 'Not found' })
            return
        }
        const beef = Beef.fromString(document.beef, 'hex')
        beef.mergeBump(MerklePath.fromHex(merklePath))
        const updated = beef.toHex()
        await db.collection('files').updateOne({ txid }, { $set: { beef: updated }, $addToSet: { arc: req.body, time: Date.now() } })
    } else {
        await db.collection('files').updateOne({ txid }, { $addToSet: { arc: req.body, time: Date.now() } })
    }
    res.send({ accepted: 'true' })
}