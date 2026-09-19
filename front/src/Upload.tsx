import { useState, useRef } from 'react'
import { useFunding } from './useFunding'
import { ApiError, errorMessage, formatSize, MAX_FILE_BYTES, requestJson } from './api'
import Notice, { type NoticeValue } from './components/Notice'
import { IconCopy, IconExternal, IconUpload, IconChevron, IconLock, IconFile, IconOk, IconFail } from './components/icons'

interface UploadResult { txid?: string; fileHash: string; network?: string; status: string; message: string }

// One union drives the comparison surface, mapping one to one onto the band's data-s.
type CompareState =
    | { kind: 'idle' }
    | { kind: 'hashing'; label: string }
    | { kind: 'invalid'; reason: 'length' | 'hex'; value: string }
    | { kind: 'match'; source: 'file' | 'paste'; label: string; hash: string }
    | { kind: 'differ'; source: 'file' | 'paste'; label: string; hash: string }

const API_DETAILS = 'POST /upload sends the raw bytes with X-Original-Filename and X-Original-Content-Type. ' +
    'It answers with txid, fileHash, network and status. HTTP 202 means the write is saved but acceptance is still pending. ' +
    'Comparison never calls the API: two files that differ by a single byte produce unrelated fingerprints, so they can never satisfy the same record.'

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
    const [compareText, setCompareText] = useState('')
    const [compareFile, setCompareFile] = useState<{ label: string; hash: string } | null>(null)
    const [compareBusy, setCompareBusy] = useState<string | null>(null)
    const [receipt, setReceipt] = useState<UploadResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [notice, setNotice] = useState<NoticeValue | null>(null)
    const [copyNotice, setCopyNotice] = useState<NoticeValue | null>(null)
    const running = useRef(false)
    const hashSequence = useRef(0)
    const compareSequence = useRef(0)
    const comparePicker = useRef<HTMLInputElement>(null)
    const comparePaste = useRef<HTMLInputElement>(null)
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
        setCompareText(''); setCompareFile(null); setCompareBusy(null)
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
        setCompareText(''); setCompareFile(null); setCompareBusy(file.name)
        try {
            const hex = await sha256(file)
            if (current === compareSequence.current) setCompareFile({ label: file.name, hash: hex })
        } finally {
            if (current === compareSequence.current) setCompareBusy(null)
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
    const recorded = !!receipt

    function readPaste(text: string): CompareState {
        const value = text.trim().toLowerCase()
        if (!/^[a-f0-9]*$/.test(value)) return { kind: 'invalid', reason: 'hex', value }
        if (value.length !== 64) return { kind: 'invalid', reason: 'length', value }
        const label = 'Typed or pasted value'
        return value === ownHash
            ? { kind: 'match', source: 'paste', label, hash: value }
            : { kind: 'differ', source: 'paste', label, hash: value }
    }

    const compare: CompareState = compareBusy ? { kind: 'hashing', label: compareBusy }
        : compareFile ? (compareFile.hash === ownHash
            ? { kind: 'match', source: 'file', ...compareFile }
            : { kind: 'differ', source: 'file', ...compareFile })
            : compareText.trim() ? readPaste(compareText) : { kind: 'idle' }

    const resolved = compare.kind === 'match' || compare.kind === 'differ'
    const bandState = compare.kind === 'hashing' ? 'busy'
        : compare.kind === 'invalid' ? 'error'
            : compare.kind === 'match' ? 'ok'
                : compare.kind === 'differ' ? 'fail' : undefined
    const pairResult = compare.kind === 'match' ? 'ok' : compare.kind === 'differ' ? 'fail' : undefined
    const chip = compare.kind === 'match' ? '=' : compare.kind === 'differ' ? '≠' : '?'
    const subject = resolved && compare.source === 'file' ? compare.label : 'pasted fingerprint'
    const correction = compare.kind === 'invalid' && compare.reason === 'hex'
        ? 'A fingerprint uses 0 to 9 and a to f only.'
        : 'A SHA-256 fingerprint is 64 hexadecimal characters.'
    const announcement = compare.kind === 'invalid' ? correction
        : compare.kind === 'hashing' ? `Reading ${compare.label}`
            : compare.kind === 'match' ? `Identical. ${subject}`
                : compare.kind === 'differ' ? `Not the same file. ${subject}` : ''

    // Row two of the pair. Row one is always the reference file.
    const copyRow = compare.kind === 'idle'
        ? { label: 'The copy', name: 'Not chosen yet', value: 'Choose a file or paste a fingerprint below', waiting: true, mono: false }
        : compare.kind === 'hashing'
            ? { label: 'The copy', name: compare.label, value: 'Fingerprinting in your browser', waiting: true, mono: false }
            : compare.kind === 'invalid'
                ? { label: 'Pasted', name: compare.reason === 'length' ? `${compare.value.length} of 64 characters` : 'Not a fingerprint', value: compare.value, waiting: true, mono: true }
                : { label: compare.source === 'paste' ? 'Pasted' : 'The copy', name: compare.label, value: compare.hash, waiting: false, mono: true }

    function restartComparison() {
        resetComparison()
        comparePaste.current?.focus()
    }

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

        {/* Not offered with nothing to compare against. */}
        {(validSelection || recorded) && <details className="tm-cmp">
            <summary className="tm-cmp__sum">
                <span className="tm-cmp__sum-t">
                    <IconChevron className="tm-cmp__chev" />
                    {recorded ? 'Check another copy against the file you recorded' : 'Compare this file with another copy'}
                </span>
                <span className="tm-cmp__free"><IconLock />Runs in your browser. No token</span>
            </summary>

            <div className="tm-cmp__body">
                <div className="tm-cmp__ctl" data-s={bandState}>
                    {compare.kind === 'hashing' && <span className="tm-cmp__state">
                        <span className="tm-cmp__spin" aria-hidden="true" />
                        <span>Reading {compare.label}</span>
                    </span>}

                    {resolved && <>
                        <span className="tm-cmp__state">
                            {compare.kind === 'match' ? <IconOk size={18} /> : <IconFail size={18} />}
                            <span>{compare.kind === 'match' ? 'Identical' : 'Not the same file'}</span>
                            <span className="tm-cmp__state-n">{subject}</span>
                        </span>
                        <button type="button" className="tm-cmp__redo" onClick={restartComparison}>Compare another</button>
                    </>}

                    {(compare.kind === 'idle' || compare.kind === 'invalid') && <>
                        <button type="button" className="tm-cmp__pick" onClick={() => comparePicker.current?.click()}>
                            <IconFile />Choose file
                        </button>
                        <input ref={comparePicker} type="file" className="tm-sr" tabIndex={-1}
                            onClick={event => { event.currentTarget.value = '' }}
                            onChange={event => void selectCompareFile(event.target.files?.[0])} />
                        <input ref={comparePaste} className="tm-cmp__in" type="text" spellCheck={false} autoComplete="off"
                            value={compareText} placeholder="or paste its 64-character fingerprint"
                            aria-label="Fingerprint of the copy to compare"
                            onChange={event => { setCompareFile(null); setCompareText(event.target.value) }} />
                    </>}
                </div>

                <div className="tm-cmp__ev" data-r={pairResult}>
                    <span className="tm-cmp__ev-r" aria-hidden="true">{chip}</span>
                    <div className="tm-cmp__ev-row" data-i="1">
                        <span className="tm-cmp__ev-l">{recorded ? 'Recorded' : 'This file'}</span>
                        <span className="tm-cmp__ev-n">{selectedFile?.name || 'Your uploaded file'}</span>
                        <span className={`tm-cmp__ev-h ${ownHash ? '' : 'tm-cmp__ev-h--wait'}`}>
                            {ownHash || 'Fingerprinting in your browser'}
                        </span>
                    </div>
                    <div className="tm-cmp__ev-row" data-i="2" data-w={copyRow.waiting ? '1' : undefined}>
                        <span className="tm-cmp__ev-l">{copyRow.label}</span>
                        <span className="tm-cmp__ev-n">{copyRow.name}</span>
                        <span className={`tm-cmp__ev-h ${copyRow.waiting && !copyRow.mono ? 'tm-cmp__ev-h--wait' : ''}`}>
                            {copyRow.value}
                        </span>
                    </div>
                </div>

                <p className={compare.kind === 'invalid' ? 'tm-cmp__foot tm-cmp__foot--err' : 'tm-sr'} aria-live="polite">
                    {compare.kind === 'invalid' ? correction : announcement}
                </p>
            </div>
        </details>}

        <details className="tm-details"><summary><IconChevron className="tm-details__chev" />API details</summary><p>{API_DETAILS}</p></details>
    </>
}
