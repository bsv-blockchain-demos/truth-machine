import { Request, Response } from 'express'
import db from '../db'
import { normaliseId, fileQuery, inspectFile } from '../services/files'

export default async function (req: Request, res: Response) {
    const id = normaliseId(req.params.id)
    if (!id) { res.status(400).json({ error: 'Enter a 64-character transaction ID or file hash.' }); return }
    try {
        const record = await db.collection('txs').findOne(fileQuery(id), { sort: { time: -1 } })
        if (!record) { res.status(404).json({ error: 'No file was found for this ID or hash. Check it and try again.' }); return }
        let inspection: ReturnType<typeof inspectFile>
        try { inspection = inspectFile(record) } catch {
            res.status(422).json({ error: 'This file record could not be verified. Download has been blocked.' }); return
        }
        if (!inspection.contentValid) {
            res.status(422).json({ error: 'The stored file does not match its fingerprint. Download has been blocked.' }); return
        }
        const filename = String(record.fileName || `${id}.bin`).replace(/[\r\n]/g, '')
        res.attachment(filename)
        res.setHeader('Content-Type', record.fileType || 'application/octet-stream')
        res.setHeader('Content-Length', inspection.bytes.length)
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.send(inspection.bytes)
    } catch (error) {
        console.error('Download unavailable', error)
        res.status(503).json({ error: 'We could not download this file right now. Please try again shortly.' })
    }
}
