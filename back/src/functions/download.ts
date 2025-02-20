/**
 * File Download Endpoint
 * 
 * This endpoint handles file downloads from the Truth Machine system.
 * Files can be retrieved using either their transaction ID (txid) or file hash.
 * 
 * The endpoint:
 * 1. Retrieves file metadata and content from the database
 * 2. Sets appropriate HTTP headers for file download
 * 3. Streams the file content to the client
 * 
 * @route GET /api/download/:id
 * @param {string} id - Transaction ID or file hash
 * @returns {Buffer} File content with appropriate headers for download
 * 
 * Response Headers:
 * - Content-Length: Size of the file in bytes
 * - Content-Type: MIME type of the file
 * - Content-Disposition: Attachment with filename including timestamp
 */

import { Request, Response } from 'express'
import db from '../db'

export default async function (req: Request, res: Response) {
    // Retrieve file by transaction ID or hash
    const { id } = req.params
    const { file, time, fileType } = await db.collection('txs').findOne({
        $or: [
            { txid: id },
            { fileHash: id }
        ]
    })

    console.log({ file })

    // Set up file download headers
    const extension = fileType.split('/')[1]
    res.setHeader('Content-Length', file.buffer.length)
    res.setHeader('Content-Type', fileType)
    res.setHeader('Content-Disposition', `attachment; filename=${id}-${time}.${extension}`)
    
    // Send file content
    res.send(file.buffer)
}