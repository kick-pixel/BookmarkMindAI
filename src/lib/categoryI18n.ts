import type { AppLanguage } from '../types'
import type { Locale } from './i18n'
import { resolveLocale } from './i18n'

export interface CategoryI18nEntry {
  en: string
  'zh-CN': string
}

// Internal stable keys -> display names per locale
const CATEGORY_I18N: Record<string, CategoryI18nEntry> = {
  // Top-level categories
  'tech-dev':         { en: 'Tech & Development', 'zh-CN': '技术开发' },
  'product-design':   { en: 'Product & Design',    'zh-CN': '产品设计' },
  'learning':         { en: 'Learning & Research', 'zh-CN': '学习研究' },
  'productivity':     { en: 'Productivity Tools',  'zh-CN': '效率工具' },
  'news':             { en: 'News & Trends',       'zh-CN': '资讯动态' },
  'work':             { en: 'Work Resources',      'zh-CN': '工作资料' },
  'business':         { en: 'Business & Finance',  'zh-CN': '商业财经' },
  'health':           { en: 'Health & Medical',    'zh-CN': '医疗健康' },
  'lifestyle':        { en: 'Life & Consumption',  'zh-CN': '生活消费' },
  'entertainment':    { en: 'Entertainment & Media','zh-CN': '娱乐媒体' },
  'other':            { en: 'Other',               'zh-CN': '其他' },

  // Sub-categories: tech-dev
  'tech-dev/frontend':     { en: 'Frontend',       'zh-CN': '前端开发' },
  'tech-dev/backend':      { en: 'Backend',        'zh-CN': '后端服务' },
  'tech-dev/ai-ml':        { en: 'AI & ML',        'zh-CN': 'AI与机器学习' },
  'tech-dev/web3':         { en: 'Web3 & Blockchain','zh-CN': 'Web3与区块链' },
  'tech-dev/data':         { en: 'Database & Data', 'zh-CN': '数据库与数据工程' },
  'tech-dev/devops':       { en: 'DevOps & Cloud',  'zh-CN': 'DevOps与云服务' },
  'tech-dev/languages':    { en: 'Languages',       'zh-CN': '编程语言' },
  'tech-dev/mobile':       { en: 'Mobile',          'zh-CN': '移动与客户端' },
  'tech-dev/security':     { en: 'Security',        'zh-CN': '安全与架构' },
  'tech-dev/testing':      { en: 'Testing & QA',    'zh-CN': '测试与质量' },
  'tech-dev/open-source':  { en: 'Open Source',     'zh-CN': '开源项目' },

  // Sub-categories: product-design
  'product-design/product-mgmt':  { en: 'Product Mgmt',  'zh-CN': '产品管理' },
  'product-design/ui-ux':         { en: 'UI/UX Design',  'zh-CN': 'UI/UX设计' },
  'product-design/resources':     { en: 'Design Resources','zh-CN': '设计资源' },
  'product-design/user-research': { en: 'User Research', 'zh-CN': '用户研究' },
  'product-design/growth':        { en: 'Growth Marketing','zh-CN': '增长营销' },

  // Sub-categories: learning
  'learning/tutorials':    { en: 'Tutorials',      'zh-CN': '技术教程' },
  'learning/papers':       { en: 'Academic Papers', 'zh-CN': '学术论文' },
  'learning/reports':      { en: 'Industry Reports', 'zh-CN': '行业报告' },
  'learning/courses':      { en: 'Courses',         'zh-CN': '课程资料' },
  'learning/datasets':     { en: 'Datasets',        'zh-CN': '数据集' },
  'learning/pkm':          { en: 'PKM',             'zh-CN': '个人知识管理' },

  // Sub-categories: productivity
  'productivity/ai-tools':    { en: 'AI Tools',       'zh-CN': 'AI工具' },
  'productivity/dev-tools':   { en: 'Dev Tools',      'zh-CN': '开发工具' },
  'productivity/vpn':         { en: 'VPN & Proxy',    'zh-CN': '网络代理' },
  'productivity/office':      { en: 'Office & Collab', 'zh-CN': '办公协作' },
  'productivity/automation':  { en: 'Automation',     'zh-CN': '自动化脚本' },
  'productivity/extensions':  { en: 'Browser Ext.',   'zh-CN': '浏览器扩展' },
  'productivity/design-tool': { en: 'Design Tools',   'zh-CN': '设计工具' },
  'productivity/data-tool':   { en: 'Data Tools',     'zh-CN': '数据工具' },

  // Sub-categories: news
  'news/tech-news':     { en: 'Tech News',    'zh-CN': '科技新闻' },
  'news/trends':        { en: 'Trends',       'zh-CN': '行业趋势' },
  'news/companies':     { en: 'Companies',    'zh-CN': '公司产品' },
  'news/finance':       { en: 'Finance',      'zh-CN': '财经商业' },
  'news/community':     { en: 'Community',    'zh-CN': '社区讨论' },

  // Sub-categories: work
  'work/docs':          { en: 'Docs & Specs',  'zh-CN': '文档规范' },
  'work/projects':      { en: 'Project Files', 'zh-CN': '项目资料' },
  'work/admin':         { en: 'Admin Panels',  'zh-CN': '后台管理' },
  'work/business-sys':  { en: 'Business Sys',  'zh-CN': '业务系统' },
  'work/careers':       { en: 'Careers',       'zh-CN': '招聘职业' },
  'work/portfolio':     { en: 'Portfolio',     'zh-CN': '简历作品' },
  'work/legal':         { en: 'Legal & Finance','zh-CN': '法律财务' },

  // Sub-categories: business
  'business/startup':  { en: 'Startups',       'zh-CN': '创业融资' },
  'business/research': { en: 'Company Research','zh-CN': '公司研究' },
  'business/marketing':{ en: 'Marketing',      'zh-CN': '市场营销' },
  'business/invest':   { en: 'Investing',      'zh-CN': '投资理财' },
  'business/ecommerce':{ en: 'E-commerce',     'zh-CN': '支付电商' },

  // Sub-categories: health
  'health/medical-data': { en: 'Medical Data',   'zh-CN': '医学数据' },
  'health/wellness':     { en: 'Health Info',    'zh-CN': '健康科普' },
  'health/medical-ai':   { en: 'Medical AI',     'zh-CN': '医疗AI' },
  'health/equipment':    { en: 'Equipment',      'zh-CN': '药品器械' },

  // Sub-categories: lifestyle
  'lifestyle/shopping': { en: 'Shopping',    'zh-CN': '购物比价' },
  'lifestyle/travel':   { en: 'Travel',      'zh-CN': '旅行出行' },
  'lifestyle/fitness':  { en: 'Fitness',     'zh-CN': '健康运动' },
  'lifestyle/food':     { en: 'Food & Living','zh-CN': '美食生活' },
  'lifestyle/pets':     { en: 'Pets',        'zh-CN': '宠物生活' },

  // Sub-categories: entertainment
  'entertainment/video':    { en: 'Video & Music',  'zh-CN': '视频音乐' },
  'entertainment/gaming':   { en: 'Gaming & Anime', 'zh-CN': '游戏动漫' },
  'entertainment/reading':  { en: 'Reading & Podcasts','zh-CN': '阅读播客' },

  // Sub-categories: other
  'other/inbox': { en: 'Inbox', 'zh-CN': '待整理' },
}

