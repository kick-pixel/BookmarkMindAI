// ============================================================
// BookmarkMind AI · Chrome Storage 存储层
// ============================================================
import type { Bookmark, Category, UserSettings } from '../types'
import { BOOKMARK_TAXONOMY, getAllFolderPaths } from './bookmarkTaxonomy'
import { IMPORT_STAGING_FOLDER } from './bookmarkImport'
import { isUsingBuiltInFreeAI } from './aiConfig'

const KEYS = {
  BOOKMARKS: 'bai_bookmarks',
  CATEGORIES: 'bai_categories',
  SETTINGS: 'bai_settings',
} as const

const CORE_AI_AUTOMATION_SETTINGS = {
  autoClassify: true,
  autoTag: true,
  autoSummary: true,
  autoExtractKeywords: true,
} as const

// ── 默认配置 ────────────────────────────────────────────────
export const DEFAULT_SETTINGS: UserSettings = {
  aiProvider: 'nvidia',
  apiKeys: {},
  aiEnabled: true,
  aiServiceMode: 'hosted',
  autoClassify: true,
  autoTag: true,
  autoSummary: true,
  autoExtractKeywords: true,
  trackVisits: true,
  cleanupReminder: true,
  cleanupReminderDays: 90,
  sendContentToAI: true,
  plan: 'free',
  aiUsageCount: 0,
  aiUsageResetAt: Date.now(),
  freeQuotaPerMonth: 100,
  language: 'auto',
  aiBaseUrls: {},
  aiModels: {},
  customBaseUrl: '',
  customModel: '',
}

export const DEFAULT_CATEGORIES: Category[] = [
  ...BOOKMARK_TAXONOMY.map((group, index) => ({
    id: `cat_${index}_${group.name}`,
    name: group.name,
    icon: group.icon,
    color: '#23d5ff',
    order: index,
  })),
]

// ── 书签 CRUD ────────────────────────────────────────────────
export async function getAllBookmarks(): Promise<Bookmark[]> {
  const result = await chrome.storage.local.get(KEYS.BOOKMARKS)
  return (result[KEYS.BOOKMARKS] as Bookmark[] | undefined) ?? []
}

export async function getBookmarkById(id: string): Promise<Bookmark | undefined> {
  const bookmarks = await getAllBookmarks()
  return bookmarks.find(b => b.id === id)
}

export async function saveBookmark(bookmark: Bookmark): Promise<Bookmark> {
  const bookmarks = await getAllBookmarks()
  const normalized = normalizeBookmark(bookmark)
  const idx = bookmarks.findIndex(b => b.id === normalized.id || normalizeUrl(b.url) === normalized.normalizedUrl)
  let saved: Bookmark
  if (idx >= 0) {
    const existing = bookmarks[idx]
    const isSameBookmark = existing.id === normalized.id
    saved = isSameBookmark
      ? { ...existing, ...normalized, updatedAt: Date.now() }
      : {
          ...existing,
          title: normalized.title || existing.title,
          favicon: normalized.favicon || existing.favicon,
          domain: normalized.domain || existing.domain,
          normalizedUrl: normalized.normalizedUrl || existing.normalizedUrl,
          isArchived: false,
          updatedAt: Date.now(),
        }
    bookmarks[idx] = saved
  } else {
    saved = normalized
    bookmarks.unshift(saved)
  }
  await chrome.storage.local.set({ [KEYS.BOOKMARKS]: bookmarks })
  const categories = await getCategories()
  ensureCategoryEntries(categories, saved.folderPath ?? [saved.category])
  await chrome.storage.local.set({ [KEYS.CATEGORIES]: categories })
  return saved
}

