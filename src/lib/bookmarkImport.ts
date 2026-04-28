import type { Bookmark } from '../types'

export const IMPORT_STAGING_FOLDER = ['其他', '待整理'] as const

const BROWSER_ROOT_FOLDERS = new Set([
  '收藏夹栏',
  '书签栏',
  'Bookmarks Bar',
  'Other Bookmarks',
  '其他书签',
  'Mobile Bookmarks',
  '移动设备书签',
])

export function parseImportedBookmarks(filename: string, text: string): Bookmark[] {
  return filename.toLowerCase().endsWith('.json')
    ? parseJsonBookmarks(text)
    : parseBookmarkHtml(text)
}

export function parseJsonBookmarks(text: string): Bookmark[] {
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : data.bookmarks
  if (!Array.isArray(list)) throw new Error('Invalid JSON')
  return list.map(bookmark => normalizeImportedBookmark(bookmark as Bookmark))
}

export function parseBookmarkHtml(text: string): Bookmark[] {
  const document = new DOMParser().parseFromString(text, 'text/html')
  const root = document.querySelector('dl')
  const bookmarks: Bookmark[] = []

  function walk(container: Element, folderPath: string[]) {
    for (const child of Array.from(container.children)) {
      const tagName = child.tagName.toLowerCase()
      if (tagName === 'dl') {
        walk(child, folderPath)
        continue
      }
      if (tagName !== 'dt') continue

      const directChildren = Array.from(child.children)
      const folder = directChildren.find(element => element.tagName.toLowerCase() === 'h3')
      const link = directChildren.find(element => element.tagName.toLowerCase() === 'a') as HTMLAnchorElement | undefined

      if (folder) {
        const name = folder.textContent?.trim()
        const nested = directChildren.find(element => element.tagName.toLowerCase() === 'dl')
        if (name && nested) walk(nested, [...folderPath, name])
        continue
      }

      if (link?.href) bookmarks.push(bookmarkFromAnchor(link, folderPath))
    }
  }

  if (root) walk(root, [])
  return bookmarks.length
    ? bookmarks
    : Array.from(document.querySelectorAll('a[href]')).map(anchor => bookmarkFromAnchor(anchor as HTMLAnchorElement, []))
}

function bookmarkFromAnchor(anchor: HTMLAnchorElement, folderPath: string[]): Bookmark {
  const href = anchor.getAttribute('href') ?? ''
  const addDate = Number(anchor.getAttribute('add_date')) * 1000
  const sourceFolderPath = cleanBrowserFolderPath(folderPath)
  return normalizeImportedBookmark({
    id: '',
    url: href,
    title: anchor.textContent?.trim() || href,
    favicon: anchor.getAttribute('icon') || undefined,
    category: IMPORT_STAGING_FOLDER[0],
    subCategory: IMPORT_STAGING_FOLDER[1],
    folderPath: [...IMPORT_STAGING_FOLDER],
    sourceFolderPath,
    tags: [],
    aiCategorized: false,
    aiStatus: 'pending',
    createdAt: Number.isFinite(addDate) && addDate > 0 ? addDate : Date.now(),
    visitCount: 0,
    status: 'sleeping',
    isArchived: false,
  } as Bookmark)
}

function normalizeImportedBookmark(bookmark: Bookmark): Bookmark {
  const now = Date.now()
  const isBrowserImport = Boolean(bookmark.sourceFolderPath?.length)
  const folderPath = isBrowserImport
    ? [...IMPORT_STAGING_FOLDER]
    : normalizeFolderPath(bookmark.folderPath, bookmark.category)

  return {
    ...bookmark,
    id: bookmark.id || `bai_import_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: bookmark.title || bookmark.url,
    category: folderPath[0],
    subCategory: folderPath[1],
    folderPath,
    sourceFolderPath: bookmark.sourceFolderPath?.map(part => part.trim()).filter(Boolean).slice(-6),
    tags: bookmark.tags ?? [],
    keywords: bookmark.keywords ?? [],
    aiCategorized: bookmark.aiCategorized ?? false,
    aiStatus: bookmark.aiStatus ?? 'pending',
    createdAt: bookmark.createdAt ?? now,
    updatedAt: now,
    visitCount: bookmark.visitCount ?? 0,
    status: bookmark.status ?? 'sleeping',
    isArchived: bookmark.isArchived ?? false,
  }
}

function normalizeFolderPath(folderPath?: string[], category?: string): string[] {
  const path = folderPath?.map(part => part.trim()).filter(Boolean).slice(0, 2) ?? []
  return path.length ? path : [category?.trim() || IMPORT_STAGING_FOLDER[0], IMPORT_STAGING_FOLDER[1]]
}

function cleanBrowserFolderPath(folderPath: string[]): string[] {
  return folderPath
    .map(part => part.trim())
    .filter(part => part && !BROWSER_ROOT_FOLDERS.has(part))
    .slice(-6)
}
