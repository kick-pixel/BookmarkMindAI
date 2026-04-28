// ============================================================
// BookmarksAI · Background Service Worker
// ============================================================
import {
  initStorage,
  getAllBookmarks,
  getCategories,
  createCategory,
  deleteCategory,
  saveBookmark,
  saveBookmarksBulk,
  migrateLegacyImportedBookmarks,
  deleteBookmark,
  archiveBookmark,
  getSettings,
  updateSettings,
  recordVisit,
  canUseAI,
  incrementAIUsage,
  computeStatus,
  getDomain,
  normalizeUrl,
} from '../lib/storage'
import { generateSummary, extractKeywords } from '../lib/ai'
import { smartClassify } from '../lib/bookmarkClassifier'
import { getProviderPreset } from '../lib/aiProviders'
import type { Bookmark, Message, MessageResponse, ExtractedContent, UserSettings } from '../types'

// ── AI 请求去重节流 ────────────────────────────────────────────
const aiRequestCache = new Map<string, Promise<unknown>>()

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
      const content = await extractContentFromTab(tab)
      const bookmark = createBookmark(content)
      const saved = await saveBookmark(bookmark)
      if (saved.id === bookmark.id) processWithAI(saved, content)
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
      optimizeImportedBookmarks([...result.importedUrls, ...result.reprocessUrls, ...migratedUrls])
        .catch(err => console.error('[BAI] Import optimization failed:', err))
      return { success: true, data: result }
    }

    case 'DELETE_BOOKMARK': {
      await deleteBookmark(msg.payload as string)
      return { success: true }
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

async function optimizeImportedBookmarks(importedUrls: string[]): Promise<void> {
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

  // 广播初始进度
  broadcastImportProgress(0, total)

  await runWithConcurrency(imported, async (bookmark) => {
    if (!hasAutomation) {
      await updateAIStatus(bookmark, 'skipped', 'All AI automation options are disabled')
      processedCount++
      broadcastImportProgress(processedCount, total)
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
          const summary = await dedupAI(`summary:${bookmark.url}`, () =>
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
            bookmark.aiError = 'Summary generation returned empty result'
          }
        } else if (!aiReady) {
          bookmark.aiError = 'AI provider is not configured'
        } else {
          bookmark.aiError = 'AI quota exceeded before summary generation'
        }
      }

      if (settings.autoExtractKeywords) {
        bookmark.keywords = buildLocalKeywords(content)
      }

      bookmark.aiStatus = 'done'
      bookmark.updatedAt = Date.now()
      await saveBookmark(bookmark)
      chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
    } catch (err) {
      bookmark.aiStatus = 'failed'
      bookmark.aiError = err instanceof Error ? err.message : 'Import optimization failed'
      await saveBookmark(bookmark)
      chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
    }

    processedCount++
    broadcastImportProgress(processedCount, total)
  })
}

/** 广播导入处理进度 */
function broadcastImportProgress(processed: number, total: number) {
  chrome.runtime.sendMessage({
    type: 'IMPORT_PROGRESS',
    payload: { processed, total, percent: total > 0 ? Math.round((processed / total) * 100) : 100 },
  }).catch(() => {})
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
  const preset = getProviderPreset(settings.aiProvider)
  const apiKey = settings.apiKeys[settings.aiProvider]
  const baseUrl =
    settings.aiBaseUrls[settings.aiProvider] ||
    (settings.aiProvider === 'custom' ? settings.customBaseUrl : '') ||
    preset.baseUrl
  const model =
    settings.aiModels[settings.aiProvider] ||
    (settings.aiProvider === 'custom' ? settings.customModel : '') ||
    preset.defaultModel
  return Boolean(apiKey && baseUrl && model)
}

async function fetchTextPreview(url: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 6000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok || !contentType.includes('text/html')) return ''
    const html = await response.text()
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1800)
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
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
  const preset = getProviderPreset(settings.aiProvider)
  const apiKey = settings.apiKeys[settings.aiProvider]
  const baseUrl =
    settings.aiBaseUrls[settings.aiProvider] ||
    (settings.aiProvider === 'custom' ? settings.customBaseUrl : '') ||
    preset.baseUrl
  const model =
    settings.aiModels[settings.aiProvider] ||
    (settings.aiProvider === 'custom' ? settings.customModel : '') ||
    preset.defaultModel
  const hasAnyAIWork =
    settings.autoClassify || settings.autoTag || settings.autoSummary || settings.autoExtractKeywords

  if (!hasAnyAIWork) {
    await updateAIStatus(bookmark, 'skipped', 'All AI automation options are disabled')
    return
  }

  if (!apiKey || !baseUrl || !model) {
    await updateAIStatus(bookmark, 'skipped', 'AI provider is not configured')
    return
  }

  const usage = await canUseAI()
  if (!usage.allowed) {
    await updateAIStatus(bookmark, 'skipped', 'AI quota exceeded')
    return
  }

  try {
    // 1. 分类与标签：四阶段智能分类（去重节流）
    if (settings.autoClassify || settings.autoTag) {
      const classification = await dedupAI(`classify:${content.url}`, () => smartClassify(content))
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
        const summary = await dedupAI(`summary:${content.url}`, () =>
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
        }
      }
    }

    // 3. 关键词索引
    if (settings.autoExtractKeywords) {
      bookmark.keywords = await extractKeywords(content)
    }

    bookmark.aiStatus = 'done'
    bookmark.aiError = undefined
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
