import { useState, useRef } from 'react'
import { useFunding } from './useFunding'
import { ApiError, errorMessage, MAX_FILE_BYTES, requestJson } from './api'
import Notice, { type NoticeValue } from './components/Notice'

interface UploadResult { txid?: string; fileHash: string; network?: string; status: string; message: string }

export default function Upload({ onUploadComplete, onSelectionChange, onVerify }: {
    onUploadComplete?: () => void; onSelectionChange?: () => void; onVerify?: (id: string) => void
}) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [receipt, setReceipt] = useState<UploadResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [notice, setNotice] = useState<NoticeValue | null>(null)
    const [copyNotice, setCopyNotice] = useState<NoticeValue | null>(null)
    const running = useRef(false)
    const { getFundingInfo, fundingInfo, error: treasuryError } = useFunding()

    function selectFile(file: File | undefined) {
        if (running.current) return
        setSelectedFile(file || null)
        setReceipt(null); setNotice(null); setCopyNotice(null)
        onSelectionChange?.()
        if (file && (!file.size || file.size > MAX_FILE_BYTES)) {
            setNotice({ tone: 'error', title: 'Choose another file', message: !file.size ? 'This file is empty. Choose a file with content.' : 'This file is too large. Choose a file smaller than 10 MB.' })
        }
    }

    async function upload() {
        if (!selectedFile || running.current || !selectedFile.size || selectedFile.size > MAX_FILE_BYTES) return
        running.current = true
        setLoading(true); setReceipt(null); setCopyNotice(null)
        setNotice({ tone: 'loading', title: 'Saving your file', message: 'Creating its fingerprint and submitting the transaction. Please keep this page open and do not upload it again.' })
        let hash = ''
        try {
            hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await selectedFile.arrayBuffer()))).map(b => b.toString(16).padStart(2, '0')).join('')
            const result = await requestJson<UploadResult>('/upload', {
                method: 'POST', headers: { 'Content-Type': 'application/octet-stream',
                    'X-Original-Content-Type': selectedFile.type || 'application/octet-stream',
                    'X-Original-Filename': encodeURIComponent(selectedFile.name) }, body: selectedFile,
            })
            setReceipt(result)
            setNotice({ tone: result.status === 'pending' ? 'pending' : 'success',
                title: result.status === 'pending' ? 'File saved, acceptance pending' : 'File saved', message: result.message })
            onUploadComplete?.()
        } catch (error) {
            const uncertain = error instanceof ApiError && error.status === 0
            setNotice({ tone: uncertain ? 'pending' : 'error', title: uncertain ? 'Upload outcome not yet known' : 'Upload could not complete',
                message: uncertain ? 'The connection was interrupted. Use the file hash below to check whether your file was saved. If a later check still finds no file, select the file again to retry.' : errorMessage(error) })
            if (uncertain && hash) setReceipt({ fileHash: hash, status: 'pending', message: '' })
        } finally {
            running.current = false; setLoading(false)
            void getFundingInfo()
        }
    }

    async function copy(value: string, label: string) {
        try {
            await navigator.clipboard.writeText(value)
            setCopyNotice({ tone: 'success', title: `${label} copied`, message: 'You can paste it into Verify & Download or save it for later.' })
        } catch { setCopyNotice({ tone: 'error', title: 'Could not copy', message: 'Select the ID or hash and copy it manually.' }) }
    }

    const validSelection = selectedFile && selectedFile.size > 0 && selectedFile.size <= MAX_FILE_BYTES
    return <div className="tm-upload-grid"><div className="tm-upload-grid__left">
        <form onSubmit={event => { event.preventDefault(); void upload() }}>
            <input type="file" id="file-upload" style={{ display: 'none' }} disabled={loading}
                onClick={event => { event.currentTarget.value = '' }}
                onChange={event => selectFile(event.target.files?.[0])} />
            <label htmlFor="file-upload">
                <div className="tm-dropzone" onDragOver={event => event.preventDefault()}
                    onDrop={event => { event.preventDefault(); selectFile(event.dataTransfer.files[0]) }}>
                    {!selectedFile && <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M12 15V8M8.5 11.5 12 8l3.5 3.5M8 16.5h8" /></svg>}
                    <p className="tm-dropzone__instruction">{selectedFile ? selectedFile.name : 'Drag and drop a file or click to browse'}</p>
                </div>
            </label>
            <p className="tm-form-helper">Up to 10 MB. One write token per upload.</p>
            {!treasuryError && fundingInfo?.tokens === 0 && !loading && <Notice tone="pending" title="No write tokens available" message="Open Treasury to mint tokens or check pending actions, then return here to upload." />}
            <div className="tm-upload-actions"><button className="tm-btn tm-btn--primary" disabled={!validSelection || loading || !!receipt}>
                {loading ? 'Uploading...' : receipt?.status === 'pending' ? 'Check status before retrying' : receipt ? 'Select a file to upload again' : 'Upload'}
            </button></div>
        </form>
        {notice && <Notice {...notice} />}
        {receipt && <div className="tm-receipt">
            <h3>Keep these details</h3>
            {receipt.txid && <p className="tm-receipt__id-row"><strong>Transaction ID: </strong>{receipt.txid}
                <button className="tm-text-action" onClick={() => copy(receipt.txid!, 'Transaction ID')}>Copy ID</button></p>}
            <p className="tm-receipt__id-row"><strong>File hash: </strong>{receipt.fileHash}
                <button className="tm-text-action" onClick={() => copy(receipt.fileHash, 'File hash')}>Copy hash</button></p>
            <button className="tm-btn tm-btn--secondary" onClick={() => onVerify?.(receipt.txid || receipt.fileHash)}>Verify this file</button>
            {receipt.txid && <p><a target="_blank" rel="noopener noreferrer" href={`https://${receipt.network === 'test' ? 'test.' : ''}whatsonchain.com/tx/${receipt.txid}`}>View transaction on WhatsOnChain</a></p>}
        </div>}
        {copyNotice && <Notice {...copyNotice} />}
        <details className="tm-api-details"><summary>API details</summary><p>Send file bytes to <code>/upload</code>. A pending response means you should check the file hash before retrying.</p></details>
    </div></div>
}
