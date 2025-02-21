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
import Funding from './Funding'

/** Base API URL with environment-specific configuration */
const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3030'


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
                    <Funding />
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
