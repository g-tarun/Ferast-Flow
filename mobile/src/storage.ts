import * as SecureStore from 'expo-secure-store'
import type { AuthSession } from './types'

const sessionKey = 'feastflow.auth.session.v1'
const endpointKey = 'feastflow.api.endpoint.v1'

export async function loadSession() {
  const value = await SecureStore.getItemAsync(sessionKey)
  if (!value) return null
  try {
    return JSON.parse(value) as AuthSession
  } catch {
    await SecureStore.deleteItemAsync(sessionKey)
    return null
  }
}

export async function saveSession(session: AuthSession) {
  await SecureStore.setItemAsync(sessionKey, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(sessionKey)
}

export async function loadApiEndpoint() {
  return SecureStore.getItemAsync(endpointKey)
}

export async function saveApiEndpoint(endpoint: string) {
  await SecureStore.setItemAsync(endpointKey, endpoint)
}
