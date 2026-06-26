import { useState, useCallback, useRef } from 'react'
import { useFunding } from './useFunding'

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3030'

function Upload({ onUploadComplete }: { onUploadComplete?: () => void }) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [response, setResponse] = useState({ txid: '', network: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { getFundingInfo } = useFunding()
    const [copied, setCopied] = useState(false)
    const copyTimeout = useRef<ReturnType<typeof setTimeout>>(null)

    const copyTxid = useCallback(() => {
        navigator.clipboard.writeText(response.txid).then(() => {
            setCopied(true)
            if (copyTimeout.current) clearTimeout(copyTimeout.current)
            copyTimeout.current = setTimeout(() => setCopied(false), 2000)
        })
    }, [response.txid])

    const handleDrag = useCallback((e: React.DragEvent<HTMLElement>) => {
            e.preventDefault()
            e.stopPropagation()
        }, [])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0])
        }
    }, [])

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
        }
    }, [])

    const upload = useCallback(async () => {
        console.log({ selectedFile })
        if (selectedFile) {
            try {
                setLoading(true)
                setError('')
                const res = await fetch(API_URL + '/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'X-Original-Content-Type': selectedFile.type || 'application/octet-stream',
                        'X-Original-Filename': selectedFile.name,
                    },
                    body: selectedFile,
                })
                if (!res.ok) {
                    let message = `Upload failed (${res.status})`
                    try {
                        const body = await res.json()
                        if (body.error) message = body.error
                    } catch { /* non-JSON response (e.g. proxy HTML error page) */ }
                    setError(message)
                    return
                }
                const data = await res.json()
                console.log('Upload successful:', data)
                setResponse({ txid: data.txid, network: data.network })
                onUploadComplete?.()
            } catch (error) {
                console.error('Upload error:', error)
                setError('Network error — could not reach server')
            } finally {
                setLoading(false)
                getFundingInfo()
            }
        }
    }, [selectedFile])

    return (
        <div className="tm-upload-grid">
            <div className="tm-upload-grid__left">
                <form onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
                    <input
                        type="file"
                        id="file-upload"
                        style={{ display: 'none' }}
                        onChange={handleChange}
                    />
                    <label htmlFor="file-upload">
                        <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            className="tm-dropzone"
                        >
                            {selectedFile ? (
                                <p className="tm-dropzone__instruction tm-dropzone__instruction--file" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {selectedFile.name}
                                </p>
                            ) : (
                                <>
                                    <svg className="tm-dropzone__glyph" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--tm-ink2)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="9.5" />
                                        <path d="M12 15V8" />
                                        <path d="M8.5 11.5 12 8l3.5 3.5" />
                                        <path d="M8 16.5h8" />
                                    </svg>
                                    <p className="tm-dropzone__instruction">Drag and drop a file or click to browse</p>
                                </>
                            )}
                        </div>
                    </label>
                </form>
                <div className="tm-upload-actions">
                    <button className="tm-btn tm-btn--primary" onClick={upload} disabled={!selectedFile || loading}>
                        Upload
                    </button>
                </div>
                {response.txid && (
                    <div className="tm-receipt">
                        <h3>Upload successful</h3>
                        <p className="tm-receipt__id-row">
                            <span className="tm-verdict__label tm-verdict__label--bold">TX ID: </span>{response?.txid}<button className="tm-copy-icon" onClick={copyTxid} title={copied ? 'Copied!' : 'Copy File ID'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {copied
                                        ? <path d="M20 6L9 17l-5-5" />
                                        : <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></>
                                    }
                                </svg>
                            </button>
                        </p>
                        <p><a target='_BLANK' href={'https://' + (response.network !== 'main' ? 'test.' : '') + 'whatsonchain.com/tx/' + response.txid}>View on WhatsOnChain</a></p>
                    </div>
                )}
                {error && (
                    <pre className="tm-error">{error}</pre>
                )}
                <details className="tm-api-details">
                    <summary>
                        <svg className="tm-chevron" width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M2 1l4 3-4 3z" /></svg>
                        API details
                    </summary>
                    <p>Send file binary streams to the <code>/upload</code> endpoint.</p>
                </details>
            </div>
        </div>
    )
}

export default Upload
