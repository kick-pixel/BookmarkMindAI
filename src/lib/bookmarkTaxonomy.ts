import type { Bookmark, ExtractedContent } from '../types'

export interface TaxonomyGroup {
  name: string
  icon: string
  children: string[]
}

export const BOOKMARK_TAXONOMY: TaxonomyGroup[] = [
  {
    name: '技术开发',
    icon: '💻',
    children: ['前端开发', '后端服务', 'AI与机器学习', 'Web3与区块链', '数据库与数据工程', 'DevOps与云服务', '编程语言', '移动与客户端', '安全与架构', '测试与质量', '开源项目'],
  },
  {
    name: '产品设计',
    icon: '◇',
    children: ['产品管理', 'UI/UX设计', '设计资源', '用户研究', '增长营销'],
  },
  {
    name: '学习研究',
    icon: '📚',
    children: ['技术教程', '学术论文', '行业报告', '课程资料', '数据集', '个人知识管理'],
  },
  {
    name: '效率工具',
    icon: '⚙',
    children: ['AI工具', '开发工具', '网络代理', '办公协作', '自动化脚本', '浏览器扩展', '设计工具', '数据工具'],
  },
  {
    name: '资讯动态',
    icon: '▣',
    children: ['科技新闻', '行业趋势', '公司产品', '财经商业', '社区讨论'],
  },
  {
    name: '工作资料',
    icon: '▤',
    children: ['文档规范', '项目资料', '后台管理', '业务系统', '招聘职业', '简历作品', '法律财务'],
  },
  {
    name: '商业财经',
    icon: '¥',
    children: ['创业融资', '公司研究', '市场营销', '投资理财', '支付电商'],
  },
  {
    name: '医疗健康',
    icon: '+',
    children: ['医学数据', '健康科普', '医疗AI', '药品器械'],
  },
  {
    name: '生活消费',
    icon: '◒',
    children: ['购物比价', '旅行出行', '健康运动', '美食生活', '宠物生活'],
  },
  {
    name: '娱乐媒体',
    icon: '▶',
    children: ['视频音乐', '游戏动漫', '阅读播客'],
  },
  {
    name: '其他',
    icon: '•',
    children: ['待整理'],
  },
]

const TAXONOMY_BY_NAME = new Map(BOOKMARK_TAXONOMY.map(group => [group.name, group]))

