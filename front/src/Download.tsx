import { useState } from 'react'

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3030'

function Download () {
    const [fileId, setFileId] = useState('')
    const [integrityResult, setIntegrityResult] = useState<any>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

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
                    <p className="tm-field-label">File id:</p>
                    <textarea
                        placeholder="411d36a493..."
                        value={fileId}
                        onChange={(e) => setFileId(e.target.value)}
                    />
                </div>
                <div className="tm-upload-actions">
                    <button className="tm-btn tm-btn--primary" onClick={handleSubmit}>Submit</button>
                </div>
                {error && <pre className="tm-error">{error}</pre>}
                <details className="tm-api-details">
                    <summary>API details</summary>
                    <p>Download files from the <code>/download/:id</code> endpoint. Validate their integrity using the <code>/integrity/:id</code> endpoint.</p>
                    <p>The id can be either the txid of the transaction which timestamped the file, or the hash of the file data.</p>
                </details>
            </div>
            <div className="tm-download-grid__right">
                {integrityResult ? (
                    <div className={`tm-verdict ${integrityResult.valid ? 'tm-verdict--pass' : 'tm-verdict--fail'}`}>
                        <span className="tm-verdict__seal" />
                        <h3>Integrity Result</h3>
                        <p className="tm-verdict__status">{integrityResult.valid ? 'Valid' : 'Invalid'}</p>
                        <p>{`${new Date(integrityResult.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} on ${new Date(integrityResult.time).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`}</p>
                        <p><span className="tm-verdict__label">Filehash: </span>{integrityResult.fileHash}</p>
                        <p><span className="tm-verdict__label">Broadcast: </span>{integrityResult?.broadcast ? 'success' : 'problem'}</p>
                        {integrityResult?.inBlock && <p><span className="tm-verdict__label">Depth: </span>{integrityResult?.depth}</p>}
                        <button className="tm-btn tm-btn--primary" onClick={() => window.location.href = `${API_URL}/download/${fileId}`}>Download</button>
                    </div>
                ) : error ? (
                    <div className="tm-verdict tm-verdict--fail">
                        <h3>Integrity Result</h3>
                        <p className="tm-verdict__status">Failed</p>
                        <p>{error}</p>
                    </div>
                ) : (
                    <div className="tm-verdict-placeholder">
                        Awaiting verification.
                    </div>
                )}
            </div>
        </div>
    )
}

export default Download
