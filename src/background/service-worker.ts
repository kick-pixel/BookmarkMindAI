// ============================================================
// BookmarkMind AI · Background Service Worker
// ============================================================
import {
  initStorage,
  getAllBookmarks,
  getCategories,
  cleanEmptyUserCategories,
  createCategory,
  deleteCategory,
  saveBookmark,
  saveBookmarksBulk,
  migrateLegacyImportedBookmarks,
  deleteBookmark,
  deleteBookmarksBulk,
  getSettings,
  updateSettings,
  clearLocalData,
  recordVisit,
  canUseAI,
  computeStatus,
  getDomain,
  normalizeUrl,
} from '../lib/storage'
import { cleanupTombstones } from '../lib/bookmarkRepository'
import { loginWithGoogle, logout, getCloudUser, syncBookmarks, collectPendingChanges } from '../lib/cloud'
import { generateSummary, extractKeywords } from '../lib/ai'
import { smartClassify } from '../lib/bookmarkClassifier'
import { recordUserCorrection } from '../lib/bookmarkClassifier/userLearning'
import { BYOK_CONFIG_REQUIRED_MESSAGE, resolveAIConfig } from '../lib/aiConfig'
import type { Bookmark, Message, MessageResponse, ExtractedContent, UserSettings, ProcessingTask } from '../types'

// ── AI 请求去重节流 ────────────────────────────────────────────
const aiRequestCache = new Map<string, Promise<unknown>>()
let autoAnalysisQueue: Promise<void> = Promise.resolve()
const PROCESSING_TASK_KEY = 'bai_processing_task'
const CONTEXT_MENU_SAVE_PAGE = 'bai-save-page'
const CONTEXT_MENU_OPEN_PANEL = 'bai-open-panel'
const AUTO_ANALYZE_DELAY_MS = 3000
const AUTO_ANALYZE_TAB_TIMEOUT_MS = 25000

function dedupAI<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = aiRequestCache.get(key)
  if (existing) return existing as Promise<T>
  const promise = factory().finally(() => { aiRequestCache.delete(key) })
  aiRequestCache.set(key, promise)
  return promise
}

function enqueueAutoAnalysis(factory: () => Promise<void>): void {
  autoAnalysisQueue = autoAnalysisQueue
    .catch(() => {})
    .then(factory)
    .catch(err => console.error('[BAI] Auto-analysis queue failed:', err))
}

// ── 初始化 ────────────────────────────────────────────────────
self.addEventListener('install', () => {
  console.log('[BAI] Background installed')
  initStorage()
})

chrome.runtime.onInstalled.addListener(() => {
  initStorage()
  setupContextMenus()
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === CONTEXT_MENU_SAVE_PAGE) {
      const targetTab = tab ?? await getActiveTab()
      if (targetTab) {
        const saved = await saveTabAsBookmark(targetTab, true)
        chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: saved }).catch(() => {})
      }
    }
    if (info.menuItemId === CONTEXT_MENU_OPEN_PANEL) {
      await openSidePanel(tab)
    }
  } catch (err) {
    console.error('[BAI] Context menu action failed:', err)
  }
})

chrome.commands.onCommand.addListener(async (command, tab) => {
  try {
    if (command === 'save-current-page') {
      const targetTab = tab ?? await getActiveTab()
      if (targetTab) {
        const saved = await saveTabAsBookmark(targetTab, true)
        chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: saved }).catch(() => {})
      }
    }
    if (command === 'open-side-panel') {
      await openSidePanel(tab)
    }
  } catch (err) {
    console.error('[BAI] Command action failed:', err)
  }
})

// ── 监听 Tab 导航（记录访问）────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const settings = await getSettings()
    if (settings.trackVisits) {
      await recordVisit(tab.url)
    }
  }
})

// ── 定时任务：每天更新书签健康状态 ──────────────────────────────
chrome.alarms.create('daily-health-check', { periodInMinutes: 24 * 60 })
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-health-check') {
    await updateBookmarkStatuses()
    const cleaned = await cleanupTombstones()
    if (cleaned > 0) console.log(`[BAI] Cleaned ${cleaned} expired tombstones`)
  }
})

