import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
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
    getFundingInfo: () => Promise<void>
    createTokens: (tokens: number) => Promise<void>
    utxoStatusUpdate: () => Promise<void>
    consolidate: () => Promise<void>
}
const FundingContext = createContext<FundingContextType | undefined>(undefined)

export function FundingProvider({ children }: { children: ReactNode }) {
    const [fundingInfo, setFundingInfo] = useState<FundingInfo | null>(null)
    const [refreshing, setRefreshing] = useState(true)
    const [action, setAction] = useState<Action | null>(null)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState<NoticeValue | null>(null)
    const running = useRef(false)
    const refreshSequence = useRef(0)

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
        setNotice({ tone: 'loading', title: action === 'mint' ? 'Creating tokens' : action === 'check' ? 'Checking pending actions' : 'Consolidating tokens',
            message: action === 'check' ? 'Checking network acceptance and block confirmations. This may take a moment.' : 'Please wait while we prepare and submit the transaction. Do not repeat this action.' })
        try {
            const data = await requestJson<{ status: string; message: string }>(path)
            setNotice({ tone: data.status === 'pending' ? 'pending' : 'success',
                title: data.status === 'pending' ? 'Still awaiting confirmation' : action === 'mint' ? 'Tokens ready' : action === 'check' ? 'Check complete' : 'Tokens consolidated', message: data.message })
        } catch (error) {
            const uncertain = action !== 'check' && error instanceof ApiError && error.status === 0
            setNotice({ tone: uncertain ? 'pending' : 'error', title: uncertain ? 'Outcome not yet known' : 'Action could not complete',
                message: uncertain ? 'The connection was interrupted. Check pending actions before trying again so the transaction is not repeated.' : errorMessage(error) })
        } finally {
            await getFundingInfo()
            setAction(null)
            running.current = false
        }
    }

    return <FundingContext.Provider value={{ fundingInfo, loading: refreshing || !!action, refreshing, action, error, notice, getFundingInfo,
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
