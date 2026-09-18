export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030'
export const MAX_FILE_BYTES = 10 * 1024 * 1024

export class ApiError extends Error {
    constructor(message: string, public status = 0) { super(message) }
}

function timeout(signal?: AbortSignal) {
    return signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000)
}

export async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
    let response: Response
    try {
        response = await fetch(API_URL + path, { ...options, signal: timeout(options?.signal ?? undefined) })
    } catch { throw new ApiError('We could not reach the service. Check your connection and try again shortly.') }
    let data
    try { data = await response.json() } catch {
        throw new ApiError('The service returned an unexpected response. Please try again shortly.', 0)
    }
    if (!response.ok || data.error) throw new ApiError(data.error || 'This request could not be completed. Please try again.', response.status)
    return data as T
}

export interface IntegrityResult {
    id: string
    txid: string
    fileHash: string
    fileName?: string
    fileType: string
    time: number
    status: 'confirmed' | 'pending' | 'failed'
    matchedFile: boolean
    matchedCommitment: boolean
    broadcast?: boolean
    inBlock?: boolean
    depth?: number | null
    blockHeight?: number | null
    valid: boolean
    downloadAllowed: boolean
    message?: string
    error?: string
}

// A 422 verdict is a result, not a bare error: it still carries the per-check facts the
// checklist renders. Anything else without those facts stays an ApiError.
export async function requestIntegrity(id: string, signal?: AbortSignal): Promise<IntegrityResult> {
    let response: Response
    try {
        response = await fetch(`${API_URL}/integrity/${id}`, { signal: timeout(signal) })
    } catch { throw new ApiError('We could not reach the service. Check your connection and try again shortly.') }
    let data: Partial<IntegrityResult> & { error?: string }
    try { data = await response.json() } catch {
        throw new ApiError('The service returned an unexpected response. Please try again shortly.', 0)
    }
    const hasVerdict = typeof data?.matchedFile === 'boolean'
    if (!response.ok && !(response.status === 422 && hasVerdict)) {
        throw new ApiError(data?.error || 'This request could not be completed. Please try again.', response.status)
    }
    return data as IntegrityResult
}

export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Something went wrong. Please try again shortly.'
}

export function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString()} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
