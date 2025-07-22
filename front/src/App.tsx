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

import Upload from './Upload'
import Download from './Download'
import './App.css'
import Funding from './Funding'
import { FundingProvider } from './useFunding'

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
            <FundingProvider>
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
            </FundingProvider>

            {/* Purpose Description */}
            <div className={'wide'}>
                <h3>Purpose</h3>
                <p>
                    This application is intended to demonstrate the methodology for secure data integrity and timestamping on the BSV Blockchain. 
                    Upload a file, and its cryptographic hash is recorded on the blockchain, creating an immutable proof of existence at that exact time. Files are stored in a regular database and can be retrieved later with verifiable evidence of their creation date and integrity. The Treasury section enables token creation to fund transaction fees for the service. It ensures operational costs are covered and displays a balance of available write actions.
                </p>
                <p>
                    The complete source code for this application can be found at{' '}
                    <a href="https://github.com/bsv-blockchain-demos/truth-machine" target="_blank" rel="noopener noreferrer" style={{color: '#ffeb3b', textDecoration: 'underline'}}>
                        https://github.com/bsv-blockchain-demos/truth-machine
                    </a>.
                </p>
            </div>
        </div>
    )
}

export default App
