import { useState, useCallback } from 'react'
import { useFunding } from './useFunding'

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3030'

function Upload({ onUploadComplete }: { onUploadComplete?: () => void }) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [response, setResponse] = useState({ txid: '', network: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { getFundingInfo } = useFunding()

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
                                <p style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {selectedFile.name}
                                </p>
                            ) : (
                                <p>Drag &amp; drop a file here or click to select one</p>
                            )}
                        </div>
                    </label>
                </form>
                <div className="tm-upload-actions">
                    <button className="tm-btn tm-btn--primary" onClick={upload} disabled={!selectedFile || loading}>
                        Upload
                    </button>
                </div>
                {error && (
                    <pre className="tm-error">{error}</pre>
                )}
                <details className="tm-api-details">
                    <summary>API details</summary>
                    <p>Send file binary streams to the <code>/upload</code> endpoint.</p>
                </details>
            </div>
            <div className="tm-upload-grid__right">
                {response.txid ? (
                    <div className="tm-receipt">
                        <h3>Upload successful</h3>
                        <p>{response?.txid}</p>
                        <p><a target='_BLANK' href={'https://' + (response.network !== 'main' ? 'test.' : '') + 'whatsonchain.com/tx/' + response.txid}>View on WhatsOnChain</a></p>
                    </div>
                ) : (
                    <div className="tm-verdict-placeholder">
                        Awaiting submission.
                    </div>
                )}
            </div>
        </div>
    )
}

export default Upload
