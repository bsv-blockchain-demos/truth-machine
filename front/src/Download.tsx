import { useState, useCallback, useEffect, useRef, useImperativeHandle, type Ref } from 'react'
import { API_URL, ApiError, errorMessage, requestIntegrity, type IntegrityResult } from './api'
import Notice, { type NoticeValue } from './components/Notice'
import { IconCopy, IconOk, IconPending, IconFail, IconNone, IconChevron } from './components/icons'

type CheckState = 'ok' | 'pending' | 'fail' | 'none'
interface CheckRow { state: CheckState; title: string; detail: string }

const API_DETAILS = 'GET /integrity/:id returns matchedFile, matchedCommitment, broadcast and inBlock, plus depth, ' +
    'status and a human-readable message. GET /download/:id streams the bytes, which the browser re-hashes before saving.'

const CHECK_ICON = { ok: IconOk, pending: IconPending, fail: IconFail, none: IconNone }

// The four facts the integrity endpoint already returns, read out in plain English.
// An earlier hard failure short-circuits the server, so later facts can be absent: those
// rows report as unevaluated rather than inventing a pass or a failure.
function buildChecklist(result: IntegrityResult): CheckRow[] {
    const failed = result.status === 'failed'
    const skipped = 'Not evaluated, because an earlier check did not pass.'
    const depth = typeof result.depth === 'number' ? ` ${result.depth.toLocaleString()} confirmations.` : ''
    return [
        result.matchedFile
            ? { state: 'ok', title: 'The stored file matches its fingerprint', detail: 'Recomputed SHA-256 of the stored bytes equals the recorded fingerprint.' }
            : { state: 'fail', title: 'The stored file does not match its fingerprint', detail: 'Recomputed SHA-256 differs from the recorded value.' },
        result.matchedCommitment
            ? { state: 'ok', title: 'The fingerprint matches the on-chain record', detail: 'Same value found in the transaction OP_RETURN output.' }
            : { state: 'fail', title: 'The fingerprint does not match the on-chain record', detail: 'The transaction commitment differs from the recorded fingerprint.' },
        result.broadcast === undefined
            ? { state: 'none', title: 'Network acceptance not evaluated', detail: skipped }
            : result.broadcast
                ? { state: 'ok', title: 'The transaction was accepted by the network', detail: 'Broadcast confirmed by the node.' }
                : failed
                    ? { state: 'fail', title: 'The transaction was rejected by the network', detail: 'The network did not accept this transaction.' }
                    : { state: 'pending', title: 'Network acceptance not yet confirmed', detail: 'No node has reported acceptance yet.' },
        result.inBlock === undefined
            ? { state: 'none', title: 'Block inclusion not evaluated', detail: skipped }
            : result.inBlock
                ? { state: 'ok', title: 'Included in a mined block', detail: `Merkle proof checks out against block headers.${depth}` }
                : failed
                    ? { state: 'fail', title: 'Not included in a mined block', detail: 'No valid Merkle proof exists for this transaction.' }
                    : { state: 'pending', title: 'Not yet in a mined block', detail: 'No Merkle proof available yet. Blocks are usually found within ten minutes.' },
    ]
}

function verdictNotice(result: IntegrityResult): NoticeValue {
    if (result.status === 'confirmed') {
        return { tone: 'success', title: 'Verified',
            message: typeof result.blockHeight === 'number'
                ? `All four checks passed. The file existed no later than block ${result.blockHeight.toLocaleString()}.`
                : 'All four checks passed. The file was included in a mined block.' }
    }
    if (result.status === 'pending') {
        return { tone: 'pending', title: 'File found, confirmation pending',
            message: result.message || 'Three checks passed. The transaction is not in a block yet, check again shortly.' }
    }
    return { tone: 'error', title: result.matchedFile ? 'Verification failed' : 'Integrity check failed',
        message: result.error || 'This file could not be verified. Downloading is blocked.' }
}

export interface DownloadHandle { verify: (id: string) => Promise<void> }

