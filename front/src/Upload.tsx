import { useState, useCallback } from 'react'

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3030'

function Upload() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [response, setResponse] = useState({ txid: '', network: '' })
    const [loading, setLoading] = useState(false)

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
                const response = await (await fetch(API_URL + '/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': selectedFile.type,
                    },
                    body: selectedFile,
                })).json()
                console.log('Upload successful:', response)
                setResponse({ txid: response.txid, network: response.network })
            } catch (error) {
                console.error('Upload error:', error)
            } finally {
                setLoading(false)
            }
        }
    }, [selectedFile])

    return (
        <div>
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
                        className='dropzone'
                    >
                        {selectedFile ? (
                            <p style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {selectedFile.name}
                            </p>
                        ) : (
                            <p>Drag & drop a file here or click to select one</p>
                        )}
                    </div>
                </label>
            </form>
            <button onClick={upload} disabled={!selectedFile || loading}>
                Upload
            </button>
            {response.txid && (
                <div>
                    <h3>Upload successful</h3>
                    <p><a target='_BLANK' href={'https://' + (response.network !== 'main' ? 'test.' : '') + 'whatsonchain.com/tx/' + response.txid}>Inspect</a></p>
                </div>
            )}
            <p className='explainer'>Send file binary streams to the /upload endpoint.</p>
        </div>
    )
}

export default Upload