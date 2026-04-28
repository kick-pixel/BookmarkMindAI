// ============================================================
// BookmarkMind AI · IndexedDB bookmark repository
// Keeps large bookmark bodies out of chrome.storage.local and leaves
// settings/categories in chrome.storage for lightweight compatibility.
// ============================================================
import type { Bookmark } from '../types'

const DB_NAME = 'bookmarkmind_ai_local'
const DB_VERSION = 1
const BOOKMARK_STORE = 'bookmarks'

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BOOKMARK_STORE)) {
        const store = db.createObjectStore(BOOKMARK_STORE, { keyPath: 'id' })
        store.createIndex('normalizedUrl', 'normalizedUrl', { unique: false })
        store.createIndex('domain', 'domain', { unique: false })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
        store.createIndex('syncState', 'syncState', { unique: false })
        store.createIndex('deletedAt', 'deletedAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function getAllBookmarkRecords(options: { includeDeleted?: boolean } = {}): Promise<Bookmark[]> {
  const db = await openDatabase()
  const transaction = db.transaction(BOOKMARK_STORE, 'readonly')
  const store = transaction.objectStore(BOOKMARK_STORE)
  const records = await requestToPromise<Bookmark[]>(store.getAll())
  return records
    .filter(bookmark => options.includeDeleted || !bookmark.deletedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function getBookmarkRecordById(id: string): Promise<Bookmark | undefined> {
  const db = await openDatabase()
  const transaction = db.transaction(BOOKMARK_STORE, 'readonly')
  const store = transaction.objectStore(BOOKMARK_STORE)
  const bookmark = await requestToPromise<Bookmark | undefined>(store.get(id))
  return bookmark?.deletedAt ? undefined : bookmark
}

export async function putBookmarkRecord(bookmark: Bookmark): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(BOOKMARK_STORE, 'readwrite')
  transaction.objectStore(BOOKMARK_STORE).put(bookmark)
  await transactionDone(transaction)
}

export async function putBookmarkRecords(bookmarks: Bookmark[]): Promise<void> {
  if (!bookmarks.length) return
  const db = await openDatabase()
  const transaction = db.transaction(BOOKMARK_STORE, 'readwrite')
  const store = transaction.objectStore(BOOKMARK_STORE)
  bookmarks.forEach(bookmark => store.put(bookmark))
  await transactionDone(transaction)
}

export async function markBookmarkRecordsDeleted(ids: string[], deletedAt = Date.now()): Promise<Bookmark[]> {
  if (!ids.length) return getAllBookmarkRecords()
  const deleteIds = new Set(ids)
  const records = await getAllBookmarkRecords({ includeDeleted: true })
  const tombstones = records
    .filter(bookmark => deleteIds.has(bookmark.id))
    .map(bookmark => ({
      ...bookmark,
      deletedAt,
      updatedAt: deletedAt,
      syncUpdatedAt: deletedAt,
      syncVersion: (bookmark.syncVersion ?? 0) + 1,
      syncState: 'pending_delete' as const,
    }))
  await putBookmarkRecords(tombstones)
  return getAllBookmarkRecords()
}

export async function clearBookmarkRecords(): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(BOOKMARK_STORE, 'readwrite')
  transaction.objectStore(BOOKMARK_STORE).clear()
  await transactionDone(transaction)
}
