import React, { useCallback, useEffect, useState } from 'react'
import { loginWithGoogle, logout, getCloudUser, isAuthenticated } from '../lib/cloud'
import type { CloudUser } from '../lib/cloud'
import { AI_PROVIDER_PRESETS, getProviderPreset } from '../lib/aiProviders'
import { parseImportedBookmarks } from '../lib/bookmarkImport'
import { createTranslator } from '../lib/i18n'
import type { AIProvider, AppLanguage, Bookmark, UserSettings } from '../types'

const SHOW_UPGRADE_LINKS = false

export default function OptionsApp() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [showKeys, setShowKeys] = useState<Partial<Record<AIProvider, boolean>>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving'>('idle')
  const [toast, setToast] = useState('')
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const languageSwitcherRef = React.useRef<HTMLDivElement | null>(null)
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null)
  const [cloudAuthenticated, setCloudAuthenticated] = useState(false)

  const { t } = createTranslator(settings?.language)
  useEffect(() => {
    async function load() {
      const settingsRes = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })
      if (settingsRes.success) {
        const loaded = settingsRes.data as UserSettings
        setSettings({ ...loaded, aiEnabled: true })
      }
    }
    load()
  }, [])

  useEffect(() => {
    void (async () => {
      const authed = await isAuthenticated()
      setCloudAuthenticated(authed)
      if (authed) {
        const user = await getCloudUser()
        setCloudUser(user)
      }
    })()
  }, [])

  useEffect(() => {
    if (!languageMenuOpen) return

    function closeLanguageMenu(event: MouseEvent) {
      if (!languageSwitcherRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setLanguageMenuOpen(false)
    }

    document.addEventListener('mousedown', closeLanguageMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeLanguageMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [languageMenuOpen])

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }, [])

  const handleChange = useCallback(async (patch: Partial<UserSettings>) => {
    if (!settings) return
    // 先从 storage 读取最新值再合并，避免并发写入覆盖
    const settingsRes = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })
    const latest = settingsRes?.success ? settingsRes.data : settings
    const updated = { ...latest, ...patch }
    setSettings(updated)
    setSaveStatus('saving')
    await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: patch })
    setSaveStatus('saved')
    window.setTimeout(() => setSaveStatus('idle'), 1800)
  }, [settings])

  const setApiKey = useCallback((provider: AIProvider, key: string) => {
    if (!settings) return
    // 只发送当前 provider 的 key，updateSettings 会做深度合并保留其他 provider
    const patch = { apiKeys: { [provider]: key } }
    setSettings(prev => prev ? { ...prev, apiKeys: { ...prev.apiKeys, [provider]: key } } : prev)
    setSaveStatus('saving')
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: patch })
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('idle'))
    window.setTimeout(() => setSaveStatus('idle'), 1800)
  }, [settings])

  const selectProvider = useCallback((provider: AIProvider) => {
    if (!settings) return
    const preset = getProviderPreset(provider)
    const patch: Partial<UserSettings> = {
      aiProvider: provider,
      aiBaseUrls: { [provider]: preset.baseUrl },
      aiModels: { [provider]: preset.defaultModel },
    }
    setSettings(prev => {
      if (!prev) return prev
      const nextBaseUrls = { ...prev.aiBaseUrls, [provider]: preset.baseUrl }
      const nextModels = { ...prev.aiModels, [provider]: preset.defaultModel }
      return { ...prev, aiProvider: provider, aiBaseUrls: nextBaseUrls, aiModels: nextModels }
    })
    setSaveStatus('saving')
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: patch })
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('idle'))
    window.setTimeout(() => setSaveStatus('idle'), 1800)
  }, [settings])

  if (!settings) {
    return (
      <div className="opt-loading">
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <span className="text-muted">{t('loading')}</span>
      </div>
    )
  }

  const selectedPreset = getProviderPreset(settings.aiProvider)
  const currentBaseUrl =
    settings.aiBaseUrls[settings.aiProvider] ||
    (settings.aiProvider === 'custom' ? settings.customBaseUrl : '') ||
    selectedPreset.baseUrl
  const currentModel =
    settings.aiModels[settings.aiProvider] ||
    (settings.aiProvider === 'custom' ? settings.customModel : '') ||
    selectedPreset.defaultModel
  const languageOptions: Array<{ value: AppLanguage; label: string }> = [
    { value: 'auto', label: t('autoLanguage') },
    { value: 'zh-CN', label: t('chinese') },
    { value: 'en', label: t('english') },
  ]

  return (
    <main className="opt-shell">
      <header className="opt-hero">
        <div className="opt-brand-mark">BAI</div>
        <div className="opt-hero-copy">
          <p className="opt-kicker">{t('appSubtitle')}</p>
          <h1>{t('optionsTitle')}</h1>
          <p>{t('optionsSubtitle')}</p>
        </div>
        <div ref={languageSwitcherRef} className={`language-switcher ${languageMenuOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="language-trigger"
            aria-label={t('language')}
            aria-expanded={languageMenuOpen}
            onClick={() => setLanguageMenuOpen(open => !open)}
          >
            <span className="language-glyph">文A</span>
          </button>
          {languageMenuOpen && (
            <div className="language-menu" role="menu">
              {languageOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  className={settings.language === option.value ? 'active' : ''}
                  onClick={() => {
                    handleChange({ language: option.value })
                    setLanguageMenuOpen(false)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="opt-section">
        <div className="opt-section-title">Cloud Account</div>
        {cloudAuthenticated && cloudUser ? (
          <div className="cloud-account-card">
            <div className="cloud-user-info">
              <span className="cloud-user-email">{cloudUser.email}</span>
              <span className={`cloud-tier-badge ${cloudUser.tier}`}>
                {cloudUser.tier.charAt(0).toUpperCase() + cloudUser.tier.slice(1)}
              </span>
            </div>
            <p className="cloud-status">
              Sync: {cloudUser.subscriptionStatus === 'active' ? 'Active' : 'Local mode only'}
            </p>
            <div className="cloud-actions">
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                await logout()
                setCloudAuthenticated(false)
                setCloudUser(null)
              }}>
                Sign Out
              </button>
              {cloudUser.tier === 'free' && (
                <a className="btn btn-primary btn-sm" href="https://bookmarkmind.ai/pricing" target="_blank" rel="noopener noreferrer">
                  Upgrade to Pro
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="cloud-account-card">
            <p className="cloud-status">Sign in to enable cloud sync and cross-device knowledge base.</p>
            <button className="btn btn-primary" onClick={async () => {
              const success = await loginWithGoogle()
              if (success) {
                setCloudAuthenticated(true)
                const user = await getCloudUser()
                setCloudUser(user)
              }
            }}>
              Sign in with Google
            </button>
          </div>
        )}
      </section>

      <section className="opt-section">
        <div className="opt-section-title">{t('aiService')}</div>

        <div className="quick-ai-panel">
          <div className="quick-ai-head">
            <div className="quick-ai-copy">
              <div className="opt-row-label">{t('quickAISetup')}</div>
              <div className="opt-row-desc">{t('quickAISetupDesc')}</div>
            </div>
            {selectedPreset.docsUrl && (
              <a className="btn btn-ghost btn-sm" href={selectedPreset.docsUrl} target="_blank" rel="noopener noreferrer">
                {t('providerDocs')}
              </a>
            )}
          </div>
          <div className="quick-ai-grid">
            <label>
              <span>{t('selectedProvider')}</span>
              <select
                className="input"
                value={settings.aiProvider}
                onChange={event => selectProvider(event.target.value as AIProvider)}
              >
                {AI_PROVIDER_PRESETS.map(provider => (
                  <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('apiKey')}</span>
              <div className="api-key-input-wrapper compact">
                <input
                  className="input"
                  type={showKeys[settings.aiProvider] ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={settings.apiKeys[settings.aiProvider] ?? ''}
                  onChange={event => setApiKey(settings.aiProvider, event.target.value)}
                />
                <button
                  type="button"
                  className="api-key-toggle"
                  onClick={() => setShowKeys(prev => ({ ...prev, [settings.aiProvider]: !prev[settings.aiProvider] }))}
                >
                  {showKeys[settings.aiProvider] ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
          </div>
          <div className="quick-ai-grid advanced-inline">
            <label>
              <span>{t('customApiUrl')}</span>
              <input
                className="input"
                value={currentBaseUrl}
                onChange={event => updateProviderBaseUrl(settings.aiProvider, event.target.value)}
                placeholder="https://your-api.example.com/v1"
              />
            </label>
            <label>
              <span>{t('customModel')}</span>
              <input
                className="input"
                value={currentModel}
                onChange={event => updateProviderModel(settings.aiProvider, event.target.value)}
                placeholder={selectedPreset.defaultModel || 'model-name'}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="opt-section">
        <div className="opt-section-title">{t('automation')}</div>
        <div className="automation-fixed-card">
          <div className="automation-fixed-icon">AI</div>
          <div className="automation-fixed-copy">
            <div className="opt-row-label">{t('coreAutomationTitle')}</div>
            <div className="opt-row-desc">{t('coreAutomationDesc')}</div>
            <div className="automation-chip-row">
              <span>{t('autoClassify')}</span>
              <span>{t('autoTag')}</span>
              <span>{t('autoSummary')}</span>
              <span>{t('autoKeywords')}</span>
            </div>
          </div>
        </div>
        <SettingToggle label={t('trackVisits')} desc={t('trackVisitsDesc')} checked={settings.trackVisits} onChange={checked => handleChange({ trackVisits: checked })} />
        <SettingToggle label={t('cleanupReminder')} desc={t('cleanupReminderDesc')} checked={settings.cleanupReminder} onChange={checked => handleChange({ cleanupReminder: checked })} />
        <SettingToggle label={t('sendContentToAI')} desc={t('sendContentToAIDesc')} checked={settings.sendContentToAI} onChange={checked => handleChange({ sendContentToAI: checked })} />

        {settings.cleanupReminder && (
          <div className="opt-row">
            <div className="opt-row-info">
              <div className="opt-row-label">{t('reminderDays')}</div>
              <div className="opt-row-desc">{t('reminderDaysDesc')}</div>
            </div>
            <div className="number-row">
              <input
                className="input"
                type="number"
                min={14}
                max={365}
                value={settings.cleanupReminderDays}
                onChange={event => handleChange({ cleanupReminderDays: Number(event.target.value) })}
              />
              <span className="text-muted text-sm">{t('days')}</span>
            </div>
          </div>
        )}
      </section>

      <section className="opt-section">
        <div className="opt-section-title">{t('dataManagement')}</div>
        <div className="opt-row opt-row-block">
          <div className="opt-row-info">
            <div className="opt-row-label">{t('exportData')}</div>
            <div className="opt-row-desc">{t('exportDataDesc')}</div>
          </div>
          <div className="button-grid">
            <button className="btn btn-ghost" onClick={() => handleExport('json')}>{t('exportJson')}</button>
            <button className="btn btn-ghost" onClick={() => handleExport('markdown')}>{t('exportMarkdown')}</button>
            <button className="btn btn-ghost" onClick={() => handleExport('html')}>{t('exportHtml')}</button>
          </div>
        </div>
        <div className="opt-row">
          <div className="opt-row-info">
            <div className="opt-row-label">{t('importData')}</div>
            <div className="opt-row-desc">{t('importDataDesc')}</div>
          </div>
          <button className="btn btn-ghost" onClick={handleImport}>{t('importButton')}</button>
        </div>
      </section>

      <section className="opt-section danger-zone">
        <div className="opt-section-title">{t('dangerZone')}</div>
        <div className="opt-row">
          <div className="opt-row-info">
            <div className="opt-row-label">{t('clearAll')}</div>
            <div className="opt-row-desc">{t('clearAllDesc')}</div>
          </div>
          <button className="btn btn-danger" onClick={handleClearAll}>{t('clearAllButton')}</button>
        </div>
      </section>

      {saveStatus !== 'idle' && (
        <div className="save-status">
          {saveStatus === 'saving' ? <><div className="spinner" style={{ width: 14, height: 14 }} /> {t('savingSettings')}</> : t('savedSettings')}
        </div>
      )}
      {toast && <div className="save-status toast">{toast}</div>}
    </main>
  )

  function updateProviderBaseUrl(provider: AIProvider, baseUrl: string) {
    if (!settings) return
    const patch: Partial<UserSettings> = {
      aiBaseUrls: { [provider]: baseUrl },
    }
    if (provider === 'custom') patch.customBaseUrl = baseUrl
    setSettings(prev => prev ? { ...prev, ...patch } : prev)
    setSaveStatus('saving')
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: patch })
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('idle'))
    window.setTimeout(() => setSaveStatus('idle'), 1800)
  }

  function updateProviderModel(provider: AIProvider, model: string) {
    if (!settings) return
    const patch: Partial<UserSettings> = {
      aiModels: { [provider]: model },
    }
    if (provider === 'custom') patch.customModel = model
    setSettings(prev => prev ? { ...prev, ...patch } : prev)
    setSaveStatus('saving')
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: patch })
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('idle'))
    window.setTimeout(() => setSaveStatus('idle'), 1800)
  }

  async function handleExport(format: 'json' | 'markdown' | 'html') {
    const res = await chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' })
    if (!res.success) return
    const bookmarks = res.data as Bookmark[]
    const date = new Date().toISOString().slice(0, 10)
    if (format === 'json') {
      downloadFile(
        `bookmarkmind-ai-export-${date}.json`,
        JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings, bookmarks }, null, 2),
        'application/json',
      )
      return
    }
    if (format === 'markdown') {
      downloadFile(`bookmarkmind-ai-export-${date}.md`, toMarkdown(bookmarks), 'text/markdown')
      return
    }
    downloadFile(`bookmarkmind-ai-export-${date}.html`, toNetscapeHtml(bookmarks), 'text/html')
  }

  async function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.html,.htm'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const bookmarks = parseImportedBookmarks(file.name, text)
        const res = await chrome.runtime.sendMessage({ type: 'IMPORT_BOOKMARKS', payload: bookmarks })
        if (!res.success) throw new Error(res.error)
        notify(t('importDone', res.data))
      } catch {
        notify(t('importFailed'))
      }
    }
    input.click()
  }

  async function handleClearAll() {
    if (!confirm(t('clearConfirm'))) return
    await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' })
    window.location.reload()
  }
}

function SettingToggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="opt-row">
      <div className="opt-row-info">
        <div className="opt-row-label">{label}</div>
        <div className="opt-row-desc">{desc}</div>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  )
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function toMarkdown(bookmarks: Bookmark[]): string {
  const groups = new Map<string, Bookmark[]>()
  for (const bookmark of bookmarks) {
    const group = bookmark.category || 'Uncategorized'
    groups.set(group, [...(groups.get(group) ?? []), bookmark])
  }
  const lines = ['# BookmarkMind AI Export', '', `Exported at: ${new Date().toISOString()}`, '']
  for (const [category, items] of groups) {
    lines.push(`## ${category}`, '')
    for (const bookmark of items) {
      lines.push(`- [${escapeMarkdown(bookmark.title)}](${bookmark.url})`)
      if (bookmark.summary) lines.push(`  - ${escapeMarkdown(bookmark.summary)}`)
      if (bookmark.tags.length) lines.push(`  - Tags: ${bookmark.tags.join(', ')}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function toNetscapeHtml(bookmarks: Bookmark[]): string {
  const now = Date.now()
  const root = createExportFolderNode('\u6536\u85cf\u5939\u680f', now)
  for (const bookmark of bookmarks) {
    addBookmarkToExportTree(root, bookmark)
  }
  const rows = renderExportFolder(root, 1, ' PERSONAL_TOOLBAR_FOLDER="true"')
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${rows.join('\n')}
</DL><p>`
}

interface ExportFolderNode {
  name: string
  addDate: number
  lastModified: number
  folders: Map<string, ExportFolderNode>
  bookmarks: Bookmark[]
}

function createExportFolderNode(name: string, timestamp: number): ExportFolderNode {
  return {
    name,
    addDate: timestamp,
    lastModified: timestamp,
    folders: new Map(),
    bookmarks: [],
  }
}

function addBookmarkToExportTree(root: ExportFolderNode, bookmark: Bookmark): void {
  const bookmarkCreatedAt = bookmark.createdAt || Date.now()
  const bookmarkModifiedAt = bookmark.updatedAt || bookmarkCreatedAt
  const folderPath = getExportFolderPath(bookmark)
  let current = root

  current.addDate = Math.min(current.addDate, bookmarkCreatedAt)
  current.lastModified = Math.max(current.lastModified, bookmarkModifiedAt)

  for (const folderName of folderPath) {
    const existing = current.folders.get(folderName)
    const next = existing ?? createExportFolderNode(folderName, bookmarkCreatedAt)
    next.addDate = Math.min(next.addDate, bookmarkCreatedAt)
    next.lastModified = Math.max(next.lastModified, bookmarkModifiedAt)
    if (!existing) current.folders.set(folderName, next)
    current = next
  }

  current.bookmarks.push(bookmark)
}

function getExportFolderPath(bookmark: Bookmark): string[] {
  const normalized = (bookmark.folderPath?.length
    ? bookmark.folderPath
    : [bookmark.category || '\u5176\u4ed6', bookmark.subCategory || '\u5f85\u6574\u7406'])
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  return normalized.length ? normalized : ['\u5176\u4ed6', '\u5f85\u6574\u7406']
}

function renderExportFolder(node: ExportFolderNode, depth: number, extraAttrs = ''): string[] {
  const lines = [
    `${indent(depth)}<DT><H3 ADD_DATE="${toUnixSeconds(node.addDate)}" LAST_MODIFIED="${toUnixSeconds(node.lastModified)}"${extraAttrs}>${escapeHtml(node.name)}</H3>`,
    `${indent(depth)}<DL><p>`,
  ]

  for (const child of node.folders.values()) {
    lines.push(...renderExportFolder(child, depth + 1))
  }

  for (const bookmark of node.bookmarks) {
    lines.push(renderExportBookmark(bookmark, depth + 1))
  }

  lines.push(`${indent(depth)}</DL><p>`)
  return lines
}

function renderExportBookmark(bookmark: Bookmark, depth: number): string {
  const createdAt = bookmark.createdAt || Date.now()
  const updatedAt = bookmark.updatedAt || createdAt
  const iconAttr = bookmark.favicon ? ` ICON="${escapeHtml(bookmark.favicon)}"` : ''

  return `${indent(depth)}<DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${toUnixSeconds(createdAt)}" LAST_MODIFIED="${toUnixSeconds(updatedAt)}"${iconAttr}>${escapeHtml(bookmark.title || bookmark.url)}</A>`
}

function toUnixSeconds(timestamp: number): number {
  return Math.floor(timestamp / 1000)
}

function indent(depth: number): string {
  return '    '.repeat(depth)
}

function escapeMarkdown(value: string): string {
  return value.replaceAll('[', '\\[').replaceAll(']', '\\]')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
