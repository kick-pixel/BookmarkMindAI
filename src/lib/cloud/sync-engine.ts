import type { Bookmark } from '../../types'
import { cloud } from './client'
import { isAuthenticated } from './auth'

export interface SyncRequest {
  lastSyncAt: string
  changes: Array<{
    id: string
    syncState: 'pending_create' | 'pending_update' | 'pending_delete'
    payload: Partial<Bookmark> | null
    syncVersion: number
  }>
}

export interface SyncResponse {
  remoteChanges: Array<{
    id: string
    action: 'create' | 'update' | 'delete'
    payload: Partial<Bookmark> | null
    syncVersion: number
  }>
  conflicts: Array<{
    id: string
    resolution: 'server_wins' | 'client_wins' | 'merge'
    payload: Partial<Bookmark>
  }>
  newLastSyncAt: string
}

export async function syncBookmarks(
  lastSyncAt: string,
  changes: SyncRequest['changes'],
): Promise<SyncResponse | null> {
  if (!await isAuthenticated()) return null
  if (!changes.length && lastSyncAt) {
    const response = await cloud.get<SyncResponse>(`/bookmarks?since=${encodeURIComponent(lastSyncAt)}`)
    if (!response.ok) return null
    return response.data ?? null
  }

  const response = await cloud.post<SyncResponse>('/bookmarks/sync', {
    lastSyncAt,
    changes,
  } satisfies SyncRequest)

  if (!response.ok) return null
  return response.data ?? null
}

export function collectPendingChanges(
  bookmarks: Bookmark[],
): SyncRequest['changes'] {
  return bookmarks
    .filter(bm => bm.syncState && bm.syncState !== 'synced')
    .map(bm => ({
      id: bm.id,
      syncState: bm.syncState as SyncRequest['changes'][number]['syncState'],
      payload: bm.syncState === 'pending_delete' ? null : bm,
      syncVersion: bm.syncVersion ?? 1,
    }))
}
