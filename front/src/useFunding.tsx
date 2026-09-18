import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { ApiError, errorMessage, requestJson } from './api'
import type { NoticeValue } from './components/Notice'

export interface FundingInfo { address: string; balance: number; tokens: number; pending: number }
type Action = 'mint' | 'check' | 'consolidate'

interface FundingContextType {
    fundingInfo: FundingInfo | null
    loading: boolean
    refreshing: boolean
    action: Action | null
    error: string
    notice: NoticeValue | null
    treasuryOpen: boolean
    openTreasury: () => void
    closeTreasury: () => void
    toggleTreasury: () => void
    getFundingInfo: () => Promise<void>
    createTokens: (tokens: number) => Promise<void>
    utxoStatusUpdate: () => Promise<void>
    consolidate: () => Promise<void>
}
const FundingContext = createContext<FundingContextType | undefined>(undefined)

const RUNNING: Record<Action, { title: string; message: string }> = {
    mint: { title: 'Creating write tokens', message: 'Building and broadcasting the funding transaction.' },
    check: { title: 'Checking pending actions', message: 'Reading network acceptance and block confirmations. This can take a moment.' },
    consolidate: { title: 'Consolidating tokens', message: 'Returning unused write tokens to the treasury.' },
}
const SETTLED: Record<Action, { done: string; pending: string }> = {
    mint: { done: 'Tokens ready', pending: 'Tokens created, acceptance pending' },
    check: { done: 'Check complete', pending: 'Still awaiting confirmation' },
    consolidate: { done: 'Tokens consolidated', pending: 'Consolidation pending' },
}

export function FundingProvider({ children }: { children: ReactNode }) {
    const [fundingInfo, setFundingInfo] = useState<FundingInfo | null>(null)
    const [refreshing, setRefreshing] = useState(true)
    const [action, setAction] = useState<Action | null>(null)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState<NoticeValue | null>(null)
    const [treasuryOpen, setTreasuryOpen] = useState(false)
    const running = useRef(false)
    const refreshSequence = useRef(0)

    // Kept free of synchronous state writes so the mount effect below can call it directly.
    const loadFundingInfo = useCallback(() => {
        const sequence = ++refreshSequence.current
        return requestJson<FundingInfo>('/checkTreasury').then(data => {
            if (typeof data.address !== 'string' || !Number.isFinite(data.balance) || !Number.isFinite(data.tokens)) {
                throw new Error('Treasury information is incomplete. Please refresh it shortly.')
            }
            if (sequence !== refreshSequence.current) return
            setFundingInfo({ ...data, pending: data.pending || 0 })
            setError('')
        }).catch(error => {
            if (sequence === refreshSequence.current) setError(errorMessage(error))
        }).finally(() => { if (sequence === refreshSequence.current) setRefreshing(false) })
    }, [])

    const getFundingInfo = useCallback(async () => {
        setRefreshing(true)
        await loadFundingInfo()
    }, [loadFundingInfo])

    useEffect(() => {
        const refresh = refreshSequence
        void loadFundingInfo()
        return () => { refresh.current++ }
    }, [loadFundingInfo])

    const runAction = async (action: Action, path: string) => {
        if (running.current) return
        running.current = true
        setAction(action)
        setNotice({ tone: 'loading', ...RUNNING[action] })
        try {
            const data = await requestJson<{ status: string; message: string }>(path)
            const pending = data.status === 'pending'
            setNotice({ tone: pending ? 'pending' : 'success',
                title: pending ? SETTLED[action].pending : SETTLED[action].done, message: data.message })
        } catch (error) {
            // A dropped connection on a spending action is an unknown outcome, never a failure:
            // repeating it could broadcast the same transaction twice.
            const uncertain = action !== 'check' && error instanceof ApiError && error.status === 0
            setNotice(uncertain
                ? { tone: 'pending', title: 'Outcome not yet known',
                    message: 'The connection dropped while the action was running. Check pending actions before you try again.' }
                : { tone: 'error', title: 'Action could not complete', message: errorMessage(error) })
        } finally {
            await getFundingInfo()
            setAction(null)
            running.current = false
        }
    }

    const openTreasury = useCallback(() => setTreasuryOpen(true), [])
    const closeTreasury = useCallback(() => setTreasuryOpen(false), [])
    const toggleTreasury = useCallback(() => setTreasuryOpen(open => !open), [])

    return <FundingContext.Provider value={{
        fundingInfo, loading: refreshing || !!action, refreshing, action, error, notice,
        treasuryOpen, openTreasury, closeTreasury, toggleTreasury, getFundingInfo,
        createTokens: tokens => runAction('mint', '/fund/' + tokens),
        utxoStatusUpdate: () => runAction('check', '/utxoStatusUpdate'),
        consolidate: () => runAction('consolidate', '/consolidate'),
    }}>{children}</FundingContext.Provider>
}

// This module intentionally exports both the provider and its consumer hook.
// eslint-disable-next-line react-refresh/only-export-components
export function useFunding(): FundingContextType {
    const context = useContext(FundingContext)
    if (!context) throw new Error('useFunding must be used within a FundingProvider')
    return context
}
