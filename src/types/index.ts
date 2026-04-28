// ============================================================
// BookmarksAI · 核心类型定义
// ============================================================

export type AIProvider =
  | 'deepseek'
  | 'kimi'
  | 'openai'
  | 'openrouter'
  | 'siliconflow'
  | 'dashscope'
  | 'volcengine'
  | 'zhipu'
  | 'groq'
  | 'together'
  | 'perplexity'
  | 'custom'
export type AppLanguage = 'auto' | 'zh-CN' | 'en'
export type AIServiceMode = 'byok' | 'hosted'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  baseUrl?: string
  model?: string
}

export type BookmarkStatus = 'active' | 'idle' | 'sleeping' | 'dead'
export type BookmarkAIStatus = 'pending' | 'done' | 'skipped' | 'failed'
// active: 30天内访问  idle: 30-90天  sleeping: 90天+  dead: 链接失效

export interface Bookmark {
  id: string
  url: string
  title: string
  favicon?: string
  // 分类
  category: string
  subCategory?: string
  folderPath?: string[]
  sourceFolderPath?: string[] // 导入前的原始收藏夹路径，仅用于 AI/规则归类上下文，不作为展示目录
  tags: string[]
  // AI 生成内容
  summary?: string
  summaryGeneratedAt?: number
  aiCategorized: boolean
  aiConfidence?: number
  aiReason?: string
  aiStatus?: BookmarkAIStatus
  aiError?: string
  // 访问追踪
  createdAt: number
  updatedAt?: number
  lastVisitedAt?: number
  visitCount: number
  status: BookmarkStatus
  // 用户备注
  note?: string
  // 技术字段
  keywords?: string[] // AI 提取的语义搜索关键词
  domain?: string
  normalizedUrl?: string
  contentHash?: string
  isArchived: boolean
  chromeBmId?: string // 对应 Chrome 原生书签 ID
}

export interface Category {
  id: string
  name: string
  icon?: string
  color?: string
  parentId?: string
  order: number
}

export interface UserSettings {
  // AI 配置
  aiProvider: AIProvider
  apiKeys: Partial<Record<AIProvider, string>>
  aiEnabled: boolean
  aiServiceMode: AIServiceMode
  // 功能开关
  autoClassify: boolean
  autoTag: boolean
  autoSummary: boolean
  autoExtractKeywords: boolean
  trackVisits: boolean
  cleanupReminder: boolean
  cleanupReminderDays: number // 多少天未访问触发提醒
  // 隐私
  sendContentToAI: boolean // 是否发送页面内容（而非只发标题/URL）
  // 付费
  plan: 'free' | 'pro'
  aiUsageCount: number
  aiUsageResetAt: number
  freeQuotaPerMonth: number // 默认 100
  language: AppLanguage
  aiBaseUrls: Partial<Record<AIProvider, string>>
  aiModels: Partial<Record<AIProvider, string>>
  customBaseUrl?: string
  customModel?: string
}

export interface UsageStats {
  totalBookmarks: number
  activeBookmarks: number
  idleBookmarks: number
  sleepingBookmarks: number
  aiProcessedCount: number
  aiUsageThisMonth: number
  topCategories: { name: string; count: number }[]
}

// 消息通信类型
export type MessageType =
  | 'SAVE_BOOKMARK'
  | 'SAVE_CURRENT_TAB'
  | 'GET_BOOKMARKS'
  | 'UPDATE_BOOKMARK'
  | 'REPROCESS_BOOKMARK'
  | 'DELETE_BOOKMARK'
  | 'ARCHIVE_BOOKMARK'
  | 'AI_CLASSIFY'
  | 'AI_SUMMARIZE'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'GET_USAGE'
  | 'RECORD_VISIT'
  | 'GET_CATEGORIES'
  | 'CREATE_CATEGORY'
  | 'DELETE_CATEGORY'
  | 'GET_BOOKMARK_BY_URL'
  | 'EXTRACT_CONTENT'
  | 'IMPORT_BOOKMARKS'
  | 'EXPORT_BOOKMARKS'

export interface Message<T = unknown> {
  type: MessageType
  payload?: T
}

export interface MessageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// 网页内容提取结果
export interface ExtractedContent {
  title: string
  url: string
  description: string
  mainContent: string // 截取前 2000 字用于 AI 处理
  ogImage?: string
  favicon?: string
}
