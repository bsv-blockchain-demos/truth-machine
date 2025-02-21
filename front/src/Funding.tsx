import { useEffect, useState } from 'react'
import { QRCodeSVG } from "qrcode.react"

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

export default function Funding() {
    // State for treasury information and UI control
    const [fundingInfo, setFundingInfo] = useState<FundingInfo>({ address: '', balance: 0, tokens: 0 })
    const [loading, setLoading] = useState<boolean>(true)
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
        <button onClick={() => createFunds(tokenNumber)}>Create Tokens</button>
    </>
}