async function updateBookmarkStatuses() {
  const bookmarks = await getAllBookmarks()
  for (const bm of bookmarks) {
    const newStatus = computeStatus(bm)
    if (newStatus !== bm.status) {
      bm.status = newStatus
      await saveBookmark(bm)
    }
  }
  console.log('[BAI] Health check complete')
}

function setupContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_SAVE_PAGE,
      title: chrome.i18n.getMessage('contextSavePage') || 'Save and organize this page',
      contexts: ['all'],
    })
    chrome.contextMenus.create({
      id: CONTEXT_MENU_OPEN_PANEL,
      title: chrome.i18n.getMessage('contextOpenPanel') || 'Open BookmarkMind AI panel',
      contexts: ['all'],
    })
  })
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab ?? null
}

async function saveTabAsBookmark(tab: chrome.tabs.Tab, notify = false, preferredContent?: ExtractedContent): Promise<Bookmark> {
  if (!tab.url) throw new Error('NO_ACTIVE_TAB')
  const content = preferredContent?.url ? preferredContent : await extractContentFromTab(tab)
  const bookmark = createBookmark(content)
  const saved = await saveBookmark(bookmark)
  if (saved.id === bookmark.id || shouldAnalyzeOnCurrentPageSave(saved)) {
    processWithAI(saved, content)
  }
  if (notify) notifySaved()
  return saved
}

function shouldAnalyzeOnCurrentPageSave(bookmark: Bookmark): boolean {
  return (
    !bookmark.summary?.trim() ||
    bookmark.aiStatus === 'pending' ||
    bookmark.aiStatus === 'skipped' ||
    bookmark.aiStatus === 'failed' ||
    Boolean(bookmark.aiError)
  )
}

async function openSidePanel(tab?: chrome.tabs.Tab): Promise<void> {
  const targetTab = tab ?? await getActiveTab()
  if (!targetTab?.windowId || !chrome.sidePanel?.open) return
  await chrome.sidePanel.open({ windowId: targetTab.windowId })
}

function notifySaved(): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: chrome.i18n.getMessage('notificationSavedTitle') || 'Saved to BookmarkMind AI',
    message: chrome.i18n.getMessage('notificationSavedMessage') || 'AI is organizing this bookmark in the background.',
  }).catch(() => {})
}

async function applyRemoteSync(changes: Array<{ action: string; payload: Partial<Bookmark> | null }>): Promise<void> {
  for (const change of changes) {
    if (change.action === 'delete' && change.payload) {
      await deleteBookmark(change.payload.id!)
    } else if (change.payload?.id) {
      const bookmarks = await getAllBookmarks()
      const existing = bookmarks.find(b => b.id === change.payload!.id)
      if (existing) {
        const merged = { ...existing, ...change.payload, syncState: 'synced' as const }
        await saveBookmark(merged)
      } else {
        await saveBookmark(change.payload as Bookmark)
      }
    }
  }
}

async function applyConflictResolutions(
  conflicts: Array<{ id: string; resolution: string; payload: Partial<Bookmark> }>,
): Promise<void> {
  for (const conflict of conflicts) {
    const bookmarks = await getAllBookmarks()
    const existing = bookmarks.find(b => b.id === conflict.id)
    if (existing) {
      const merged = { ...existing, ...conflict.payload, syncState: 'synced' as const }
      await saveBookmark(merged)
    }
  }
}

async function markBookmarksSynced(ids: string[]): Promise<void> {
  const bookmarks = await getAllBookmarks()
  for (const bm of bookmarks) {
    if (ids.includes(bm.id) && bm.syncState !== 'synced') {
      bm.syncState = 'synced'
      await saveBookmark(bm)
    }
  }
}

// ── 消息处理中心 ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (r: MessageResponse) => void) => {
    handleMessage(message).then(sendResponse).catch(err =>
      sendResponse({ success: false, error: err.message })
    )
    return true // 保持通道开放（异步）
  }
)

