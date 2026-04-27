import { useEffect, useState } from 'react'
import { QRCodeSVG } from "qrcode.react"
import { useFunding } from './useFunding'

interface FundingProps {
    onClose: () => void
}

export default function Funding({ onClose }: FundingProps) {
    const { getFundingInfo, fundingInfo, loading, createTokens, utxoStatusUpdate, consolidate } = useFunding()
    const [tokenNumber, setTokenNumber] = useState(1)

    useEffect(() => {
        getFundingInfo()
    }, [])

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
                {loading && (
                    <div className="tm-modal__loading-overlay">
                        <span className="tm-spinner" />
                    </div>
                )}

                {!loading && !fundingInfo ? (
                    <div className="tm-loading">Error loading funding info.</div>
                ) : (
                    <>
                        <div className="tm-modal__stats">
                            <div className="tm-stat-card tm-stat-card--pass">
                                <span className="tm-stat-card__label">Wallet Balance</span>
                                <span className="tm-stat-card__value">{fundingInfo ? fundingInfo.balance.toLocaleString() : '—'}</span>
                                <span className="tm-stat-card__unit">satoshis</span>
                            </div>
                            <div className={`tm-stat-card ${!fundingInfo || fundingInfo.tokens === 0 ? 'tm-stat-card--warn' : 'tm-stat-card--pass'}`}>
                                <span className="tm-stat-card__label">Tokens Ready</span>
                                <span className="tm-stat-card__value">{fundingInfo ? fundingInfo.tokens.toLocaleString() : '—'}</span>
                                <span className="tm-stat-card__unit">available</span>
                            </div>
                        </div>

                        <div className="tm-modal__section">
                            <span className="tm-modal__section-label">Deposit Address</span>
                            <div className="tm-modal__deposit">
                                {fundingInfo && <QRCodeSVG value={fundingInfo.address} marginSize={2} width={140} />}
                                <span className="tm-modal__address">{fundingInfo ? fundingInfo.address : '—'}</span>
                            </div>
                        </div>

                        <div className="tm-modal__section">
                            <span className="tm-modal__section-label">Mint Tokens</span>
                            <div className="tm-modal__mint">
                                <div className="tm-stepper">
                                    <button className="tm-stepper__btn" onClick={decrement} aria-label="Decrease">−</button>
                                    <input
                                        type="number"
                                        min="1"
                                        max="1000"
                                        className="tm-stepper__input"
                                        value={tokenNumber}
                                        onChange={(e) => setTokenNumber(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                                    />
                                    <button className="tm-stepper__btn" onClick={increment} aria-label="Increase">+</button>
                                </div>
                                <button className="tm-btn tm-btn--primary" onClick={() => createTokens(tokenNumber)} disabled={loading}>
                                    Mint {tokenNumber} Token{tokenNumber !== 1 ? 's' : ''}
                                </button>
                            </div>
                        </div>

                        <div className="tm-modal__footer">
                            <button className="tm-btn tm-btn--secondary" onClick={utxoStatusUpdate} disabled={loading}>Check Token Balance</button>
                            <button className="tm-btn tm-btn--secondary" onClick={consolidate} disabled={loading}>Consolidate Tokens</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
