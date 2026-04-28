// ============================================================
// BookmarkMind AI · 增强加权规则引擎 (Stage 3)
// 替代原 LOCAL_RULES，支持权重叠加、领域关键词、页面类型关键词
// ============================================================
import type { ExtractedContent } from '../../types'
import { analyzeURL, type PathFeatures } from './urlAnalyzer'
import { detectContentType } from './contentTypeDetector'

export interface RuleMatchEvidence {
  ruleName: string
  weight: number
  matchedOn: string[]   // 哪些字段触发了匹配
  snippet: string       // 命中的原文片段
}

export interface WeightedRule {
  name: string
  /** 正则表达式 → 用于匹配的 text */
  pattern: RegExp
  /** 目标分类 */
  category: string
  subCategory: string
  /** 匹配权重 (0-1) */
  weight: number
  /** 匹配域: 在哪些字段上执行 */
  fields: Array<'title' | 'url' | 'description' | 'content'>
  /** 最低匹配阈值 (0-1)，累计权重超过此值才生效 */
  minThreshold?: number
}

/**
 * 领域关键词 - 用于标题/内容的关键词匹配
 * 按 (category, subCategory) 分组
 */
interface DomainKeywordGroup {
  category: string
  subCategory: string
  keywords: string[]
  minMatch: number  // 最少匹配多少个关键词
  weight: number
}

