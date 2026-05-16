export async function openLibraryView(tabId?: number): Promise<void> {
  if (chrome.sidePanel?.open) {
    const activeTab = tabId
      ? null
      : (await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []))[0]
    const targetTabId = tabId ?? activeTab?.id
    const targetWindowId = activeTab?.windowId

    if (targetTabId) {
      const opened = await chrome.sidePanel.open({ tabId: targetTabId }).then(() => true).catch(() => false)
      if (opened) return
    }

    if (targetWindowId) {
      const opened = await chrome.sidePanel.open({ windowId: targetWindowId }).then(() => true).catch(() => false)
      if (opened) return
    }
  }

  await chrome.tabs.create({ url: chrome.runtime.getURL('src/sidepanel/sidepanel.html') })
}

export async function openQuickPanelWindow(): Promise<void> {
  await chrome.windows.create({
    url: chrome.runtime.getURL('src/popup/popup.html'),
    type: 'popup',
    width: 420,
    height: 640,
    focused: true,
  })
}

export function openSettingsPage(): void {
  chrome.runtime.openOptionsPage()
}
