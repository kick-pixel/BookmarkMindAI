import { CLOUD_CONFIG } from './config'
import { cloud } from './client'

export interface CloudUser {
  id: string
  email: string
  tier: 'free' | 'pro' | 'unlimited'
  subscriptionStatus: 'inactive' | 'active' | 'past_due' | 'canceled'
}

export async function loginWithGoogle(): Promise<boolean> {
  try {
    const redirectUri = chrome.identity.getRedirectURL('/auth/callback')
    const authUrl = `${CLOUD_CONFIG.apiBaseUrl}/api/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    })

    if (!responseUrl) return false

    const params = new URLSearchParams(responseUrl.split('#')[1] ?? responseUrl.split('?')[1] ?? '')
    const token = params.get('token')
    if (!token) return false

    await chrome.storage.local.set({ [CLOUD_CONFIG.tokenKey]: token })
    return true
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  await chrome.storage.local.remove(CLOUD_CONFIG.tokenKey)
}

export async function getCloudUser(): Promise<CloudUser | null> {
  const response = await cloud.get<CloudUser>('/user')
  if (!response.ok) return null
  return response.data ?? null
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(CLOUD_CONFIG.tokenKey)
    return Boolean(result[CLOUD_CONFIG.tokenKey])
  } catch {
    return false
  }
}