const LOCAL_RULES: Array<{ pattern: RegExp; folderPath: [string, string] }> = [
  { pattern: /vpn|proxy|protonvpn|proton vpn|wireguard|openvpn|tailscale|zerotier|clash|v2ray|xray|sing-box|surge|shadowrocket|shadowsocks|代理|翻墙|科学上网|网络加速/i, folderPath: ['效率工具', '网络代理'] },
  { pattern: /web3|blockchain|solana|ethereum|bitcoin|crypto|defi|nft|dao|airdrop|faucet|wallet|metamask|phantom|hardhat|foundry|colosseum|devnet|hackathon|智能合约|区块链|加密货币|空投|水龙头|钱包/i, folderPath: ['技术开发', 'Web3与区块链'] },
  { pattern: /react|vue|angular|css|html|frontend|前端|typescript|javascript/i, folderPath: ['技术开发', '前端开发'] },
  { pattern: /node|java|spring|go\b|golang|python|django|api|backend|后端|服务端/i, folderPath: ['技术开发', '后端服务'] },
  { pattern: /ai|llm|openai|deepseek|模型|机器学习|agent|prompt/i, folderPath: ['技术开发', 'AI与机器学习'] },
  { pattern: /postgres|mysql|redis|clickhouse|database|数据库|sql|db/i, folderPath: ['技术开发', '数据库与数据工程'] },
  { pattern: /milvus|dataset|数据集|modelscope|huggingface|tianchi|kaggle/i, folderPath: ['学习研究', '数据集'] },
  { pattern: /docker|kubernetes|k8s|devops|云|部署|ci\/cd|github actions/i, folderPath: ['技术开发', 'DevOps与云服务'] },
  { pattern: /android|ios|flutter|react native|移动端|客户端|harmonyos/i, folderPath: ['技术开发', '移动与客户端'] },
  { pattern: /security|auth|安全|架构|architecture/i, folderPath: ['技术开发', '安全与架构'] },
  { pattern: /test|testing|测试|playwright|cypress|selenium|junit/i, folderPath: ['技术开发', '测试与质量'] },
  { pattern: /github|open source|开源/i, folderPath: ['技术开发', '开源项目'] },
  { pattern: /figma|ui|ux|design|设计|交互/i, folderPath: ['产品设计', 'UI/UX设计'] },
  { pattern: /product|prd|roadmap|产品|需求/i, folderPath: ['产品设计', '产品管理'] },
  { pattern: /course|教程|学习|lesson|guide|文档|docs/i, folderPath: ['学习研究', '技术教程'] },
  { pattern: /paper|论文|research|arxiv|学术/i, folderPath: ['学习研究', '学术论文'] },
  { pattern: /tool|工具|extension|插件|效率|automation|自动化/i, folderPath: ['效率工具', '开发工具'] },
  { pattern: /ruoyi|blade|nacos|后台|admin|管理系统|控制台|console/i, folderPath: ['工作资料', '后台管理'] },
  { pattern: /news|资讯|新闻|日报|周刊|动态/i, folderPath: ['资讯动态', '科技新闻'] },
  { pattern: /招聘|职业|面试|resume|job|career/i, folderPath: ['工作资料', '招聘职业'] },
  { pattern: /简历|作品集|portfolio/i, folderPath: ['工作资料', '简历作品'] },
  { pattern: /startup|融资|创业|投资|finance|财经|支付|payment|电商/i, folderPath: ['商业财经', '创业融资'] },
  { pattern: /medical|medicine|health|meddialog|cmedqa|医疗|医学|健康/i, folderPath: ['医疗健康', '医学数据'] },
  { pattern: /pet|宠物|猫|狗/i, folderPath: ['生活消费', '宠物生活'] },
  { pattern: /shopping|shop|price|购物|优惠|电商/i, folderPath: ['生活消费', '购物比价'] },
  { pattern: /video|music|game|movie|youtube|bilibili|游戏|视频|音乐/i, folderPath: ['娱乐媒体', '视频音乐'] },
]

export function getTaxonomyPrompt(): string {
  return BOOKMARK_TAXONOMY
    .map(group => `- ${group.name}: ${group.children.join('、')}`)
    .join('\n')
}

export function getAllFolderPaths(): string[][] {
  return BOOKMARK_TAXONOMY.flatMap(group => group.children.map(child => [group.name, child]))
}

export function normalizeFolderPath(folderPath?: string[], fallbackCategory = '其他'): string[] {
  const raw = (folderPath ?? []).map(part => part.trim()).filter(Boolean).slice(0, 2)
  const first = raw[0] || fallbackCategory || '其他'
  const group = TAXONOMY_BY_NAME.get(first)

  if (!group) {
    const fallback = TAXONOMY_BY_NAME.get(fallbackCategory)
    if (fallback) return [fallback.name, fallback.children[0]]
    return ['其他', '待整理']
  }

  const second = raw[1] && group.children.includes(raw[1])
    ? raw[1]
    : group.children[0]
  return [group.name, second]
}

export function folderPathToCategory(folderPath?: string[]): { category: string; subCategory: string } {
  const normalized = normalizeFolderPath(folderPath)
  return {
    category: normalized[0],
    subCategory: normalized[1],
  }
}

export function inferFolderByRules(input: Pick<ExtractedContent, 'title' | 'url' | 'description' | 'mainContent'> | Bookmark): string[] {
  const text = [
    input.title,
    'url' in input ? input.url : '',
    'description' in input ? input.description : '',
    'mainContent' in input ? input.mainContent.slice(0, 500) : '',
    'domain' in input ? input.domain : '',
    'tags' in input ? input.tags.join(' ') : '',
  ].join('\n')

  const matched = LOCAL_RULES.find(rule => rule.pattern.test(text))
  return matched?.folderPath ?? ['其他', '待整理']
}
