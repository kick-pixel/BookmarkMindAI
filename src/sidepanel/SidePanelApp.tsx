import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { parseImportedBookmarks } from '../lib/bookmarkImport'
import { BOOKMARK_TAXONOMY } from '../lib/bookmarkTaxonomy'
import { displayCategory, displayFolderPath } from '../lib/categoryI18n'
import { createTranslator, resolveLocale } from '../lib/i18n'
import type { Locale } from '../lib/i18n'
import type { Bookmark, Category, ProcessingTask, UserSettings } from '../types'

type FilterStatus = 'all' | 'active' | 'idle' | 'sleeping' | 'needsReview' | 'aiFailed' | 'noSummary' | 'duplicates' | 'inbox'
type SortKey = 'newest' | 'oldest' | 'visited' | 'alpha'

const TAXONOMY_ROOTS = new Set(BOOKMARK_TAXONOMY.map(group => group.name))
const TAXONOMY_CHILDREN = new Map(BOOKMARK_TAXONOMY.map(group => [group.name, group.children]))

function getFolderPath(bookmark: Bookmark): string[] {
  const path = bookmark.folderPath?.map(part => part.trim()).filter(Boolean) ?? []
  return path.length ? path : [bookmark.category || '其他']
}

function getFolderKey(bookmark: Bookmark): string {
  return getFolderPath(bookmark).join('/')
}

function getFolderLabel(bookmark: Bookmark, locale?: Locale): string {
  const path = getFolderPath(bookmark)
  if (locale) return displayFolderPath(path, locale).join('/')
  return path.join('/')
}

function getDuplicateKey(bookmark: Bookmark): string {
  return bookmark.normalizedUrl || bookmark.url.trim().replace(/\/$/, '')
}

function isInboxBookmark(bookmark: Bookmark): boolean {
  return getFolderKey(bookmark) === '其他/待整理' || !bookmark.aiCategorized
}

function hasAIProblem(bookmark: Bookmark): boolean {
  return bookmark.aiStatus === 'failed' || Boolean(bookmark.aiError)
}

function lacksSummary(bookmark: Bookmark): boolean {
  return bookmark.aiStatus !== 'pending' && !bookmark.summary?.trim()
}

function expandSearchTokens(query: string): string[] {
  const baseTokens = query
    .toLowerCase()
    .split(/[\s,，。！？|｜:：\-_/]+/)
    .map(token => token.trim())
    .filter(Boolean)
  const synonyms: Record<string, string[]> = {
    vpn: ['vpn', 'proxy', '代理', 'protonvpn', 'wireguard', 'openvpn', 'clash', 'v2ray', '科学上网'],
    proxy: ['proxy', 'vpn', '代理', 'clash', 'v2ray', 'shadowsocks'],
    代理: ['代理', 'vpn', 'proxy', 'clash', 'v2ray', '科学上网', '网络代理'],
    web3: ['web3', 'blockchain', '区块链', 'solana', 'ethereum', 'defi', 'nft', 'faucet', 'airdrop', 'wallet'],
    区块链: ['区块链', 'web3', 'blockchain', 'solana', 'ethereum', 'defi', 'nft', '智能合约'],
    solana: ['solana', 'web3', 'blockchain', '区块链', 'faucet', 'airdrop', 'phantom'],
    ai: ['ai', 'llm', 'openai', 'deepseek', 'agent', 'prompt', '模型', '人工智能'],
    llm: ['llm', 'ai', 'openai', 'deepseek', '模型', '大模型', 'agent'],
    数据库: ['数据库', 'database', 'sql', 'mysql', 'postgres', 'postgresql', 'redis'],
    设计: ['设计', 'design', 'ui', 'ux', 'figma', '产品设计'],
  }
  return [...new Set(baseTokens.flatMap(token => synonyms[token] ?? [token]))]
}

function scoreText(value: string | undefined, tokens: string[], weight: number): number {
  const text = value?.toLowerCase()
  if (!text) return 0
  return tokens.reduce((score, token) => {
    if (text === token) return score + weight * 1.4
    if (text.startsWith(token)) return score + weight * 1.2
    if (text.includes(token)) return score + weight
    return score
  }, 0)
}

function getRootCategories(categories: Category[]): Category[] {
  return categories
    .filter(category => !category.parentId && (TAXONOMY_ROOTS.has(category.name) || category.id.startsWith('user_')))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh'))
}

