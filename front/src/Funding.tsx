import { useEffectm useState } from 'react'
import { QRCodeSVG } from "qrcode.react"

const API_URL = import.meta.env?.API_URL || 'http://localhost:3030'

export default function Funding() {
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