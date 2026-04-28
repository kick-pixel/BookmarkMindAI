// ============================================================
// BookmarkMind AI · Content Script（页面内容提取）
// ============================================================
import type { ExtractedContent, Message } from '../types'

// 提取页面核心内容
function extractPageContent(): ExtractedContent {
  const title = document.title || ''
  const url = location.href

  // 优先取 OG description，否则取 meta description
  const description =
    (document.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content ||
    (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content ||
    ''

  // OG 图片
  const ogImage =
    (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content || undefined

  // Favicon
  const favicon =
    (document.querySelector('link[rel="icon"]') as HTMLLinkElement)?.href ||
    (document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement)?.href ||
    `${location.origin}/favicon.ico`

  // 提取主要正文内容（去掉导航、广告等噪音）
  const mainContent = extractMainText()

  return { title, url, description, mainContent, ogImage, favicon }
}

function extractMainText(): string {
  // 优先提取 article、main 标签内容
  const prioritySelectors = ['article', 'main', '[role="main"]', '.post-content', '.article-body']
  for (const sel of prioritySelectors) {
    const el = document.querySelector(sel)
    if (el) {
      return cleanText(el.textContent ?? '').slice(0, 3000)
    }
  }
  // 降级：提取 body 内容，去掉 script/style/nav/footer
  const body = document.body.cloneNode(true) as HTMLElement
  ;['script', 'style', 'nav', 'footer', 'header', 'aside', '.sidebar', '.ad', '.advertisement']
    .forEach(sel => body.querySelectorAll(sel).forEach(el => el.remove()))

  return cleanText(body.textContent ?? '').slice(0, 3000)
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── 监听来自 Popup 的消息 ──────────────────────────────────────
chrome.runtime.onMessage.addListener(
  (msg: Message, _sender, sendResponse) => {
    if (msg.type === 'EXTRACT_CONTENT') {
      const content = extractPageContent()
      sendResponse({ success: true, data: content })
    }
    return true
  }
)

// ── 鼠标悬停预览书签摘要 ────────────────────────────────────────
// 当用户悬停在页面链接上时，如果该链接已保存为书签，显示摘要浮窗
let tooltip: HTMLDivElement | null = null

function createTooltip() {
  const el = document.createElement('div')
  el.id = 'bai-tooltip'
  el.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    max-width: 320px;
    padding: 12px 14px;
    background: rgba(15, 15, 20, 0.96);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: #e2e8f0;
    pointer-events: none;
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.2s, transform 0.2s;
    backdrop-filter: blur(12px);
  `
  document.body.appendChild(el)
  return el
}

let hoverTimer: ReturnType<typeof setTimeout>

document.addEventListener('mouseover', (e) => {
  const target = e.target as HTMLElement
  const anchor = target.closest('a')
  if (!anchor?.href) return

  hoverTimer = setTimeout(async () => {
    const resp = await chrome.runtime.sendMessage({
      type: 'GET_BOOKMARK_BY_URL',
      payload: anchor.href,
    }).catch(() => null)

    const bookmark = resp?.data
    if (!bookmark?.summary) return

    if (!tooltip) tooltip = createTooltip()

    tooltip.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        ${bookmark.favicon ? `<img src="${bookmark.favicon}" style="width:16px;height:16px;border-radius:3px">` : ''}
        <span style="font-weight:600;color:#a5b4fc;font-size:12px;">📌 已收藏</span>
        <span style="margin-left:auto;font-size:11px;color:#64748b;">${bookmark.category}</span>
      </div>
      <div style="color:#cbd5e1;font-size:12.5px;">${bookmark.summary}</div>
    `

    const rect = anchor.getBoundingClientRect()
    tooltip.style.left = `${Math.min(rect.left, window.innerWidth - 340)}px`
    tooltip.style.top = `${rect.bottom + 8}px`
    tooltip.style.opacity = '1'
    tooltip.style.transform = 'translateY(0)'
  }, 600)
})

document.addEventListener('mouseout', () => {
  clearTimeout(hoverTimer)
  if (tooltip) {
    tooltip.style.opacity = '0'
    tooltip.style.transform = 'translateY(6px)'
  }
})
