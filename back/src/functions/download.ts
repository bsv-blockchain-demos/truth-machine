import { Request, Response } from 'express'
import db from '../db'

export default async function (req: Request, res: Response) {
    // get the data by its txid or hash
    const { id } = req.params
    const { file, time, fileType } = await db.collection('txs').findOne({
        $or: [
            { txid: id },
            { fileHash: id }
        ]
    })

    console.log({ file })

    const extension = fileType.split('/')[1]
    res.setHeader('Content-Length', file.buffer.length)
    res.setHeader('Content-Type', fileType)
    res.setHeader('Content-Disposition', `attachment; filename=${id}-${time}.${extension}`)
    res.send(file.buffer)
}