export async function saveBookmarksBulk(
  incoming: Bookmark[],
): Promise<{ imported: number; skipped: number; importedUrls: string[]; reprocessUrls: string[] }> {
  const existing = await getAllBookmarks()
  const byUrl = new Map(existing.map(b => [normalizeUrl(b.url), b]))
  const categories = await getCategories()
  let imported = 0
  let skipped = 0
  const importedUrls: string[] = []
  const reprocessUrls: string[] = []

  for (const bookmark of incoming) {
    const normalized = normalizeBookmark(bookmark)
    if (normalized.sourceFolderPath?.length) {
      normalized.category = IMPORT_STAGING_FOLDER[0]
      normalized.subCategory = IMPORT_STAGING_FOLDER[1]
      normalized.folderPath = [...IMPORT_STAGING_FOLDER]
      normalized.aiStatus = 'pending'
      normalized.aiCategorized = false
    }
    const existingBookmark = byUrl.get(normalized.normalizedUrl ?? normalizeUrl(normalized.url))
    if (existingBookmark) {
      if (!existingBookmark.summary || !existingBookmark.aiCategorized || existingBookmark.aiStatus === 'failed') {
        reprocessUrls.push(existingBookmark.url)
      }
      skipped += 1
      continue
    }
    existing.unshift(normalized)
    byUrl.set(normalized.normalizedUrl ?? normalizeUrl(normalized.url), normalized)
    importedUrls.push(normalized.url)
    ensureCategoryEntries(categories, normalized.folderPath ?? [...IMPORT_STAGING_FOLDER])
    imported += 1
  }

  await chrome.storage.local.set({ [KEYS.BOOKMARKS]: existing })
  await chrome.storage.local.set({ [KEYS.CATEGORIES]: categories })
  return { imported, skipped, importedUrls, reprocessUrls }
}

export async function migrateLegacyImportedBookmarks(): Promise<string[]> {
  const bookmarks = await getAllBookmarks()
  const categories = await getCategories()
  const normalizedFolders = new Set(getAllFolderPaths().map(folderPath => folderPath.join('/')))
  const normalizedRoots = new Set(BOOKMARK_TAXONOMY.map(group => group.name))
  const migratedUrls: string[] = []
  let changed = false

  const migrated = bookmarks.map(bookmark => {
    const folderPath = normalizeStoredFolderPath(bookmark.folderPath, bookmark.category)
    const folderKey = folderPath.join('/')
    const looksLegacyImport =
      !bookmark.sourceFolderPath?.length &&
      !normalizedFolders.has(folderKey) &&
      !normalizedRoots.has(folderPath[0]) &&
      !bookmark.aiCategorized

    if (!looksLegacyImport) return bookmark

    changed = true
    migratedUrls.push(bookmark.url)
    const sourceFolderPath = folderPath.filter(Boolean)
    const sourceTagSet = new Set(sourceFolderPath)
    const tags = bookmark.tags.filter(tag => !sourceTagSet.has(tag))
    return {
      ...bookmark,
      category: IMPORT_STAGING_FOLDER[0],
      subCategory: IMPORT_STAGING_FOLDER[1],
      folderPath: [...IMPORT_STAGING_FOLDER],
      sourceFolderPath,
      tags,
      aiStatus: 'pending' as const,
      aiError: undefined,
      updatedAt: Date.now(),
    }
  })

  if (!changed) return []

  ensureCategoryEntries(categories, [...IMPORT_STAGING_FOLDER])
  await chrome.storage.local.set({
    [KEYS.BOOKMARKS]: migrated,
    [KEYS.CATEGORIES]: categories,
  })
  return migratedUrls
}

export async function deleteBookmark(id: string): Promise<void> {
  const bookmarks = await getAllBookmarks()
  const filtered = bookmarks.filter(b => b.id !== id)
  await chrome.storage.local.set({ [KEYS.BOOKMARKS]: filtered })
}

export async function archiveBookmark(id: string): Promise<void> {
  const bookmark = await getBookmarkById(id)
  if (bookmark) {
    bookmark.isArchived = true
    await saveBookmark(bookmark)
  }
}

