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
  archiveBookmark,
  getSettings,
  updateSettings,
  resetFreeAIUsage,
  clearLocalData,
  recordVisit,
  canUseAI,
  incrementAIUsage,
  computeStatus,
  getDomain,
  normalizeUrl,
} from '../lib/storage'
import { generateSummary, extractKeywords } from '../lib/ai'
import { smartClassify } from '../lib/bookmarkClassifier'
import { recordUserCorrection } from '../lib/bookmarkClassifier/userLearning'
import {
  BYOK_CONFIG_REQUIRED_MESSAGE,
  FREE_AI_QUOTA_MESSAGE,
  FREE_AI_UNSTABLE_MESSAGE,
  isUsingBuiltInFreeAI,
  resolveAIConfig,
} from '../lib/aiConfig'
import type { Bookmark, Message, MessageResponse, ExtractedContent, UserSettings, ProcessingTask } from '../types'

// ── AI 请求去重节流 ────────────────────────────────────────────
const aiRequestCache = new Map<string, Promise<unknown>>()
const PROCESSING_TASK_KEY = 'bai_processing_task'
const CONTEXT_MENU_SAVE_PAGE = 'bai-save-page'
const CONTEXT_MENU_OPEN_PANEL = 'bai-open-panel'

function dedupAI<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = aiRequestCache.get(key)
  if (existing) return existing as Promise<T>
  const promise = factory().finally(() => { aiRequestCache.delete(key) })
  aiRequestCache.set(key, promise)
  return promise
}

// ── 导入并发控制 ────────────────────────────────────────────────
const CONCURRENCY_LIMIT = 6

async function runWithConcurrency<T>(
  items: T[],
  processor: (item: T, iondex: number) => Promise<void>,
): Promise<void> {
  const queue = [...items]
  const running: Promise<void>[] = []
  let index = 0

  function next(): Promise<void> | null {
    if (queue.length === 0) return null
    const item = queue.shift()!
    const currentIndex = index++
    const task = processor(item, currentIndex).catch(err => {
      console.error(`[BAI] Concurrency task #${currentIndex} failed:`, err)
    })
    running.push(task)
    task.then(() => running.splice(running.indexOf(task), 1))
    return task
  }

  // 启动初始批
  for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, items.length); i++) {
    next()
  }

  // 每当一个任务完成，启动下一个
  while (running.length > 0) {
    await Promise.race(running)
    if (queue.length > 0) next()
  }
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
      contexts: ['page'],
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

async function saveTabAsBookmark(tab: chrome.tabs.Tab, notify = false): Promise<Bookmark> {
  if (!tab.url) throw new Error('NO_ACTIVE_TAB')
  const content = await extractContentFromTab(tab)
  const bookmark = createBookmark(content)
  const saved = await saveBookmark(bookmark)
  if (saved.id === bookmark.id) processWithAI(saved, content)
  if (notify) notifySaved()
  return saved
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
      const saved = await saveTabAsBookmark(tab)
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
      await saveBookmark(bookmark)
      chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
      const content = await buildImportedContent(bookmark, { includeExistingSummary: false })
      processWithAI(bookmark, content)
      return { success: true, data: bookmark }
    }

    case 'IMPORT_BOOKMARKS': {
      const bookmarks = msg.payload as Bookmark[]
      const result = await saveBookmarksBulk(bookmarks)
      const migratedUrls = await migrateLegacyImportedBookmarks()
      optimizeImportedBookmarks([...result.importedUrls, ...result.reprocessUrls, ...migratedUrls], 'import')
        .catch(err => console.error('[BAI] Import optimization failed:', err))
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
      optimizeImportedBookmarks(failedUrls, 'retry')
        .catch(err => console.error('[BAI] Retry failed bookmarks failed:', err))
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

    case 'ARCHIVE_BOOKMARK': {
      await archiveBookmark(msg.payload as string)
      return { success: true }
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
      const settings = await getSettings()
      return {
        success: true,
        data: {
          ...usage,
          used: settings.aiUsageCount,
          quota: settings.freeQuotaPerMonth,
        },
      }
    }

    case 'RESET_FREE_AI_USAGE': {
      const settings = await resetFreeAIUsage()
      const usage = await canUseAI()
      return {
        success: true,
        data: {
          ...usage,
          used: settings.aiUsageCount,
          quota: settings.freeQuotaPerMonth,
        },
      }
    }

    case 'CLEAR_ALL_DATA': {
      await clearLocalData()
      await initStorage()
      return { success: true }
    }

    case 'AI_SUMMARIZE': {
      const { bookmark, content } = msg.payload as { bookmark: Bookmark; content: ExtractedContent }
      const usage = await canUseAI()
      if (!usage.allowed) return { success: false, error: 'QUOTA_EXCEEDED' }

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
        await incrementAIUsage()
      } else if (isUsingBuiltInFreeAI(await getSettings())) {
        return { success: false, error: FREE_AI_UNSTABLE_MESSAGE }
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
  }

  return {
    title: tab.title ?? tab.url ?? '',
    url: tab.url ?? '',
    description: '',
    mainContent: '',
    favicon: tab.favIconUrl,
  }
}

