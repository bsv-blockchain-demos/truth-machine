import { Request, Response } from 'express'
import db from '../db'

export default async function (req: Request, res: Response) {
    // get the data by its txid or hash
    const { id } = req.params
    const what = await db.collection('txs').findOne({
        $or: [
            { txid: id },
            { fileHash: id }
        ]
    })

    console.log({ what })
    const { file, time, fileType } = what

    // stream the response back to the user
    const extension = fileType.split('/')[1]
    res.setHeader('Content-Type', fileType)
    res.setHeader('Content-Disposition', `attachment; filename=${id as string}-${time}.${extension}`)
    res.send(file)
}