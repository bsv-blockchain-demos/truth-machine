import { useState, useEffect, useCallback, useRef } from 'react'
import Upload from './Upload'
import Download, { type DownloadHandle } from './Download'
import Funding from './Funding'
import './App.css'
import { FundingProvider, useFunding } from './useFunding'
import seal from './assets/truth-machine-seal.svg'
import { IconThemeLight, IconThemeAuto, IconThemeDark, IconGitHub, IconBsvMark } from './components/icons'

type ThemeMode = 'light' | 'auto' | 'dark'
const THEME_ORDER: ThemeMode[] = ['light', 'auto', 'dark']
const THEME_ICON = { light: IconThemeLight, auto: IconThemeAuto, dark: IconThemeDark }

function applyTheme(mode: ThemeMode) {
    const dark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

function ThemeButton() {
    const [mode, setMode] = useState<ThemeMode>(() => {
        try {
            const stored = localStorage.getItem('tm-theme')
            if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
        } catch { /* localStorage unavailable */ }
        return 'auto'
    })

    useEffect(() => {
        applyTheme(mode)
        try { localStorage.setItem('tm-theme', mode) } catch { /* localStorage unavailable */ }
        if (mode !== 'auto') return
        // Only auto tracks the system: an explicit choice must survive the OS changing under it.
        const query = window.matchMedia('(prefers-color-scheme: dark)')
        const onChange = () => applyTheme('auto')
        query.addEventListener('change', onChange)
        return () => query.removeEventListener('change', onChange)
    }, [mode])

    const next = THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length]
    const Icon = THEME_ICON[mode]
    return (
        <button type="button" className="tm-theme-btn" data-mode={mode}
            aria-label={`Colour theme: ${mode}. Switch to ${next}`}
            onClick={() => setMode(next)}>
            <Icon />
        </button>
    )
}

function TreasuryPill() {
    const { fundingInfo, error, treasuryOpen, toggleTreasury } = useFunding()
    const tone = error ? 'fail' : !fundingInfo ? 'idle' : fundingInfo.tokens === 0 ? 'warn' : 'ok'
    const showValue = !!fundingInfo || !!error
    const value = error ? 'Unavailable' : fundingInfo ? fundingInfo.balance.toLocaleString() : ''
    const badge = error ? 'Retry check'
        : !fundingInfo ? 'Checking'
            : fundingInfo.tokens === 0 ? '0 tokens · add some'
                : `${fundingInfo.tokens.toLocaleString()} tokens`
    const description = error ? 'Treasury unavailable'
        : fundingInfo ? `Treasury: ${fundingInfo.balance.toLocaleString()} satoshis, ${fundingInfo.tokens.toLocaleString()} write tokens`
            : 'Treasury: checking'

    return (
        <button type="button" className={`tm-pill tm-pill--${tone}`} id="tm-pill"
            aria-expanded={treasuryOpen} aria-controls="tm-drawer"
            aria-label={`${description}. ${treasuryOpen ? 'Close' : 'Open'} the treasury panel`}
            onClick={toggleTreasury}>
            <span className="tm-dot" />
            <span className="tm-pill__label">Treasury</span>
            {showValue && <span className={`tm-pill__val${error ? ' tm-pill__val--txt' : ''}`}>{value}</span>}
            {!error && fundingInfo && <span className="tm-pill__unit">sats</span>}
            <span className="tm-pill__badge">{badge}</span>
        </button>
    )
}

function scrollToStage(id: string) {
    const target = document.getElementById(id)
    if (!target) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 100, behavior: reduce ? 'auto' : 'smooth' })
}

