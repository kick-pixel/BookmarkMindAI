import React, { useEffect, useState, useCallback } from 'react'
import { createTranslator } from '../lib/i18n'
import type { Bookmark, ExtractedContent, UserSettings } from '../types'


export default function PopupApp() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null)
  const [recentBookmarks, setRecentBookmarks] = useState<Bookmark[]>([])
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // ── 初始化 ──────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      setTab(currentTab)

      const [bmRes, settingsRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
      ])

      if (bmRes.success) {
        const bms: Bookmark[] = bmRes.data.filter((b: Bookmark) => !b.isArchived)
        setRecentBookmarks(bms.slice(0, 5))

        // 检查当前页是否已保存
        if (currentTab?.url) {
          setIsSaved(bms.some(b => b.url === currentTab.url))
        }
      }

      if (settingsRes.success) setSettings(settingsRes.data)
      setLoading(false)
    }
    init()
  }, [])

  // ── 保存书签 ─────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!tab || isSaved || isSaving) return
    setIsSaving(true)

    try {
      // 从当前页面提取内容
      let content: ExtractedContent
      try {
        const res = await chrome.tabs.sendMessage(tab.id!, { type: 'EXTRACT_CONTENT' })
        content = res.data
      } catch {
        // 内容脚本未加载时降级处理
        content = {
          title: tab.title ?? '',
          url: tab.url ?? '',
          description: '',
          mainContent: '',
          favicon: tab.favIconUrl,
        }
      }

      const res = await chrome.runtime.sendMessage({ type: 'SAVE_CURRENT_TAB', payload: content })
      if (res.success) {
        setIsSaved(true)
        setRecentBookmarks(prev => [res.data, ...prev].slice(0, 5))
      }
    } finally {
      setIsSaving(false)
    }
  }, [tab, isSaved, isSaving])

  // ── 打开侧边栏 ───────────────────────────────────────────────
  const openSidePanel = useCallback(async () => {
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id })
      window.close()
    }
  }, [tab])

  // ── 工具函数 ─────────────────────────────────────────────────
  const { t } = createTranslator(settings?.language)
  const aiConfigured = Boolean(settings?.aiEnabled)

  const statusColor: Record<string, string> = {
    active: 'var(--success)',
    idle: 'var(--warning)',
    sleeping: 'var(--text-muted)',
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px' }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
        <span className="text-muted text-sm">{t('loading')}</span>
      </div>
    )
  }

  return (
    <div className="flex-col" style={{ height: '100%' }}>

      {/* 头部 */}
      <header className="popup-header">
        <img className="popup-logo" src="/icons/icon48.png" alt="BookmarkMind AI logo" />
        <div>
          <div className="popup-title">{t('appName')}</div>
          <div className="popup-subtitle">{t('appSubtitle')}</div>
        </div>
        <div className="popup-header-actions">
          {isSaved && <span className="saved-badge">✓ {t('saved')}</span>}
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => chrome.runtime.openOptionsPage()}
            data-tip={t('openSettings')}
          >{t('settings')}</button>
        </div>
      </header>

      {/* 当前页面 */}
      {tab && (
        <div className="current-page">
          <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            {tab.favIconUrl && (
              <img src={tab.favIconUrl} className="bookmark-favicon" alt="" />
            )}
            <span className="text-xs text-muted">{t('currentPage')}</span>
          </div>
          <div className="current-page-title">{tab.title}</div>
          <div className="current-page-url">{tab.url}</div>

          <button
            className={`save-btn ${isSaved ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={isSaved || isSaving}
          >
            {isSaving
              ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> {t('analyzing')}</>
              : isSaved
              ? <>✓ {t('saveToLibrary')}</>
              : <>＋ {t('savePage')}</>
            }
          </button>
        </div>
      )}

      {settings?.aiEnabled && !aiConfigured && (
        <div className="setup-card">
          <div className="setup-card-icon">AI</div>
          <div className="setup-card-copy">
            <strong>{t('setupAI')}</strong>
            <span>{t('setupAIDesc')}</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => chrome.runtime.openOptionsPage()}>
            {t('setupNow')}
          </button>
        </div>
      )}

      {/* 最近书签 */}
      <div className="recent-section">
        <div className="section-title">
          <span>{t('recent')}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={openSidePanel}
          >{t('viewAll')} →</button>
        </div>

        {recentBookmarks.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">📭</div>
            <div>{t('emptyRecent')}</div>
          </div>
        ) : (
          recentBookmarks.map(bm => (
            <a
              key={bm.id}
              href={bm.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bookmark-mini-card"
              onClick={e => { e.preventDefault(); chrome.tabs.create({ url: bm.url }) }}
            >
              {bm.favicon
                ? <img src={bm.favicon} className="bookmark-favicon" alt="" onError={e => (e.currentTarget.style.display = 'none')} />
                : <div style={{ width: 16, height: 16, background: 'var(--bg-hover)', borderRadius: 3, flexShrink: 0 }} />
              }
              <div className="bookmark-mini-info">
                <div className="bookmark-mini-title">{bm.title}</div>
                <div className="flex items-center gap-1">
                  <div className="status-dot" style={{ background: statusColor[bm.status] ?? 'var(--text-muted)' }} />
                  <span className="bookmark-mini-cat">{bm.category}</span>
                  {bm.aiCategorized && <span style={{ fontSize: 9, color: 'var(--accent)' }}>✦ AI</span>}
                </div>
              </div>
              {bm.summary && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>📄</span>
              )}
            </a>
          ))
        )}
      </div>

      {/* 底部 */}
      <footer className="popup-footer">
        <button className="btn btn-ghost" onClick={openSidePanel}>{t('manageBookmarks')}</button>
        <button
          className="btn btn-ghost"
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') })}
        >{t('settings')}</button>
      </footer>
    </div>
  )
}
