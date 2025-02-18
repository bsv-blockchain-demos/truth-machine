import React, { useEffect, useState } from 'react'

interface FundingInfo {
    address: string
    balance: number
}

const App: React.FC = () => {
    const [fundingInfo, setFundingInfo] = useState<FundingInfo | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchFundingInfo = async () => {
            try {
                const res = await fetch('/api/funding-info')
                const info: FundingInfo = await res.json()
                setFundingInfo(info)
            } catch (error) {
                console.error('Failed to fetch funding info', error)
            } finally {
                setLoading(false)
            }
        }

        fetchFundingInfo()
    }, [])

    if (loading) {
        return <div>Loading...</div>
    }

    if (!fundingInfo) {
        return <div>Error loading funding info.</div>
    }

    return (
        <div style={{ margin: '2rem', fontFamily: 'Helvetica, sans-serif' }}>
            <h1>Data Timestamper</h1>
            <h2>Upload</h2>
            <p>
                Send data to <code>/upload</code> endpoint to store and timestamp on the BSV
                Blockchain.
            </p>
            <h2>Download</h2>
            <p>
                Retrieve stored data from <code>/download/&lt;hash&gt;</code> along with an
                integrity proof and timestamp.
            </p>
            <h2>Funding Service</h2>
            <p>
                This service has {fundingInfo.balance} write tokens remaining. To top up the
                balance, make a BSV payment to {fundingInfo.address} and hit the{' '}
                <a href="/fund/10">/fund/&lt;number&gt; endpoint</a>.
            </p>
        </div>
    )
}

export default App