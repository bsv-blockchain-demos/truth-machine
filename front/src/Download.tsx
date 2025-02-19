import { useState } from 'react'

function Download () {
    const [fileId, setFileId] = useState('')
    const [integrityResult, setIntegrityResult] = useState<any>(null)

    const handleSubmit = async () => {
        try {
            const integrityResponse = await fetch('/integrity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fileId })
            })
            if (!integrityResponse.ok) {
                throw new Error('Integrity check failed')
            }
            setIntegrityResult(await integrityResponse.json())
        } catch (error) {
            console.log({ error })
        }
    }

    return (
        <div>
            <input
                type="text"
                placeholder="Enter file id"
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
            />
            <button onClick={handleSubmit}>Submit</button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {downloadResult && (
                <div>
                    <h3>Download Result</h3>
                    <pre>{JSON.stringify(downloadResult, null, 2)}</pre>
                </div>
            )}
            {integrityResult && (
                <div>
                    <h3>Integrity Result</h3>
                    <pre>{JSON.stringify(integrityResult, null, 2)}</pre>
                </div>
            )}
        </div>
    )
}

export default Download