async function optimizeImportedBookmarks(importedUrls: string[], taskType: ProcessingTask['type']): Promise<void> {
  if (!importedUrls.length) return

  const settings = await getSettings()
  const hasAutomation =
    settings.autoClassify || settings.autoTag || settings.autoSummary || settings.autoExtractKeywords

  const importedUrlSet = new Set(importedUrls.map(normalizeUrl))
  const bookmarks = await getAllBookmarks()
  const imported = bookmarks.filter(bookmark => importedUrlSet.has(normalizeUrl(bookmark.url)))
  const aiReady = isAIConfigured(settings)
  const total = imported.length
  let processedCount = 0
  let failedCount = 0
  const taskId = `${taskType}_${Date.now()}`

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

  await runWithConcurrency(imported, async (bookmark) => {
    await updateProcessingTask({
      id: taskId,
      type: taskType,
      status: 'running',
      total,
      processed: processedCount,
      failed: failedCount,
      currentTitle: bookmark.title,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    })

    if (!hasAutomation) {
      await updateAIStatus(bookmark, 'skipped', 'All AI automation options are disabled')
      processedCount++
      await broadcastProcessingProgress(taskId, taskType, processedCount, total, failedCount)
      return
    }

    try {
      const content = await buildImportedContent(bookmark)

      if (settings.autoClassify || settings.autoTag) {
        const classification = await smartClassify(content, { localOnly: !aiReady })
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

      if (settings.autoSummary) {
        const summaryUsage = aiReady ? await canUseAI() : { allowed: false }
        if (summaryUsage.allowed) {
          const summary = await dedupAI(`summary:${getAIRequestCacheScope(settings)}:${bookmark.url}`, () =>
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
            await incrementAIUsage()
            bookmark.aiError = undefined
          } else {
            bookmark.aiError = isUsingBuiltInFreeAI(settings)
              ? FREE_AI_UNSTABLE_MESSAGE
              : 'Summary generation returned empty result'
          }
        } else if (!aiReady) {
          bookmark.aiError = settings.aiServiceMode === 'byok' ? BYOK_CONFIG_REQUIRED_MESSAGE : 'AI provider is not configured'
        } else {
          bookmark.aiError = isUsingBuiltInFreeAI(settings)
            ? FREE_AI_QUOTA_MESSAGE
            : 'AI quota exceeded before summary generation'
        }
      }

      if (settings.autoExtractKeywords) {
        bookmark.keywords = buildLocalKeywords(content)
      }

      if (bookmark.aiError) failedCount++
      bookmark.aiStatus = 'done'
      bookmark.updatedAt = Date.now()
      await saveBookmark(bookmark)
      chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
    } catch (err) {
      bookmark.aiStatus = 'failed'
      bookmark.aiError = err instanceof Error ? err.message : 'Import optimization failed'
      failedCount++
      await saveBookmark(bookmark)
      chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
    }

    processedCount++
    await broadcastProcessingProgress(taskId, taskType, processedCount, total, failedCount)
  })

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

async function buildImportedContent(
  bookmark: Bookmark,
  options: { includeExistingSummary?: boolean } = {},
): Promise<ExtractedContent> {
  const fetched = await fetchTextPreview(bookmark.url).catch(() => '')
  const includeExistingSummary = options.includeExistingSummary ?? true
  return {
    title: bookmark.title,
    url: bookmark.url,
    description: [
      bookmark.domain,
      bookmark.sourceFolderPath?.length ? `原收藏夹目录：${bookmark.sourceFolderPath.join('/')}` : '',
      bookmark.folderPath?.length ? `当前目录：${bookmark.folderPath.join('/')}` : '',
      bookmark.tags.join(', '),
      bookmark.note,
    ].filter(Boolean).join('\n'),
    mainContent: fetched || (includeExistingSummary ? bookmark.summary : '') || '',
    favicon: bookmark.favicon,
  }
}

function buildLocalKeywords(content: ExtractedContent): string[] {
  return [
    content.title,
    content.description,
    content.url,
  ]
    .join(' ')
    .split(/[\s,，。！？|｜:：\-_/]+/)
    .map(keyword => keyword.trim())
    .filter(keyword => keyword.length >= 2)
    .slice(0, 8)
}

function isAIConfigured(settings: UserSettings): boolean {
  return Boolean(resolveAIConfig(settings))
}

function getAIRequestCacheScope(settings: UserSettings): string {
  const config = resolveAIConfig(settings)
  if (!config) return `${settings.aiServiceMode}:${settings.aiProvider}:unconfigured`
  return `${settings.aiServiceMode}:${config.provider}:${config.baseUrl ?? ''}:${config.model ?? ''}`
}

async function fetchTextPreview(url: string): Promise<string> {
  for (const candidate of getTextPreviewUrls(url)) {
    const controller = new AbortController()
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 6000)
    try {
      const response = await fetch(candidate, { signal: controller.signal })
      if (!response.ok) continue

      const contentType = response.headers.get('content-type') ?? ''
      const text = await response.text()
      const preview = extractTextPreview(text, contentType)
      if (preview) return preview
    } catch {
      // Try the next candidate URL. Imported bookmarks should degrade gracefully.
    } finally {
      globalThis.clearTimeout(timeoutId)
    }
  }
  return ''
}

function getTextPreviewUrls(url: string): string[] {
  const githubRawUrl = toGithubRawUrl(url)
  return githubRawUrl ? [githubRawUrl, url] : [url]
}

function toGithubRawUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'github.com') return null
    const parts = parsed.pathname.split('/').filter(Boolean)
    const blobIndex = parts.indexOf('blob')
    if (parts.length < 5 || blobIndex !== 2) return null
    const [owner, repo, , branch, ...filePath] = parts
    if (!owner || !repo || !branch || !filePath.length) return null
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath.join('/')}`
  } catch {
    return null
  }
}

function extractTextPreview(text: string, contentType: string): string {
  const normalizedType = contentType.toLowerCase()
  if (
    normalizedType.includes('text/plain') ||
    normalizedType.includes('text/markdown') ||
    normalizedType.includes('application/json') ||
    normalizedType.includes('application/octet-stream')
  ) {
    return text.replace(/\s+/g, ' ').trim().slice(0, 1800)
  }

  if (!normalizedType.includes('text/html')) return ''

  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800)
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
    await updateAIStatus(bookmark, 'skipped', settings.aiServiceMode === 'byok' ? BYOK_CONFIG_REQUIRED_MESSAGE : FREE_AI_QUOTA_MESSAGE)
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
      const usageNow = await canUseAI()
      if (usageNow.allowed) {
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
          await incrementAIUsage()
        } else if (isUsingBuiltInFreeAI(settings)) {
          bookmark.aiError = FREE_AI_UNSTABLE_MESSAGE
        } else if (settings.aiServiceMode === 'byok') {
          bookmark.aiError = BYOK_CONFIG_REQUIRED_MESSAGE
        }
      } else if (settings.aiServiceMode === 'byok') {
        bookmark.aiError = BYOK_CONFIG_REQUIRED_MESSAGE
      }
    }

    // 3. 关键词索引
    if (settings.autoExtractKeywords) {
      bookmark.keywords = await extractKeywords(content)
    }

    bookmark.aiStatus = 'done'
    if (!bookmark.aiError) bookmark.aiError = undefined
    await saveBookmark(bookmark)

    // 通知 Popup/SidePanel 更新
    chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
  } catch (err) {
    bookmark.aiStatus = 'failed'
    bookmark.aiError = isUsingBuiltInFreeAI(settings)
      ? FREE_AI_UNSTABLE_MESSAGE
      : err instanceof Error ? err.message : 'AI processing failed'
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
