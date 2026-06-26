import { useState, useRef, useEffect } from 'react'
import Upload from './Upload'
import Download from './Download'
import './App.css'
import Funding from './Funding'
import { FundingProvider, useFunding } from './useFunding'
import seal from './assets/truth-machine-seal.svg'

function TreasuryPill() {
    const { fundingInfo } = useFunding()
    const [isOpen, setIsOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') setIsOpen(false)
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('keydown', handleEscape)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen])

    return (
        <div className="tm-treasury-pill-wrapper" ref={wrapperRef}>
            <button className={`tm-treasury-pill ${fundingInfo.tokens === 0 ? 'tm-treasury-pill--warn' : 'tm-treasury-pill--ok'}`} onClick={() => setIsOpen(o => !o)}>
                <span className="tm-treasury-pill__icon">◆</span>
                <span className="tm-treasury-pill__label">TREASURY:</span>
                <span className="tm-treasury-pill__stat">{fundingInfo.balance.toLocaleString()}</span>
                <span className="tm-treasury-pill__unit">SATS</span>
                <span className="tm-treasury-pill__sep">|</span>
                <span className={`tm-treasury-pill__badge ${fundingInfo.tokens === 0 ? 'tm-treasury-pill__badge--warn' : 'tm-treasury-pill__badge--ok'}`}>
                    {fundingInfo.tokens.toLocaleString()} tokens
                </span>
            </button>

            {isOpen && (
                <>
                    <div className="tm-modal-backdrop" />
                    <div className="tm-modal">
                        <Funding onClose={() => setIsOpen(false)} />
                    </div>
                </>
            )}
        </div>
    )
}

type Theme = 'light' | 'dark'

function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>(
        () => (document.documentElement.getAttribute('data-theme') as Theme) || 'light'
    )

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        try { localStorage.setItem('tm-theme', theme) } catch { /* localStorage unavailable */ }
    }, [theme])

    const isDark = theme === 'dark'

    return (
        <button
            className="tm-theme-toggle"
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
        >
            {isDark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
            ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            )}
        </button>
    )
}

function App() {
    const [uploadComplete, setUploadComplete] = useState(false)

    return (
        <FundingProvider>
            <div className="tm-app">
                <header className="tm-header">
                    <div className="tm-header__left">
                        <img src={seal} alt="Truth Machine seal" />
                        <div className="tm-header__text">
                            <h1>Truth Machine</h1>
                            <h2 className="subtitle">Data Integrity &amp; Timestamping</h2>
                        </div>
                    </div>
                    <div className="tm-header__right">
                        <ThemeToggle />
                        <TreasuryPill />
                    </div>
                </header>

                <section className="tm-hero">
                    <span className="tm-hero__badge">
                        <span className="tm-hero__dot" />
                        LIVE DEMO ON BSV BLOCKCHAIN
                    </span>
                    <h2 className="tm-hero__headline">
                        Proof that a file existed <em>here,</em> <em>now,</em> and <em>exactly as it is.</em>
                    </h2>
                    <p className="tm-hero__sub">
                        Upload a file. Its cryptographic hash is written to the BSV blockchain. An immutable, timestamped record anyone can verify.
                    </p>
                </section>

                <main className="tm-app__sections">
                    <section className="tm-section">
                        <div className="tm-section__header">
                            <div className={`tm-step ${uploadComplete ? 'tm-step--done' : 'tm-step--active'}`}>
                                <span className="tm-step__number">{uploadComplete ? '✓' : '1'}</span>
                            </div>
                            <h2 className="tm-section__title">Upload File</h2>
                        </div>
                        <Upload onUploadComplete={() => setUploadComplete(true)} />
                    </section>

                    <section className="tm-section">
                        <div className="tm-section__header">
                            <div className={`tm-step ${uploadComplete ? 'tm-step--active' : 'tm-step--upcoming'}`}>
                                <span className="tm-step__number">2</span>
                            </div>
                            <h2 className="tm-section__title">Verify &amp; Download</h2>
                        </div>
                        <Download />
                    </section>
                </main>

                <section className="tm-about">
                    <h3 className="tm-about__title">About this demo</h3>
                    <p className="tm-about__text">
                        This application is intended to demonstrate the methodology for secure data integrity and timestamping on the BSV Blockchain. Upload a file, and its cryptographic hash is recorded on the blockchain, creating an immutable proof of existence at that exact time. Files are stored in a regular database and can be retrieved later with verifiable evidence of their creation date and integrity. The Treasury section enables token creation to fund transaction fees for the service. It ensures operational costs are covered and displays a balance of available write actions.
                    </p>
                </section>

                <footer className="tm-footer">
                    <div className="tm-footer__left">
                        <img src={seal} alt="Truth Machine" className="tm-footer__logo" />
                        <span className="tm-footer__name">Truth Machine</span>
                    </div>
                    <a
                        href="https://github.com/bsv-blockchain-demos/truth-machine"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tm-footer__github"
                        aria-label="View source on GitHub"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                        </svg>
                    </a>
                </footer>
            </div>
        </FundingProvider>
    )
}

export default App