function Page() {
    const { treasuryOpen, closeTreasury } = useFunding()
    const [uploadComplete, setUploadComplete] = useState(false)
    const [verifyStatus, setVerifyStatus] = useState<'idle' | 'active' | 'done'>('idle')
    const downloadRef = useRef<DownloadHandle>(null)

    // The drawer is ordinary page content rather than a dialog, so it needs no focus trap.
    // Escape still closes it, because that is what a reader who opened it will reach for.
    useEffect(() => {
        if (!treasuryOpen) return
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeTreasury() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [treasuryOpen, closeTreasury])

    const onVerify = useCallback((id: string) => {
        void downloadRef.current?.verify(id)
        scrollToStage('stage-verify')
    }, [])

    const uploadStep = uploadComplete ? 'done' : 'active'
    const verifyStep = verifyStatus === 'done' ? 'done'
        : uploadComplete || verifyStatus === 'active' ? 'active' : 'upcoming'

    const steps: { key: string; stage: string; title: string; description: string; state: string }[] = [
        { key: '1', stage: 'stage-upload', title: 'Upload', description: 'Save the fingerprint', state: uploadStep },
        { key: '2', stage: 'stage-verify', title: 'Verify', description: 'Check and download', state: verifyStep },
    ]

    return (
        <div className="tm-app">
            <header className="tm-header">
                <div className="tm-shell tm-header__in">
                    <div className="tm-brand">
                        <img src={seal} width="44" height="44" alt="Truth Machine seal" />
                        <div>
                            <h1>Truth Machine</h1>
                            <p className="tm-label">Data integrity &amp; timestamping</p>
                        </div>
                    </div>
                    <div className="tm-header__right">
                        <ThemeButton />
                        <TreasuryPill />
                    </div>
                </div>

                <div className="tm-drawer" id="tm-drawer" data-open={treasuryOpen}>
                    <div className="tm-shell tm-drawer__in">
                        <div className="tm-drawer__head">
                            <div>
                                <h2>Treasury</h2>
                                <p className="tm-hint">The demo pays its own transaction fees. Deposit BSV, then mint write tokens. One token covers one upload. You only need this when tokens run out.</p>
                            </div>
                            <button type="button" className="tm-action" onClick={closeTreasury}>Close</button>
                        </div>
                        <div className="tm-panel"><Funding /></div>
                    </div>
                </div>
            </header>

            <section className="tm-shell tm-hero">
                <div>
                    <span className="tm-badge"><span className="tm-dot" />Live demo on the BSV blockchain</span>
                    <h2 className="tm-hero__headline">Proof that a file existed <em>before a given block,</em> byte for byte.</h2>
                    <p className="tm-hero__sub">Upload a file and its fingerprint is written to the BSV blockchain. Anyone holding the transaction ID or the fingerprint can check the file against that record later. It does not prove who made the file, when it was made, or that its contents are true.</p>
                </div>
            </section>

            <div className="tm-shell tm-flow">
                <nav className="tm-rail" aria-label="Progress">
                    {steps.map(step => (
                        <button type="button" key={step.key} className="tm-rail__step" data-s={step.state}
                            aria-current={step.state === 'active' ? 'step' : undefined}
                            onClick={() => scrollToStage(step.stage)}>
                            <span className="tm-rail__num">{step.key}</span>
                            <span>
                                <span className="tm-rail__t">{step.title}</span>
                                <span className="tm-rail__d">{step.description}</span>
                            </span>
                        </button>
                    ))}
                </nav>

                <main className="tm-stages">
                    <section className="tm-stage" id="stage-upload" aria-labelledby="h-upload">
                        <div className="tm-stage__head">
                            <h2 id="h-upload">1. Upload a file</h2>
                            <span className="tm-label">Spends one write token</span>
                        </div>
                        <p className="tm-hint tm-stage__intro">The file&rsquo;s SHA-256 fingerprint goes on-chain; the bytes are stored so the file can be handed back and re-checked.</p>
                        <div className="tm-panel">
                            <Upload
                                onUploadComplete={() => setUploadComplete(true)}
                                onSelectionChange={() => setUploadComplete(false)}
                                onVerify={onVerify} />
                        </div>
                    </section>

                    <section className="tm-stage" id="stage-verify" aria-labelledby="h-verify">
                        <div className="tm-stage__head">
                            <h2 id="h-verify">2. Verify &amp; download</h2>
                            <span className="tm-label">Free, no token needed</span>
                        </div>
                        <p className="tm-hint tm-stage__intro">Paste a transaction ID or fingerprint to see which of the four checks pass, and to download the original bytes.</p>
                        <div className="tm-panel">
                            <Download ref={downloadRef} onStatusChange={setVerifyStatus} />
                        </div>
                    </section>
                </main>
            </div>

            <section className="tm-shell tm-about">
                <div className="tm-about__lead">
                    <h3>About this demo</h3>
                    <p>Truth Machine is a proof of concept by the BSV Association. When you upload a file, the server computes its SHA-256 fingerprint, writes that fingerprint into an OP_RETURN output of a BSV transaction, and stores the bytes alongside the transaction in BEEF format. Verification recomputes the fingerprint, compares it to the on-chain commitment, and checks a Merkle proof against block headers.</p>
                </div>
                <dl>
                    <div>
                        <dt>Write tokens</dt>
                        <dd>The treasury is split into 13-satoshi outputs. One upload spends one token. Minting, checking pending actions and consolidating live in the treasury panel, opened from the header.</dd>
                    </div>
                    <div>
                        <dt>Pending is not failure</dt>
                        <dd>A pending outcome means the result is not yet known. Check the status rather than repeating a transaction that may already have gone through.</dd>
                    </div>
                    <div>
                        <dt>Limits</dt>
                        <dd>Files up to 10 MB. No accounts and no private storage, so treat everything uploaded here as public.</dd>
                    </div>
                </dl>
            </section>

            <footer className="tm-shell tm-footer">
                <div className="tm-footer__l">
                    <span>&copy; {new Date().getFullYear()}</span>
                    <span className="tm-footer__mark"><IconBsvMark /></span>
                    <a className="tm-footer__org" href="https://bsvassociation.org/"
                        target="_blank" rel="noopener noreferrer">BSV Association.</a>
                    <span>A Swiss non-profit association.</span>
                </div>
                <div className="tm-footer__r">
                    <span>Truth Machine, an open source proof of concept, powered by BSV.</span>
                    <a href="https://github.com/bsv-blockchain-demos/truth-machine" target="_blank" rel="noopener noreferrer"
                        aria-label="View source on GitHub"><IconGitHub size={18} /></a>
                </div>
            </footer>
        </div>
    )
}

export default function App() {
    return <FundingProvider><Page /></FundingProvider>
}
