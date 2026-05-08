import { cloud } from './client'
import { isAuthenticated } from './auth'

export interface LicenseInfo {
  tier: 'free' | 'pro' | 'unlimited'
  canUseCloudAI: boolean
  aiCallsUsed: number
  aiCallsLimit: number
  resetAt: string
}

export async function getLicenseInfo(): Promise<LicenseInfo | null> {
  if (!await isAuthenticated()) return null

  const response = await cloud.get<LicenseInfo>('/usage')
  if (!response.ok) return null
  return response.data ?? null
}

export async function canUseCloudAI(): Promise<boolean> {
  const license = await getLicenseInfo()
  return license?.canUseCloudAI ?? false
}
