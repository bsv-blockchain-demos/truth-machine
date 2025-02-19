import { useState, useCallback } from 'react'

function Upload() {
    const [dragActive, setDragActive] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0])
        }
    }, [])

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
        }
    }, [])

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
                        style={{
                            border: '2px dashed #ccc',
                            borderRadius: '4px',
                            padding: '20px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            backgroundColor: dragActive ? '#eee' : 'white'
                        }}
                    >
                        {selectedFile ? (
                            <p>{selectedFile.name}</p>
                        ) : (
                            <p>Drag & drop a file here or click to select one</p>
                        )}
                    </div>
                </label>
            </form>
        </div>
    )
}

export default Upload