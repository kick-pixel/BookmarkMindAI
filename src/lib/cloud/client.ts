import { getApiBaseUrl, CLOUD_CONFIG } from './config'

interface CloudResponse<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: string
}

async function getToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(CLOUD_CONFIG.tokenKey)
    return (result[CLOUD_CONFIG.tokenKey] as string | undefined) ?? null
  } catch {
    return null
  }
}

async function fetchWithAuth(
  path: string,
  init?: RequestInit,
): Promise<CloudResponse> {
  const token = await getToken()
  const url = `${getApiBaseUrl()}${path}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const response = await fetch(url, {
      ...init,
      headers,
    })

    if (response.status === 401) {
      return { ok: false, status: 401, error: 'Unauthorized' }
    }

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data?.error ?? response.statusText,
      }
    }

    return { ok: true, status: response.status, data }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}

export const cloud = {
  get: <T = unknown>(path: string) => fetchWithAuth(path, { method: 'GET' }) as Promise<CloudResponse<T>>,
  post: <T = unknown>(path: string, body: unknown) =>
    fetchWithAuth(path, { method: 'POST', body: JSON.stringify(body) }) as Promise<CloudResponse<T>>,
  put: <T = unknown>(path: string, body: unknown) =>
    fetchWithAuth(path, { method: 'PUT', body: JSON.stringify(body) }) as Promise<CloudResponse<T>>,
}
