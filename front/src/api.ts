export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030'
export const MAX_FILE_BYTES = 10 * 1024 * 1024

export class ApiError extends Error {
    constructor(message: string, public status = 0) { super(message) }
}

export async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
    let response: Response
    try {
        response = await fetch(API_URL + path, { ...options, signal: options?.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000) })
    } catch { throw new ApiError('We could not reach the service. Check your connection and try again shortly.') }
    let data
    try { data = await response.json() } catch {
        throw new ApiError('The service returned an unexpected response. Please try again shortly.', 0)
    }
    if (!response.ok || data.error) throw new ApiError(data.error || 'This request could not be completed. Please try again.', response.status)
    return data as T
}

export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Something went wrong. Please try again shortly.'
}