async function handleMessage(msg: Message): Promise<MessageResponse> {
  switch (msg.type) {
    case 'SAVE_BOOKMARK': {
      const content = msg.payload as ExtractedContent
      const bookmark = createBookmark(content)
      const saved = await saveBookmark(bookmark)
      // 异步 AI 处理（不阻塞保存）
      if (saved.id === bookmark.id) processWithAI(saved, content)
      return { success: true, data: saved }
    }

    case 'SAVE_CURRENT_TAB': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.url) return { success: false, error: 'NO_ACTIVE_TAB' }
      const saved = await saveTabAsBookmark(tab, false, msg.payload as ExtractedContent | undefined)
      return { success: true, data: saved }
    }

    case 'GET_BOOKMARKS': {
      const bookmarks = await getAllBookmarks()
      return { success: true, data: bookmarks }
    }

    case 'UPDATE_BOOKMARK': {
      const patch = msg.payload as Partial<Bookmark> & { id: string }
      const bookmarks = await getAllBookmarks()
      const current = bookmarks.find(bookmark => bookmark.id === patch.id)
      if (!current) return { success: false, error: 'BOOKMARK_NOT_FOUND' }
      const updated = { ...current, ...patch, updatedAt: Date.now() }
      if (hasFolderChanged(current, updated)) {
        const nextFolderPath = normalizeBookmarkFolderPath(updated)
        await recordUserCorrection(current, normalizeBookmarkFolderPath(current), nextFolderPath)
        updated.category = nextFolderPath[0]
        updated.subCategory = nextFolderPath[1]
        updated.folderPath = nextFolderPath
        updated.aiReason = '用户手动调整目录，已记录为本地分类偏好。'
      }
      const saved = await saveBookmark(updated)
      chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: saved }).catch(() => {})
      return { success: true, data: saved }
    }

    case 'REPROCESS_BOOKMARK': {
      const bookmarkId = msg.payload as string
      const bookmarks = await getAllBookmarks()
      const bookmark = bookmarks.find(item => item.id === bookmarkId)
      if (!bookmark) return { success: false, error: 'BOOKMARK_NOT_FOUND' }
      bookmark.aiStatus = 'pending'
      bookmark.aiError = undefined
      bookmark.summary = undefined
      bookmark.summaryGeneratedAt = undefined
      await saveBookmark(bookmark)
      chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
      const activeTab = await getActiveTab()
      if (activeTab?.url && normalizeUrl(activeTab.url) === normalizeUrl(bookmark.url)) {
        const content = await extractContentFromTab(activeTab)
        processWithAI(bookmark, content)
        return { success: true, data: bookmark }
      }
      await analyzeBookmarksByOpeningTabs([bookmark.url], 'retry', { active: true, closeTabs: false })
      const updated = (await getAllBookmarks()).find(item => item.id === bookmark.id) ?? bookmark
      return { success: true, data: updated }
    }

    case 'IMPORT_BOOKMARKS': {
      const bookmarks = msg.payload as Bookmark[]
      const result = await saveBookmarksBulk(bookmarks)
      const migratedUrls = await migrateLegacyImportedBookmarks()
      enqueueAutoAnalysis(() =>
        analyzeBookmarksByOpeningTabs([...result.importedUrls, ...result.reprocessUrls, ...migratedUrls], 'import'),
      )
      return { success: true, data: result }
    }

    case 'GET_PROCESSING_TASK': {
      const task = await getProcessingTask()
      return { success: true, data: task }
    }

    case 'DISMISS_PROCESSING_TASK': {
      const taskId = msg.payload as string | undefined
      const task = await getProcessingTask()
      if (!taskId || task?.id === taskId) {
        await chrome.storage.local.remove(PROCESSING_TASK_KEY)
      }
      return { success: true }
    }

    case 'RETRY_FAILED_BOOKMARKS': {
      const bookmarks = await getAllBookmarks()
      const failedUrls = bookmarks
        .filter(bookmark =>
          !bookmark.isArchived &&
          (bookmark.aiStatus === 'failed' || Boolean(bookmark.aiError) || !bookmark.summary)
        )
        .map(bookmark => bookmark.url)
      if (!failedUrls.length) return { success: true, data: { total: 0 } }
      enqueueAutoAnalysis(() => analyzeBookmarksByOpeningTabs(failedUrls, 'retry'))
      return { success: true, data: { total: failedUrls.length } }
    }

    case 'DELETE_BOOKMARK': {
      await deleteBookmark(msg.payload as string)
      return { success: true }
    }

    case 'CLEAN_DUPLICATE_BOOKMARKS': {
      const bookmarks = await getAllBookmarks()
      const duplicateDeleteIds = getDuplicateBookmarkDeleteIds(bookmarks)
      const remaining = await deleteBookmarksBulk(duplicateDeleteIds)
      return {
        success: true,
        data: {
          deleted: duplicateDeleteIds.length,
          bookmarks: remaining.filter(bookmark => !bookmark.isArchived),
        },
      }
    }

    case 'GET_SETTINGS': {
      const settings = await getSettings()
      return { success: true, data: settings }
    }

    case 'UPDATE_SETTINGS': {
      const updated = await updateSettings(msg.payload as Parameters<typeof updateSettings>[0])
      return { success: true, data: updated }
    }

    case 'GET_USAGE': {
      const usage = await canUseAI()
      return { success: true, data: usage }
    }

    case 'CLEAR_ALL_DATA': {
      await clearLocalData()
      await initStorage()
      return { success: true }
    }

    case 'AI_SUMMARIZE': {
      const { bookmark, content } = msg.payload as { bookmark: Bookmark; content: ExtractedContent }
      const usage = await canUseAI()
      if (!usage.allowed) return { success: false, error: BYOK_CONFIG_REQUIRED_MESSAGE }

      const summary = await generateSummary(content, {
        category: bookmark.category,
        subCategory: bookmark.subCategory,
        tags: bookmark.tags,
        reason: bookmark.aiReason,
      })
      if (summary) {
        bookmark.summary = summary
        bookmark.summaryGeneratedAt = Date.now()
        await saveBookmark(bookmark)
      }
      return { success: true, data: { summary } }
    }

    case 'GET_CATEGORIES': {
      const categories = await getCategories()
      return { success: true, data: categories }
    }

    case 'CREATE_CATEGORY': {
      const payload = msg.payload as { name: string; parentId?: string }
      const categories = await createCategory(payload.name, payload.parentId)
      return { success: true, data: categories }
    }

    case 'DELETE_CATEGORY': {
      const payload = msg.payload as string | { categoryId: string }
      const categoryId = typeof payload === 'string' ? payload : payload.categoryId
      const result = await deleteCategory(categoryId)
      return { success: true, data: result }
    }

    case 'CLEAN_EMPTY_FOLDERS': {
      const categories = await cleanEmptyUserCategories()
      return { success: true, data: categories }
    }

    case 'GET_BOOKMARK_BY_URL': {
      const url = msg.payload as string
      const bookmarks = await getAllBookmarks()
      const found = bookmarks.find(b => b.url === url && !b.isArchived)
      return { success: true, data: found ?? null }
    }

    case 'CLOUD_LOGIN': {
      const success = await loginWithGoogle()
      if (success) {
        const user = await getCloudUser()
        return { success: true, data: user }
      }
      return { success: false, error: 'Login failed' }
    }

    case 'CLOUD_LOGOUT': {
      await logout()
      return { success: true }
    }

    case 'CLOUD_SYNC': {
      const bookmarks = await getAllBookmarks()
      const settings = await getSettings()
      const lastSyncAt = settings.lastSyncAt ? new Date(settings.lastSyncAt).toISOString() : '1970-01-01T00:00:00Z'
      const changes = collectPendingChanges(bookmarks)

      if (!changes.length) {
        const result = await syncBookmarks(lastSyncAt, [])
        if (!result) return { success: false, error: 'Sync failed' }

        await applyRemoteSync(result.remoteChanges)

        await updateSettings({ lastSyncAt: Date.now() })
        return { success: true, data: { synced: result.remoteChanges.length } }
      }

      const result = await syncBookmarks(lastSyncAt, changes)
      if (!result) return { success: false, error: 'Sync failed' }

      await applyRemoteSync(result.remoteChanges)
      await applyConflictResolutions(result.conflicts)

      const syncedIds = new Set([
        ...changes.map(c => c.id),
        ...result.remoteChanges.map(c => c.id),
      ])
      await markBookmarksSynced(Array.from(syncedIds))

      await updateSettings({ lastSyncAt: Date.now() })
      return { success: true, data: { synced: result.remoteChanges.length + changes.length } }
    }

    case 'CLOUD_GET_STATUS': {
      const user = await getCloudUser()
      return { success: true, data: user }
    }

    default:
      return { success: false, error: `Unknown message type: ${(msg as Message).type}` }
  }
}

