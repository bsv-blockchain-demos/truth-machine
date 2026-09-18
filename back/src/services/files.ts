import { createHash } from 'node:crypto'
import { Transaction } from '@bsv/sdk'
import { OpReturn } from '@bsv/templates'

export const MAX_FILE_BYTES = 10 * 1024 * 1024

export function normaliseId(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const id = value.trim().toLowerCase()
    return /^[a-f0-9]{64}$/.test(id) ? id : null
}

export function fileBytes(file: any): Buffer {
    if (Buffer.isBuffer(file)) return file
    if (file?._bsontype === 'Binary') return Buffer.from(file.value())
    throw new Error('Stored file is missing')
}

export function inspectFile(record: any) {
    const bytes = fileBytes(record.file)
    const hash = createHash('sha256').update(bytes).digest('hex')
    const tx = Transaction.fromHexBEEF(record.beef)
    const expectedScript = new OpReturn().lock(Array.from(Buffer.from(hash, 'hex'))).toHex()
    const matchedFile = hash === record.fileHash
    const matchedCommitment = tx.id('hex') === record.txid &&
        tx.outputs[0]?.lockingScript.toHex() === expectedScript
    return { bytes, tx, matchedFile, matchedCommitment, contentValid: matchedFile && matchedCommitment }
}

export function fileQuery(id: string) {
    return { file: { $exists: true }, $or: [{ txid: id }, { fileHash: id }] }
}
