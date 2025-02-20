/**
 * Truth Machine Frontend Application
 * 
 * Main frontend application for the Truth Machine system, providing a user interface
 * for data timestamping, integrity verification, and treasury management on the
 * Bitcoin SV blockchain.
 * 
 * Features:
 * - File upload with blockchain timestamping
 * - File download with integrity verification
 * - Treasury management with QR code support
 * - Token creation and management
 * - Real-time balance monitoring
 */

import { useState, useEffect } from 'react'
import Upload from './Upload'
import Download from './Download'
import './App.css'
import { QRCodeSVG } from 'qrcode.react'

/** Base API URL with environment-specific configuration */
const API_URL = import.meta.env?.API_URL || 'http://localhost:3030'

/**
 * Treasury information interface
 * @interface FundingInfo
 * @property {string} address - Bitcoin address for funding the treasury
 * @property {number} balance - Current balance in satoshis
 * @property {number} tokens - Available write tokens
 */
interface FundingInfo {
    address: string
    balance: number
    tokens: number
}

/**
 * Main application component
 * 
 * Provides a comprehensive interface for:
 * 1. Managing the treasury (viewing balance, creating tokens)
 * 2. Uploading files for blockchain timestamping
 * 3. Downloading files with integrity proofs
 * 
 * State Management:
 * - Tracks treasury status (address, balance, tokens)
 * - Manages token creation process
 * - Handles loading states during API calls
 * 
 * API Integration:
 * - GET /checkTreasury - Fetch treasury status
 * - POST /fund/:tokens - Create new write tokens
 * 
 * @component
 * @example
 * return (
 *   <App />
 * )
 */
function App() {
    // State for treasury information and UI control
    const [fundingInfo, setFundingInfo] = useState<FundingInfo>({ address: '', balance: 0, tokens: 0 })
    const [loading, setLoading] = useState(true)
    const [tokenNumber, setTokenNumber] = useState(1)

    /**
     * Create new write tokens in the treasury
     * @param {number} tokens - Number of tokens to create
     * @throws {Error} When token creation fails
     */
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

    /**
     * Fetch current treasury status
     * Updates the fundingInfo state with latest treasury information
     * @throws {Error} When API call fails
     */
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

    // Initialize treasury information on component mount
    useEffect(() => {
        fetchFundingInfo()
    }, [])

    // Loading state UI
    if (loading) {
        return <div>Loading...</div>
    }

    // Error state UI
    if (!fundingInfo) {
        return <div>Error loading funding info.</div>
    }

    /**
     * Main application UI
     * Organized in sections:
     * 1. Treasury Management
     *    - QR code for funding address
     *    - Current balance display
     *    - Token creation interface
     * 2. File Upload
     *    - Interface for timestamping new files
     * 3. File Download
     *    - Interface for retrieving files with proofs
     * 4. Purpose Description
     *    - System overview and functionality explanation
     */
    return (
        <div style={{ margin: '2rem', fontFamily: 'Helvetica, sans-serif' }}>
            <h1>Truth Machine</h1>
            <h2>Data Integrity & Timestamping Demo</h2>
            <main>
                {/* Treasury Management Section */}
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

                {/* File Upload Section */}
                <section>
                    <h3>Upload</h3>
                    <Upload />
                </section>

                {/* File Download Section */}
                <section>
                    <h3>Download</h3>
                    <Download />
                </section>
            </main>

            {/* Purpose Description */}
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
