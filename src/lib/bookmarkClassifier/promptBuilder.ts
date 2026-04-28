// ============================================================
// BookmarksAI · AI Prompt 构建器
// 为 classifyBookmark 提供增强的 System Prompt，
// 注入域名引擎匹配结果、URL 结构分析、用户学习记录
// ============================================================
import { getTaxonomyPrompt } from '../bookmarkTaxonomy'
import { getDomainSuggestion } from './domainEngine'
import { analyzeURL, getContentTypeLabel } from './urlAnalyzer'

/**
 * 构建增强型 AI 分类 System Prompt
 * 特点是：不给 LLM 自由发挥的空间，而是给大量 structed context 辅助判断
 */
export function buildClassifySystemPrompt(url: string): string {
  // 1. 域名匹配结果
  const domainSuggestion = getDomainSuggestion(url)

  // 2. URL 结构分析
  const features = analyzeURL(url)
  const contentTypeLabel = getContentTypeLabel(features)
  const hasDocPath = features.isDocumentation
  const hasBlog = features.isBlog
  const isGithub = features.isGitHubRepo

  // 3. 构建 Prompt
  const domainHint = domainSuggestion
    ? `\n📌 域名预判：此域名已知属于「${domainSuggestion}」，请注意判断。`
    : ''

  return `你是 BookmarksAI 的智能目录架构师。请严格按以下规则为网页选择分类。

=== 可用目录体系（只允许二级，不允许新造第三级）===
${getTaxonomyPrompt()}

=== 重要分类规则 ===
- folderPath 必须是长度为 2 的数组：[一级目录, 二级目录]
- category = folderPath[0]，subCategory = folderPath[1]
- tags 是 3-5 个横向检索标签（可以跨目录）
- confidence 是分类置信度 0-1
- 高优先级关键词（检测到必须优先放入）：
  - VPN/代理/科学上网/Clash/V2Ray/WireGuard → 效率工具/网络代理
  - Solana/Ethereum/Web3/DeFi/NFT/空投/钱包/智能合约/Colosseum/Devnet/Faucet → 技术开发/Web3与区块链
  - 教程/入门指南/getting started → 学习研究/技术教程
  - 工具官网/产品发布 → 不按新闻处理，按功能领域归类
- 如果内容难以判断，优先按域名归属领域归类
- 如果域名预判和内容分析有明显矛盾，以内容为准但需要说明原因
- 注意品牌多义词：Colosseum 在 colosseum.org 或 arena.colosseum.org 中是 Web3/Solana 生态品牌，不是罗马斗兽场旅游/历史内容

=== 当前页面的预分析上下文 ===
- URL 结构特征：${contentTypeLabel}${isGithub ? ' (GitHub Gist)' : ''}
- 域名预判：${domainSuggestion || '未知域名'}${domainHint}
- 页面类型判断依据：URL 路径${hasDocPath ? ' 包含文档关键词' : ''}${hasBlog ? ' 包含博客关键词' : ''}

=== 响应格式（严格 JSON，不要其他文字）===
{"folderPath":["一级","二级"],"category":"一级","subCategory":"二级","tags":["标签1","标签2","标签3","标签4","标签5"],"confidence":0.95,"reason":"分类依据一句话说明"}`
}

/**
 * 构建分类用的 User Content
 */
export function buildClassifyUserContent(
  title: string,
  url: string,
  description: string,
  pageContent: string,
): string {
  return `网页标题：${title}
URL：${url}
描述：${description}
内容摘要：${pageContent || '(无页面内容)'}`
}