const DOMAIN_KEYWORDS: DomainKeywordGroup[] = [
  // 技术开发
  { category: '技术开发', subCategory: '前端开发', keywords: ['react', 'vue', 'angular', 'svelte', 'tailwind', 'css', 'html', '前端', 'typescript', 'javascript', 'webpack', 'vite', 'babel', 'esbuild', 'nextjs', 'nuxtjs', 'astro'], minMatch: 1, weight: 0.70 },
  { category: '技术开发', subCategory: '后端服务', keywords: ['nodejs', 'nestjs', 'express', 'spring boot', 'spring', 'django', 'fastapi', 'flask', 'golang', 'rust', '微服务', 'grpc', 'graphql', 'rest api', 'backend', '后端'], minMatch: 1, weight: 0.70 },
  { category: '技术开发', subCategory: 'AI与机器学习', keywords: ['machine learning', 'deep learning', 'llm', '大模型', 'chatgpt', 'gpt', 'ai agent', 'rag', 'fine-tuning', 'pytorch', 'tensorflow', '神经网络', '自然语言处理', '计算机视觉', 'stable diffusion', 'openai', 'langchain', 'llamaindex', '向量数据库', 'embedding', 'transformer'], minMatch: 1, weight: 0.75 },
  { category: '技术开发', subCategory: '数据库与数据工程', keywords: ['sql', 'nosql', 'postgresql', 'mysql', 'mongodb', 'redis', 'clickhouse', 'elasticsearch', '数据仓库', '数据湖', 'etl', 'spark', 'flink', 'kafka', '数据工程', 'database', 'sqlite'], minMatch: 1, weight: 0.75 },
  { category: '技术开发', subCategory: 'Web3与区块链', keywords: ['ethereum', 'solana', 'bitcoin', 'blockchain', '区块链', 'web3', '智能合约', 'solidity', 'defi', 'nft', 'airdrop', 'wallet', '空投', '钱包', 'hardhat', 'foundry', 'token', '代币', 'crypto', 'colosseum', 'hackathon', 'faucet', 'devnet', 'phantom', 'metamask'], minMatch: 1, weight: 0.85 },
  { category: '技术开发', subCategory: 'DevOps与云服务', keywords: ['docker', 'kubernetes', 'k8s', 'devops', 'ci/cd', 'jenkins', 'terraform', 'ansible', 'aws', 'azure', 'gcp', '云原生', '部署', '容器', 'helm', 'istio', 'github actions'], minMatch: 1, weight: 0.75 },
  { category: '技术开发', subCategory: '安全与架构', keywords: ['security', '信息安全', '网络安全', '渗透测试', 'auth', 'oauth', 'jwt', '零信任', '防火墙', 'vulnerability', '漏洞', 'cve', '身份认证', '加密'], minMatch: 1, weight: 0.70 },
  { category: '技术开发', subCategory: '移动与客户端', keywords: ['android', 'ios', 'swift', 'flutter', 'react native', 'harmonyos', '移动端', '客户端', '小程序', 'kotlin', 'jetpack compose', 'swiftui'], minMatch: 1, weight: 0.70 },

  // 学习研究
  { category: '学习研究', subCategory: '学术论文', keywords: ['paper', '论文', 'arxiv', 'preprint', 'research', '研究', 'conference', 'journal', 'acm', 'ieee', 'citation', '引用', 'proceedings', '投稿', 'submission'], minMatch: 1, weight: 0.72 },
  { category: '学习研究', subCategory: '技术教程', keywords: ['tutorial', '教程', 'guide', '指南', 'learn', '学习', 'how to', 'cheatsheet', '备忘', 'roadmap', 'roadmap.sh', '从零开始', '入门', 'getting started'], minMatch: 1, weight: 0.65 },
  { category: '学习研究', subCategory: '课程资料', keywords: ['course', '课程', 'lesson', 'lecture', '讲座', 'workshop', 'training', '培训', 'coursera', 'udemy', 'udacity', 'edx', '慕课', 'mooc', 'dev.to'], minMatch: 1, weight: 0.65 },

  // 效率工具
  { category: '效率工具', subCategory: '网络代理', keywords: ['vpn', 'proxy', '代理', '翻墙', '科学上网', 'clash', 'v2ray', 'wireguard', 'tailscale', 'zerotier', 'openvpn', 'shadowsocks', 'trojan', '网络加速'], minMatch: 1, weight: 0.90 },
  { category: '效率工具', subCategory: 'AI工具', keywords: ['chatgpt', 'deepseek', 'claude', 'kimi', 'ai chat', 'ai assistant', 'ai 助手', 'copilot', 'perplexity', 'midjourney', 'stable diffusion', 'doubao', '豆包', 'metaso', '通义千问'], minMatch: 1, weight: 0.80 },
  { category: '效率工具', subCategory: '开发工具', keywords: ['editor', 'ide', 'vs code', 'vscode', 'postman', 'git', 'svn', 'terminal', 'shell', 'npm', 'yarn', 'pnpm', 'sdk', 'cli', '插件', 'extension'], minMatch: 1, weight: 0.60 },
  { category: '效率工具', subCategory: '自动化脚本', keywords: ['automation', 'workflow', 'zapier', 'make', 'n8n', 'workflow', '自动', '脚本', 'pipeline', 'trigger', 'webhook'], minMatch: 1, weight: 0.65 },
  { category: '效率工具', subCategory: '办公协作', keywords: ['notion', 'slack', 'teams', '飞书', '钉钉', 'project management', '项目管理', 'trello', 'asana', 'linear', 'miro', '协作', 'cooperation', 'meeting', '会议', 'jira', 'confluence'], minMatch: 1, weight: 0.65 },

  // 产品设计
  { category: '产品设计', subCategory: 'UI/UX设计', keywords: ['ui', 'ux', 'design', '设计', '交互', 'figma', 'sketch', 'adobe xd', '原型', 'prototype', '用户研究', '可用性', 'accessibility', '无障碍'], minMatch: 1, weight: 0.70 },
  { category: '产品设计', subCategory: '设计资源', keywords: ['icon', '字体', 'font', 'color palette', '配色', '模板', 'template', 'mockup', 'dribbble', 'behance', '素材', 'resource', 'design resource'], minMatch: 1, weight: 0.65 },

  // 资讯动态
  { category: '资讯动态', subCategory: '科技新闻', keywords: ['news', '报道', '新闻', '资讯', 'infoq', '36kr', 'hacker news', 'techcrunch', 'the verge', 'solidot', 'solidot', 'ithome', '快讯', 'breaking'], minMatch: 1, weight: 0.65 },

  // 商业财经
  { category: '商业财经', subCategory: '创业融资', keywords: ['startup', '融资', 'investment', '投资', 'seed', 'a轮', 'b轮', 'crunchbase', 'pitch', '创业', 'incubator', '加速器', 'acelerator', 'vc', 'venture'], minMatch: 1, weight: 0.70 },
  { category: '商业财经', subCategory: '投资理财', keywords: ['stock', '基金', 'invest', '投资', '理财', 'market', '股市', 'bloomberg', 'reuters', 'xueqiu', '雪球', 'eastmoney', '东方财富', 'coin', 'token', 'btc', 'eth', 'crypto', '加密货币'], minMatch: 1, weight: 0.70 },

  // 医疗健康
  { category: '医疗健康', subCategory: '健康科普', keywords: ['health', '健康', 'medical', '医疗', '疾病', 'disease', 'symptom', '症状', '治疗', 'treatment', '药品', 'drug', 'medicine', 'med', '体检', 'checkup', '健身', 'fitness'], minMatch: 1, weight: 0.65 },

  // 生活消费
  { category: '生活消费', subCategory: '购物比价', keywords: ['buy', 'shop', 'price', 'deal', '折扣', '优惠', 'coupon', 'taobao', 'jd', 'amazon', 'pinduoduo', 'shopify', 'ecommerce', 'shopping', '购物', '商城', 'marketplace'], minMatch: 1, weight: 0.75 },
  { category: '生活消费', subCategory: '旅行出行', keywords: ['travel', 'trip', 'booking', 'airbnb', 'ctrip', '携程', 'hotel', '酒店', 'flight', '机票', '攻略', 'itinerary', '旅行', '出行', 'tourism', '旅游'], minMatch: 1, weight: 0.70 },
  { category: '生活消费', subCategory: '美食生活', keywords: ['recipe', '美食', 'food', 'cooking', 'cook', '餐厅', 'restaurant', 'dianping', '大众点评', 'meituan', '外卖', 'delivery', '菜谱', 'diet', '饮食'], minMatch: 1, weight: 0.68 },

  // 娱乐媒体
  { category: '娱乐媒体', subCategory: '视频音乐', keywords: ['youtube', 'bilibili', 'netflix', 'spotify', 'video', 'music', '直播', 'stream', 'twitch', 'vimeo', '电影', 'movie', 'series', '电视剧', '动画', 'anime', '追番', '番剧'], minMatch: 1, weight: 0.75 },
  { category: '娱乐媒体', subCategory: '游戏动漫', keywords: ['game', 'gaming', 'steam', 'playstation', 'xbox', 'nintendo', '游戏', '手游', '电竞', 'esports', 'gacha', '抽卡', '角色扮演', 'rpg', '策略', 'fps'], minMatch: 1, weight: 0.72 },
  { category: '娱乐媒体', subCategory: '阅读播客', keywords: ['book', 'reading', '阅读', '小说', 'novel', 'podcast', '播客', '文学', 'literature', 'read', 'reader', 'kindle', 'epub', 'mobi', 'audiobook', '听书'], minMatch: 1, weight: 0.68 },

  // 工作资料
  { category: '工作资料', subCategory: '招聘职业', keywords: ['job', 'career', '招聘', 'hiring', 'recruit', 'linkedin', 'boss直聘', 'zhaopin', '智联', 'lagou', '猎头', '简历', 'resume', 'interview', '面试', 'offer', '内推', '职位'], minMatch: 1, weight: 0.75 },
]

