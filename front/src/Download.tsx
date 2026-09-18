import { useState, useCallback, useEffect, useRef, useImperativeHandle, type Ref } from 'react'
import { API_URL, ApiError, errorMessage, requestJson } from './api'
import Notice, { type NoticeValue } from './components/Notice'

interface IntegrityResult {
    id: string; txid: string; fileHash: string; fileName?: string; fileType: string; time: number
    status: 'confirmed' | 'pending'; valid: boolean; downloadAllowed: boolean; message: string; depth: number | null
}

export interface DownloadHandle { verify: (id: string) => Promise<void> }

export default function Download({ ref }: { ref?: Ref<DownloadHandle> }) {
    const [fileId, setFileId] = useState('')
    const [result, setResult] = useState<IntegrityResult | null>(null)
    const [notice, setNotice] = useState<NoticeValue | null>(null)
    const [actionNotice, setActionNotice] = useState<NoticeValue | null>(null)
    const [loading, setLoading] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const sequence = useRef(0)
    const request = useRef<AbortController | null>(null)

    const verify = useCallback(async (value: string) => {
        const id = value.trim().toLowerCase()
        const current = ++sequence.current
        request.current?.abort()
        setResult(null); setActionNotice(null)
        if (!/^[a-f0-9]{64}$/.test(id)) {
            setLoading(false)
            setNotice({ tone: 'error', title: 'Check the ID or hash', message: 'Enter a 64-character transaction ID or SHA-256 file hash. You can copy it from the upload receipt.' }); return
        }
        setFileId(id); setLoading(true)
        setNotice({ tone: 'loading', title: 'Checking your file', message: 'Finding the file, comparing its fingerprint and checking its blockchain proof.' })
        const controller = new AbortController()
        request.current = controller
        try {
            const data = await requestJson<IntegrityResult>('/integrity/' + id, { signal: controller.signal })
            if (current !== sequence.current) return
            setResult(data)
            setNotice({ tone: data.status === 'confirmed' ? 'success' : 'pending',
                title: data.status === 'confirmed' ? 'File and blockchain proof verified' : 'File found, confirmation pending', message: data.message })
        } catch (error) {
            if (current !== sequence.current) return
            setNotice({ tone: 'error', title: error instanceof ApiError && error.status === 404 ? 'File not found' : 'Verification could not complete', message: errorMessage(error) })
        } finally { if (current === sequence.current) setLoading(false) }
    }, [])

    useImperativeHandle(ref, () => ({ verify }), [verify])
    useEffect(() => () => { sequence.current++; request.current?.abort() }, [])

    function changeId(value: string) {
        sequence.current++; request.current?.abort()
        setFileId(value); setResult(null); setNotice(null); setActionNotice(null); setLoading(false)
    }

    async function copyHash() {
        if (!result) return
        try {
            await navigator.clipboard.writeText(result.fileHash)
            setActionNotice({ tone: 'success', title: 'File hash copied', message: 'Save it to find and verify this file later.' })
        } catch { setActionNotice({ tone: 'error', title: 'Could not copy', message: 'Select the file hash below and copy it manually.' }) }
    }

    async function download() {
        if (!result || downloading) return
        const current = sequence.current
        setDownloading(true)
        setActionNotice({ tone: 'loading', title: 'Preparing your download', message: 'Checking the file bytes again before saving them.' })
        try {
            const response = await fetch(API_URL + '/download/' + result.txid, { signal: AbortSignal.timeout(30000) })
            if (!response.ok) {
                let message = 'The file could not be downloaded. Please try again.'
                try { message = (await response.json()).error || message } catch { /* Keep the friendly fallback. */ }
                throw new Error(message)
            }
            const blob = await response.blob()
            const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).map(b => b.toString(16).padStart(2, '0')).join('')
            if (hash !== result.fileHash) throw new Error('The downloaded file did not match its fingerprint. Saving was blocked.')
            if (current !== sequence.current) return
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url; link.download = result.fileName || `${result.fileHash}.bin`
            document.body.append(link); link.click(); link.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
            setActionNotice({ tone: 'success', title: 'Download ready', message: 'The file matches its fingerprint. Your browser has been asked to save it.' })
        } catch (error) {
            if (current === sequence.current) setActionNotice({ tone: 'error', title: 'Download could not complete', message: errorMessage(error) })
        } finally { setDownloading(false) }
    }

    return <div className="tm-download-grid"><div className="tm-download-grid__left">
        <form onSubmit={event => { event.preventDefault(); void verify(fileId) }}>
            <div className="tm-download-form-box">
                <label className="tm-field-label" htmlFor="file-id">Transaction ID or file hash</label>
                <textarea id="file-id" placeholder="Paste the ID or SHA-256 hash from your receipt" value={fileId} onChange={event => changeId(event.target.value)} />
                <p className="tm-form-helper">Use the 64-character ID or file hash from your upload receipt.</p>
            </div>
            <div className="tm-upload-actions"><button className="tm-btn tm-btn--primary" disabled={loading}>
                {loading ? 'Checking...' : 'Verify file'}
            </button></div>
        </form>
        {notice && <Notice {...notice} />}
        {result && <div className={`tm-verdict ${result.status === 'confirmed' ? 'tm-verdict--pass' : 'tm-verdict--pending'}`}>
            <p><strong>Uploaded: </strong>{new Date(result.time).toLocaleString()}</p>
            <p className="tm-receipt__id-row"><strong>File hash: </strong>{result.fileHash}</p>
            <button className="tm-text-action" onClick={copyHash}>Copy file hash</button>
            {result.depth !== null && <p><strong>Block confirmations: </strong>{result.depth}</p>}
            <div className="tm-upload-actions">
                {result.downloadAllowed && <button className="tm-btn tm-btn--primary" onClick={download} disabled={downloading}>{downloading ? 'Downloading...' : 'Download file'}</button>}
                {result.status === 'pending' && <button className="tm-btn tm-btn--secondary" onClick={() => verify(result.id)} disabled={loading}>Check again</button>}
            </div>
        </div>}
        {actionNotice && <Notice {...actionNotice} />}
        <details className="tm-api-details"><summary>API details</summary><p>Look up a file with <code>/integrity/:id</code> and download it with <code>/download/:id</code>. The ID can be a transaction ID or file hash.</p></details>
    </div></div>
}
