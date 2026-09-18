import { useEffect, useState } from 'react'
import { QRCodeSVG } from "qrcode.react"
import { useFunding } from './useFunding'
import Notice from './components/Notice'

interface FundingProps {
    onClose: () => void
}

export default function Funding({ onClose }: FundingProps) {
    const { getFundingInfo, fundingInfo, loading, refreshing, action, error, notice, createTokens, utxoStatusUpdate, consolidate } = useFunding()
    const [tokenNumber, setTokenNumber] = useState(1)

    useEffect(() => {
        getFundingInfo()
    }, [getFundingInfo])

    const decrement = () => setTokenNumber(n => Math.max(1, n - 1))
    const increment = () => setTokenNumber(n => Math.min(1000, n + 1))

    return (
        <div className="tm-modal__shell">
            <div className="tm-modal__header">
                <div className="tm-modal__title-group">
                    <span className="tm-modal__icon">◆</span>
                    <div>
                        <div className="tm-modal__title">Treasury</div>
                        <div className="tm-modal__subtitle">Fund Write Actions</div>
                    </div>
                </div>
                <button className="tm-modal__close" onClick={onClose} aria-label="Close">×</button>
            </div>

            <div className="tm-modal__inner" style={{ position: 'relative' }}>
                {notice && <Notice {...notice} />}
                {error && <Notice tone="error" title="Treasury unavailable" message={`${error}${fundingInfo ? ' The figures below are from the last successful check.' : ''}`} />}
                {refreshing && !action && <Notice tone="loading" title="Refreshing treasury" message="Checking the latest balance and available tokens." />}
                {!fundingInfo ? (
                    <button className="tm-btn tm-btn--secondary" disabled={loading} onClick={getFundingInfo}>Retry treasury check</button>
                ) : (
                    <>
                        <div className="tm-modal__stats">
                            <div className="tm-stat-card tm-stat-card--pass">
                                <span className="tm-stat-card__label">Wallet Balance</span>
                                <span className="tm-stat-card__value">{fundingInfo ? fundingInfo.balance.toLocaleString() : 'Unavailable'}</span>
                                <span className="tm-stat-card__unit">satoshis</span>
                            </div>
                            <div className={`tm-stat-card ${!fundingInfo || fundingInfo.tokens === 0 ? 'tm-stat-card--warn' : 'tm-stat-card--pass'}`}>
                                <span className="tm-stat-card__label">Tokens Ready</span>
                                <span className="tm-stat-card__value">{fundingInfo ? fundingInfo.tokens.toLocaleString() : 'Unavailable'}</span>
                                <span className="tm-stat-card__unit">available</span>
                            </div>
                        </div>

                        <div className="tm-modal__section">
                            <span className="tm-modal__section-label">Deposit Address</span>
                            <div className="tm-modal__deposit">
                                {fundingInfo && <QRCodeSVG value={fundingInfo.address} marginSize={2} width={140} />}
                                <span className="tm-modal__address">{fundingInfo ? fundingInfo.address : 'Unavailable'}</span>
                            </div>
                        </div>

                        {fundingInfo.tokens === 0 && <Notice tone="pending" title="No write tokens available" message="Mint tokens below to enable uploads. Each upload uses one token." />}
                        {fundingInfo.pending > 0 && <Notice tone="pending" title="Actions awaiting confirmation" message={`${fundingInfo.pending} action(s) need a status check. Check pending actions before repeating them.`} />}
                        <div className="tm-modal__section">
                            <span className="tm-modal__section-label">Mint Tokens</span>
                            <div className="tm-modal__mint">
                                <div className="tm-stepper">
                                    <button className="tm-stepper__btn" onClick={decrement} aria-label="Decrease" disabled={loading || !!error}>−</button>
                                    <input
                                        type="number"
                                        aria-label="Number of tokens"
                                        disabled={loading || !!error}
                                        min="1"
                                        max="1000"
                                        className="tm-stepper__input"
                                        value={tokenNumber}
                                        onChange={(e) => setTokenNumber(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                                    />
                                    <button className="tm-stepper__btn" onClick={increment} aria-label="Increase" disabled={loading || !!error}>+</button>
                                </div>
                                <button className="tm-btn tm-btn--primary" onClick={() => createTokens(tokenNumber)} disabled={loading || !!error}>
                                    {action === 'mint' ? 'Creating tokens...' : `Mint ${tokenNumber} Token${tokenNumber !== 1 ? 's' : ''}`}
                                </button>
                            </div>
                        </div>

                        <button className="tm-btn tm-btn--secondary" disabled={loading} onClick={getFundingInfo}>Refresh balance</button>
                        <p className="tm-form-helper">Consolidation returns confirmed, unused tokens to the treasury after a network fee. Those tokens will no longer be available for uploads.</p>
                        <div className="tm-modal__footer">
                            <button className="tm-btn tm-btn--secondary" onClick={utxoStatusUpdate} disabled={loading}>{action === 'check' ? 'Checking...' : 'Check pending actions'}</button>
                            <button className="tm-btn tm-btn--secondary" onClick={consolidate} disabled={loading || !!error}>{action === 'consolidate' ? 'Consolidating...' : 'Consolidate Tokens'}</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