export default function Download({ ref, onStatusChange }: {
    ref?: Ref<DownloadHandle>
    onStatusChange?: (status: 'idle' | 'active' | 'done') => void
}) {
    const [fileId, setFileId] = useState('')
    const [result, setResult] = useState<IntegrityResult | null>(null)
    const [notice, setNotice] = useState<NoticeValue | null>(null)
    const [actionNotice, setActionNotice] = useState<NoticeValue | null>(null)
    const [invalid, setInvalid] = useState(false)
    const [loading, setLoading] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const sequence = useRef(0)
    const request = useRef<AbortController | null>(null)
    const report = useRef(onStatusChange)
    const verifyRef = useRef<((value: string) => void) | null>(null)

    const verify = useCallback(async (value: string) => {
        const id = value.trim().toLowerCase()
        const current = ++sequence.current
        request.current?.abort()
        setResult(null); setActionNotice(null)
        if (id.length !== 64 || !/^[a-f0-9]{64}$/.test(id)) {
            setLoading(false); setInvalid(true)
            setNotice({ tone: 'error', title: 'Check the ID or fingerprint',
                message: id.length === 64
                    ? 'That value contains characters outside 0 to 9 and a to f.'
                    : `That value is ${id.length} characters. Both identifiers are exactly 64 hexadecimal characters.` })
            return
        }
        setInvalid(false); setFileId(id); setLoading(true)
        report.current?.('active')
        setNotice({ tone: 'loading', title: 'Checking your file', message: 'Recomputing the fingerprint and reading the block proof.' })
        const controller = new AbortController()
        request.current = controller
        try {
            const data = await requestIntegrity(id, controller.signal)
            if (current !== sequence.current) return
            setResult(data)
            setNotice(verdictNotice(data))
            report.current?.(data.status === 'confirmed' ? 'done' : 'active')
        } catch (error) {
            if (current !== sequence.current) return
            const missing = error instanceof ApiError && error.status === 404
            setNotice(missing
                ? { tone: 'error', title: 'File not found', message: 'No upload matches that identifier. Check the value against your receipt.' }
                : { tone: 'error', title: 'Verification could not complete',
                    message: 'The lookup service is unavailable. Nothing about the file has changed. Try again shortly.',
                    action: { label: 'Try again', onClick: () => verifyRef.current?.(id) } })
        } finally { if (current === sequence.current) setLoading(false) }
    }, [])

    // The upload receipt drives verification through this handle rather than a prop the
    // stage reacts to, so handing off never costs an extra render pass.
    useImperativeHandle(ref, () => ({ verify }), [verify])
    // Refs are written in effects, never during render, so retry handlers see the latest.
    useEffect(() => { report.current = onStatusChange })
    useEffect(() => { verifyRef.current = verify }, [verify])
    useEffect(() => () => { sequence.current++; request.current?.abort() }, [])

    function changeId(value: string) {
        sequence.current++; request.current?.abort()
        setFileId(value); setResult(null); setNotice(null); setActionNotice(null); setInvalid(false); setLoading(false)
        report.current?.(value ? 'active' : 'idle')
    }

    async function copyHash() {
        if (!result) return
        try {
            await navigator.clipboard.writeText(result.fileHash)
            setActionNotice({ tone: 'success', title: 'Copied to clipboard', message: 'File fingerprint copied.' })
        } catch { setActionNotice({ tone: 'error', title: 'Could not copy', message: 'Select the fingerprint above and copy it manually.' }) }
    }

    async function download() {
        if (!result || downloading) return
        const current = sequence.current
        setDownloading(true)
        setActionNotice({ tone: 'loading', title: 'Preparing your download', message: 'Fetching the bytes and re-checking the fingerprint before saving.' })
        try {
            const response = await fetch(API_URL + '/download/' + result.txid, { signal: AbortSignal.timeout(30000) })
            if (!response.ok) {
                let message = 'The file could not be downloaded. Please try again.'
                try { message = (await response.json()).error || message } catch { /* Keep the friendly fallback. */ }
                throw new Error(message)
            }
            const blob = await response.blob()
            const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())))
                .map(b => b.toString(16).padStart(2, '0')).join('')
            // The browser re-checks the bytes it actually received, so a good server
            // response cannot hand over a file that no longer matches its fingerprint.
            if (hash !== result.fileHash) {
                setActionNotice({ tone: 'error', title: 'Download blocked',
                    message: 'The downloaded file did not match its fingerprint, so it was not saved.' })
                return
            }
            if (current !== sequence.current) return
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url; link.download = result.fileName || `${result.fileHash}.bin`
            document.body.append(link); link.click(); link.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
            setActionNotice({ tone: 'success', title: 'Download ready',
                message: `${result.fileName || 'The file'} was saved. Its fingerprint matched before saving.` })
        } catch (error) {
            if (current === sequence.current) setActionNotice({ tone: 'error', title: 'Download could not complete', message: errorMessage(error) })
        } finally { setDownloading(false) }
    }

    const rows = result ? buildChecklist(result) : []
    const cardTone = !result ? '' : result.status === 'confirmed' ? 'tm-card--ok' : result.status === 'pending' ? 'tm-card--pending' : 'tm-card--fail'
    const cardTitle = !result ? '' : result.status === 'confirmed' ? 'What was proven' : result.status === 'pending' ? 'What was proven so far' : 'What was checked'

    return <>
        <div className={`tm-field ${invalid ? 'tm-field--error' : ''}`}>
            <label className="tm-label" htmlFor="file-id">Transaction ID or file fingerprint</label>
            <input id="file-id" spellCheck={false} autoComplete="off" value={fileId} disabled={loading}
                placeholder="Paste the 64-character value from your receipt"
                onChange={event => changeId(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void verify(fileId) } }} />
            <span className="tm-hint">64 hexadecimal characters. Both values come from the receipt in step 1.</span>
        </div>

        {notice && <Notice {...notice} />}

        <div className="tm-actions">
            <button type="button" className="tm-btn tm-btn--primary" disabled={loading || !fileId.trim()} onClick={() => void verify(fileId)}>
                {loading && <span className="tm-btn__spin" aria-hidden="true" />}
                {loading ? 'Checking…' : 'Verify file'}
            </button>
        </div>

        {result && <div className={`tm-card ${cardTone}`}>
            <p className="tm-card__t">{cardTitle}</p>
            <ul className="tm-check">
                {rows.map(row => {
                    const Icon = CHECK_ICON[row.state]
                    return <li key={row.title} data-s={row.state}>
                        <Icon />
                        <div>
                            <p className="tm-check__t">{row.title}</p>
                            <p className="tm-check__d">{row.detail}</p>
                        </div>
                    </li>
                })}
            </ul>
            <hr className="tm-divider" />
            <div className="tm-kv">
                <span className="tm-label">File fingerprint (SHA-256)</span>
                <div className="tm-kv__v">{result.fileHash}</div>
                <div className="tm-kv__row">
                    <button type="button" className="tm-action" onClick={() => void copyHash()}><IconCopy />Copy fingerprint</button>
                </div>
            </div>
            <div className="tm-kv__row">
                <span className="tm-hint">
                    Recorded {new Date(result.time).toLocaleString('en-AU')}
                    {result.fileName ? ` · ${result.fileName}` : ''}
                </span>
            </div>
            {actionNotice && <Notice {...actionNotice} />}
            <div className="tm-actions">
                {result.downloadAllowed && <button type="button"
                    className={`tm-btn ${result.status === 'pending' ? 'tm-btn--secondary' : 'tm-btn--primary'}`}
                    disabled={downloading} onClick={() => void download()}>
                    {downloading && <span className="tm-btn__spin" aria-hidden="true" />}
                    {downloading ? 'Downloading…' : 'Download file'}
                </button>}
                {result.status !== 'confirmed' && <button type="button"
                    className={`tm-btn ${result.status === 'pending' ? 'tm-btn--primary' : 'tm-btn--secondary'}`}
                    disabled={loading} onClick={() => void verify(result.id || fileId)}>Check again</button>}
            </div>
            <p className="tm-hint">
                {result.status === 'failed' && result.matchedCommitment && !result.matchedFile
                    ? 'The blockchain record is sound; the stored copy is not. Saving was blocked to avoid handing you altered bytes.'
                    : 'This proves the bytes existed before that block. It does not prove who made the file, when it was made, or that its contents are true.'}
            </p>
        </div>}

        {!result && actionNotice && <Notice {...actionNotice} />}

        <details className="tm-details"><summary><IconChevron className="tm-details__chev" />API details</summary><p>{API_DETAILS}</p></details>
    </>
}
