// ============================================================
// BookmarkMind AI · 核心类型定义
// ============================================================

export type AIProvider =
  | 'deepseek'
  | 'kimi'
  | 'openai'
  | 'nvidia'
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

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  baseUrl?: string
  model?: string
}

export type BookmarkStatus = 'active' | 'idle' | 'sleeping' | 'dead'
export type BookmarkAIStatus = 'pending' | 'done' | 'skipped' | 'failed'
export type BookmarkSyncState =
  | 'pending_create'
  | 'pending_update'
  | 'pending_delete'
  | 'synced'
  | 'conflict'
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
  remoteId?: string // 后续云同步服务端 ID
  syncState?: BookmarkSyncState
  syncVersion?: number
  syncUpdatedAt?: number
  deletedAt?: number // 云同步 tombstone；普通本地读取会过滤
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
  language: AppLanguage
  aiBaseUrls: Partial<Record<AIProvider, string>>
  aiModels: Partial<Record<AIProvider, string>>
  customBaseUrl?: string
  customModel?: string
  // Cloud sync
  cloudEnabled: boolean
  aiSource: 'byok' | 'cloud'
  lastSyncAt: number
}

export interface UsageStats {
  totalBookmarks: number
  activeBookmarks: number
  idleBookmarks: number
  sleepingBookmarks: number
  aiProcessedCount: number
  topCategories: { name: string; count: number }[]
}

export interface ProcessingTask {
  id: string
  type: 'import' | 'retry'
  status: 'running' | 'completed' | 'failed'
  total: number
  processed: number
  failed: number
  currentTitle?: string
  startedAt: number
  updatedAt: number
  error?: string
}

// 消息通信类型
export type MessageType =
  | 'SAVE_BOOKMARK'
  | 'SAVE_CURRENT_TAB'
  | 'GET_BOOKMARKS'
  | 'UPDATE_BOOKMARK'
  | 'REPROCESS_BOOKMARK'
  | 'DELETE_BOOKMARK'
  | 'CLEAN_DUPLICATE_BOOKMARKS'
  | 'AI_CLASSIFY'
  | 'AI_SUMMARIZE'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'GET_USAGE'
  | 'RESET_FREE_AI_USAGE'
  | 'CLEAR_ALL_DATA'
  | 'GET_PROCESSING_TASK'
  | 'DISMISS_PROCESSING_TASK'
  | 'RETRY_FAILED_BOOKMARKS'
  | 'RECORD_VISIT'
  | 'GET_CATEGORIES'
  | 'CREATE_CATEGORY'
  | 'DELETE_CATEGORY'
  | 'CLEAN_EMPTY_FOLDERS'
  | 'GET_BOOKMARK_BY_URL'
  | 'EXTRACT_CONTENT'
  | 'IMPORT_BOOKMARKS'
  | 'EXPORT_BOOKMARKS'
  | 'CLOUD_LOGIN'
  | 'CLOUD_LOGOUT'
  | 'CLOUD_SYNC'
  | 'CLOUD_GET_STATUS'

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
