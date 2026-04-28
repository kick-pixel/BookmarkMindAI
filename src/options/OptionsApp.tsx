import React, { useCallback, useEffect, useState } from 'react'
import { AI_PROVIDER_PRESETS, getProviderPreset } from '../lib/aiProviders'
import { parseImportedBookmarks } from '../lib/bookmarkImport'
import { createTranslator } from '../lib/i18n'
import type { AIProvider, AppLanguage, Bookmark, UserSettings } from '../types'

type UsageInfo = { used: number; quota: number; isPro: boolean }

export default function OptionsApp() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [showKeys, setShowKeys] = useState<Partial<Record<AIProvider, boolean>>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving'>('idle')
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [toast, setToast] = useState('')

  const { locale, t } = createTranslator(settings?.language)
  useEffect(() => {
    async function load() {
      const [settingsRes, usageRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'GET_USAGE' }),
      ])
      if (settingsRes.success) {
        const loaded = settingsRes.data as UserSettings
        setSettings({ ...loaded, aiEnabled: true, aiServiceMode: loaded.aiServiceMode ?? 'byok' })
        if (!loaded.aiEnabled || !loaded.aiServiceMode) {
          chrome.runtime.sendMessage({
            type: 'UPDATE_SETTINGS',
            payload: { aiEnabled: true, aiServiceMode: loaded.aiServiceMode ?? 'byok' },
          }).catch(() => {})
        }
      }
      if (usageRes.success) setUsage(usageRes.data)
    }
    load()
  }, [])

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }, [])

  const handleChange = useCallback(async (patch: Partial<UserSettings>) => {
    if (!settings) return
    const updated = { ...settings, ...patch }
    setSettings(updated)
    setSaveStatus('saving')
    await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: patch })
    setSaveStatus('saved')
    window.setTimeout(() => setSaveStatus('idle'), 1800)
  }, [settings])

  const setApiKey = useCallback((provider: AIProvider, key: string) => {
    if (!settings) return
    handleChange({ apiKeys: { ...settings.apiKeys, [provider]: key } })
  }, [settings, handleChange])

  const selectProvider = useCallback((provider: AIProvider) => {
    if (!settings) return
    const preset = getProviderPreset(provider)
    const nextBaseUrls = { ...settings.aiBaseUrls }
    const nextModels = { ...settings.aiModels }
    if (provider !== 'custom') {
      nextBaseUrls[provider] = preset.baseUrl
      nextModels[provider] = preset.defaultModel
    }
    handleChange({
      aiProvider: provider,
      aiBaseUrls: nextBaseUrls,
      aiModels: nextModels,
    })
  }, [settings, handleChange])

  if (!settings) {
    return (
      <div className="opt-loading">
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <span className="text-muted">{t('loading')}</span>
      </div>
    )
  }

  const usagePct = usage ? Math.min((usage.used / usage.quota) * 100, 100) : 0
  const nearLimit = usagePct >= 80
  const selectedPreset = getProviderPreset(settings.aiProvider)
  const currentBaseUrl =
    settings.aiBaseUrls[settings.aiProvider] ||
    (settings.aiProvider === 'custom' ? settings.customBaseUrl : '') ||
    selectedPreset.baseUrl
  const currentModel =
    settings.aiModels[settings.aiProvider] ||
    (settings.aiProvider === 'custom' ? settings.customModel : '') ||
    selectedPreset.defaultModel
  const showHostedUsage = settings.aiServiceMode === 'hosted'

  return (
    <main className="opt-shell">
      <header className="opt-hero">
        <div className="opt-brand-mark">BAI</div>
        <div className="opt-hero-copy">
          <p className="opt-kicker">{t('appSubtitle')}</p>
          <h1>{t('optionsTitle')}</h1>
          <p>{t('optionsSubtitle')}</p>
        </div>
      </header>

      <section className="opt-section opt-ledger">
        <div className="opt-section-title">{t('language')}</div>
        <div className="opt-row">
          <div className="opt-row-info">
            <div className="opt-row-label">{t('language')}</div>
            <div className="opt-row-desc">{t('languageDesc')}</div>
          </div>
          <select
            className="input opt-select"
            value={settings.language}
            onChange={event => handleChange({ language: event.target.value as AppLanguage })}
          >
            <option value="auto">{t('autoLanguage')}</option>
            <option value="zh-CN">{t('chinese')}</option>
            <option value="en">{t('english')}</option>
          </select>
        </div>
      </section>

      <section className="opt-section">
        <div className="opt-section-title">{t('aiService')}</div>

        <div className="ai-mode-grid">
          <button
            type="button"
            className={`ai-mode-card ${settings.aiServiceMode === 'byok' ? 'selected' : ''}`}
            onClick={() => handleChange({ aiServiceMode: 'byok', aiEnabled: true })}
          >
            <span>{t('byokMode')}</span>
            <strong>{t('byokModeTitle')}</strong>
            <small>{t('byokModeDesc')}</small>
          </button>
          <button
            type="button"
            className="ai-mode-card disabled"
            onClick={() => notify(t('hostedModeSoon'))}
          >
            <span>{t('hostedModeSoonBadge')}</span>
            <strong>{t('hostedModeTitle')}</strong>
            <small>{t('hostedModeDesc')}</small>
          </button>
        </div>

        {usage && showHostedUsage && (
          <div className="usage-widget">
            <div className="usage-header">
              <span className="text-sm text-secondary">{t('monthlyUsage')}</span>
              <span className={`usage-plan ${usage.isPro ? 'plan-pro' : 'plan-free'}`}>
                {usage.isPro ? t('proUser') : t('freePlan')}
              </span>
            </div>
            <div className="usage-track">
              <div className={`usage-fill ${nearLimit ? 'warn' : 'ok'}`} style={{ width: `${usagePct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span>{t('usedCount', { used: usage.used })}</span>
              <span>{t('quotaCount', { quota: usage.quota })}</span>
            </div>

            {!usage.isPro && (
              <div className="upgrade-banner">
                <div className="upgrade-price">¥68 <span>/ year</span></div>
                <div className="upgrade-copy">
                  <strong>{t('upgradeTitle')}</strong>
                  <span>{t('upgradeDesc')}</span>
                </div>
                <button className="btn btn-primary" onClick={() => chrome.tabs.create({ url: 'https://bookmarksai.app/upgrade' })}>
                  {t('upgrade')}
                </button>
              </div>
            )}
          </div>
        )}

        {settings.aiServiceMode === 'byok' && (
            <div className="quick-ai-panel">
              <div className="quick-ai-copy">
                <div className="opt-row-label">{t('quickAISetup')}</div>
                <div className="opt-row-desc">{t('quickAISetupDesc')}</div>
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
              {selectedPreset.docsUrl && (
                <div className="quick-ai-doc-row">
                  <span>{locale === 'zh-CN' ? '当前预设会自动填入默认 Base URL 和模型名。需要自定义时可直接改下面两项。' : 'The selected preset fills Base URL and model automatically. Edit the fields below only when needed.'}</span>
                  <a className="btn btn-ghost btn-sm" href={selectedPreset.docsUrl} target="_blank" rel="noopener noreferrer">
                    {t('providerDocs')}
                  </a>
                </div>
              )}
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
        )}

        {settings.aiServiceMode === 'hosted' && (
          <div className="hosted-plan-panel">
            <div className="hosted-plan-card">
              <strong>{t('aiPlanTitle')}</strong>
              <span>{t('aiPlanDesc')}</span>
            </div>
            <div className="hosted-plan-card premium">
              <strong>{t('cloudPlanTitle')}</strong>
              <span>{t('cloudPlanDesc')}</span>
            </div>
          </div>
        )}
      </section>

      <section className="opt-section">
        <div className="opt-section-title">{t('automation')}</div>
        <SettingToggle label={t('autoClassify')} desc={t('autoClassifyDesc')} checked={settings.autoClassify} onChange={checked => handleChange({ autoClassify: checked })} />
        <SettingToggle label={t('autoTag')} desc={t('autoTagDesc')} checked={settings.autoTag} onChange={checked => handleChange({ autoTag: checked })} />
        <SettingToggle label={t('autoSummary')} desc={t('autoSummaryDesc')} checked={settings.autoSummary} onChange={checked => handleChange({ autoSummary: checked })} />
        <SettingToggle label={t('autoKeywords')} desc={t('autoKeywordsDesc')} checked={settings.autoExtractKeywords} onChange={checked => handleChange({ autoExtractKeywords: checked })} />
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
      aiBaseUrls: { ...settings.aiBaseUrls, [provider]: baseUrl },
    }
    if (provider === 'custom') patch.customBaseUrl = baseUrl
    handleChange(patch)
  }

  function updateProviderModel(provider: AIProvider, model: string) {
    if (!settings) return
    const patch: Partial<UserSettings> = {
      aiModels: { ...settings.aiModels, [provider]: model },
    }
    if (provider === 'custom') patch.customModel = model
    handleChange(patch)
  }

  async function handleExport(format: 'json' | 'markdown' | 'html') {
    const res = await chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' })
    if (!res.success) return
    const bookmarks = res.data as Bookmark[]
    const date = new Date().toISOString().slice(0, 10)
    if (format === 'json') {
      downloadFile(
        `bookmarksai-export-${date}.json`,
        JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings, bookmarks }, null, 2),
        'application/json',
      )
      return
    }
    if (format === 'markdown') {
      downloadFile(`bookmarksai-export-${date}.md`, toMarkdown(bookmarks), 'text/markdown')
      return
    }
    downloadFile(`bookmarksai-export-${date}.html`, toNetscapeHtml(bookmarks), 'text/html')
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
    await chrome.storage.local.clear()
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
  const lines = ['# BookmarksAI Export', '', `Exported at: ${new Date().toISOString()}`, '']
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
  const groups = new Map<string, Bookmark[]>()
  for (const bookmark of bookmarks) {
    const folder = (bookmark.folderPath?.length ? bookmark.folderPath : [bookmark.category || '其他']).join('/')
    groups.set(folder, [...(groups.get(folder) ?? []), bookmark])
  }
  const rows = Array.from(groups.entries()).flatMap(([folder, items]) => [
    `<DT><H3>${escapeHtml(folder)}</H3>`,
    '<DL><p>',
    ...items.map(bookmark =>
      `<DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${Math.floor(bookmark.createdAt / 1000)}">${escapeHtml(bookmark.title)}</A>`,
    ),
    '</DL><p>',
  ])
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>BookmarksAI Export</TITLE>
<H1>BookmarksAI Export</H1>
<DL><p>
${rows.join('\n')}
</DL><p>`
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
