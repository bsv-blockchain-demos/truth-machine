import { Request, Response } from 'express'
import db from '../db'
import { normaliseId, fileQuery, inspectFile } from '../services/files'
import { checkProof, bounded, tracker } from '../services/proofs'
import { settleOperation } from '../services/operations'

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
        const { matchedFile, matchedCommitment, contentValid } = inspection
        const common = { id, txid: record.txid, fileHash: record.fileHash, fileName: record.fileName,
            time: record.time, fileType: record.fileType, matchedFile, matchedCommitment }
        if (!contentValid) {
            res.status(422).json({ ...common, status: 'failed', valid: false, downloadAllowed: false,
                error: 'The stored file does not match its recorded fingerprint. Download has been blocked.' }); return
        }
        let inBlock = false, seen = false, unavailable = false, invalidProof = false
        let tx = inspection.tx
        try {
            const proof = await checkProof(record, tx)
            inBlock = proof.inBlock; seen = proof.seen; invalidProof = !!proof.invalidProof; tx = proof.tx
        } catch { unavailable = true }
        if ((seen || inBlock) && record.reservation && (record.operationStatus !== 'accepted' || !record.settled)) {
            await settleOperation(record, 'accepted')
        }
        const responses = Array.isArray(record.arc) ? record.arc : []
        const rejected = record.operationStatus === 'rejected' || responses.some(r =>
            ['REJECTED', 'DOUBLE_SPEND_ATTEMPTED', 'INVALID', 'MALFORMED'].includes(r.txStatus || r.code))
        const accepted = record.operationStatus === 'accepted' || responses.some(r => r.status === 'success' ||
            ['SENT_TO_NETWORK', 'ACCEPTED_BY_NETWORK', 'SEEN_ON_NETWORK', 'MINED'].includes(r.txStatus || r.message?.trim()))
        const broadcast = inBlock || seen || (!rejected && accepted)
        if (invalidProof || (rejected && !seen && !inBlock)) {
            res.status(422).json({ ...common, status: 'failed', valid: false, broadcast: false, inBlock: false, downloadAllowed: false,
                error: invalidProof ? 'The blockchain proof could not be validated. Try checking again later.' : 'The transaction was rejected. This file has not been confirmed on the blockchain.' }); return
        }
        let depth: number | null = null
        let blockHeight: number | null = null
        if (inBlock && tx.merklePath) {
            blockHeight = tx.merklePath.blockHeight
            try { depth = Math.max(1, await bounded(tracker.currentHeight()) - tx.merklePath.blockHeight + 1) } catch { /* Proof is valid even when current height is unavailable. */ }
        }
        res.json({ ...common, status: inBlock ? 'confirmed' : 'pending', valid: inBlock, contentValid: true,
            broadcast, inBlock, depth, blockHeight, downloadAllowed: true,
            message: inBlock ? 'Your file matches its fingerprint and its blockchain proof is verified.' :
                unavailable ? 'Your file matches its fingerprint. Blockchain verification is temporarily unavailable. You can download the matching file or check again later.' :
                broadcast ? 'Your file matches its fingerprint. The transaction is accepted, but block confirmation is still pending. You can download the file and check again later.' :
                'Your file is stored and matches its fingerprint. Network acceptance is not yet confirmed. Keep this ID and check again before uploading again.' })
    } catch (error) {
        console.error('Verification unavailable', error)
        res.status(503).json({ error: 'We could not check this file right now. Please try again shortly.' })
    }
}
