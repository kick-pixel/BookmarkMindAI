export const CLOUD_CONFIG = {
  apiBaseUrl: 'https://api.bookmarkmind.ai',
  apiVersion: 'v1',
  tokenKey: 'bai_cloud_token',
  tokenRefreshThresholdMs: 5 * 60 * 1000,
  syncPollIntervalMs: 10 * 60 * 1000,
  syncPushDebounceMs: 5000,
  maxRetryAttempts: 3,
  retryBackoffMs: [1000, 2000, 4000],
}

export function getApiBaseUrl(): string {
  return `${CLOUD_CONFIG.apiBaseUrl}/api/${CLOUD_CONFIG.apiVersion}`
}
