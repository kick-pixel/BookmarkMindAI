// ============================================================
// BookmarkMind AI · OpenAI-compatible AI 服务层
// ============================================================
import type { AIConfig, ExtractedContent } from '../types'
import { inferFolderByRules, normalizeFolderPath } from './bookmarkTaxonomy'
import { getProviderPreset } from './aiProviders'
import { resolveAIConfig } from './aiConfig'
import { getSettings } from './storage'
import { buildClassifySystemPrompt, buildClassifyUserContent } from './bookmarkClassifier/promptBuilder'

// ── 核心 Chat 调用（带重试）────────────────────────────────────
async function chatCompletion(
  config: AIConfig,
  systemPrompt: string,
  userContent: string,
  maxTokens = 500,
): Promise<string> {
  const preset = getProviderPreset(config.provider)
  const baseUrl = (config.baseUrl ?? preset.baseUrl).replace(/\/$/, '')
  const model = config.model ?? preset.defaultModel
  const MAX_RETRIES = 3

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await tryChatCompletion(baseUrl, model, config.apiKey, systemPrompt, userContent, maxTokens)
    if (result.ok) return result.content
    lastError = result.error

    // 只对临时性错误重试：429(限流), 5xx(服务端错误), timeout
    const shouldRetry = result.isRetryable && attempt < MAX_RETRIES
    if (!shouldRetry) break

    // 指数退避：500ms, 1s, 2s
    const delayMs = 500 * Math.pow(2, attempt - 1)
    await sleep(delayMs)
  }

  throw lastError ?? new Error('AI API request failed after retries')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => globalThis.setTimeout(resolve, ms))
}

