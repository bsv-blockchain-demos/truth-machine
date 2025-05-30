import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react'

export interface FundingInfo {
    address: string
    balance: number
    tokens: number
}

interface FundingContextType {
    fundingInfo: FundingInfo
    loading: boolean
    getFundingInfo: () => Promise<void>
    createTokens: (tokens: number) => Promise<void>
    utxoStatusUpdate: () => Promise<void>
}

const FundingContext = createContext<FundingContextType | undefined>(undefined)

interface FundingProviderProps {
    children: ReactNode
}

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3030'

export const FundingProvider: React.FC<FundingProviderProps> = ({ children }) => {
    const [fundingInfo, setFundingInfo] = useState<FundingInfo>({ address: '', balance: 0, tokens: 0 })
    const [loading, setLoading] = useState<boolean>(true)

    /**
     * Fetch current treasury status.
     * Updates the fundingInfo state with latest treasury information.
     * @throws {Error} When API call fails.
     */
    const getFundingInfo = async () => {
        try {
            setLoading(true)
            const response = await fetch(API_URL + '/checkTreasury')
            const { address, balance, tokens } = await response.json()
            console.log({ address, balance, tokens })
            setFundingInfo({ address, balance, tokens })
        } catch (error) {
            console.error('Failed to fetch funding info', error)
        } finally {
            setLoading(false)
        }
    }

    /**
     * Create new write tokens in the treasury
     * @param {number} tokens - Number of tokens to create
     * @throws {Error} When token creation fails
     */
    async function createTokens(tokens: number) {
        try {
            setLoading(true)
            const response = await (await fetch(API_URL + '/fund/' + String(tokens))).json()
            console.log({ response })
            await getFundingInfo()
        } catch (error) {
            console.error('Failed to create funds', error)
        } finally {
            setLoading(false)
        }
    }

    async function utxoStatusUpdate() {
        try {
            const response = await (await fetch(API_URL + '/utxoStatusUpdate')).json()
            console.info('UTXO Status Update: ', response)
            if(response.success && response.updated.length > 0) {
                await getFundingInfo()
            }
        } catch (error) {
            console.error('Failed to update UTXO status', error)
        }
    }

    const contextValue = useMemo(() => ({ fundingInfo, loading, getFundingInfo, createTokens, utxoStatusUpdate }), [fundingInfo, loading, getFundingInfo, createTokens, utxoStatusUpdate])

    return (
        <FundingContext.Provider value={contextValue}>
            {children}
        </FundingContext.Provider>
    )
}

export const useFunding = (): FundingContextType => {
    const context = useContext(FundingContext)
    if (context === undefined) {
        throw new Error('useFunding must be used within a FundingProvider')
    }
    return context
}