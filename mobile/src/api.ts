import Constants from 'expo-constants'
import { Platform } from 'react-native'
import type { AuthSession } from './types'

const requestTimeoutMs = 20_000

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/+$/, '').replace(/\/api$/, '')
}

export function defaultApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL
  if (configured?.trim()) return normalizeApiUrl(configured)

  const legacyExperienceUrl = (Constants as typeof Constants & { experienceUrl?: string }).experienceUrl
  const hostUri = Constants.expoConfig?.hostUri || legacyExperienceUrl?.replace(/^\w+:\/\//, '')
  const host = hostUri?.split(':')[0]
  if (host) return `http://${host}:4000`
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000'
  return 'http://127.0.0.1:4000'
}

export function sessionFromAuth(token: string, user: AuthSession['user']): AuthSession {
  let expiresAt: number | undefined
  try {
    const segment = token.split('.')[1]
    if (segment) {
      const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
      const payload = JSON.parse(globalThis.atob(padded)) as { exp?: number }
      expiresAt = payload.exp ? payload.exp * 1000 : undefined
    }
  } catch {
    expiresAt = undefined
  }
  return { token, user, expiresAt }
}

export function isSessionExpired(session: AuthSession) {
  return Boolean(session.expiresAt && session.expiresAt <= Date.now() + 10_000)
}

export function mediaUrl(apiUrl: string, source?: string) {
  if (!source) return `${apiUrl}/images/hero-catering.png`
  if (/^(data:|https?:\/\/)/i.test(source)) return source
  return `${apiUrl}${source.startsWith('/') ? source : `/${source}`}`
}

export function documentUrl(apiUrl: string, documentId: string, token: string, inline = true) {
  const disposition = inline ? '&disposition=inline' : ''
  return `${apiUrl}/api/documents/${encodeURIComponent(documentId)}/download?token=${encodeURIComponent(token)}${disposition}`
}

export async function apiRequest<T>(
  apiUrl: string,
  path: string,
  options: { body?: unknown; method?: string; token?: string; signal?: AbortSignal } = {},
) {
  const timeout = new AbortController()
  const timeoutId = setTimeout(() => timeout.abort(), requestTimeoutMs)
  const signal = options.signal || timeout.signal
  try {
    const response = await fetch(`${normalizeApiUrl(apiUrl)}/api${path}`, {
      method: options.method || (options.body !== undefined ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal,
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      throw new ApiError(payload?.message || `Request failed (${response.status})`, response.status)
    }
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Check the local API address.', 408)
    }
    throw new ApiError('Cannot reach FeastFlow API. Check that the API is running and this phone is on the same Wi-Fi.', 0)
  } finally {
    clearTimeout(timeoutId)
  }
}