async function tryChatCompletion(
  baseUrl: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<{ ok: true; content: string } | { ok: false; error: Error; isRetryable: boolean }> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 60000)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
    })

    if (!response.ok) {
      const errText = await response.text()
      const status = response.status
      const isRetryable = status === 429 || status >= 500
      const error = new Error(`AI API Error ${status}: ${errText}`)
      return { ok: false, error, isRetryable }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    if (!content) {
      return { ok: false, error: new Error('AI returned empty response'), isRetryable: true }
    }
    return { ok: true, content }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    const isRetryable = error.name === 'AbortError' || error.message.includes('network')
    return { ok: false, error, isRetryable }
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
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
    const raw = await chatCompletion(config, systemPrompt, userContent, 420)
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
    tags: [...new Set((result.tags ?? []).map(tag => tag.trim()).filter(Boolean))].slice(0, 3),
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
function buildSummarySystemPrompt(
  category?: string,
  subCategory?: string,
  tags?: string[],
): string {
  const categoryHint = category
    ? `\n注意：该网页的所属分类为「${category}${subCategory ? `/${subCategory}` : ''}」，这是理解网页内容的重要上下文。请不要偏离此分类范围生成摘要。`
    : ''

  const tagsHint = tags?.length
    ? `\n相关标签：${tags.join('、')}，摘要应围绕这些关键词展开。`
    : ''

  // 根据分类定制摘要策略
  let typeSpecificGuidance = ''
  if (category === '技术开发') {
    typeSpecificGuidance = `
【技术文档/开源项目摘要策略】
- 第一句：这是什么技术/工具/框架（一句话定义）
- 第二句：核心功能或解决的问题（2-3个关键点）
- 第三句：适用场景和技术栈（适合什么项目使用）
- 如果是 GitHub 仓库，额外提及 Stars 数（如果有）、主要语言、最新更新时间（如果有）`
  } else if (category === '学习研究') {
    typeSpecificGuidance = `
【教程/学习资料摘要策略】
- 第一句：这份资料讲什么主题/技术
- 第二句：内容覆盖范围和深度（入门/进阶/实战）
- 第三句：适合什么基础的学习者，学完能掌握什么`
  } else if (category === '效率工具') {
    typeSpecificGuidance = `
【工具/产品摘要策略】
- 第一句：这是什么工具/产品（一句话定义）
- 第二句：核心功能和差异化特点（与同类产品相比的优势）
- 第三句：目标用户和使用场景（谁最需要这个工具）`
  } else if (category === '资讯动态') {
    typeSpecificGuidance = `
【新闻/资讯摘要策略】
- 第一句：核心事件或消息（发生了什么）
- 第二句：关键背景和影响范围
- 第三句：对读者有什么价值或需要关注的原因`
  } else if (category === '产品设计') {
    typeSpecificGuidance = `
【产品/设计摘要策略】
- 第一句：这是什么类型的产品设计资源/案例
- 第二句：核心设计理念或方法论
- 第三句：对产品经理/设计师的实用价值`
  } else {
    typeSpecificGuidance = `
【通用摘要策略】
- 第一句：这个页面/资源是什么（定义/概述）
- 第二句：核心内容或功能（关键信息点）
- 第三句：实用价值（适合什么人、解决什么问题）`
  }

  return `你是一个专业的网页内容摘要助手。请根据页面分类使用对应的摘要策略，生成100-160字的高质量中文摘要。${categoryHint}${tagsHint}

=== 通用摘要原则 ===
1. 信息密度：每句话都必须包含实质性信息，禁止废话和套话
2. 不要复述标题中已明确的信息，而是补充标题没说的核心价值
3. 务必根据提供的正文内容摘要，不要编造未提及的内容
4. 对品牌多义词保持谨慎：如果 URL 属于 colosseum.org，Colosseum 指 Web3/Solana 生态平台，不是罗马斗兽场
5. ⚠️ 如果正文内容为空或仅有域名/路径信息，说明页面内容不可获取（如需要登录），此时如实说明"页面内容需登录后查看，无法生成详细摘要"，不要自行编造内容

=== 分类定制策略 ===${typeSpecificGuidance}

=== 输出格式 ===
直接输出摘要文本，不要任何标签、markdown格式或"摘要："前缀。
必须使用2-3个完整中文句子，最后一个字符必须是句号、问号或感叹号。不要使用省略号，不要输出未完成的半句话。`
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

  const isSparseContent = !content.mainContent?.trim() || content.mainContent.trim().length < 180
  const knownDomainSummary = getKnownDomainSummary(content.url, options, isSparseContent)
  if (knownDomainSummary) return knownDomainSummary

const userContent = `标题：${content.title}
URL：${content.url}
${options?.category ? `分类：${options.category}${options.subCategory ? `/${options.subCategory}` : ''}` : ''}
${options?.tags?.length ? `标签：${options.tags.join('、')}` : ''}
${options?.reason ? `分类依据：${options.reason}` : ''}
正文内容：
${body}`

  try {
    const prompt = buildSummarySystemPrompt(options?.category, options?.subCategory, options?.tags)
    const summary = await chatCompletion(config, prompt, userContent, 500)
    return normalizeSummaryText(summary)
  } catch (err) {
    throw err
  }
}

function normalizeSummaryText(summary: string): string {
  let text = summary
    .replace(/^摘要[:：]\s*/i, '')
    .replace(/```[\s\S]*?```/g, match => match.replace(/```/g, ''))
    .replace(/\s+/g, ' ')
    .trim()

  text = text.replace(/[.．]+$/g, '。')
  if (/[。！？!?]$/.test(text)) return normalizeTerminalPunctuation(text)

  const lastSentenceEnd = Math.max(
    text.lastIndexOf('。'),
    text.lastIndexOf('！'),
    text.lastIndexOf('？'),
    text.lastIndexOf('!'),
    text.lastIndexOf('?'),
  )
  if (lastSentenceEnd >= 40) {
    return normalizeTerminalPunctuation(text.slice(0, lastSentenceEnd + 1).trim())
  }

  return `${text.replace(/[，,、；;：:]+$/, '')}。`
}

function normalizeTerminalPunctuation(text: string): string {
  return text.replace(/!/g, '！').replace(/\?/g, '？').replace(/\.([^0-9]|$)/g, '。$1').trim()
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