// Chinese name -> internal key mapping (for backward compatibility with stored data)
const CN_TO_KEY: Record<string, string> = {
  '技术开发': 'tech-dev', '产品设计': 'product-design', '学习研究': 'learning',
  '效率工具': 'productivity', '资讯动态': 'news', '工作资料': 'work',
  '商业财经': 'business', '医疗健康': 'health', '生活消费': 'lifestyle',
  '娱乐媒体': 'entertainment', '其他': 'other',
}

/**
 * Resolve the display name for a category path given the user's locale.
 * The internal category names (stored in bookmarks) remain in Chinese
 * for backward compatibility. This function translates them at render time.
 */
export function displayCategory(
  cnName: string,
  locale: Locale,
): string {
  if (locale === 'en') {
    const key = CN_TO_KEY[cnName]
    if (key && CATEGORY_I18N[key]) return CATEGORY_I18N[key].en
  }
  return cnName
}

/**
 * Get the full display path for a folder path.
 */
export function displayFolderPath(
  folderPath: string[],
  locale: Locale,
): string[] {
  return folderPath.map(part => displayCategory(part, locale))
}

/**
 * Get all root category display names for the given locale.
 */
export function getRootCategoryDisplayNames(locale: Locale): string[] {
  return Object.keys(CN_TO_KEY).map(cn => displayCategory(cn, locale))
}

/**
 * Get the full i18n map for use in settings dropdowns.
 * Returns { value: chineseName, label: displayName } pairs.
 */
export function getRootCategoryOptions(locale: Locale): Array<{ value: string; label: string }> {
  return Object.keys(CN_TO_KEY).map(cn => ({
    value: cn,
    label: displayCategory(cn, locale),
  }))
}

/**
 * Get child category options for a given root category.
 */
export function getChildCategoryOptions(
  rootCnName: string,
  locale: Locale,
): Array<{ value: string; label: string }> {
  const key = CN_TO_KEY[rootCnName]
  if (!key) return []

  const children = getChildKeysForRoot(key)
  return children.map(childKey => {
    const fullKey = `${key}/${childKey}`
    const entry = CATEGORY_I18N[fullKey]
    const cnName = entry ? entry['zh-CN'] : childKey
    const displayName = entry ? entry[locale] : cnName
    return { value: cnName, label: displayName }
  })
}

function getChildKeysForRoot(key: string): string[] {
  const childMap: Record<string, string[]> = {
    'tech-dev': ['frontend', 'backend', 'ai-ml', 'web3', 'data', 'devops', 'languages', 'mobile', 'security', 'testing', 'open-source'],
    'product-design': ['product-mgmt', 'ui-ux', 'resources', 'user-research', 'growth'],
    'learning': ['tutorials', 'papers', 'reports', 'courses', 'datasets', 'pkm'],
    'productivity': ['ai-tools', 'dev-tools', 'vpn', 'office', 'automation', 'extensions', 'design-tool', 'data-tool'],
    'news': ['tech-news', 'trends', 'companies', 'finance', 'community'],
    'work': ['docs', 'projects', 'admin', 'business-sys', 'careers', 'portfolio', 'legal'],
    'business': ['startup', 'research', 'marketing', 'invest', 'ecommerce'],
    'health': ['medical-data', 'wellness', 'medical-ai', 'equipment'],
    'lifestyle': ['shopping', 'travel', 'fitness', 'food', 'pets'],
    'entertainment': ['video', 'gaming', 'reading'],
    'other': ['inbox'],
  }
  return childMap[key] ?? []
}
