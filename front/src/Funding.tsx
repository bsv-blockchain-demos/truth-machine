import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useFunding } from './useFunding'
import Notice from './components/Notice'
import { IconCopy, IconMinus, IconPlus } from './components/icons'

const API_DETAILS = 'GET /checkTreasury returns address, balance, tokens and pending. GET /fund/:n mints tokens. ' +
    'GET /utxoStatusUpdate re-checks pending actions. GET /consolidate sweeps unused tokens back to the treasury.'

export default function Funding() {
    const { getFundingInfo, fundingInfo, loading, refreshing, action, error, notice,
        createTokens, utxoStatusUpdate, consolidate } = useFunding()
    const [tokenNumber, setTokenNumber] = useState(25)
    const [copied, setCopied] = useState(false)

    // Anything that spends stays off until a treasury check succeeds. Checking pending
    // actions stays available, because that is how a stale treasury gets unstuck.
    const blocked = loading || !!error

    async function copyAddress() {
        if (!fundingInfo) return
        try {
            await navigator.clipboard.writeText(fundingInfo.address)
            setCopied(true)
        } catch { setCopied(false) }
    }

    if (!fundingInfo) {
        return <>
            {error
                ? <Notice tone="error" title="Treasury check failed" message="The service did not answer. Nothing has been spent." />
                : <Notice tone="loading" title="Checking the treasury" message="Reading the balance and token count." />}
            <div className="tm-actions">
                <button type="button" className="tm-btn tm-btn--secondary" disabled={refreshing} onClick={getFundingInfo}>
                    {refreshing && <span className="tm-btn__spin" aria-hidden="true" />}
                    {refreshing ? 'Checking…' : 'Retry treasury check'}
                </button>
            </div>
            <details className="tm-details"><summary>API details</summary><p>{API_DETAILS}</p></details>
        </>
    }

    return <>
        <div className="tm-stats">
            <div className="tm-stat">
                <span className="tm-label">Wallet balance</span>
                <div className="tm-stat__v">{fundingInfo.balance.toLocaleString()}</div>
                <span className="tm-stat__u">satoshis held by the demo treasury</span>
            </div>
            <div className={`tm-stat ${error || fundingInfo.tokens === 0 ? 'tm-stat--warn' : 'tm-stat--ok'}`}>
                <span className="tm-label">Write tokens ready</span>
                <div className="tm-stat__v">{fundingInfo.tokens.toLocaleString()}</div>
                <span className="tm-stat__u">one token pays for one upload</span>
            </div>
        </div>

        {notice && <Notice {...notice} />}
        {error && <Notice tone="error" title="Treasury check failed"
            message="The figures below are from the last successful check. Minting and consolidating stay off until a check succeeds."
            action={{ label: 'Retry treasury check', onClick: () => void getFundingInfo() }} />}
        {refreshing && !action && <Notice tone="loading" title="Refreshing treasury" message="Reading the latest balance and token count." />}
        {!error && fundingInfo.tokens === 0 && <Notice tone="pending" title="No write tokens available"
            message="Mint at least one token before uploading a file." />}
        {fundingInfo.pending > 0 && <Notice tone="pending"
            title={`${fundingInfo.pending} ${fundingInfo.pending === 1 ? 'action needs' : 'actions need'} a status check`}
            message="Check pending actions before minting again, so nothing is spent twice."
            action={{ label: 'Check pending actions', onClick: () => void utxoStatusUpdate() }} />}
        {copied && <Notice tone="success" title="Copied to clipboard" message="The deposit address was copied." />}

        <div className="tm-fund">
            <div className="tm-deposit">
                <span className="tm-label">1. Deposit BSV</span>
                <p className="tm-hint">Send any amount to this address, then refresh the balance.</p>
                <div className="tm-row tm-row--top">
                    <QRCodeSVG className="tm-qr" value={fundingInfo.address} size={116} marginSize={1}
                        bgColor="#ffffff" fgColor="#16181d" title="QR code for the deposit address" />
                    <div className="tm-deposit__col">
                        <div className="tm-addr">{fundingInfo.address}</div>
                        <button type="button" className="tm-action" onClick={copyAddress}><IconCopy />Copy address</button>
                    </div>
                </div>
            </div>

            <div className="tm-deposit">
                <span className="tm-label">2. Mint write tokens</span>
                <p className="tm-hint">Each token is a 13-satoshi output that pays the fee for one upload. Mint between 1 and 1,000.</p>
                <div className="tm-step-num">
                    <button type="button" aria-label="Fewer tokens" disabled={blocked}
                        onClick={() => setTokenNumber(n => Math.max(1, n - 1))}><IconMinus /></button>
                    <input type="number" min="1" max="1000" inputMode="numeric" aria-label="Number of tokens to mint"
                        disabled={blocked} value={tokenNumber}
                        onChange={event => setTokenNumber(Math.max(1, Math.min(1000, parseInt(event.target.value) || 1)))} />
                    <button type="button" aria-label="More tokens" disabled={blocked}
                        onClick={() => setTokenNumber(n => Math.min(1000, n + 1))}><IconPlus /></button>
                </div>
                <div className="tm-actions">
                    <button type="button" className="tm-btn tm-btn--primary" disabled={blocked} onClick={() => void createTokens(tokenNumber)}>
                        {action === 'mint' && <span className="tm-btn__spin" aria-hidden="true" />}
                        {action === 'mint' ? 'Creating tokens…' : 'Mint tokens'}
                    </button>
                    <button type="button" className="tm-action" disabled={loading} onClick={() => void getFundingInfo()}>Refresh balance</button>
                </div>
            </div>
        </div>

        <div className="tm-housekeeping">
            <span className="tm-label">Housekeeping</span>
            <p className="tm-hint">Check pending actions if a mint or upload outcome was left unknown. Consolidating returns unused tokens to the treasury and removes the ability to upload until you mint again.</p>
            <div className="tm-actions">
                <button type="button" className="tm-btn tm-btn--secondary" disabled={loading} onClick={() => void utxoStatusUpdate()}>
                    {action === 'check' && <span className="tm-btn__spin" aria-hidden="true" />}
                    {action === 'check' ? 'Checking…' : 'Check pending actions'}
                </button>
                <button type="button" className="tm-btn tm-btn--danger" disabled={blocked} onClick={() => void consolidate()}>
                    {action === 'consolidate' && <span className="tm-btn__spin" aria-hidden="true" />}
                    {action === 'consolidate' ? 'Consolidating…' : 'Consolidate tokens'}
                </button>
            </div>
        </div>

        <details className="tm-details"><summary>API details</summary><p>{API_DETAILS}</p></details>
    </>
}
