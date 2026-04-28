// ============================================================
// BookmarkMind AI · OpenAI-compatible AI 服务层
// ============================================================
import type { AIConfig, ExtractedContent } from '../types'
import { inferFolderByRules, normalizeFolderPath } from './bookmarkTaxonomy'
import { getProviderPreset } from './aiProviders'
import { resolveAIConfig } from './aiConfig'
import { getSettings } from './storage'
import { buildClassifySystemPrompt, buildClassifyUserContent } from './bookmarkClassifier/promptBuilder'

// ── 核心 Chat 调用 ────────────────────────────────────────────
async function chatCompletion(
  config: AIConfig,
  systemPrompt: string,
  userContent: string,
  maxTokens = 500,
): Promise<string> {
  const preset = getProviderPreset(config.provider)
  const baseUrl = (config.baseUrl ?? preset.baseUrl).replace(/\/$/, '')
  const model = config.model ?? preset.defaultModel
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 30000)

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  }).finally(() => globalThis.clearTimeout(timeoutId))

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI API Error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ── 获取当前 AI 配置 ─────────────────────────────────────────
async function getAIConfig(): Promise<AIConfig | null> {
  const settings = await getSettings()
  return resolveAIConfig(settings)
}

/**
 * 获取 AI 可用的正文内容
 * 当主内容为空或过短时，自动降级使用 description 和 URL 摘要
 */
function getContentForAI(content: ExtractedContent, maxChars: number): string {
  const main = content.mainContent?.trim()
  // 正文足够长（>200字），直接返回
  if (main && main.length > 200) return main.slice(0, maxChars)

  // 正文过短/为空，用 description + URL 拼一个摘要上下文
  const fallbackParts: string[] = []
  if (content.description?.trim()) {
    fallbackParts.push(`描述：${content.description.trim()}`)
  }
  try {
    const url = new URL(content.url)
    fallbackParts.push(`域名：${url.hostname}`)
    if (url.pathname.length > 1) {
      fallbackParts.push(`路径：${url.pathname}`)
    }
  } catch {
    // URL 解析失败，跳过域名和路径
  }
  if (main && main.length > 0) {
    fallbackParts.push(`页面摘要：${main}`)
  }
  return fallbackParts.join('\n').slice(0, maxChars)
}

// ── 功能 1：智能分类 ─────────────────────────────────────────
export interface ClassifyResult {
  category: string
  subCategory?: string
  folderPath?: string[]
  tags: string[]
  confidence: number
  reason?: string
}

export async function classifyBookmark(content: ExtractedContent, options?: { localOnly?: boolean }): Promise<ClassifyResult | null> {
  if (options?.localOnly) return createLocalClassification(content)
  const config = await getAIConfig()
  if (!config) return createLocalClassification(content)

  const settings = await getSettings()
  const pageContent = settings.sendContentToAI ? getContentForAI(content, 800) : ''
  const systemPrompt = buildClassifySystemPrompt(content.url)
  const userContent = buildClassifyUserContent(content.title, content.url, content.description, pageContent)

  try {
    const raw = await chatCompletion(config, systemPrompt, userContent, 260)
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw
    return normalizeClassification(JSON.parse(jsonStr) as ClassifyResult)
  } catch {
    return createLocalClassification(content)
  }
}

function normalizeClassification(result: ClassifyResult): ClassifyResult {
  const rawFolderPath = result.folderPath ?? [result.category, result.subCategory].filter((part): part is string => Boolean(part))
  const folderPath = normalizeFolderPath(rawFolderPath)
  return {
    ...result,
    folderPath,
    category: folderPath[0],
    subCategory: folderPath[1],
    tags: [...new Set((result.tags ?? []).map(tag => tag.trim()).filter(Boolean))].slice(0, 5),
    confidence: Number.isFinite(result.confidence) ? result.confidence : 0.6,
  }
}

function createLocalClassification(content: ExtractedContent): ClassifyResult {
  const folderPath = normalizeFolderPath(inferFolderByRules(content))
  const fallbackTags = [
    ...getFolderSeedTags(folderPath),
    content.title.split(/[\s,，。！？|｜:：\-_/]+/).find(word => word.length >= 2),
    content.url ? new URL(content.url).hostname.replace(/^www\./, '') : '',
  ].filter(Boolean) as string[]
  return {
    folderPath,
    category: folderPath[0],
    subCategory: folderPath[1],
    tags: [...new Set(fallbackTags)].slice(0, 3),
    confidence: 0.45,
    reason: '使用本地规则根据标题和域名归类',
  }
}

function getFolderSeedTags(folderPath: string[]): string[] {
  const key = folderPath.join('/')
  if (key === '效率工具/网络代理') return ['VPN', '代理', '网络工具']
  if (key === '技术开发/Web3与区块链') return ['Web3', '区块链', '加密生态']
  return []
}

// ── 功能 2：摘要生成 ─────────────────────────────────────────
function buildSummarySystemPrompt(category?: string, subCategory?: string): string {
  const categoryHint = category
    ? `\n注意：该网页的所属分类为「${category}${subCategory ? `/${subCategory}` : ''}」，这是理解网页内容的重要上下文。请不要偏离此分类范围生成摘要。`
    : ''

  return `你是一个专业的网页内容摘要助手。用简洁的中文生成150-180字的内容摘要。${categoryHint}
要求：
1. 提炼核心观点和关键信息
2. 突出实用价值（适合什么人看、能解决什么问题）
3. 如有重要数据或结论请保留
4. 语言简洁流畅，避免废话
5. 务必根据提供的正文内容进行摘要，不要被多义词误导，要结合页面 URL 和分类领域判断
6. ⚠️ 如果正文内容为空或仅有域名/路径信息，说明页面内容不可获取（如需要登录），此时如实说明"页面内容需登录后查看，无法生成详细摘要"，不要自行编造内容
7. 对品牌多义词保持谨慎：如果 URL 属于 colosseum.org 或 arena.colosseum.org，Colosseum 指 Web3/Solana 生态平台，不是罗马斗兽场
直接输出摘要文本，不要任何标签或格式。`
}