export async function recordVisit(url: string): Promise<void> {
  const bookmarks = await getAllBookmarks()
  const bm = bookmarks.find(b => b.url === url)
  if (bm) {
    bm.lastVisitedAt = Date.now()
    bm.visitCount = (bm.visitCount ?? 0) + 1
    bm.status = computeStatus(bm)
    await chrome.storage.local.set({ [KEYS.BOOKMARKS]: bookmarks })
  }
}

export function computeStatus(bm: Bookmark): Bookmark['status'] {
  if (!bm.lastVisitedAt) return 'sleeping'
  const days = (Date.now() - bm.lastVisitedAt) / (1000 * 60 * 60 * 24)
  if (days <= 30) return 'active'
  if (days <= 90) return 'idle'
  return 'sleeping'
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.searchParams.sort()
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return url.trim()
  }
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function normalizeBookmark(bookmark: Bookmark): Bookmark {
  const now = Date.now()
  return {
    ...bookmark,
    normalizedUrl: bookmark.normalizedUrl ?? normalizeUrl(bookmark.url),
    domain: bookmark.domain ?? getDomain(bookmark.url),
    updatedAt: bookmark.updatedAt ?? now,
    visitCount: bookmark.visitCount ?? 0,
    tags: bookmark.tags ?? [],
    keywords: bookmark.keywords ?? [],
    sourceFolderPath: bookmark.sourceFolderPath?.map(part => part.trim()).filter(Boolean),
    folderPath: normalizeStoredFolderPath(bookmark.folderPath, bookmark.category),
    isArchived: bookmark.isArchived ?? false,
  }
}

function normalizeStoredFolderPath(folderPath?: string[], category?: string): string[] {
  const path = (folderPath ?? []).map(part => part.trim()).filter(Boolean).slice(0, 2)
  if (path.length) return path
  return [category?.trim() || '其他']
}

// ── 分类 CRUD ────────────────────────────────────────────────
export async function getCategories(): Promise<Category[]> {
  const result = await chrome.storage.local.get(KEYS.CATEGORIES)
  const stored = result[KEYS.CATEGORIES] as Category[] | undefined
  return stored?.length ? stored : DEFAULT_CATEGORIES
}

export async function saveCategory(category: Category): Promise<void> {
  const categories = await getCategories()
  const idx = categories.findIndex(c => c.id === category.id)
  if (idx >= 0) categories[idx] = category
  else categories.push(category)
  await chrome.storage.local.set({ [KEYS.CATEGORIES]: categories })
}

export async function createCategory(name: string, parentId?: string): Promise<Category[]> {
  const categories = await getCategories()
  const normalizedName = name.trim()
  if (!normalizedName) return categories

  const duplicate = categories.some(category =>
    category.parentId === parentId && category.name.toLowerCase() === normalizedName.toLowerCase()
  )
  if (duplicate) return categories

  categories.push({
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: normalizedName,
    icon: parentId ? '' : '📁',
    color: '#23d5ff',
    parentId,
    order: categories.filter(category => category.parentId === parentId).length,
  })
  await chrome.storage.local.set({ [KEYS.CATEGORIES]: categories })
  return categories
}

export async function deleteCategory(categoryId: string): Promise<{ categories: Category[]; bookmarks: Bookmark[] }> {
  const categories = await getCategories()
  const target = categories.find(category => category.id === categoryId)
  if (!target) return { categories, bookmarks: await getAllBookmarks() }

  const childIds = new Set(categories.filter(category => category.parentId === target.id).map(category => category.id))
  const deleteIds = new Set([target.id, ...childIds])
  const remainingCategories = categories.filter(category => !deleteIds.has(category.id))
  const bookmarks = await getAllBookmarks()
  const parent = target.parentId ? categories.find(category => category.id === target.parentId) : undefined

  const remainingBookmarks = bookmarks.filter(bookmark => {
    const [root, child] = normalizeStoredFolderPath(bookmark.folderPath, bookmark.category)
    const shouldDelete = target.parentId
      ? parent?.name === root && target.name === child
      : target.name === root

    return !shouldDelete
  })

  await chrome.storage.local.set({
    [KEYS.CATEGORIES]: remainingCategories,
    [KEYS.BOOKMARKS]: remainingBookmarks,
  })
  return { categories: remainingCategories, bookmarks: remainingBookmarks }
}

