import { useState, useRef } from 'react'
import { useFunding } from './useFunding'
import { ApiError, errorMessage, formatSize, MAX_FILE_BYTES, requestJson } from './api'
import Notice, { type NoticeValue } from './components/Notice'
import { IconCopy, IconExternal, IconUpload } from './components/icons'

interface UploadResult { txid?: string; fileHash: string; network?: string; status: string; message: string }
interface CompareSide { name: string; size: number }

const API_DETAILS = 'POST /upload sends the raw bytes with X-Original-Filename and X-Original-Content-Type. ' +
    'It answers with txid, fileHash, network and status. HTTP 202 means the write is saved but acceptance is still pending.'

async function sha256(file: File) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function KeyValue({ label, value, copyLabel, onCopy }: { label: string; value: string; copyLabel: string; onCopy: () => void }) {
    return (
        <div className="tm-kv">
            <span className="tm-label">{label}</span>
            <div className="tm-kv__v">{value}</div>
            <div className="tm-kv__row">
                <button type="button" className="tm-action" onClick={onCopy}><IconCopy />{copyLabel}</button>
            </div>
        </div>
    )
}

export default function Upload({ onUploadComplete, onSelectionChange, onVerify }: {
    onUploadComplete?: () => void; onSelectionChange?: () => void; onVerify?: (id: string) => void
}) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [fileError, setFileError] = useState<string | null>(null)
    const [localHash, setLocalHash] = useState<string | null>(null)
    const [hashing, setHashing] = useState(false)
    const [compareValue, setCompareValue] = useState('')
    const [compareSide, setCompareSide] = useState<CompareSide | null>(null)
    const [compareHashing, setCompareHashing] = useState(false)
    const [receipt, setReceipt] = useState<UploadResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [notice, setNotice] = useState<NoticeValue | null>(null)
    const [copyNotice, setCopyNotice] = useState<NoticeValue | null>(null)
    const running = useRef(false)
    const hashSequence = useRef(0)
    const compareSequence = useRef(0)
    const { getFundingInfo, fundingInfo, error: treasuryError, openTreasury, utxoStatusUpdate } = useFunding()

    const noTokens = !treasuryError && fundingInfo?.tokens === 0
    const validSelection = !!selectedFile && selectedFile.size > 0 && selectedFile.size <= MAX_FILE_BYTES

    async function fingerprint(file: File) {
        const current = ++hashSequence.current
        setHashing(true)
        try {
            const hex = await sha256(file)
            if (current === hashSequence.current) setLocalHash(hex)
        } catch {
            if (current === hashSequence.current) setLocalHash(null)
        } finally {
            if (current === hashSequence.current) setHashing(false)
        }
    }

    function resetComparison() {
        compareSequence.current++
        setCompareValue(''); setCompareSide(null); setCompareHashing(false)
    }

    function selectFile(file: File | undefined) {
        if (running.current) return
        hashSequence.current++
        setSelectedFile(file || null)
        setReceipt(null); setNotice(null); setCopyNotice(null); setFileError(null)
        setLocalHash(null); setHashing(false)
        resetComparison()
        onSelectionChange?.()
        if (!file) return
        if (!file.size) { setFileError('That file is empty. Choose a file with content.'); return }
        if (file.size > MAX_FILE_BYTES) { setFileError(`That file is ${formatSize(file.size)}. The limit is 10 MB.`); return }
        void fingerprint(file)
    }

    // The comparison never leaves the browser: no request, no token, nothing recorded.
    async function selectCompareFile(file: File | undefined) {
        if (!file) return
        const current = ++compareSequence.current
        setCompareSide({ name: file.name, size: file.size })
        setCompareValue(''); setCompareHashing(true)
        try {
            const hex = await sha256(file)
            if (current === compareSequence.current) setCompareValue(hex)
        } catch {
            if (current === compareSequence.current) setCompareSide(null)
        } finally {
            if (current === compareSequence.current) setCompareHashing(false)
        }
    }

    async function upload() {
        if (!selectedFile || running.current || !validSelection) return
        running.current = true
        setLoading(true); setReceipt(null); setCopyNotice(null)
        setNotice({ tone: 'loading', title: 'Saving your file', message: 'Writing the fingerprint to the blockchain and storing the bytes.' })
        let hash = localHash || ''
        try {
            if (!hash) hash = await sha256(selectedFile)
            const result = await requestJson<UploadResult>('/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-Original-Content-Type': selectedFile.type || 'application/octet-stream',
                    'X-Original-Filename': encodeURIComponent(selectedFile.name),
                },
                body: selectedFile,
            })
            setReceipt(result)
            setNotice(result.status === 'pending'
                ? { tone: 'pending', title: 'File saved, acceptance pending', message: result.message }
                : { tone: 'success', title: 'File saved', message: result.message })
            onUploadComplete?.()
        } catch (error) {
            // A dropped connection leaves the write in an unknown state. Keep the locally
            // computed fingerprint so the file can be looked up instead of uploaded again.
            const uncertain = error instanceof ApiError && error.status === 0
            const noFunds = error instanceof ApiError && error.status === 503
            if (uncertain && hash) {
                setReceipt({ fileHash: hash, status: 'pending', message: '' })
                setNotice({ tone: 'pending', title: 'Upload outcome not yet known',
                    message: 'The connection dropped mid-write. Open the treasury and check pending actions, then verify with the fingerprint below.',
                    action: { label: 'Check pending actions', onClick: () => { openTreasury(); void utxoStatusUpdate() } } })
            } else {
                setNotice({ tone: 'error', title: 'Upload could not complete', message: errorMessage(error),
                    ...(noFunds ? { action: { label: 'Open treasury', onClick: openTreasury } } : {}) })
            }
        } finally {
            running.current = false; setLoading(false)
            void getFundingInfo()
        }
    }

    async function copy(value: string, label: string) {
        try {
            await navigator.clipboard.writeText(value)
            setCopyNotice({ tone: 'success', title: 'Copied to clipboard', message: `${label} copied.` })
        } catch { setCopyNotice({ tone: 'error', title: 'Could not copy', message: 'Select the value above and copy it manually.' }) }
    }

    const failed = notice?.tone === 'error'
    const showButton = !(receipt && receipt.status === 'pending')
    const buttonLabel = loading ? 'Uploading…'
        : receipt ? 'Select a file to upload again'
            : failed ? 'Try upload again'
                : 'Upload file'
    const buttonDisabled = loading || !!receipt || !validSelection || noTokens
    const hint = !selectedFile ? 'Choose a file to enable this.'
        : noTokens ? 'Blocked until a token is minted.'
            : validSelection && !receipt && !loading ? 'Uses one write token.'
                : ''

    // After an upload the receipt carries the authoritative value, including the recovery
    // case where only the locally computed fingerprint is known.
    const ownHash = receipt?.fileHash || localHash
    const uploaded = !!receipt
    const compareId = compareValue.trim().toLowerCase()
    const compareReady = /^[a-f0-9]{64}$/.test(compareId)
    const compareMatch = compareReady && ownHash ? compareId === ownHash : null

    return <>
        <label className={`tm-dropzone ${selectedFile ? 'tm-dropzone--filled' : ''}`}
            onDragOver={event => event.preventDefault()}
            onDrop={event => { event.preventDefault(); selectFile(event.dataTransfer.files[0]) }}>
            {selectedFile ? <>
                <span className="tm-label">Selected file</span>
                <span className="tm-file">
                    <span className="tm-file__name">{selectedFile.name}</span>
                    <span className="tm-hint">{formatSize(selectedFile.size)}</span>
                </span>
                <span className="tm-action">Choose a different file</span>
            </> : <>
                <span className="tm-dropzone__icon"><IconUpload size={28} /></span>
                <span className="tm-dropzone__t">Drag a file here, or click to browse</span>
                <span className="tm-hint">Up to 10 MB. One write token per upload.</span>
            </>}
            <input type="file" className="tm-sr" disabled={loading}
                onClick={event => { event.currentTarget.value = '' }}
                onChange={event => selectFile(event.target.files?.[0])} />
        </label>

        {hashing && <p className="tm-hint">Computing this file&rsquo;s fingerprint&hellip;</p>}

        {localHash && !receipt && <KeyValue label="This file's fingerprint (SHA-256)" value={localHash}
            copyLabel="Copy fingerprint" onCopy={() => void copy(localHash, 'File fingerprint')} />}

        {noTokens && !loading && !receipt && <Notice tone="pending" title="No write tokens available"
            message="Step 1 needs at least one token before a file can be saved."
            action={{ label: 'Open treasury', onClick: openTreasury }} />}

        {fileError
            ? <Notice tone="error" title="Choose another file" message={fileError} />
            : notice && <Notice {...notice} />}

        {showButton && <div className="tm-actions">
            <button type="button" className="tm-btn tm-btn--primary" disabled={buttonDisabled} onClick={() => void upload()}>
                {loading && <span className="tm-btn__spin" aria-hidden="true" />}
                {buttonLabel}
            </button>
            {hint && <span className="tm-hint">{hint}</span>}
        </div>}

        {receipt && <div className={`tm-card tm-card--${receipt.status === 'pending' ? 'pending' : 'ok'}`}>
            <p className="tm-card__t">Keep these details</p>
            <p className="tm-hint">Either value retrieves the file and its proof. Nothing here is stored in your browser.</p>
            {receipt.txid && <KeyValue label="Transaction ID" value={receipt.txid} copyLabel="Copy ID"
                onCopy={() => void copy(receipt.txid!, 'Transaction ID')} />}
            <KeyValue label="File fingerprint (SHA-256)" value={receipt.fileHash} copyLabel="Copy fingerprint"
                onCopy={() => void copy(receipt.fileHash, 'File fingerprint')} />
            <div className="tm-actions">
                <button type="button" className="tm-btn tm-btn--secondary"
                    onClick={() => onVerify?.(receipt.txid || receipt.fileHash)}>Verify this file</button>
                {receipt.txid && <a className="tm-action" target="_blank" rel="noopener noreferrer"
                    href={`https://${receipt.network === 'test' ? 'test.' : ''}whatsonchain.com/tx/${receipt.txid}`}>
                    <IconExternal />View on WhatsOnChain
                </a>}
            </div>
        </div>}

        {copyNotice && <Notice {...copyNotice} />}

        {ownHash && <details className="tm-details">
            <summary>{uploaded ? 'Check another copy against this file' : 'Compare this file with another'}</summary>
            <p>
                {uploaded
                    ? 'Confirm that another copy is byte for byte the file you just recorded. The check runs in your browser. Nothing is uploaded and no token is spent.'
                    : 'Confirm that two files are byte for byte identical before you record either one. The check runs in your browser. Nothing is uploaded and no token is spent.'}
            </p>

            <ol className="tm-seq">
                <li>
                    <span className="tm-label">1. {uploaded ? 'The file you recorded' : 'This file'}</span>
                    <div className="tm-seq__meta">
                        <span className="tm-seq__name">{selectedFile?.name || 'Your uploaded file'}</span>
                        {selectedFile && <span className="tm-hint">{formatSize(selectedFile.size)}</span>}
                    </div>
                    <div className="tm-kv__v">{ownHash}</div>
                    {uploaded && <p className="tm-hint">This is the fingerprint written to the blockchain.</p>}
                </li>

                <li>
                    <span className="tm-label">2. The file to compare</span>
                    <div className="tm-actions">
                        <label className="tm-btn tm-btn--secondary tm-btn--sm">
                            {compareSide ? 'Choose a different file' : 'Choose a file'}
                            <input type="file" className="tm-sr"
                                onClick={event => { event.currentTarget.value = '' }}
                                onChange={event => void selectCompareFile(event.target.files?.[0])} />
                        </label>
                        <span className="tm-hint">or paste its fingerprint below</span>
                    </div>
                    <div className="tm-seq__meta">
                        <span className={`tm-seq__name ${compareSide ? '' : 'tm-seq__empty'}`}>
                            {compareSide ? compareSide.name : 'No file chosen'}
                        </span>
                        {compareSide && <span className="tm-hint">{formatSize(compareSide.size)}</span>}
                    </div>
                    <input id="compare-hash" className="tm-seq__input" spellCheck={false} autoComplete="off" value={compareValue}
                        aria-label="Fingerprint to compare"
                        placeholder={compareHashing ? 'Computing the fingerprint…' : 'Paste a 64-character fingerprint'}
                        onChange={event => { compareSequence.current++; setCompareValue(event.target.value); setCompareSide(null) }} />
                </li>

                <li>
                    <span className="tm-label">3. Result</span>
                    {compareMatch === true && <Notice tone="success" title="The fingerprints match"
                        message={uploaded
                            ? 'That copy is byte for byte the file recorded on the blockchain.'
                            : 'Both files are byte for byte identical, so either one satisfies the same record.'} />}
                    {compareMatch === false && <Notice tone="error" title="The fingerprints do not match"
                        message="The two files differ, even if only by a single byte. They cannot satisfy the same blockchain record." />}
                    {compareMatch === null && <p className="tm-hint">
                        {compareHashing ? 'Reading the second file…'
                            : !compareId ? 'Choose a file or paste a fingerprint in step 2 to see the result.'
                                : `A fingerprint is exactly 64 hexadecimal characters. That value is ${compareId.length}.`}
                    </p>}
                </li>
            </ol>
        </details>}

        <details className="tm-details"><summary>API details</summary><p>{API_DETAILS}</p></details>
    </>
}