const KNOWN_DOMAIN_SUMMARIES: Array<{
  pattern: RegExp
  summary: string
  category?: string
  sparseOnly?: boolean
}> = [
  {
    pattern: /(^|\.)colosseum\.org$/i,
    category: '技术开发/Web3与区块链',
    sparseOnly: true,
    summary: 'Colosseum 是 Solana/Web3 生态相关的平台入口，常用于黑客松、项目竞技、开发者活动或创业项目展示。当前页面正文内容较少或可能需要登录后查看，无法生成更详细的页面摘要。',
  },
]

export async function generateSummary(
  content: ExtractedContent,
  options?: { category?: string; subCategory?: string; tags?: string[]; reason?: string },
): Promise<string | null> {
  const config = await getAIConfig()
  if (!config) return null

  const settings = await getSettings()
  const body = settings.sendContentToAI
    ? getContentForAI(content, 2400)
    : `${content.description}\n${content.url}`

  // 本地预检：正文内容不可获取（登录墙/空白页等），直接返回占位摘要，避免 AI 编造
  const isEmptyContent = !content.mainContent?.trim() || content.mainContent.trim().length < 50
  const isEmptyDescription = !content.description?.trim()
  const isSparseContent = !content.mainContent?.trim() || content.mainContent.trim().length < 180
  const isFallbackOnlyMetadata = body.length < 50 || (isEmptyContent && isEmptyDescription)
  const knownDomainSummary = getKnownDomainSummary(content.url, options, isSparseContent)
  if (knownDomainSummary) return knownDomainSummary

  if (isEmptyContent && isEmptyDescription) {
    const domain = getDomainFallback(content.url)
    return `页面内容暂无法获取（可能需要登录或等待页面加载完成）。${domain ? `域名：${domain}` : ''}`.trim()
  }
  if (isFallbackOnlyMetadata) {
    const domain = getDomainFallback(content.url)
    return `页面内容暂无法获取（可能需要登录或等待页面加载完成）。${domain ? `域名：${domain}` : ''}`.trim()
  }

const userContent = `标题：${content.title}
URL：${content.url}
${options?.category ? `分类：${options.category}${options.subCategory ? `/${options.subCategory}` : ''}` : ''}
${options?.tags?.length ? `标签：${options.tags.join('、')}` : ''}
${options?.reason ? `分类依据：${options.reason}` : ''}
正文内容：
${body}`

  try {
    const prompt = buildSummarySystemPrompt(options?.category, options?.subCategory)
    return await chatCompletion(config, prompt, userContent, 300)
  } catch {
    return null
  }
}

function getKnownDomainSummary(
  url: string,
  options: { category?: string; subCategory?: string } | undefined,
  isSparseContent: boolean,
): string | null {
  const domain = getDomainFallback(url)
  const categoryKey = options?.category ? `${options.category}/${options.subCategory ?? ''}` : ''
  const matched = KNOWN_DOMAIN_SUMMARIES.find(item => item.pattern.test(domain))
  if (!matched) return null
  if (matched.category && matched.category !== categoryKey) return null
  if (matched.sparseOnly && !isSparseContent) return null
  return matched.summary
}

/** 从 URL 中提取域名（降级版，不依赖 new URL） */
function getDomainFallback(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// ── 功能 3：语义搜索（生成嵌入向量简化版）───────────────────
// 由于 Chrome Extension 限制，使用关键词提取 + BM25 模拟语义搜索
const KEYWORDS_SYSTEM_PROMPT = `从以下文本中提取5-8个核心关键词，用于语义搜索索引。
只返回以逗号分隔的关键词，不要其他内容。`

export async function extractKeywords(content: ExtractedContent): Promise<string[]> {
  const config = await getAIConfig()
  if (!config) {
    // 降级：从标题提取简单关键词
    return content.title.split(/[\s,，。！？]+/).filter(w => w.length >= 2).slice(0, 8)
  }

  const settings = await getSettings()
  const text = settings.sendContentToAI
    ? `${content.title}\n${content.description}\n${getContentForAI(content, 800)}`
    : `${content.title}\n${content.description}\n${content.url}`
  try {
    const result = await chatCompletion(config, KEYWORDS_SYSTEM_PROMPT, text, 100)
    return result.split(/[,，]/).map(k => k.trim()).filter(Boolean)
  } catch {
    return content.title.split(/[\s,，。！？]+/).filter(w => w.length >= 2).slice(0, 8)
  }
}

// ── 功能 4：健康检查（批量分析沉睡书签）───────────────────────
export async function analyzeStaleBookmarks(
  bookmarkTitles: string[],
): Promise<{ toArchive: number[]; reason: string }> {
  const config = await getAIConfig()
  if (!config) return { toArchive: [], reason: '' }

  const prompt = `以下是用户长期未访问的书签列表（格式：序号. 标题），请分析哪些可能已经过时或价值降低，建议归档（不是删除）。
${bookmarkTitles.map((t, i) => `${i}. ${t}`).join('\n')}

返回JSON：{"toArchive":[建议归档的序号数组],"reason":"简短说明"}`

  try {
    const raw = await chatCompletion(config, '你是书签健康分析助手', prompt, 300)
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw
    return JSON.parse(jsonStr)
  } catch {
    return { toArchive: [], reason: '' }
  }
}