/**
 * 增强规则匹配结果
 */
export interface RuleResult {
  folderPath: [string, string]
  confidence: number
  evidence: RuleMatchEvidence[]
  source: 'keyword-group' | 'url-structure' | 'content-type'
}

/**
 * 构建匹配文本
 */
function buildMatchText(input: Pick<ExtractedContent, 'title' | 'url' | 'description' | 'mainContent'>): Record<string, string> {
  return {
    title: input.title ?? '',
    url: input.url ?? '',
    description: input.description ?? '',
    content: (input.mainContent ?? '').slice(0, 800),
  }
}

/**
 * 关键词组规则匹配
 */
function matchKeywordGroups(texts: Record<string, string>): RuleResult[] {
  const results: RuleResult[] = []

  for (const group of DOMAIN_KEYWORDS) {
    const matchedKeywords: string[] = []
    const matchedOriginal: string[] = []

    // 构建要搜索的文本
    const searchText = [
      texts.title.toLowerCase(),
      texts.url.toLowerCase(),
      texts.description.toLowerCase(),
      texts.content.toLowerCase(),
    ].join(' ')

    for (const keyword of group.keywords) {
      // 处理多词关键词
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i')
      if (regex.test(searchText)) {
        matchedKeywords.push(keyword)
        // 找到原文上下文
        for (const [field, value] of Object.entries(texts)) {
          const lower = value.toLowerCase()
          const idx = lower.indexOf(keyword.toLowerCase())
          if (idx >= 0) {
            const start = Math.max(0, idx - 10)
            const end = Math.min(value.length, idx + keyword.length + 10)
            matchedOriginal.push(`${field}:${value.slice(start, end)}`)
            break
          }
        }
      }
    }

    if (matchedKeywords.length >= group.minMatch) {
      const confidenceDelta = Math.min(group.weight * (0.6 + 0.4 * matchedKeywords.length / group.keywords.length), group.weight)
      results.push({
        folderPath: [group.category, group.subCategory],
        confidence: confidenceDelta,
        evidence: [{
          ruleName: `keyword-${group.category}/${group.subCategory}`,
          weight: confidenceDelta,
          matchedOn: matchedKeywords,
          snippet: matchedOriginal.slice(0, 3).join(' | '),
        }],
        source: 'keyword-group',
      })
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}

/**
 * URL 结构规则匹配
 */
function matchURLStructure(url: string, features: PathFeatures): RuleResult[] {
  const results: RuleResult[] = []
  const urlLower = url.toLowerCase()

  // Proxy/VPN: 匹配 URL 中的代理关键词
  if (/\b(vpn|proxy|clash|v2ray|shadowsocks)\b/i.test(urlLower)) {
    results.push({
      folderPath: ['效率工具', '网络代理'],
      confidence: 0.85,
      evidence: [{ ruleName: 'url-proxy-keyword', weight: 0.85, matchedOn: [url], snippet: url }],
      source: 'url-structure',
    })
  }

  // Web3/Blockchain
  if (/\b(ethereum|solana|blockchain|web3|defi|nft|airdrop|faucet|colosseum|phantom|metamask)\b/i.test(urlLower)) {
    results.push({
      folderPath: ['技术开发', 'Web3与区块链'],
      confidence: 0.80,
      evidence: [{ ruleName: 'url-web3-keyword', weight: 0.80, matchedOn: [url], snippet: url }],
      source: 'url-structure',
    })
  }

  // GitHub topics page
  if (features.isGitHubTopics) {
    results.push({
      folderPath: ['技术开发', '开源项目'],
      confidence: 0.75,
      evidence: [{ ruleName: 'url-github-topics', weight: 0.75, matchedOn: ['GitHub Topics'], snippet: url }],
      source: 'url-structure',
    })
  }

  // Documentation subdomain
  if (features.isDocumentation) {
    results.push({
      folderPath: ['学习研究', '技术教程'],
      confidence: 0.65,
      evidence: [{ ruleName: 'url-doc-path', weight: 0.65, matchedOn: ['文档路径'], snippet: url }],
      source: 'url-structure',
    })
  }

  // YouTube/Bilibili
  if (features.isVideo || /\b(youtube|bilibili)\b/.test(urlLower)) {
    results.push({
      folderPath: ['娱乐媒体', '视频音乐'],
      confidence: 0.80,
      evidence: [{ ruleName: 'url-video-domain', weight: 0.80, matchedOn: ['视频站点'], snippet: url }],
      source: 'url-structure',
    })
  }

  return results
}

/**
 * 内容类型匹配
 */
function matchContentType(title: string, description: string, url: string): RuleResult[] {
  const { type, confidence: typeConf } = detectContentType(title, description, url)
  const suggested = getContentTypeCategory(type)
  if (suggested && typeConf >= 0.7) {
    return [{
      folderPath: [suggested.category, suggested.subCategory],
      confidence: typeConf * 0.8, // 类型判断本身置信度打折
      evidence: [{ ruleName: `content-type-${type}`, weight: typeConf, matchedOn: [type], snippet: title }],
      source: 'content-type',
    }]
  }
  return []
}

function getContentTypeCategory(type: string): { category: string; subCategory: string } | null {
  const map: Record<string, [string, string]> = {
    'academic-paper': ['学习研究', '学术论文'],
    'tutorial': ['学习研究', '技术教程'],
    'blog-post': ['学习研究', '技术教程'],
    'news-article': ['资讯动态', '科技新闻'],
    'video': ['娱乐媒体', '视频音乐'],
    'community-post': ['资讯动态', '社区讨论'],
    'pricing-page': ['资讯动态', '公司产品'],
    'ecommerce': ['生活消费', '购物比价'],
    'social-media': ['资讯动态', '社区讨论'],
    'github-repo': ['技术开发', '开源项目'],
    'product-docs': ['学习研究', '技术教程'],
  }
  const mapped = map[type]
  return mapped ? { category: mapped[0], subCategory: mapped[1] } : null
}

/**
 * 主规则匹配接口
 * 返回所有可能的规则匹配结果（按置信度降序）
 */
export function matchByRules(input: Pick<ExtractedContent, 'title' | 'url' | 'description' | 'mainContent'>): RuleResult[] {
  const texts = buildMatchText(input)
  const features = analyzeURL(input.url)

  const results: RuleResult[] = [
    ...matchKeywordGroups(texts),
    ...matchURLStructure(input.url, features),
    ...matchContentType(input.title, input.description, input.url),
  ]

  // 去重: 相同 folderPath 取最高置信度
  const bestByFolder = new Map<string, RuleResult>()
  for (const result of results) {
    const key = result.folderPath.join('/')
    const existing = bestByFolder.get(key)
    if (!existing || result.confidence > existing.confidence) {
      bestByFolder.set(key, result)
    }
  }

  return Array.from(bestByFolder.values()).sort((a, b) => b.confidence - a.confidence)
}

/**
 * 获取规则匹配的最佳单项结果
 */
export function getBestRuleMatch(input: Pick<ExtractedContent, 'title' | 'url' | 'description' | 'mainContent'>): RuleResult | null {
  const results = matchByRules(input)
  return results[0] ?? null
}