function getChildCategories(categories: Category[], parentId?: string): Category[] {
  if (!parentId) return []
  return categories
    .filter(category => category.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh'))
}

function findRootCategory(categories: Category[], name: string): Category | undefined {
  return categories.find(category => !category.parentId && category.name === name)
}

function getFolderChildren(categories: Category[], rootName: string): string[] {
  const root = findRootCategory(categories, rootName)
  const taxonomyChildren = TAXONOMY_CHILDREN.get(rootName) ?? []
  const userChildren = getChildCategories(categories, root?.id)
    .filter(category => category.id.startsWith('user_'))
    .map(category => category.name)
  return [...new Set([...taxonomyChildren, ...userChildren])]
}

export default function SidePanelApp() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [reprocessingIds, setReprocessingIds] = useState<Set<string>>(() => new Set())
  const [processingTask, setProcessingTask] = useState<ProcessingTask | null>(null)
  const [dismissedProcessingTaskIds, setDismissedProcessingTaskIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [now] = useState(() => Date.now())
  const { t } = createTranslator(settings?.language)
  const locale = resolveLocale(settings?.language)
  const aiConfigured = Boolean(settings?.aiEnabled)
  const aiNeedsSetup = Boolean(settings?.aiEnabled && !aiConfigured)
  const statusLabels: Record<FilterStatus, string> = {
    all: t('all'),
    active: t('active'),
    idle: t('idle'),
    sleeping: t('sleeping'),
    needsReview: t('needsReview'),
    aiFailed: t('aiFailedFilter'),
    noSummary: t('noSummaryFilter'),
    duplicates: t('duplicatesFilter'),
    inbox: t('inboxFilter'),
  }

  useEffect(() => {
    async function refreshLibrary() {
      const [bmRes, catRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' }),
        chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' }),
      ])
      if (bmRes.success) setBookmarks(bmRes.data.filter((bookmark: Bookmark) => !bookmark.isArchived))
      if (catRes.success) setCategories(catRes.data)
    }

    async function loadData() {
      const [bmRes, catRes, settingsRes, taskRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' }),
        chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'GET_PROCESSING_TASK' }),
      ])
      if (bmRes.success) setBookmarks(bmRes.data.filter((b: Bookmark) => !b.isArchived))
      if (catRes.success) setCategories(catRes.data)
      if (settingsRes.success) setSettings(settingsRes.data)
      if (taskRes.success) setProcessingTask(taskRes.data)
      setLoading(false)
    }

    void loadData()
    const handler = (msg: { type: string; payload: Bookmark | ProcessingTask }) => {
      if (msg.type === 'BOOKMARK_UPDATED') {
        const bookmark = msg.payload as Bookmark
        setBookmarks(prev => {
          if (bookmark.isArchived) return prev.filter(item => item.id !== bookmark.id)
          const exists = prev.some(item => item.id === bookmark.id)
          if (exists) return prev.map(item => item.id === bookmark.id ? bookmark : item)
          return [bookmark, ...prev]
        })
        if (bookmark.aiStatus !== 'pending') {
          setReprocessingIds(prev => {
            const next = new Set(prev)
            next.delete(bookmark.id)
            return next
          })
          chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' })
            .then(res => { if (res.success) setCategories(res.data) })
            .catch(() => {})
        }
      }
      if (msg.type === 'PROCESSING_TASK_UPDATED') {
        const task = msg.payload as ProcessingTask
        setProcessingTask(task)
        if (task.status === 'completed' || task.status === 'failed') {
          void refreshLibrary()
        }
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>()
    bookmarks.forEach(bookmark => {
      const key = getDuplicateKey(bookmark)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key))
  }, [bookmarks])

  const stats = useMemo(() => {
    const usedRoots = new Set<string>()
    const usedChildren = new Set<string>()
    for (const bookmark of bookmarks) {
      const [root, child] = getFolderPath(bookmark)
      usedRoots.add(root)
      if (child) usedChildren.add(`${root}/${child}`)
    }
    const rootById = new Map(categories.filter(category => !category.parentId).map(category => [category.id, category]))
    const emptyUserChildIds = new Set(
      categories
        .filter(category => category.id.startsWith('user_') && category.parentId)
        .filter(category => {
          const parent = rootById.get(category.parentId!)
          return !parent || !usedChildren.has(`${parent.name}/${category.name}`)
        })
        .map(category => category.id),
    )
    const keptChildrenByParent = new Set(
      categories
        .filter(category => category.parentId && !emptyUserChildIds.has(category.id))
        .map(category => category.parentId!),
    )
    const emptyFolders = categories.filter(category => {
      if (!category.id.startsWith('user_')) return false
      if (category.parentId) return emptyUserChildIds.has(category.id)
      return !usedRoots.has(category.name) && !keptChildrenByParent.has(category.id)
    }).length
    const aiFailed = bookmarks.filter(hasAIProblem).length
    const noSummary = bookmarks.filter(lacksSummary).length
    const duplicates = bookmarks.filter(bookmark => duplicateKeys.has(getDuplicateKey(bookmark))).length
    const inbox = bookmarks.filter(isInboxBookmark).length
    const needsReviewIds = new Set(
      bookmarks
        .filter(bookmark =>
          hasAIProblem(bookmark) ||
          lacksSummary(bookmark) ||
          isInboxBookmark(bookmark) ||
          duplicateKeys.has(getDuplicateKey(bookmark))
        )
        .map(bookmark => bookmark.id),
    )
    return {
      total: bookmarks.length,
      active: bookmarks.filter(b => b.status === 'active').length,
      sleeping: bookmarks.filter(b => b.status === 'sleeping').length,
      aiFailed,
      noSummary,
      duplicates,
      inbox,
      emptyFolders,
      needsReview: needsReviewIds.size,
    }
  }, [bookmarks, categories, duplicateKeys])

  const rootCategories = useMemo(() => getRootCategories(categories), [categories])

  const folderTree = useMemo(() => {
    const tree = new Map<string, { id?: string; count: number; children: Map<string, { id?: string; count: number }> }>()
    for (const category of rootCategories) {
      tree.set(category.name, { id: category.id, count: 0, children: new Map() })
      for (const child of getChildCategories(categories, category.id)) {
        tree.get(category.name)?.children.set(child.name, { id: child.id, count: 0 })
      }
    }

    bookmarks.forEach(bookmark => {
      const [category, subCategory] = getFolderPath(bookmark)
      const group = tree.get(category) ?? { count: 0, children: new Map() }
      group.count += 1
      if (subCategory) {
        const child = group.children.get(subCategory) ?? { count: 0 }
        child.count += 1
        group.children.set(subCategory, child)
      }
      tree.set(category, group)
    })

    return Array.from(tree.entries())
      .filter(([, data]) => data.count > 0 || data.id?.startsWith('user_'))
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0], 'zh'))
      .map(([category, data]) => ({
        category,
        id: data.id,
        count: data.count,
        children: Array.from(data.children.entries())
          .filter(([name, child]) => Boolean(name.trim()) && (child.count > 0 || child.id?.startsWith('user_')))
          .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0], 'zh'))
          .map(([name, child]) => ({ name, id: child.id, count: child.count })),
      }))
  }, [bookmarks, categories, rootCategories])

  const scoreBookmark = useCallback((bookmark: Bookmark, query: string): number => {
    const tokens = expandSearchTokens(query)
    if (!tokens.length) return 0
    let score = 0
    score += scoreText(bookmark.title, tokens, 42)
    score += scoreText(bookmark.domain, tokens, 22)
    score += scoreText(bookmark.url, tokens, 16)
    score += scoreText(bookmark.category, tokens, 20)
    score += scoreText(bookmark.subCategory, tokens, 22)
    score += scoreText(getFolderLabel(bookmark, locale), tokens, 24)
    score += scoreText(bookmark.summary, tokens, 10)
    score += scoreText(bookmark.note, tokens, 12)
    score += scoreText(bookmark.aiReason, tokens, 8)
    score += bookmark.tags.reduce((sum, tag) => sum + scoreText(tag, tokens, 28), 0)
    score += bookmark.keywords?.reduce((sum, keyword) => sum + scoreText(keyword, tokens, 24), 0) ?? 0
    score += bookmark.sourceFolderPath?.reduce((sum, folder) => sum + scoreText(folder, tokens, 10), 0) ?? 0
    score += Math.max(0, 5 - Math.floor((now - bookmark.createdAt) / 86400000 / 7))
    return score
  }, [now])

  const displayedBookmarks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    let list = bookmarks

    if (selectedCat !== 'all') {
      list = list.filter(b => getFolderKey(b) === selectedCat || getFolderPath(b)[0] === selectedCat)
    }
    if (filterStatus === 'active' || filterStatus === 'idle' || filterStatus === 'sleeping') {
      list = list.filter(b => b.status === filterStatus)
    }
    if (filterStatus === 'needsReview') {
      list = list.filter(bookmark =>
        hasAIProblem(bookmark) ||
        lacksSummary(bookmark) ||
        isInboxBookmark(bookmark) ||
        duplicateKeys.has(getDuplicateKey(bookmark))
      )
    }
    if (filterStatus === 'aiFailed') list = list.filter(hasAIProblem)
    if (filterStatus === 'noSummary') list = list.filter(lacksSummary)
    if (filterStatus === 'duplicates') list = list.filter(bookmark => duplicateKeys.has(getDuplicateKey(bookmark)))
    if (filterStatus === 'inbox') list = list.filter(isInboxBookmark)

    if (query) {
      return list
        .map(bookmark => ({ bookmark, score: scoreBookmark(bookmark, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || b.bookmark.createdAt - a.bookmark.createdAt)
        .map(item => item.bookmark)
    }

    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'newest': return b.createdAt - a.createdAt
        case 'oldest': return a.createdAt - b.createdAt
        case 'visited': return (b.lastVisitedAt ?? 0) - (a.lastVisitedAt ?? 0)
        case 'alpha': return a.title.localeCompare(b.title, 'zh')
        default: return 0
      }
    })
  }, [bookmarks, selectedCat, filterStatus, searchQuery, sortKey, scoreBookmark, duplicateKeys])

  const handleRetryFailed = useCallback(async () => {
    const res = await chrome.runtime.sendMessage({ type: 'RETRY_FAILED_BOOKMARKS' })
    if (res.success) {
      const taskRes = await chrome.runtime.sendMessage({ type: 'GET_PROCESSING_TASK' })
      if (taskRes.success) setProcessingTask(taskRes.data)
    }
  }, [])

  const handleDismissProcessingTask = useCallback((taskId: string) => {
    setDismissedProcessingTaskIds(prev => new Set(prev).add(taskId))
    setProcessingTask(null)
    chrome.runtime.sendMessage({ type: 'DISMISS_PROCESSING_TASK', payload: taskId }).catch(() => {})
  }, [])

  const handleCleanDuplicates = useCallback(async () => {
    if (!confirm(t('cleanDuplicatesConfirm', { count: stats.duplicates }))) return
    const res = await chrome.runtime.sendMessage({ type: 'CLEAN_DUPLICATE_BOOKMARKS' })
    if (res.success) {
      setBookmarks(res.data.bookmarks.filter((bookmark: Bookmark) => !bookmark.isArchived))
      setFilterStatus('all')
    }
  }, [stats.duplicates, t])

  const handleCleanEmptyFolders = useCallback(async () => {
    if (!confirm(t('cleanEmptyFoldersConfirm', { count: stats.emptyFolders }))) return
    const res = await chrome.runtime.sendMessage({ type: 'CLEAN_EMPTY_FOLDERS' })
    if (res.success) setCategories(res.data)
  }, [stats.emptyFolders, t])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t('confirmDelete'))) return
    await chrome.runtime.sendMessage({ type: 'DELETE_BOOKMARK', payload: id })
    setBookmarks(prev => prev.filter(b => b.id !== id))
  }, [t])

  const handleOpen = useCallback((url: string) => {
    chrome.tabs.create({ url })
  }, [])

  const handleSaveCurrentPage = useCallback(async () => {
    const res = await chrome.runtime.sendMessage({ type: 'SAVE_CURRENT_TAB' })
    if (res.success) {
      setBookmarks(prev => [res.data, ...prev.filter(item => item.id !== res.data.id)])
    }
  }, [])

  const handleImportBookmarks = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.html,.htm,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const imported = parseImportedBookmarks(file.name, text)
      const res = await chrome.runtime.sendMessage({ type: 'IMPORT_BOOKMARKS', payload: imported })
      if (res.success) {
        const [bmRes, catRes] = await Promise.all([
          chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' }),
          chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' }),
        ])
        if (bmRes.success) setBookmarks(bmRes.data.filter((bookmark: Bookmark) => !bookmark.isArchived))
        if (catRes.success) setCategories(catRes.data)
      }
    }
    input.click()
  }, [])

  const handleUpdateBookmark = useCallback(async (id: string, patch: Partial<Bookmark>) => {
    const res = await chrome.runtime.sendMessage({ type: 'UPDATE_BOOKMARK', payload: { id, ...patch } })
    if (res.success) {
      setBookmarks(prev => prev.map(bookmark => bookmark.id === id ? res.data : bookmark))
    }
  }, [])

  const handleReprocess = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setReprocessingIds(prev => new Set(prev).add(id))
    setBookmarks(prev => prev.map(bookmark => bookmark.id === id
      ? { ...bookmark, aiStatus: 'pending', aiError: undefined, updatedAt: Date.now() }
      : bookmark,
    ))

    try {
      const res = await chrome.runtime.sendMessage({ type: 'REPROCESS_BOOKMARK', payload: id })
      if (res.success) {
        setBookmarks(prev => prev.map(bookmark => bookmark.id === id ? res.data : bookmark))
      } else {
        setBookmarks(prev => prev.map(bookmark => bookmark.id === id
          ? { ...bookmark, aiStatus: 'failed', aiError: res.error ?? 'AI analysis failed' }
          : bookmark,
        ))
      }
    } catch (err) {
      setBookmarks(prev => prev.map(bookmark => bookmark.id === id
        ? { ...bookmark, aiStatus: 'failed', aiError: err instanceof Error ? err.message : 'AI analysis failed' }
        : bookmark,
      ))
    } finally {
      setReprocessingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const handleCreateRootFolder = useCallback(async () => {
    const name = prompt(t('newFolderPrompt'))?.trim()
    if (!name) return
    const res = await chrome.runtime.sendMessage({ type: 'CREATE_CATEGORY', payload: { name } })
    if (res.success) setCategories(res.data)
  }, [t])

  const handleCreateSubFolder = useCallback(async (parentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const name = prompt(t('newSubFolderPrompt'))?.trim()
    if (!name) return
    const res = await chrome.runtime.sendMessage({ type: 'CREATE_CATEGORY', payload: { name, parentId } })
    if (res.success) setCategories(res.data)
  }, [t])

  const handleDeleteFolder = useCallback(async (category: Category, e: React.MouseEvent) => {
    e.stopPropagation()
    const parent = category.parentId ? categories.find(item => item.id === category.parentId) : undefined
    const affectedCount = bookmarks.filter(bookmark => {
      const [root, child] = getFolderPath(bookmark)
      return category.parentId
        ? parent?.name === root && category.name === child
        : category.name === root
    }).length
    const ok = confirm(
      affectedCount > 0
        ? t('deleteFolderWithBookmarksConfirm', { name: category.name, count: affectedCount })
        : t('deleteEmptyFolderConfirm', { name: category.name }),
    )
    if (!ok) return
    const res = await chrome.runtime.sendMessage({ type: 'DELETE_CATEGORY', payload: { categoryId: category.id } })
    if (res.success) {
      setCategories(res.data.categories)
      setBookmarks(res.data.bookmarks.filter((bookmark: Bookmark) => !bookmark.isArchived))
      setSelectedCat('all')
    }
  }, [bookmarks, categories, t])

  function timeAgo(ts?: number): string {
    if (!ts) return t('never')
    const days = Math.floor((now - ts) / 86400000)
    if (days === 0) return t('today')
    if (days === 1) return t('yesterday')
    if (days < 30) return t('daysAgo', { count: days })
    if (days < 365) return t('monthsAgo', { count: Math.floor(days / 30) })
    return t('yearsAgo', { count: Math.floor(days / 365) })
  }

  if (loading) {
    return (
      <div className="sp-loading">
        <div className="spinner sp-loading-spinner" />
        <span className="text-muted">{t('loading')}</span>
      </div>
    )
  }

  return (
    <div className="sp-shell">
      <header className="sp-header">
        <div className="sp-logo">BAI</div>
        <div className="sp-heading">
          <div className="sp-title">{t('library')}</div>
          <div className="sp-subtitle">{t('panelSubtitle')}</div>
        </div>
        <div className="sp-header-actions">
          <button className="btn btn-primary btn-sm" onClick={handleSaveCurrentPage}>
            + {t('saveCurrentPage')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleImportBookmarks}>
            {t('importBookmarks')}
          </button>
          <select
            className="sort-select"
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            aria-label="Sort bookmarks"
          >
            <option value="newest">{t('newest')}</option>
            <option value="oldest">{t('oldest')}</option>
            <option value="visited">{t('visited')}</option>
            <option value="alpha">{t('alpha')}</option>
          </select>
          <button className="btn btn-ghost btn-icon" onClick={() => chrome.runtime.openOptionsPage()}>
            {t('settings')}
          </button>
        </div>
      </header>

      <div className="sp-search">
        <div className="search-wrapper">
          <span className="search-icon">⌕</span>
          <input
            className="input search-input"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">×</button>
          )}
        </div>
      </div>

      {aiNeedsSetup && (
        <section className="sp-ai-ribbon compact warning">
          <div>
            <strong>{t('aiNeedsSetup')}</strong>
            <span>{t('aiNeedsSetupDesc')}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => chrome.runtime.openOptionsPage()}>
            {t('configureAI')}
          </button>
        </section>
      )}

      {processingTask && processingTask.status !== 'completed' && !dismissedProcessingTaskIds.has(processingTask.id) && (
        <ProcessingTaskCard
          task={processingTask}
          onRetryFailed={handleRetryFailed}
          onDismiss={handleDismissProcessingTask}
          t={t}
        />
      )}

      <div className="sp-body">
        <nav className="sp-sidebar">
          <div className="sidebar-title-row">
            <div className="sidebar-section-label">{t('folderFilter')}</div>
            <button className="folder-tool-btn" title={t('addRootFolder')} onClick={handleCreateRootFolder}>+</button>
          </div>
          <button
            className={`cat-item ${selectedCat === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCat('all')}
          >
            <span className="cat-icon">ALL</span>
            <span className="cat-name">{t('all')}</span>
            <span className="cat-count">{bookmarks.length}</span>
          </button>
          {folderTree.map(folder => (
            <div key={folder.category} className="folder-group">
              <button
                className={`cat-item ${selectedCat === folder.category ? 'active' : ''}`}
                onClick={() => setSelectedCat(folder.category)}
              >
                <span className="cat-icon">▾</span>
                <span className="cat-name">{displayCategory(folder.category, locale)}</span>
                <span className="cat-count">{folder.count}</span>
                {folder.id && (
                  <span className="folder-actions">
                    <span className="folder-mini-btn" title={t('addSubFolder')} onClick={e => handleCreateSubFolder(folder.id!, e)}>+</span>
                    <span className="folder-mini-btn danger" title={t('deleteFolder')} onClick={e => handleDeleteFolder({ id: folder.id!, name: folder.category, order: 0 }, e)}>×</span>
                  </span>
                )}
              </button>
              {folder.children.map(child => {
                const key = `${folder.category}/${child.name}`
                return (
                  <button
                    key={key}
                    className={`cat-item child ${selectedCat === key ? 'active' : ''}`}
                    onClick={() => setSelectedCat(key)}
                  >
                    <span className="cat-icon">└</span>
                    <span className="cat-name">{displayCategory(child.name, locale)}</span>
                    <span className="cat-count">{child.count}</span>
                    {child.id && (
                      <span className="folder-actions">
                        <span
                          className="folder-mini-btn danger"
                          title={t('deleteFolder')}
                          onClick={e => handleDeleteFolder({ id: child.id!, name: child.name, parentId: folder.id, order: 0 }, e)}
                        >×</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <main className="sp-content">
          {selectedCat === 'all' && !searchQuery && (
            <div className="sp-stats">
              <div className="stat-card">
                <div className="stat-num accent">{stats.total}</div>
                <div className="stat-label">{t('totalBookmarks')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-num success">{stats.active}</div>
                <div className="stat-label">{t('activeBookmarks')}</div>
              </div>
              <button className="stat-card stat-button" onClick={() => setFilterStatus('needsReview')}>
                <div className={`stat-num ${stats.needsReview > 0 ? 'warn' : 'success'}`}>{stats.needsReview}</div>
                <div className="stat-label">{t('needsReview')}</div>
              </button>
              <div className="stat-card">
                <div className="stat-num muted">{stats.sleeping}</div>
                <div className="stat-label">{t('sleepingBookmarks')}</div>
              </div>
            </div>
          )}

          <div className="sp-ops compact">
            <div>
              <strong>{t('resultCount', { count: displayedBookmarks.length })}</strong>
              <span>{stats.needsReview > 0 ? t('healthSummary', { count: stats.needsReview }) : searchQuery ? t('searchPlaceholder') : t('editTagsCta')}</span>
            </div>
            <div className="sp-ops-actions">
              {stats.noSummary + stats.aiFailed + stats.inbox > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={handleRetryFailed}>
                  {t('repairWithAI')}
                </button>
              )}
              {stats.duplicates > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={handleCleanDuplicates}>
                  {t('cleanDuplicates')}
                </button>
              )}
              {stats.emptyFolders > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={handleCleanEmptyFolders}>
                  {t('cleanEmptyFolders')}
                </button>
              )}
            </div>
          </div>

          <div className="sp-filters">
            {(Object.keys(statusLabels) as FilterStatus[]).map(s => (
              <button
                key={s}
                className={`filter-chip ${filterStatus === s ? 'active' : ''}`}
                onClick={() => setFilterStatus(s)}
              >
                {statusLabels[s]}
              </button>
            ))}
          </div>

          {displayedBookmarks.length === 0 ? (
            <div className="sp-empty">
              <div className="empty-orb">{searchQuery ? '⌕' : '+'}</div>
              <div className="msg">
                <strong>{searchQuery ? t('noResults') : t('noBookmarksTitle')}</strong>
                {!searchQuery && <span>{t('noBookmarksDesc')}</span>}
              </div>
              {!searchQuery && (
                <button className="btn btn-primary" onClick={handleSaveCurrentPage}>
                  + {t('saveCurrentPage')}
                </button>
              )}
            </div>
          ) : (
            displayedBookmarks.map(bm => (
              <BookmarkCard
                key={bm.id}
                bookmark={bm}
                categories={categories}
                editing={editingId === bm.id}
                onOpen={handleOpen}
                onEdit={setEditingId}
                onDelete={handleDelete}
                onUpdate={handleUpdateBookmark}
                onReprocess={handleReprocess}
                isReprocessing={reprocessingIds.has(bm.id)}
                timeAgo={timeAgo}
                t={t}
                locale={locale}
                searchQuery={searchQuery}
              />
            ))
          )}
        </main>
      </div>
    </div>
  )
}

function ProcessingTaskCard({
  task,
  onRetryFailed,
  onDismiss,
  t,
}: {
  task: ProcessingTask
  onRetryFailed: () => void
  onDismiss: (taskId: string) => void
  t: ReturnType<typeof createTranslator>['t']
}) {
  const percent = task.total > 0 ? Math.round((task.processed / task.total) * 100) : 0
  const isRunning = task.status === 'running'
  const title = task.type === 'retry' ? t('processingRetry') : t('processingImport')

  return (
    <section className={`processing-task-card ${task.status}`}>
      <div className="processing-task-head">
        <div>
          <strong>{title}</strong>
          <span>
            {isRunning
              ? t('processingRunning', { processed: task.processed, total: task.total })
              : task.failed > 0
                ? t('processingFailed', { failed: task.failed })
                : t('processingCompleted', { processed: task.processed })}
          </span>
        </div>
        <div className="processing-task-meta">
          <div className="processing-task-percent">{percent}%</div>
          <button
            type="button"
            className="processing-task-close"
            aria-label={t('dismiss')}
            onClick={() => onDismiss(task.id)}
          >
            ×
          </button>
        </div>
      </div>
      <div className="processing-task-track">
        <div className="processing-task-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="processing-task-foot">
        <span>{task.currentTitle || t('localProcessing')}</span>
        {task.failed > 0 && !isRunning && (
          <button className="btn btn-ghost btn-sm" onClick={onRetryFailed}>
            {t('retryFailed')}
          </button>
        )}
      </div>
    </section>
  )
}

/** 在文本中高亮搜索词 */
function AIStatusNote({
  bookmark,
  isAnalyzing,
  t,
}: {
  bookmark: Bookmark
  isAnalyzing: boolean
  t: ReturnType<typeof createTranslator>['t']
}) {
  if (isAnalyzing) {
    return (
      <div className="ai-status-note running">
        <div className="spinner mini-spinner" />
        <span>{t('analyzing')}</span>
      </div>
    )
  }

  if (bookmark.aiStatus === 'failed') {
    return (
      <div className="ai-status-note failed">
        {bookmark.aiError ? `${t('aiFailed')}: ${bookmark.aiError}` : t('aiFailed')}
      </div>
    )
  }

  if (bookmark.aiStatus === 'skipped') {
    return (
      <div className="ai-status-note warning">
        {bookmark.aiError ? `${t('aiSkipped')}: ${bookmark.aiError}` : t('aiSkipped')}
      </div>
    )
  }

  if (bookmark.aiStatus === 'done' && bookmark.aiError) {
    return (
      <div className="ai-status-note warning">
        {`${t('aiDoneNoSummary')}: ${bookmark.aiError}`}
      </div>
    )
  }

  return null
}

function highlightText(text: string, query?: string): React.ReactNode {
  if (!query?.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="search-highlight">{part}</mark>
      : part,
  )
}

function getVisibleTags(bookmark: Bookmark): string[] {
  const folderParts = new Set(getFolderPath(bookmark))
  const title = bookmark.title.toLowerCase()
  const host = (() => {
    try {
      return new URL(bookmark.url).hostname.replace(/^www\./, '').toLowerCase()
    } catch {
      return bookmark.domain?.toLowerCase() ?? ''
    }
  })()

  return [...new Set(bookmark.tags.map(tag => tag.trim()).filter(Boolean))]
    .filter(tag => {
      const lower = tag.toLowerCase()
      if (folderParts.has(tag)) return false
      if (lower === host || lower === bookmark.domain?.toLowerCase()) return false
      if (tag.length > 18 && title.includes(lower)) return false
      return true
    })
    .slice(0, 3)
}

function BookmarkCard({
  bookmark: bm,
  categories,
  editing,
  onOpen,
  onEdit,
  onDelete,
  onUpdate,
  onReprocess,
  isReprocessing,
  timeAgo,
  t,
  locale,
  searchQuery,
}: {
  bookmark: Bookmark
  categories: Category[]
  editing: boolean
  onOpen: (url: string) => void
  onEdit: (id: string | null) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onUpdate: (id: string, patch: Partial<Bookmark>) => void
  onReprocess: (id: string, e: React.MouseEvent) => void
  isReprocessing: boolean
  timeAgo: (ts?: number) => string
  t: ReturnType<typeof createTranslator>['t']
  locale: Locale
  searchQuery?: string
}) {
  const initialFolderPath = getFolderPath(bm)
  const visibleTags = getVisibleTags(bm)
  const [draftCategory, setDraftCategory] = useState(initialFolderPath[0])
  const [draftSubCategory, setDraftSubCategory] = useState(initialFolderPath[1] ?? '')
  const [draftTags, setDraftTags] = useState(bm.tags.join(', '))
  const [draftNote, setDraftNote] = useState(bm.note ?? '')
  const rootOptions = getRootCategories(categories)
  const subCategoryOptions = getFolderChildren(categories, draftCategory)
  const isAnalyzing = isReprocessing || bm.aiStatus === 'pending'
  const showAIStatus = isAnalyzing || bm.aiStatus === 'skipped' || bm.aiStatus === 'failed' || (bm.aiStatus === 'done' && Boolean(bm.aiError))

  function saveEdit(e: React.MouseEvent) {
    e.stopPropagation()
    const nextSubCategory = draftSubCategory && subCategoryOptions.includes(draftSubCategory)
      ? draftSubCategory
      : subCategoryOptions[0] ?? ''
    const folderPath = [draftCategory, nextSubCategory].filter(Boolean)
    onUpdate(bm.id, {
      category: folderPath[0],
      subCategory: folderPath[1],
      folderPath,
      tags: draftTags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean),
      note: draftNote.trim(),
    })
    onEdit(null)
  }

  return (
    <article className={`bookmark-card ${editing ? 'editing' : ''} ${isAnalyzing ? 'ai-running' : ''}`} onClick={() => !editing && onOpen(bm.url)}>
      <div className="bm-header">
        {bm.favicon
          ? <img src={bm.favicon} className="bm-favicon" alt="" onError={e => (e.currentTarget.style.display = 'none')} />
          : <div className="bm-favicon fallback" />
        }
        <div className="bm-title-block">
          <div className="bm-title">{highlightText(bm.title, searchQuery)}</div>
          <div className="bm-domain">{highlightText(bm.domain || bm.url, searchQuery)}</div>
        </div>
        <div className="bm-actions">
          <button
            className="bm-action-btn primary"
            title={editing ? t('saveChanges') : t('edit')}
            onClick={e => {
              e.stopPropagation()
              if (editing) saveEdit(e)
              else onEdit(bm.id)
            }}
          >
            {editing ? t('saveChanges') : t('edit')}
          </button>
          <button
            className={`bm-action-btn ai-btn ${isAnalyzing ? 'running' : ''}`}
            title={t('reanalyze')}
            disabled={isAnalyzing}
            onClick={e => onReprocess(bm.id, e)}
          >
            {isAnalyzing ? <><div className="spinner mini-spinner" /> AI</> : 'AI'}
          </button>
          <button className="bm-action-btn danger" title={t('delete')} onClick={e => onDelete(bm.id, e)}>
            {t('delete')}
          </button>
        </div>
      </div>

      {showAIStatus && (
        <AIStatusNote bookmark={bm} isAnalyzing={isAnalyzing} t={t} />
      )}

      {bm.summary ? (
        <div className="bm-summary">{highlightText(bm.summary, searchQuery)}</div>
      ) : isAnalyzing ? (
        <div className="bm-ai-pending">
          <div className="bm-summary-skeleton skeleton" />
          <div className="bm-summary-skeleton skeleton short" />
        </div>
      ) : null}

      {editing && (
        <div className="bm-editor" onClick={e => e.stopPropagation()}>
          <label>
            <span>{t('category')}</span>
            <select
              className="input"
              value={draftCategory}
              onChange={e => {
                const nextCategory = e.target.value
                setDraftCategory(nextCategory)
                setDraftSubCategory(getFolderChildren(categories, nextCategory)[0] ?? '')
              }}
            >
              {rootOptions.map(category => (
                <option key={category.id} value={category.name}>{displayCategory(category.name, locale)}</option>
              ))}
            </select>
          </label>
          {subCategoryOptions.length > 0 && (
            <label>
              <span>{t('folder')}</span>
              <select className="input" value={draftSubCategory} onChange={e => setDraftSubCategory(e.target.value)}>
                <option value="">{t('all')}</option>
                {subCategoryOptions.map(folder => (
                  <option key={folder} value={folder}>{displayCategory(folder, locale)}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>{t('tags')}</span>
            <input className="input" value={draftTags} placeholder={t('tagsHint')} onChange={e => setDraftTags(e.target.value)} />
          </label>
          <label className="wide">
            <span>{t('note')}</span>
            <textarea className="input" value={draftNote} placeholder={t('noteHint')} onChange={e => setDraftNote(e.target.value)} />
          </label>
          <div className="bm-editor-actions">
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onEdit(null) }}>{t('cancel')}</button>
            <button className="btn btn-primary btn-sm" onClick={saveEdit}>{t('saveChanges')}</button>
          </div>
        </div>
      )}

      {bm.note && !editing && <div className="bm-note">{highlightText(bm.note, searchQuery)}</div>}

      <div className="bm-footer">
        <div
          className="status-dot"
          style={{ background: bm.status === 'active' ? 'var(--success)' : bm.status === 'idle' ? 'var(--warning)' : 'var(--text-muted)' }}
        />
        <span className="badge badge-purple">{highlightText(getFolderLabel(bm, locale), searchQuery)}</span>
        {visibleTags.length ? visibleTags.map(tag => (
          <span key={tag} className="bm-tag">#<span>{highlightText(tag, searchQuery)}</span></span>
        )) : (
          <button
            className="bm-add-tag"
            onClick={e => {
              e.stopPropagation()
              onEdit(bm.id)
            }}
          >
            + {t('tags')}
          </button>
        )}
        {bm.aiStatus === 'done' && <span className="badge badge-green">AI</span>}
        <div className="bm-meta">
          <span>{timeAgo(bm.lastVisitedAt)}</span>
          {bm.visitCount > 0 && <span>· {t('times', { count: bm.visitCount })}</span>}
        </div>
      </div>
    </article>
  )
}
