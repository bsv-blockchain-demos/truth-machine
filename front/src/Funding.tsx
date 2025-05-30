import { useEffect, useState } from 'react'
import { QRCodeSVG } from "qrcode.react"
import { useFunding } from './useFunding'

/**
 * Funding Component
 *
 * This component displays and manages treasury information for funding, leveraging the useFunding hook.
 * 
 * With functionality moved to useFunding, the hook now handles:
 * - API integration for fetching treasury status (address, balance, tokens) and creating new tokens.
 * - State management for funding information and loading state.
 *
 * The component is primarily responsible for rendering:
 * - A QR code for the funding Bitcoin address.
 * - Treasury balance and available tokens.
 * - A UI to specify the number of tokens to create.
 */
export default function Funding() {
    const { getFundingInfo, fundingInfo, loading, createTokens, utxoStatusUpdate } = useFunding()
    const [tokenNumber, setTokenNumber] = useState(1)

    // Initialize treasury information on component mount
    useEffect(() => {
        getFundingInfo()
    }, [])

    if (loading) return <div>Loading...</div>
    if (!fundingInfo) return <div>Error loading funding info.</div>

    return <>
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
        <button onClick={() => createTokens(tokenNumber)}>Create Tokens</button>
        <br /><br />
        <label>Manual Token Status Update</label>
        <button onClick={utxoStatusUpdate}>Check Tokens</button>
    </>
}