function ensureCategoryEntries(categories: Category[], folderPath: string[]): void {
  const [rootName, childName] = normalizeStoredFolderPath(folderPath)
  let root = categories.find(category => !category.parentId && category.name === rootName)
  if (!root) {
    root = {
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: rootName,
      icon: '📁',
      color: '#23d5ff',
      order: categories.filter(category => !category.parentId).length,
    }
    categories.push(root)
  }

  if (childName && !categories.some(category => category.parentId === root.id && category.name === childName)) {
    categories.push({
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: childName,
      icon: '',
      color: '#23d5ff',
      parentId: root.id,
      order: categories.filter(category => category.parentId === root.id).length,
    })
  }
}

// ── 设置 ────────────────────────────────────────────────────
export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get(KEYS.SETTINGS)
  const settings = {
    ...DEFAULT_SETTINGS,
    ...((result[KEYS.SETTINGS] as Partial<UserSettings> | undefined) ?? {}),
    aiEnabled: true,
    ...CORE_AI_AUTOMATION_SETTINGS,
  }
  const hasAnyApiKey = Object.values(settings.apiKeys ?? {}).some(key => Boolean(key?.trim()))
  return {
    ...settings,
    aiServiceMode: settings.aiServiceMode === 'byok' && !hasAnyApiKey ? 'hosted' : settings.aiServiceMode,
  }
}

export async function updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const settings = await getSettings()
  const updated = {
    ...settings,
    ...partial,
    aiEnabled: true,
    ...CORE_AI_AUTOMATION_SETTINGS,
  }
  await chrome.storage.local.set({ [KEYS.SETTINGS]: updated })
  return updated
}

// ── AI 用量管理 ───────────────────────────────────────────────
export async function canUseAI(): Promise<{ allowed: boolean; remaining: number; isPro: boolean }> {
  const settings = await getSettings()

  if (settings.aiServiceMode === 'byok' && settings.apiKeys[settings.aiProvider]) {
    return { allowed: true, remaining: Infinity, isPro: settings.plan === 'pro' }
  }

  if (settings.plan === 'pro') {
    return { allowed: true, remaining: Infinity, isPro: true }
  }

  // 检查是否需要重置月度用量（每月 1 日重置）
  const now = new Date()
  const resetDate = new Date(settings.aiUsageResetAt)
  const needsReset =
    now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()

  if (needsReset) {
    await updateSettings({ aiUsageCount: 0, aiUsageResetAt: Date.now() })
    return { allowed: true, remaining: settings.freeQuotaPerMonth, isPro: false }
  }

  const remaining = settings.freeQuotaPerMonth - settings.aiUsageCount
  return { allowed: remaining > 0, remaining, isPro: false }
}

export async function incrementAIUsage(): Promise<void> {
  const settings = await getSettings()
  if (!isUsingBuiltInFreeAI(settings)) return
  await updateSettings({ aiUsageCount: settings.aiUsageCount + 1 })
}

export async function resetFreeAIUsage(): Promise<UserSettings> {
  return updateSettings({ aiUsageCount: 0, aiUsageResetAt: Date.now() })
}

// ── 初始化 ────────────────────────────────────────────────────
export async function initStorage(): Promise<void> {
  const settings = await getSettings()
  if (!settings) await updateSettings(DEFAULT_SETTINGS)

  const categories = await getCategories()
  if (!categories?.length) {
    await chrome.storage.local.set({ [KEYS.CATEGORIES]: DEFAULT_CATEGORIES })
  }
}
