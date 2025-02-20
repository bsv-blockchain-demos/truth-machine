import { useState, useEffect } from 'react'
import Upload from './Upload'
import Download from './Download'
import './App.css'
import { QRCodeSVG } from 'qrcode.react'

const API_URL = import.meta.env?.API_URL || 'http://localhost:3030'

function App() {
    const [fundingInfo, setFundingInfo] = useState({ address: '', balance: 0, tokens: 0 })
    const [loading, setLoading] = useState(true)
    const [tokenNumber, setTokenNumber] = useState(1)

    async function createFunds(tokens: number) {
        try {
            setLoading(true)
            const response = await (await fetch(API_URL + '/fund/' + String(tokens))).json()
            console.log({ response })
            await fetchFundingInfo()
        } catch (error) {
            console.error('Failed to create funds', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchFundingInfo = async () => {
        try {
            setLoading(true)
            const { address, balance, tokens } = await (await fetch(API_URL + '/checkTreasury')).json()
            console.log({ address, balance, tokens })
            setFundingInfo({ address, balance, tokens })
        } catch (error) {
            console.error('Failed to fetch funding info', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
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
            <h1>Truth Machine</h1>
            <h2>Data Integrity & Timestamping Demo</h2>
            <main>
                <section>
                    <h3>Treasury</h3>
                    <QRCodeSVG value={fundingInfo.address} marginSize={2} width={128} />
                    <p>Balance: <big>{fundingInfo.balance.toLocaleString()}</big> satoshis</p>
                    <p>Tokens Ready: <big>{fundingInfo.tokens.toLocaleString()}</big></p>
                    <label>
                        <input
                            type='number'
                            min='1'
                            max='1000'
                            className='token-input'
                            value={tokenNumber}
                            onChange={(e) => setTokenNumber(parseInt(e.target.value))}
                        />{' '}
                        tokens
                    </label>
                    <button onClick={() => createFunds(tokenNumber)}>Create Tokens</button>
                </section>
                <section>
                    <h3>Upload</h3>
                    <Upload />
                </section>
                <section>
                    <h3>Download</h3>
                    <Download />
                </section>
            </main>
            <div className={'wide'}>
                <h3>Purpose</h3>
                <p>
                    This application is intended to demonstrate the methodology for secure data integrity and timestamping on the BSV Blockchain. 
                    Upload a file, and its cryptographic hash is recorded on the blockchain, creating an immutable proof of existence at that exact time. Files are stored in a regular database and can be retrieved later with verifiable evidence of their creation date and integrity. The Treasury section enables token creation to fund transaction fees for the service. It ensures operational costs are covered and displays a balance of available write actions.
                </p>
            </div>
        </div>
    )
}

export default App