async function extractContentFromTab(tab: chrome.tabs.Tab): Promise<ExtractedContent> {
  if (tab.id) {
    const response = await chrome.tabs
      .sendMessage(tab.id, { type: 'EXTRACT_CONTENT' })
      .catch(() => null)
    if (response?.success && response.data) {
      return {
        ...response.data,
        favicon: response.data.favicon || tab.favIconUrl,
      }
    }

    const injected = await chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        func: extractPageContentInPage,
      })
      .catch(() => null)
    const injectedContent = injected?.[0]?.result as ExtractedContent | undefined
    if (injectedContent?.url) {
      return {
        ...injectedContent,
        favicon: injectedContent.favicon || tab.favIconUrl,
      }
    }
  }

  return {
    title: tab.title ?? tab.url ?? '',
    url: tab.url ?? '',
    description: '',
    mainContent: '',
    favicon: tab.favIconUrl,
  }
}

async function extractPageContentInPage(): Promise<ExtractedContent> {
  await waitForReadablePageInPage()

  function cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  async function waitForReadablePageInPage(): Promise<void> {
    if (document.readyState === 'loading') {
      await new Promise<void>(resolve => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }))
    }
    const bodyLen = (document.body?.textContent ?? '').replace(/\s+/g, ' ').trim().length
    if (bodyLen >= 300) return
    await new Promise<void>(resolve => window.setTimeout(resolve, 900))
  }

  function extractMainText(): string {
    if (!document.body) return ''

    const body = document.body.cloneNode(true) as HTMLElement
    const noiseSelectors = [
      'script', 'style', 'nav', 'footer', 'header', 'aside',
      'form', 'button', 'select', 'textarea', 'iframe', 'noscript',
      '[aria-hidden="true"]', '[hidden]',
      '.sidebar', '.ad', '.ads', '.advertisement', '.cookie-banner',
      '.consent-banner', '#cookie-banner', '.popup', '.modal',
      '.overlay', '.toast', '.notification', '.banner',
      '.toolbar', '.menu', '.share', '.social', '.related',
      '.recommend', '.comments', '#comments',
    ]
    noiseSelectors.forEach(sel => body.querySelectorAll(sel).forEach(el => el.remove()))

    const candidates = Array.from(body.querySelectorAll<HTMLElement>(
      'article, main, section, div, td, pre, blockquote, [role="main"]',
    ))
    let best = ''
    let bestScore = 0

    for (const element of candidates) {
      const text = cleanText(element.textContent ?? '')
      if (text.length < 80) continue
      const linkText = Array.from(element.querySelectorAll('a'))
        .map(link => link.textContent ?? '')
        .join(' ')
      const linkDensity = cleanText(linkText).length / Math.max(text.length, 1)
      const paragraphCount = element.querySelectorAll('p, li, pre, code, h1, h2, h3').length
      const punctuationCount = (text.match(/[。！？；：，、.!?;:,]/g) ?? []).length
      const codeBonus = element.querySelectorAll('pre, code').length * 25
      const noisePenalty = /nav|menu|footer|header|sidebar|comment|related|recommend|advert/i.test(element.className)
        ? 120
        : 0
      const score =
        text.length * (1 - Math.min(linkDensity, 0.85)) +
        paragraphCount * 45 +
        punctuationCount * 8 +
        codeBonus -
        noisePenalty

      if (score > bestScore) {
        bestScore = score
        best = text
      }
    }

    if (best.length >= 120) return best.slice(0, 6000)
    const bodyText = cleanText(body.textContent ?? '')
    return bodyText.length >= 80 ? bodyText.slice(0, 6000) : ''
  }

  // 提取描述（多来源）
  const description =
    (document.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content ||
    (document.querySelector('meta[name="twitter:description"]') as HTMLMetaElement)?.content ||
    (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content ||
    ''

  // 提取 OG 图片
  const ogImage =
    (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content ||
    (document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement)?.content ||
    undefined

  // 提取 Favicon（多来源）
  const favicon =
    (document.querySelector('link[rel="icon"][sizes="32x32"]') as HTMLLinkElement)?.href ||
    (document.querySelector('link[rel="icon"][sizes="96x96"]') as HTMLLinkElement)?.href ||
    (document.querySelector('link[rel="icon"][sizes="192x192"]') as HTMLLinkElement)?.href ||
    (document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement)?.href ||
    (document.querySelector('link[rel="icon"]') as HTMLLinkElement)?.href ||
    (document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement)?.href ||
    `${location.origin}/favicon.ico`

  return {
    title: document.title || '',
    url: location.href,
    description,
    mainContent: extractMainText(),
    ogImage,
    favicon,
  }
}

async function analyzeBookmarksByOpeningTabs(
  importedUrls: string[],
  taskType: ProcessingTask['type'],
  options: { active?: boolean; closeTabs?: boolean } = {},
): Promise<void> {
  if (!importedUrls.length) return

  const importedUrlSet = new Set(importedUrls.map(normalizeUrl))
  const bookmarks = await getAllBookmarks()
  const imported = bookmarks.filter(bookmark =>
    importedUrlSet.has(normalizeUrl(bookmark.url)) && isHttpUrl(bookmark.url),
  )
  const total = imported.length
  let processedCount = 0
  let failedCount = 0
  const taskId = `${taskType}_${Date.now()}`

  const CONCURRENT_TABS = 3

  await updateProcessingTask({
    id: taskId,
    type: taskType,
    status: 'running',
    total,
    processed: 0,
    failed: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  })

  async function processOneBookmark(bookmark: Bookmark) {
    try {
      const analyzed = await analyzeBookmarkInTemporaryTab(bookmark, {
        active: options.active ?? false,
        closeTab: options.closeTabs ?? true,
      })
      if (analyzed.aiStatus === 'failed' || analyzed.aiError) failedCount++
    } catch (err) {
      bookmark.aiStatus = 'failed'
      bookmark.aiError = err instanceof Error ? err.message : '自动打开页面分析失败'
      bookmark.updatedAt = Date.now()
      failedCount++
      await saveBookmark(bookmark)
      chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
    }
    processedCount++
    await broadcastProcessingProgress(taskId, taskType, processedCount, total, failedCount)
  }

  // Process in concurrent batches of CONCURRENT_TABS
  const chunks: Bookmark[][] = []
  for (let i = 0; i < imported.length; i += CONCURRENT_TABS) {
    chunks.push(imported.slice(i, i + CONCURRENT_TABS))
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(processOneBookmark))
  }

  await updateProcessingTask({
    id: taskId,
    type: taskType,
    status: failedCount > 0 ? 'failed' : 'completed',
    total,
    processed: processedCount,
    failed: failedCount,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  })
}

async function analyzeBookmarkInTemporaryTab(
  bookmark: Bookmark,
  options: { active: boolean; closeTab: boolean },
): Promise<Bookmark> {
  bookmark.aiStatus = 'pending'
  bookmark.aiError = undefined
  await saveBookmark(bookmark)
  chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})

  const tab = await chrome.tabs.create({ url: bookmark.url, active: options.active })
  if (!tab.id) throw new Error('无法打开页面标签页')

  try {
    const loadedTab = await waitForTabComplete(tab.id)
    await sleep(AUTO_ANALYZE_DELAY_MS)
    const content = await extractContentFromTab(loadedTab)
    if (!hasReadableMainContent(content)) {
      throw new Error('页面正文未加载完成或无法读取')
    }
    await processWithAI(bookmark, content)
    return bookmark
  } finally {
    if (options.closeTab) {
      await chrome.tabs.remove(tab.id).catch(() => {})
    }
  }
}

