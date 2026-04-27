import { useState, useCallback, useRef } from 'react'

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3030'

function Download () {
    const [fileId, setFileId] = useState('')
    const [integrityResult, setIntegrityResult] = useState<any>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)
    const copyTimeout = useRef<ReturnType<typeof setTimeout>>(null)

    const copyHash = useCallback((hash: string) => {
        navigator.clipboard.writeText(hash).then(() => {
            setCopied(true)
            if (copyTimeout.current) clearTimeout(copyTimeout.current)
            copyTimeout.current = setTimeout(() => setCopied(false), 2000)
        })
    }, [])

    const handleSubmit = async () => {
        try {
            setLoading(true)
            const integrityResponse = await (await fetch(API_URL + '/integrity/' + fileId)).json()
            if (!integrityResponse.valid) {
                throw new Error(integrityResponse.error)
            }
            setIntegrityResult(integrityResponse)
            setError('')
        } catch (error) {
            console.log({ error })
            setIntegrityResult(null)
            setError(String(error) || 'error')
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="tm-loading">Loading...</div>

    return (
        <div className="tm-download-grid">
            <div className="tm-download-grid__left">
                <div className="tm-download-form-box">
                    <span className="tm-corner tm-corner--tl" />
                    <span className="tm-corner tm-corner--tr" />
                    <span className="tm-corner tm-corner--bl" />
                    <span className="tm-corner tm-corner--br" />
                    <p className="tm-field-label">TX ID OR FILE HASH <span className="tm-tooltip-wrap"><span className="tm-tooltip-icon">i</span><span className="tm-tooltip"><strong>TX ID:</strong> shown after you upload a file. You can also find it on WhatsOnChain.<br /><br /><strong>File Hash:</strong> shown after verification completes.<br /><br />Either one works here to look up and verify your file.</span></span></p>
                    <textarea
                        placeholder="411d36a493..."
                        value={fileId}
                        onChange={(e) => setFileId(e.target.value)}
                    />
                    <p className="tm-form-helper">64-CHAR HEX · TX OR SHA-256</p>
                </div>
                <div className="tm-upload-actions">
                    <button className="tm-btn tm-btn--primary" onClick={handleSubmit}>
                        Submit
                    </button>
                </div>
                {integrityResult ? (
                    <div className={`tm-verdict ${integrityResult.valid ? 'tm-verdict--pass' : 'tm-verdict--fail'}`}>
                        <h3>Integrity Result: <span className="tm-verdict__status--inline">{integrityResult.valid ? 'Valid' : 'Invalid'}</span></h3>
                        <p><span className="tm-verdict__label tm-verdict__label--bold">Recorded: </span>{`${new Date(integrityResult.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} on ${new Date(integrityResult.time).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`}</p>
                        <p><span className="tm-verdict__label tm-verdict__label--bold">Filehash: </span>{integrityResult.fileHash}<button className="tm-copy-icon" onClick={() => copyHash(integrityResult.fileHash)} title={copied ? 'Copied!' : 'Copy File Hash'}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{copied ? <path d="M20 6L9 17l-5-5" /> : <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></>}</svg></button></p>
                        <p><span className="tm-verdict__label tm-verdict__label--bold">Broadcast: </span>{integrityResult?.broadcast ? 'Success' : 'Problem'}</p>
                        {integrityResult?.inBlock && <p><span className="tm-verdict__label tm-verdict__label--bold">Depth: </span>{integrityResult?.depth}</p>}
                        <button className="tm-btn tm-btn--primary" onClick={() => window.location.href = `${API_URL}/download/${fileId}`}>
                            Download
                        </button>
                    </div>
                ) : error ? (
                    <div className="tm-verdict tm-verdict--fail">
                        <h3>Integrity Result: <span className="tm-verdict__status--inline">Failed</span></h3>
                        <p>{error}</p>
                    </div>
                ) : null}
                {error && <pre className="tm-error">{error}</pre>}
                <details className="tm-api-details">
                    <summary>
                        <svg className="tm-chevron" width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M2 1l4 3-4 3z" /></svg>
                        API details
                    </summary>
                    <p>Download files from the <code>/download/:id</code> endpoint. Validate their integrity using the <code>/integrity/:id</code> endpoint.</p>
                    <p>The id can be either the txid of the transaction which timestamped the file, or the hash of the file data.</p>
                </details>
            </div>
        </div>
    )
}

export default Download
