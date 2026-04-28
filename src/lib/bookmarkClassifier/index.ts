// ============================================================
// BookmarkMind AI · 智能分类器主入口
// 四阶段流水线：域名引擎 → URL分析 → 规则引擎 → AI → 融合
// ============================================================
import type { ExtractedContent } from '../../types'
import { matchDomain, type DomainMatchResult } from './domainEngine'
import type { RuleResult } from './ruleEngine'
import { ensembleClassify, type EnsembleOutput } from './ensemble'
import { classifyBookmark as classifyBookmarkAI, type ClassifyResult } from '../ai'
import { matchLearnedRule } from './userLearning'

export type { DomainMatchResult, RuleResult, EnsembleOutput }
export type { ClassifyResult } from '../ai'

export interface ClassifyOptions {
  /** 仅本地规则（不调用 AI） */
  localOnly?: boolean
  /** 是否启用用户学习 */
  enableLearning?: boolean
}

/**
 * 智能分类主入口
 * 四阶段流水线：
 * 1. 域名引擎 → 高置信度域名查找 (0.5ms)
 * 2. URL 结构分析 → 页面类型标记 (0.3ms)
 * 3. 加权规则引擎 → 关键词+URL+内容类型 (1-2ms)
 * 4a. AI 语义分类 (可选, 需 API 调用)
 * 4b. 融合器 → 最终输出 (0.1ms)
 */
export async function smartClassify(
  content: Pick<ExtractedContent, 'title' | 'url' | 'description' | 'mainContent'>,
  options: ClassifyOptions = {},
): Promise<EnsembleOutput> {
  const { localOnly = false, enableLearning = true } = options

  // Stage 1 + 2 + 3: 本地引擎并行执行
  const domainResult = matchDomain(content.url)

  // 高置信度短路：域名匹配 ≥ 0.90 直接返回
  if (domainResult && domainResult.confidence >= 0.90) {
    const tags = generateTagsFromDomain(content, domainResult)
    return {
      folderPath: domainResult.folderPath,
      confidence: domainResult.confidence,
      reason: `域名映射: ${domainResult.matchedDomain} → ${domainResult.folderPath.join('/')}`,
      tags,
      source: 'domain-map',
      contributions: [{
        source: 'domain-map',
        folderPath: domainResult.folderPath.join('/'),
        confidence: domainResult.confidence,
        weight: 0.40,
      }],
    }
  }

  // 检查用户学习规则
  if (enableLearning) {
    const learnedRule = await matchLearnedRule(content.url)
    if (learnedRule && learnedRule.confidence >= 0.7) {
      return {
        folderPath: learnedRule.folderPath,
        confidence: learnedRule.confidence,
        reason: `用户学习: 基于 ${learnedRule.confidence.toFixed(2)} 置信度的用户修正记录`,
        tags: [learnedRule.folderPath[0], learnedRule.folderPath[1]],
        source: 'rule-engine',
        contributions: [{
          source: 'user-learning',
          folderPath: learnedRule.folderPath.join('/'),
          confidence: learnedRule.confidence,
          weight: 0.35,
        }],
      }
    }
  }

  // Stage 4a: AI 分类 (如果需要)
  let aiResult: ClassifyResult | null = null
  if (!localOnly) {
    aiResult = await classifyBookmarkAI(content).catch(() => null)
  }

  // Stage 4b: 融合器
  const ensembleResult = ensembleClassify(content, aiResult)

  return ensembleResult
}

/**
 * 从域名匹配生成标签
 */
function generateTagsFromDomain(
  content: Pick<ExtractedContent, 'title' | 'url' | 'description' | 'mainContent'>,
  domainResult: DomainMatchResult,
): string[] {
  const tags: string[] = [domainResult.folderPath[0], domainResult.folderPath[1]]
  tags.push(domainResult.matchedDomain)

  // 从标题提取额外关键词
  const titleWords = content.title
    .split(/[\s,，。！？|｜:：\-_/]+/)
    .filter(w => w.length >= 2 && !tags.includes(w))
    .slice(0, 2)

  tags.push(...titleWords)
  return [...new Set(tags)].slice(0, 5)
}

/**
 * 同步版本：仅使用本地规则，适用于需要立即返回的场景
 */
export function smartClassifySync(
  content: Pick<ExtractedContent, 'title' | 'url' | 'description' | 'mainContent'>,
): EnsembleOutput {
  const domainResult = matchDomain(content.url)

  // 域名高置信度短路
  if (domainResult && domainResult.confidence >= 0.90) {
    return {
      folderPath: domainResult.folderPath,
      confidence: domainResult.confidence,
      reason: `域名映射: ${domainResult.matchedDomain} → ${domainResult.folderPath.join('/')}`,
      tags: generateTagsFromDomain(content, domainResult),
      source: 'domain-map',
      contributions: [{
        source: 'domain-map',
        folderPath: domainResult.folderPath.join('/'),
        confidence: domainResult.confidence,
        weight: 0.40,
      }],
    }
  }

  return ensembleClassify(content, null)
}