function waitForTabComplete(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('页面加载超时'))
    }, AUTO_ANALYZE_TAB_TIMEOUT_MS)

    const listener = (updatedTabId: number, changeInfo: { status?: string }, tab: chrome.tabs.Tab) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return
      globalThis.clearTimeout(timeoutId)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve(tab)
    }

    chrome.tabs.onUpdated.addListener(listener)
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') {
        globalThis.clearTimeout(timeoutId)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve(tab)
      }
    }).catch(err => {
      globalThis.clearTimeout(timeoutId)
      chrome.tabs.onUpdated.removeListener(listener)
      reject(err)
    })
  })
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => globalThis.setTimeout(resolve, ms))
}

async function getProcessingTask(): Promise<ProcessingTask | null> {
  const result = await chrome.storage.local.get(PROCESSING_TASK_KEY)
  return (result[PROCESSING_TASK_KEY] as ProcessingTask | undefined) ?? null
}

async function updateProcessingTask(task: ProcessingTask): Promise<void> {
  const previous = await getProcessingTask()
  const startedAt = previous?.id === task.id ? previous.startedAt : task.startedAt
  const next = { ...task, startedAt, updatedAt: Date.now() }
  await chrome.storage.local.set({ [PROCESSING_TASK_KEY]: next })
  chrome.runtime.sendMessage({ type: 'PROCESSING_TASK_UPDATED', payload: next }).catch(() => {})
}

