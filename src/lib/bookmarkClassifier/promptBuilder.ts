// ============================================================
// BookmarkMind AI · AI Prompt 构建器
// 为 classifyBookmark 提供增强的 System Prompt，
// 注入域名引擎匹配结果、URL 结构分析、用户学习记录
// ============================================================
import { getTaxonomyPrompt } from '../bookmarkTaxonomy'
import { getDomainSuggestion } from './domainEngine'
import { analyzeURL, getContentTypeLabel } from './urlAnalyzer'

const MEDIA_DOMAIN_HINTS = [
  'news', 'finance', 'tech', '36kr', 'huxiu', 'ithome', 'infoq',
  'qq.com', 'news.qq.com', '163.com', 'sina.com', 'sohu.com',
  'theverge.com', 'techcrunch.com', 'wired.com', 'reuters.com', 'bloomberg.com',
]

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
  const isTutorial = features.isTutorial
  const isAPI = features.isAPI
  const isPricing = features.isPricing
  const hostname = getHostname(url)
  const subdomain = features.subdomain || hostname.split('.')[0] || ''
  const mediaDomainHint = MEDIA_DOMAIN_HINTS.some(hint => hostname.includes(hint) || subdomain === hint)
    ? '疑似新闻/媒体/资讯域名'
    : '无明显媒体域名信号'

  // 3. 构建 Prompt
  const domainHint = domainSuggestion
    ? `\n📌 域名预判：此域名已知属于「${domainSuggestion}」，请注意判断。`
    : ''

  return `你是 BookmarkMind AI 的智能目录架构师。请严格按以下规则为网页选择分类。

=== 可用目录体系（只允许二级，不允许新造第三级）===
${getTaxonomyPrompt()}

=== 决策原则：先判内容形态，再判主题领域 ===
请把「页面是什么形态」和「页面讨论什么主题」分开判断。最终目录优先由内容形态决定，主题只影响子类和标签。

1. 内容形态判断（最高优先级）
   - 新闻/媒体报道/快讯/转载稿/监管动态/公司新闻 → 资讯动态。即使主题包含 AI、模型、Meta、Manus、开发者，也不要归入技术开发。
   - 技术文档/API Reference/SDK 文档/官方手册 → 技术开发或学习研究，按技术栈细分。
   - 教程/实战/入门/指南/how-to/course → 学习研究/技术教程；如果是具体开发框架实战，也可归技术开发对应子类。
   - GitHub 仓库/开源项目/readme/issues → 技术开发/开源项目或对应技术子类。
   - 工具官网/产品落地页/定价页 → 按产品功能领域归类，不按新闻处理。
   - 普通博客/观点文章 → 综合正文主题、作者目的和网站上下文判断。
2. 主题领域识别
   - 识别 AI、Web3、前端、后端、数据库、设计、财经、政策、健康等主题。
   - 主题领域不能覆盖内容形态：例如“AI 公司并购新闻”仍是资讯动态，不是技术开发。
3. 目录映射
   - 新闻形态优先映射到 资讯动态/科技新闻、资讯动态/公司产品 或相关资讯子类。
   - 开发资源形态才映射到 技术开发。
4. 标签生成：从三个维度提取标签
   - 文章标签最多 3 个，优先选择可检索的主题词/事件词/实体词
   - 可包含技术/领域关键词（如 React、Kubernetes、Solana）
   - 可包含内容类型（如 新闻、教程、文档、开源项目），但不要重复目录名

=== 强约束：不要被主题词带偏 ===
- 标题/正文出现 AI、模型、大模型、Agent、Meta、OpenAI、Manus、开发者，不必然属于「技术开发/AI与机器学习」。
- 只有当页面是在讲技术实现、代码、框架、API、模型训练、工程实践、开发教程或开源项目时，才归入技术开发。
- 如果页面是在报道事件、融资、并购、监管、产品发布、行业动态、公司动作，应归入资讯动态。
- 新闻媒体域名或 news 子域名是强信号，但不是唯一依据；如果正文形态明显是新闻报道，优先按新闻处理。

=== 重要分类规则 ===
- folderPath 必须是长度为 2 的数组：[一级目录, 二级目录]
- category = folderPath[0]，subCategory = folderPath[1]
- tags 是 1-3 个具体、精准的横向检索标签（禁止过于宽泛的词汇如"技术"、"工具"、"网站"）
- confidence 是分类置信度 0-1
- 高优先级关键词（检测到必须优先放入对应分类）：
  - VPN/代理/科学上网/Clash/V2Ray/WireGuard → 效率工具/网络代理
  - Solana/Ethereum/Web3/DeFi/NFT/空投/钱包/智能合约/Colosseum/Devnet/Faucet → 技术开发/Web3与区块链
  - 教程/入门指南/getting started → 学习研究/技术教程
  - 新闻/报道/媒体稿/news.qq.com/腾讯新闻/36氪/虎嗅/IT之家 → 资讯动态/科技新闻；即使主题是 AI、Meta、模型或开发者，也不要归入技术开发
  - 工具官网/产品发布 → 不按新闻处理，按功能领域归类
- 如果内容难以判断，优先按域名归属领域归类
- 如果域名预判和内容分析有明显矛盾，以内容为准但需要说明原因
- 注意品牌多义词：Colosseum 在 colosseum.org 或 arena.colosseum.org 中是 Web3/Solana 生态品牌，不是罗马斗兽场旅游/历史内容

=== 典型反例 ===
- “Manus 被 Meta 收购遭监管叫停，腾讯新闻” → 资讯动态/科技新闻；标签可含 Manus、AI、并购、监管。
- “LangGraph 循环执行实战：Python 代码示例” → 技术开发/AI与机器学习 或 学习研究/技术教程。
- “OpenAI SDK sessions API 文档” → 技术开发/AI与机器学习。
- “某 AI 产品发布定价调整” → 资讯动态/公司产品 或 效率工具/AI工具，视页面形态判断。

=== 标签生成规则 ===
- 最多 3 个标签，宁缺毋滥
- 优先实体/主题/事件标签，如"Manus"、"并购监管"、"LangGraph"
- 可以包含 1 个内容类型标签，如"新闻"、"教程"、"文档"、"开源项目"
- 不要输出目录名作为标签，如"技术开发"、"资讯动态"、"科技新闻"、"AI与机器学习"
- 禁止生成过于宽泛、无检索价值的标签，如"技术"、"信息"、"网站"、"工具"、"学习"
- 优先使用行业通用术语，而不是描述性短语

=== 当前页面的预分析上下文 ===
- URL 结构特征：${contentTypeLabel}${isGithub ? ' (GitHub Gist)' : ''}
- 主机名：${hostname}
- 子域名：${subdomain || '无'}
- 媒体域名信号：${mediaDomainHint}
- 域名预判：${domainSuggestion || '未知域名'}${domainHint}
- 页面类型判断依据：URL 路径${hasDocPath ? ' 包含文档关键词' : ''}${hasBlog ? ' 包含博客关键词' : ''}${isTutorial ? ' 包含教程关键词' : ''}${isAPI ? ' 包含 API 关键词' : ''}${isPricing ? ' 包含定价关键词' : ''}

=== 响应格式（严格 JSON，不要其他文字）===
{"folderPath":["一级","二级"],"category":"一级","subCategory":"二级","tags":["标签1","标签2","标签3"],"confidence":0.95,"reason":"说明内容形态、主题领域和最终目录选择依据"}`
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
  const features = analyzeURL(url)
  const contentTypeLabel = getContentTypeLabel(features)

  // 构建 URL 特征摘要
  const urlFeatures: string[] = []
  if (features.subdomain) urlFeatures.push(`子域名: ${features.subdomain}`)
  if (features.pathSegments.length > 0) urlFeatures.push(`路径: /${features.pathSegments.join('/')}`)
  if (features.extension) urlFeatures.push(`文件类型: ${features.extension}`)

  let contentSection: string
  if (pageContent && pageContent.length > 10) {
    contentSection = `页面正文片段（用于判断内容形态和主题，前800字）：\n${pageContent}`
  } else {
    contentSection = `⚠️ 正文未采集（用户关闭了"发送页面正文给AI"选项或页面不可访问）。请仅基于标题、URL和描述进行判断。\n内容类型预判：${contentTypeLabel}`
  }

  return `网页标题：${title}
URL：${url}
URL特征：${urlFeatures.join(' | ') || '普通页面'}
描述：${description || '(无描述)'}
请先判断内容形态，再判断主题领域，最后给出目录。
${contentSection}`
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}
