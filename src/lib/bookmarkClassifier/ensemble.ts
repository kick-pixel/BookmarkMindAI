// ============================================================
// BookmarkMind AI · 置信度融合器 (Stage 4)
// 融合域名引擎、规则引擎、AI 结果得出最终分类
// ============================================================
import type { ExtractedContent } from '../../types'
import type { DomainMatchResult } from './domainEngine'
import type { RuleResult } from './ruleEngine'
import { matchDomain } from './domainEngine'
import { matchByRules } from './ruleEngine'
import type { ClassifyResult } from '../ai'

export interface EnsembleInput {
  domainResult?: DomainMatchResult | null
  ruleResults?: RuleResult[]
  aiResult?: ClassifyResult | null
}

export interface EnsembleOutput {
  folderPath: [string, string]
  confidence: number
  reason: string
  tags: string[]
  source: 'domain-map' | 'rule-engine' | 'ai' | 'ensemble-fallback'
  contributions: {
    source: string
    folderPath: string
    confidence: number
    weight: number
  }[]
}

// 各引擎的权重配置
const WEIGHTS = {
  domainMap: 0.40,        // 域名映射 (高精度, 覆盖面窄)
  urlStructure: 0.15,     // URL 结构 (中等精度)
  keywordGroup: 0.25,     // 关键词组 (中等精度)
  contentType: 0.10,      // 内容类型 (低精度)
  aiPrompt: 0.35,         // AI 分类 (高精度但需扣除 0.1 偏见调节)
}

/**
 * 融合所有分类引擎的结果
 */
export function ensembleClassify(
  input: Pick<ExtractedContent, 'title' | 'url' | 'description' | 'mainContent'>,
  aiResult?: ClassifyResult | null,
): EnsembleOutput {
  const domainResult = matchDomain(input.url)
  const ruleResults = matchByRules(input)

  const contributions: EnsembleOutput['contributions'] = []

  // 1. 域名引擎
  if (domainResult) {
    contributions.push({
      source: 'domain-map',
      folderPath: domainResult.folderPath.join('/'),
      confidence: domainResult.confidence,
      weight: WEIGHTS.domainMap,
    })
  }

  // 2. 规则引擎 (按来源分组)
  for (const rule of ruleResults) {
    const weight = RULE_SOURCE_WEIGHTS[rule.source] ?? 0.15
    contributions.push({
      source: `rule-${rule.source}`,
      folderPath: rule.folderPath.join('/'),
      confidence: rule.confidence,
      weight,
    })
  }

  // 3. AI 结果
  if (aiResult?.folderPath) {
    const aiWeight = WEIGHTS.aiPrompt
    // 如果域名引擎已有高置信度结果且和 AI 一致，给 AI 加成
    let aiConfBoost = 0
    if (domainResult && aiResult.folderPath[0] === domainResult.folderPath[0]) {
      aiConfBoost = 0.05  // 领域一致加成
    }
    contributions.push({
      source: 'ai',
      folderPath: aiResult.folderPath.join('/'),
      confidence: (aiResult.confidence ?? 0.7) + aiConfBoost,
      weight: aiWeight,
    })
  }

  // 4. 加权投票选出最佳分类
  // 注：每个引擎独立贡献 vote = (confidence, countPerEngine)，不做 weightedAvg 缩放过低
  // 最终 confidence 取各贡献引擎的平均分（不除以 weight），避免单一引擎时被过度压低
  const votes = new Map<string, { totalWeightedScore: number; totalConf: number; count: number; reasons: string[]; tags: string[] }>()

  for (const c of contributions) {
    const key = c.folderPath
    const existing = votes.get(key) ?? { totalWeightedScore: 0, totalConf: 0, count: 0, reasons: [], tags: [] }
    // totalWeightedScore 用于比较哪个分类更好：累加 (置信度 × 权重)
    // 但计算最终 confidence 时，使用平均置信度（不受权重缩放影响）
    existing.totalWeightedScore += c.confidence * c.weight
    existing.totalConf += c.confidence
    existing.count += 1
    existing.reasons.push(`${c.source} (${(c.confidence * 100).toFixed(0)}%)`)
    if (aiResult?.tags?.length && c.source === 'ai') {
      existing.tags = [...new Set([...existing.tags, ...aiResult.tags])]
    }
    votes.set(key, existing)
  }

  // 计算每个分类的综合评分
  let bestKey = ''
  let bestScore = -1
  let bestData: { totalWeightedScore: number; totalConf: number; count: number; reasons: string[]; tags: string[] } | null = null

  for (const [key, data] of votes) {
    // 综合评分 = 总加权分 + 多样性加分
    const diversityBonus = Math.min(data.count * 0.02, 0.10)
    const score = data.totalWeightedScore + diversityBonus

    if (score > bestScore) {
      bestScore = score
      bestKey = key
      bestData = data
    }
  }

  if (!bestKey || !bestData) {
    return createFallback(input.title)
  }

  const folderPath = bestKey.split('/') as [string, string]
  // 最终置信度 = 各贡献引擎的平均置信度，不除以 weight 缩放
  const confidence = Math.min(
    (bestData.totalConf / Math.max(bestData.count, 1)) + 0.05,
    0.99,
  )

  // 决定最终 source label
  let source: EnsembleOutput['source'] = 'ensemble-fallback'
  const topContributor = contributions.sort((a, b) => b.confidence * b.weight - a.confidence * a.weight)[0]
  if (topContributor) {
    if (topContributor.source === 'domain-map') source = 'domain-map'
    else if (topContributor.source.startsWith('rule-')) source = 'rule-engine'
    else if (topContributor.source === 'ai') source = 'ai'
  }

  return {
    folderPath,
    confidence,
    reason: `融合 ${contributions.length} 个引擎: ${bestData.reasons.join('; ')}`,
    tags: bestData.tags.length ? bestData.tags.slice(0, 5) : generateFallbackTags(input, folderPath),
    source,
    contributions,
  }
}

const RULE_SOURCE_WEIGHTS: Record<string, number> = {
  'keyword-group': WEIGHTS.keywordGroup,
  'url-structure': WEIGHTS.urlStructure,
  'content-type': WEIGHTS.contentType,
}

/**
 * 生成备选标签
 */
function generateFallbackTags(input: Pick<ExtractedContent, 'title' | 'url' | 'description' | 'mainContent'>, folderPath: string[]): string[] {
  const tags: string[] = [...folderPath]
  const titleTags = input.title.split(/[\s,，。！？|｜:：\-_/]+/).filter(w => w.length >= 2).slice(0, 3)
  tags.push(...titleTags)
  try {
    const hostname = new URL(input.url).hostname.replace(/^www\./, '')
    tags.push(hostname)
  } catch { /* skip */ }
  return [...new Set(tags)].slice(0, 5)
}

function createFallback(title: string): EnsembleOutput {
  return {
    folderPath: ['其他', '待整理'],
    confidence: 0.3,
    reason: '所有引擎均未匹配到合适分类',
    tags: title.split(/[\s,，。！？]+/).filter(w => w.length >= 2).slice(0, 3),
    source: 'ensemble-fallback',
    contributions: [],
  }
}