async function broadcastProcessingProgress(
  taskId: string,
  taskType: ProcessingTask['type'],
  processed: number,
  total: number,
  failed: number,
): Promise<void> {
  await updateProcessingTask({
    id: taskId,
    type: taskType,
    status: 'running',
    total,
    processed,
    failed,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  })
}

function getAIRequestCacheScope(settings: UserSettings): string {
  const config = resolveAIConfig(settings)
  if (!config) return `unconfigured:${settings.aiProvider}`
  return `${config.provider}:${config.baseUrl ?? ''}:${config.model ?? ''}`
}

function hasReadableMainContent(content: ExtractedContent): boolean {
  const text = content.mainContent?.trim() ?? ''
  const punctuationCount = (text.match(/[。！？；：，、.!?;:,]/g) ?? []).length
  return text.length >= 180 && punctuationCount >= 4
}

// ── 创建书签对象 ─────────────────────────────────────────────
function createBookmark(content: ExtractedContent): Bookmark {
  return {
    id: `bai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: content.url,
    normalizedUrl: normalizeUrl(content.url),
    title: content.title,
    favicon: content.favicon,
    domain: getDomain(content.url),
    category: '其他',
    subCategory: '待整理',
    folderPath: ['其他', '待整理'],
    tags: [],
    aiCategorized: false,
    aiStatus: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    visitCount: 0,
    status: 'active',
    isArchived: false,
  }
}

// ── 异步 AI 处理流程 ─────────────────────────────────────────
async function processWithAI(bookmark: Bookmark, content: ExtractedContent) {
  const settings = await getSettings()
  const hasAnyAIWork =
    settings.autoClassify || settings.autoTag || settings.autoSummary || settings.autoExtractKeywords

  if (!hasAnyAIWork) {
    await updateAIStatus(bookmark, 'skipped', 'All AI automation options are disabled')
    return
  }

  const usage = await canUseAI()
  if (!usage.allowed) {
    await updateAIStatus(bookmark, 'skipped', BYOK_CONFIG_REQUIRED_MESSAGE)
    return
  }

  try {
    // 1. 分类与标签：四阶段智能分类（去重节流）
    if (settings.autoClassify || settings.autoTag) {
      const classification = await dedupAI(`classify:${getAIRequestCacheScope(settings)}:${content.url}`, () => smartClassify(content))
      if (classification && classification.confidence > 0.3) {
        if (settings.autoClassify) {
          bookmark.category = classification.folderPath[0]
          bookmark.subCategory = classification.folderPath[1]
          bookmark.folderPath = classification.folderPath
        }
        if (settings.autoTag) {
          bookmark.tags = classification.tags
        }
        bookmark.aiCategorized = true
        bookmark.aiConfidence = classification.confidence
        bookmark.aiReason = classification.reason
      }
    }

    // 2. 摘要（去重节流）
    if (settings.autoSummary) {
      if (hasReadableMainContent(content)) {
        const summary = await dedupAI(`summary:${getAIRequestCacheScope(settings)}:${content.url}`, () =>
          generateSummary(content, {
            category: bookmark.category,
            subCategory: bookmark.subCategory,
            tags: bookmark.tags,
            reason: bookmark.aiReason,
          }),
        )
        if (summary) {
          bookmark.summary = summary
          bookmark.summaryGeneratedAt = Date.now()
        }
      } else {
        bookmark.aiError = '当前没有可摘要的页面正文。纯前端模式只处理已打开并完成渲染的页面。'
      }
    }

    // 3. 关键词索引
    if (settings.autoExtractKeywords) {
      bookmark.keywords = await extractKeywords(content)
    }

    bookmark.aiStatus = 'done'
    if (bookmark.summary) bookmark.aiError = undefined
    await saveBookmark(bookmark)

    // 通知 Popup/SidePanel 更新
    chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
  } catch (err) {
    bookmark.aiStatus = 'failed'
    bookmark.aiError = err instanceof Error ? err.message : 'AI processing failed'
    await saveBookmark(bookmark)
    chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
    console.error('[BAI] AI processing failed:', err)
  }
}

async function updateAIStatus(
  bookmark: Bookmark,
  status: Bookmark['aiStatus'],
  error?: string,
): Promise<void> {
  bookmark.aiStatus = status
  bookmark.aiError = error
  await saveBookmark(bookmark)
  chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
}

function hasFolderChanged(current: Bookmark, updated: Bookmark): boolean {
  return normalizeBookmarkFolderPath(current).join('/') !== normalizeBookmarkFolderPath(updated).join('/')
}

function normalizeBookmarkFolderPath(bookmark: Pick<Bookmark, 'folderPath' | 'category' | 'subCategory'>): [string, string] {
  const raw = bookmark.folderPath?.length
    ? bookmark.folderPath
    : [bookmark.category, bookmark.subCategory]
  const [root = '其他', child = '待整理'] = raw.map(part => part?.trim()).filter(Boolean)
  return [root, child]
}

function getDuplicateBookmarkDeleteIds(bookmarks: Bookmark[]): string[] {
  const byUrl = new Map<string, Bookmark[]>()
  for (const bookmark of bookmarks.filter(bookmark => !bookmark.isArchived)) {
    const key = bookmark.normalizedUrl || normalizeUrl(bookmark.url)
    byUrl.set(key, [...(byUrl.get(key) ?? []), bookmark])
  }

  const deleteIds: string[] = []
  for (const group of byUrl.values()) {
    if (group.length <= 1) continue
    const duplicates = [...group].sort(compareBookmarkKeepPriority).slice(1)
    deleteIds.push(...duplicates.map(bookmark => bookmark.id))
  }
  return deleteIds
}

function compareBookmarkKeepPriority(a: Bookmark, b: Bookmark): number {
  const score = (bookmark: Bookmark) =>
    (bookmark.summary ? 1000 : 0) +
    (bookmark.aiStatus === 'done' ? 300 : 0) +
    (bookmark.tags.length ? 80 : 0) +
    (bookmark.note ? 70 : 0) +
    Math.min(bookmark.visitCount ?? 0, 50) +
    Math.floor((bookmark.updatedAt ?? bookmark.createdAt) / 100000000)

  return score(b) - score(a)
}
