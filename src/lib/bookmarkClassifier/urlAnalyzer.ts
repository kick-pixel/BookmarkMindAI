// ============================================================
// BookmarksAI · URL 结构分析器 (Stage 2)
// 提取路径层级、子域名、路径关键词、内容类型标签
// ============================================================

export interface PathFeatures {
  /** 子域名 (www, docs, api, blog, dev, ...) */
  subdomain: string
  /** 路径段数组 */
  pathSegments: string[]
  /** 文件扩展名 */
  extension: string
  /** 顶级域名 */
  tld: string
  /** 是否为 GitHub 仓库页面 (github.com/owner/repo) */
  isGitHubRepo: boolean
  /** 是否为 GitHub Topics 页面 */
  isGitHubTopics: boolean
  /** 是否为文档页面 */
  isDocumentation: boolean
  /** 是否为博客文章 */
  isBlog: boolean
  /** 是否为定价页 */
  isPricing: boolean
  /** 是否为教程 */
  isTutorial: boolean
  /** 是否为 API 参考文档 */
  isAPI: boolean
  /** 是否为社区/论坛页面 */
  isCommunity: boolean
  /** 是否为视频页面 */
  isVideo: boolean
  /** 是否为 GitHub Gist */
  isGist: boolean
}

// 内容类型关键词映射
const DOC_PATTERNS = /\b(docs?|documentation|wiki|manual|handbook|guide|reference|help|tutorials?)\b/i
const BLOG_PATTERNS = /\b(blog|posts?|articles?|news|updates?|journal|magazine|story)\b/i
const PRICING_PATTERNS = /\b(pricing|plans?|pro|enterprise|billing|subscription|premium)\b/i
const TUTORIAL_PATTERNS = /\b(tutorial|learn|course|class|lesson|training|workshop|bootcamp)\b/i
const API_PATTERNS = /\b(api|sdk|reference|endpoint|graphql|rest)\b/i
const COMMUNITY_PATTERNS = /\b(forum|community|discuss|chat|group|team|board|thread)\b/i
const VIDEO_PATTERNS = /\b(watch|video|playlist|channel|live|stream|episode)\b/i

/**
 * 解析 URL 结构
 */
export function analyzeURL(url: string): PathFeatures {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname
    const parts = hostname.split('.')

    // 提取子域名
    const subdomain = parts.length > 2 ? parts.slice(0, -2).join('.') : ''

    // 提取顶级域名
    const tld = parts.length >= 2 ? parts.slice(-1)[0] : ''

    // 分解路径
    const pathSegments = pathname
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .split('/')
      .filter(Boolean)

    // 文件扩展名
    const lastSegment = pathSegments[pathSegments.length - 1] ?? ''
    const extMatch = lastSegment.match(/\.(\w+)$/)
    const extension = extMatch?.[1]?.toLowerCase() ?? ''

    // GitHub 检测
    const isGitHub = hostname === 'github.com' || hostname.endsWith('.github.com') || hostname.endsWith('.github.io')
    const isGitHubRepo = isGitHub && pathSegments.length >= 2 && !pathSegments.includes('topics') && pathSegments[0] !== 'topics'
    const isGitHubTopics = isGitHub && (pathSegments[0] === 'topics' || pathname.startsWith('/topics/'))
    const isGist = hostname === 'gist.github.com' || pathname.startsWith('/gist/')

    // 路径关键词检测
    const pathStr = pathname.toLowerCase()
    const isDocumentation = DOC_PATTERNS.test(pathStr)
    const isBlog = BLOG_PATTERNS.test(pathStr)
    const isPricing = PRICING_PATTERNS.test(pathStr)
    const isTutorial = TUTORIAL_PATTERNS.test(pathStr)
    const isAPI = API_PATTERNS.test(pathStr)
    const isCommunity = COMMUNITY_PATTERNS.test(pathStr)
    const isVideo = VIDEO_PATTERNS.test(pathStr) || pathname.startsWith('/watch') || pathname.includes('/video/')

    return {
      subdomain,
      pathSegments,
      extension,
      tld,
      isGitHubRepo,
      isGitHubTopics,
      isDocumentation,
      isBlog,
      isPricing,
      isTutorial,
      isAPI,
      isCommunity,
      isVideo,
      isGist,
    }
  } catch {
    return {
      subdomain: '',
      pathSegments: [],
      extension: '',
      tld: '',
      isGitHubRepo: false,
      isGitHubTopics: false,
      isDocumentation: false,
      isBlog: false,
      isPricing: false,
      isTutorial: false,
      isAPI: false,
      isCommunity: false,
      isVideo: false,
      isGist: false,
    }
  }
}

/**
 * 获取内容类型友好的字符串描述 (用于 AI Prompt)
 */
export function getContentTypeLabel(features: PathFeatures): string {
  if (features.isDocumentation) return '文档/手册'
  if (features.isBlog) return '博客/文章'
  if (features.isPricing) return '定价页面'
  if (features.isTutorial) return '教程/课程'
  if (features.isAPI) return 'API 参考文档'
  if (features.isCommunity) return '社区/论坛'
  if (features.isVideo) return '视频/多媒体'
  if (features.isGitHubRepo) return 'GitHub 仓库'
  if (features.isGitHubTopics) return 'GitHub 主题'
  if (features.isGist) return '代码片段'

  if (features.subdomain === 'docs' || features.subdomain === 'doc') return '文档站点'
  if (features.subdomain === 'blog') return '博客站点'
  if (features.subdomain === 'dev' || features.subdomain === 'developer') return '开发者站点'

  return '普通页面'
}
