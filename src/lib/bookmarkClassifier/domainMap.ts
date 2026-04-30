// ============================================================
// BookmarkMind AI · 域名分类映射表
// 数据来源: Wappalyzer 开源分类数据库 + 社区补充
// 更新方式: 可运行 scripts/generate-domain-map.mjs 重新生成
// ============================================================

/**
 * 域名→分类映射条目
 * 按域名长度降序排列，优先匹配最具体的域名 (sub.domain.com > domain.com)
 */
export interface DomainMapEntry {
  domain: string
  category: string
  subCategory: string
  confidence: number
  /** 路径覆写: 特定路径走不同子分类 */
  pathOverrides?: Array<{
    pattern: string       // 正则字符串 (new RegExp 时转义)
    subCategory: string
    confidence: number
  }>
}

/**
 * 领域→本站分类映射 (供 Wappalyzer 数据转换用)
 */
export const WAPPALYZER_TO_TAXONOMY: Record<string, [string, string, number]> = {
  // 技术开发
  'Developer Tools':      ['技术开发', '开发工具', 0.90],
  'AI / ML':              ['技术开发', 'AI与机器学习', 0.92],
  'Machine Learning':     ['技术开发', 'AI与机器学习', 0.92],
  'Security':             ['技术开发', '安全与架构', 0.88],
  'CMS':                  ['技术开发', '后端服务', 0.75],
  'Databases':            ['技术开发', '数据库与数据工程', 0.90],
  'Programming Languages':['技术开发', '编程语言', 0.92],
  'Mobile':               ['技术开发', '移动与客户端', 0.85],
  'DevOps':               ['技术开发', 'DevOps与云服务', 0.90],
  'Containers':           ['技术开发', 'DevOps与云服务', 0.88],
  'Web Frameworks':       ['技术开发', '前端开发', 0.82],
  'JavaScript Frameworks':['技术开发', '前端开发', 0.85],
  'CSS Frameworks':       ['技术开发', '前端开发', 0.78],
  'UI Frameworks':        ['技术开发', '前端开发', 0.78],
  'Web Servers':          ['技术开发', '后端服务', 0.80],
  'Operating Systems':    ['技术开发', '后端服务', 0.70],
  'Testing':              ['技术开发', '测试与质量', 0.85],

  // AI/ML 细分
  'Chatbots':             ['效率工具', 'AI工具', 0.88],

  // 学习研究
  'Documentation':        ['学习研究', '技术教程', 0.82],
  'Education':            ['学习研究', '课程资料', 0.85],
  'Science':              ['学习研究', '学术论文', 0.80],

  // 娱乐媒体
  'Video':                ['娱乐媒体', '视频音乐', 0.85],
  'Games':                ['娱乐媒体', '游戏动漫', 0.85],
  'Music':                ['娱乐媒体', '视频音乐', 0.80],
  'Media Players':        ['娱乐媒体', '视频音乐', 0.75],

  // 资讯动态
  'News':                 ['资讯动态', '科技新闻', 0.85],
  'Social Networks':      ['资讯动态', '社区讨论', 0.80],
  'Forums':               ['资讯动态', '社区讨论', 0.78],

  // 商业财经
  'Markets':              ['商业财经', '投资理财', 0.80],
  'Finance':              ['商业财经', '投资理财', 0.82],
  'Ecommerce':            ['生活消费', '购物比价', 0.85],
  'Payments':             ['商业财经', '支付电商', 0.80],
  'Advertising':          ['商业财经', '市场营销', 0.70],
  'Job Boards':           ['工作资料', '招聘职业', 0.85],

  // 效率工具
  'Analytics':            ['效率工具', '数据工具', 0.75],
  'Automation':           ['效率工具', '自动化脚本', 0.80],
  'CRM':                  ['效率工具', '办公协作', 0.78],
  'Fonts':                ['产品设计', '设计资源', 0.75],
  'Maps':                 ['生活消费', '旅行出行', 0.65],

  // 其他
  'Health':               ['医疗健康', '健康科普', 0.80],
  'Travel':               ['生活消费', '旅行出行', 0.80],
  'Search Engines':       ['效率工具', '数据工具', 0.60],
  'Email':                ['效率工具', '办公协作', 0.70],
  'Cloud':                ['技术开发', 'DevOps与云服务', 0.78],
}

/**
 * 内置域名映射表 (核心 3000+ 域名的高置信度映射)
 * 按 domain 字母排序
 */
export const DOMAIN_MAP: DomainMapEntry[] = [
  // ========== 技术开发 / 前端开发 ==========
  { domain: 'developer.mozilla.org',     category: '技术开发', subCategory: '前端开发', confidence: 0.95 },
  { domain: 'react.dev',                 category: '技术开发', subCategory: '前端开发', confidence: 0.93 },
  { domain: 'vuejs.org',                 category: '技术开发', subCategory: '前端开发', confidence: 0.93 },
  { domain: 'angular.io',                category: '技术开发', subCategory: '前端开发', confidence: 0.93 },
  { domain: 'nextjs.org',                category: '技术开发', subCategory: '前端开发', confidence: 0.92 },
  { domain: 'nuxtjs.org',                category: '技术开发', subCategory: '前端开发', confidence: 0.90 },
  { domain: 'svelte.dev',                category: '技术开发', subCategory: '前端开发', confidence: 0.90 },
  { domain: 'tailwindcss.com',           category: '技术开发', subCategory: '前端开发', confidence: 0.90 },
  { domain: 'css-tricks.com',            category: '技术开发', subCategory: '前端开发', confidence: 0.88 },
  { domain: 'web.dev',                   category: '技术开发', subCategory: '前端开发', confidence: 0.85 },
  { domain: 'typescriptlang.org',        category: '技术开发', subCategory: '前端开发', confidence: 0.90 },
  { domain: 'babeljs.io',                category: '技术开发', subCategory: '前端开发', confidence: 0.85 },
  { domain: 'webpack.js.org',            category: '技术开发', subCategory: '前端开发', confidence: 0.85 },
  { domain: 'vite.dev',                  category: '技术开发', subCategory: '前端开发', confidence: 0.88 },
  { domain: 'esbuild.github.io',         category: '技术开发', subCategory: '前端开发', confidence: 0.82 },
  { domain: 'storybook.js.org',          category: '技术开发', subCategory: '前端开发', confidence: 0.85 },
  { domain: 'jestjs.io',                 category: '技术开发', subCategory: '前端开发', confidence: 0.80 },
  { domain: 'vitest.dev',                category: '技术开发', subCategory: '前端开发', confidence: 0.82 },
  { domain: 'playwright.dev',            category: '技术开发', subCategory: '前端开发', confidence: 0.82 },
  { domain: 'astro.build',               category: '技术开发', subCategory: '前端开发', confidence: 0.85 },
  { domain: 'qwik.dev',                  category: '技术开发', subCategory: '前端开发', confidence: 0.82 },
  { domain: 'solidjs.com',               category: '技术开发', subCategory: '前端开发', confidence: 0.82 },

  // ========== 技术开发 / 后端服务 ==========
  { domain: 'nodejs.org',                category: '技术开发', subCategory: '后端服务', confidence: 0.92 },
  { domain: 'deno.com',                  category: '技术开发', subCategory: '后端服务', confidence: 0.85 },
  { domain: 'spring.io',                 category: '技术开发', subCategory: '后端服务', confidence: 0.90 },
  { domain: 'fastapi.tiangolo.com',      category: '技术开发', subCategory: '后端服务', confidence: 0.85 },
  { domain: 'djangoproject.com',         category: '技术开发', subCategory: '后端服务', confidence: 0.88 },
  { domain: 'flask.palletsprojects.com', category: '技术开发', subCategory: '后端服务', confidence: 0.85 },
  { domain: 'expressjs.com',             category: '技术开发', subCategory: '后端服务', confidence: 0.85 },
  { domain: 'golang.org',                category: '技术开发', subCategory: '后端服务', confidence: 0.88 },
  { domain: 'go.dev',                    category: '技术开发', subCategory: '后端服务', confidence: 0.88 },
  { domain: 'rust-lang.org',             category: '技术开发', subCategory: '后端服务', confidence: 0.85 },
  { domain: 'redis.io',                  category: '技术开发', subCategory: '后端服务', confidence: 0.90 },
  { domain: 'nginx.com',                 category: '技术开发', subCategory: '后端服务', confidence: 0.82 },
  { domain: 'haproxy.org',               category: '技术开发', subCategory: '后端服务', confidence: 0.78 },
  { domain: 'graphql.org',               category: '技术开发', subCategory: '后端服务', confidence: 0.82 },
  { domain: 'grpc.io',                   category: '技术开发', subCategory: '后端服务', confidence: 0.80 },

  // ========== 技术开发 / AI与机器学习 ==========
  { domain: 'huggingface.co',            category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.95 },
  { domain: 'openai.com',                category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.92 },
  { domain: 'deepseek.com',              category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.92 },
  { domain: 'anthropic.com',             category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.90 },
  { domain: 'pytorch.org',               category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.92 },
  { domain: 'tensorflow.org',            category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.92 },
  { domain: 'jax.readthedocs.io',        category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.82 },
  { domain: 'keras.io',                  category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.85 },
  { domain: 'mlflow.org',                category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.80 },
  { domain: 'wandb.ai',                  category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.82 },
  { domain: 'langchain.com',             category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.88 },
  { domain: 'langchain-ai.github.io',    category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.85 },
  { domain: 'llamaindex.ai',             category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.85 },
  { domain: 'cohere.com',                category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.82 },
  { domain: 'mistral.ai',                category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.85 },
  { domain: 'stability.ai',              category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.82 },
  { domain: 'replicate.com',             category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.82 },
  { domain: 'modelscope.cn',             category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.82 },
  { domain: 'paperswithcode.com',        category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.88 },
  { domain: 'kaggle.com',                category: '技术开发', subCategory: 'AI与机器学习', confidence: 0.85 },
  { domain: 'github.com',                category: '技术开发', subCategory: '开源项目', confidence: 0.95,
    pathOverrides: [
      { pattern: '^/topics/',             subCategory: 'AI与机器学习', confidence: 0.80 },
      { pattern: '^/features/',           subCategory: '开发工具', confidence: 0.85 },
    ]
  },

  // ========== 技术开发 / 数据库与数据工程 ==========
  { domain: 'postgresql.org',            category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.92 },
  { domain: 'mysql.com',                 category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.90 },
  { domain: 'mongodb.com',               category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.90 },
  { domain: 'sqlite.org',                category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.88 },
  { domain: 'clickhouse.com',            category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.90 },
  { domain: 'druid.apache.org',          category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.82 },
  { domain: 'cassandra.apache.org',      category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.82 },
  { domain: 'neo4j.com',                 category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.82 },
  { domain: 'prisma.io',                 category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.82 },
  { domain: 'dbeaver.com',               category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.80 },
  { domain: 'datadoghq.com',             category: '技术开发', subCategory: '数据库与数据工程', confidence: 0.78 },

  // ========== 技术开发 / DevOps与云服务 ==========
  { domain: 'docker.com',                category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.92 },
  { domain: 'kubernetes.io',             category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.92 },
  { domain: 'helm.sh',                   category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.85 },
  { domain: 'istio.io',                  category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.82 },
  { domain: 'terraform.io',              category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.85 },
  { domain: 'ansible.com',               category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.85 },
  { domain: 'jenkins.io',                category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.82 },
  { domain: 'gitlab.com',                category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.85 },
  { domain: 'gitlab.cn',                 category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.85 },
  { domain: 'github.com',                category: '技术开发', subCategory: '开源项目', confidence: 0.95,
    pathOverrides: [
      { pattern: '^/marketplace',         subCategory: 'DevOps与云服务', confidence: 0.80 },
    ]
  },
  { domain: 'aws.amazon.com',            category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.90 },
  { domain: 'cloud.google.com',          category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.90 },
  { domain: 'azure.microsoft.com',       category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.88 },
  { domain: 'alibabacloud.com',          category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.85 },
  { domain: 'console.aws.amazon.com',    category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.90 },
  { domain: 'github.blog',               category: '学习研究', subCategory: '技术教程', confidence: 0.82 },

  // ========== 技术开发 / Web3与区块链 ==========
  { domain: 'ethereum.org',              category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.92 },
  { domain: 'solana.com',                category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.90 },
  { domain: 'colosseum.org',             category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.94 },
  { domain: 'arena.colosseum.org',       category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.96 },
  { domain: 'chain.link',                category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.82 },
  { domain: 'openzeppelin.com',          category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.85 },
  { domain: 'hardhat.org',               category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.85 },
  { domain: 'alchemy.com',               category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.80 },
  { domain: 'metamask.io',               category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.90 },
  { domain: 'phantom.app',               category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.90 },
  { domain: 'magiceden.io',              category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.86 },
  { domain: 'opensea.io',                category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.84 },
  { domain: 'raydium.io',                category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.86 },
  { domain: 'jup.ag',                    category: '技术开发', subCategory: 'Web3与区块链', confidence: 0.86 },

  // ========== 学习研究 / 技术教程 ==========
  { domain: 'stackoverflow.com',         category: '学习研究', subCategory: '技术教程', confidence: 0.95 },
  { domain: 'medium.com',                category: '学习研究', subCategory: '技术教程', confidence: 0.75 },
  { domain: 'dev.to',                    category: '学习研究', subCategory: '技术教程', confidence: 0.82 },
  { domain: 'freecodecamp.org',          category: '学习研究', subCategory: '技术教程', confidence: 0.85 },
  { domain: 'geeksforgeeks.org',         category: '学习研究', subCategory: '技术教程', confidence: 0.82 },
  { domain: 'w3schools.com',             category: '学习研究', subCategory: '技术教程', confidence: 0.82 },
  { domain: 'tutorialspoint.com',        category: '学习研究', subCategory: '技术教程', confidence: 0.78 },
  { domain: 'roadmap.sh',                category: '学习研究', subCategory: '技术教程', confidence: 0.82 },
  { domain: 'learngitbranching.js.org',  category: '学习研究', subCategory: '技术教程', confidence: 0.78 },
  { domain: 'leetcode.com',              category: '学习研究', subCategory: '技术教程', confidence: 0.90 },

  // ========== 学习研究 / 学术论文 ==========
  { domain: 'arxiv.org',                 category: '学习研究', subCategory: '学术论文', confidence: 0.92 },
  { domain: 'scholar.google.com',        category: '学习研究', subCategory: '学术论文', confidence: 0.90 },
  { domain: 'semanticscholar.org',       category: '学习研究', subCategory: '学术论文', confidence: 0.85 },
  { domain: 'dblp.org',                  category: '学习研究', subCategory: '学术论文', confidence: 0.82 },
  { domain: 'acm.org',                   category: '学习研究', subCategory: '学术论文', confidence: 0.82 },
  { domain: 'ieee.org',                  category: '学习研究', subCategory: '学术论文', confidence: 0.82 },
  { domain: 'cnki.net',                  category: '学习研究', subCategory: '学术论文', confidence: 0.80 },

  // ========== 学习研究 / 课程资料 ==========
  { domain: 'coursera.org',              category: '学习研究', subCategory: '课程资料', confidence: 0.90 },
  { domain: 'udemy.com',                 category: '学习研究', subCategory: '课程资料', confidence: 0.88 },
  { domain: 'edx.org',                   category: '学习研究', subCategory: '课程资料', confidence: 0.85 },
  { domain: 'udacity.com',               category: '学习研究', subCategory: '课程资料', confidence: 0.82 },
  { domain: 'mit.edu',                   category: '学习研究', subCategory: '课程资料', confidence: 0.80 },
  { domain: 'ieeexplore.ieee.org',       category: '学习研究', subCategory: '学术论文', confidence: 0.85 },
  { domain: 'xuetangx.com',              category: '学习研究', subCategory: '课程资料', confidence: 0.78 },
  { domain: 'lab.magiconch.com',         category: '学习研究', subCategory: '课程资料', confidence: 0.65 },

  // ========== 效率工具 / 开发工具 ==========
  { domain: 'npmjs.com',                 category: '效率工具', subCategory: '开发工具', confidence: 0.90 },
  { domain: 'npmtrends.com',             category: '效率工具', subCategory: '开发工具', confidence: 0.80 },
  { domain: 'cdnjs.com',                 category: '效率工具', subCategory: '开发工具', confidence: 0.78 },
  { domain: 'unpkg.com',                 category: '效率工具', subCategory: '开发工具', confidence: 0.78 },
  { domain: 'jsdelivr.com',              category: '效率工具', subCategory: '开发工具', confidence: 0.78 },
  { domain: 'eslint.org',                category: '效率工具', subCategory: '开发工具', confidence: 0.80 },
  { domain: 'prettier.io',               category: '效率工具', subCategory: '开发工具', confidence: 0.80 },
  { domain: 'code.visualstudio.com',     category: '效率工具', subCategory: '开发工具', confidence: 0.88 },
  { domain: 'marketplace.visualstudio.com', category: '效率工具', subCategory: '开发工具', confidence: 0.85 },
  { domain: 'stackblitz.com',            category: '效率工具', subCategory: '开发工具', confidence: 0.80 },
  { domain: 'codesandbox.io',            category: '效率工具', subCategory: '开发工具', confidence: 0.80 },
  { domain: 'codepen.io',                category: '效率工具', subCategory: '开发工具', confidence: 0.78 },
  { domain: 'replit.com',                category: '效率工具', subCategory: '开发工具', confidence: 0.80 },
  { domain: 'postman.com',               category: '效率工具', subCategory: '开发工具', confidence: 0.85 },
  { domain: 'tech-stack.com',            category: '效率工具', subCategory: '开发工具', confidence: 0.70 },
  { domain: 'sentry.io',                 category: '效率工具', subCategory: '开发工具', confidence: 0.82 },

  // ========== 效率工具 / AI工具 ==========
  { domain: 'chat.openai.com',           category: '效率工具', subCategory: 'AI工具', confidence: 0.93 },
  { domain: 'chat.deepseek.com',         category: '效率工具', subCategory: 'AI工具', confidence: 0.92 },
  { domain: 'claude.ai',                 category: '效率工具', subCategory: 'AI工具', confidence: 0.92 },
  { domain: 'perplexity.ai',             category: '效率工具', subCategory: 'AI工具', confidence: 0.88 },
  { domain: 'notion.ai',                 category: '效率工具', subCategory: 'AI工具', confidence: 0.75 },
  { domain: 'copilot.microsoft.com',     category: '效率工具', subCategory: 'AI工具', confidence: 0.85 },
  { domain: 'gemini.google.com',         category: '效率工具', subCategory: 'AI工具', confidence: 0.85 },
  { domain: 'kimi.moonshot.cn',          category: '效率工具', subCategory: 'AI工具', confidence: 0.88 },
  { domain: 'tongyi.aliyun.com',         category: '效率工具', subCategory: 'AI工具', confidence: 0.82 },
  { domain: 'yiyan.baidu.com',           category: '效率工具', subCategory: 'AI工具', confidence: 0.80 },
  { domain: 'doubao.com',                category: '效率工具', subCategory: 'AI工具', confidence: 0.82 },
  { domain: 'metaso.cn',                 category: '效率工具', subCategory: 'AI工具', confidence: 0.82 },
  { domain: 'midjourney.com',            category: '效率工具', subCategory: 'AI工具', confidence: 0.85 },
  { domain: 'civitai.com',               category: '效率工具', subCategory: 'AI工具', confidence: 0.80 },
  { domain: 'character.ai',              category: '效率工具', subCategory: 'AI工具', confidence: 0.78 },
  { domain: 'memo.ai',                   category: '效率工具', subCategory: 'AI工具', confidence: 0.75 },
  { domain: 'notion.site',               category: '效率工具', subCategory: '办公协作', confidence: 0.82 },

  // ========== 效率工具 / 网络代理 ==========
  { domain: 'protonvpn.com',             category: '效率工具', subCategory: '网络代理', confidence: 0.95 },
  { domain: 'nordvpn.com',               category: '效率工具', subCategory: '网络代理', confidence: 0.92 },
  { domain: 'tailscale.com',             category: '效率工具', subCategory: '网络代理', confidence: 0.90 },
  { domain: 'wireguard.com',             category: '效率工具', subCategory: '网络代理', confidence: 0.88 },
  { domain: 'openvpn.net',               category: '效率工具', subCategory: '网络代理', confidence: 0.88 },
  { domain: 'surge.sh',                  category: '效率工具', subCategory: '网络代理', confidence: 0.75 },
  { domain: 'zerotier.com',              category: '效率工具', subCategory: '网络代理', confidence: 0.82 },
  { domain: 'v2ex.com',                  category: '资讯动态', subCategory: '社区讨论', confidence: 0.82 },
  { domain: 'cloudflare.com',            category: '技术开发', subCategory: 'DevOps与云服务', confidence: 0.85 },
  { domain: '1.1.1.1',                   category: '效率工具', subCategory: '网络代理', confidence: 0.82 },

  // ========== 效率工具 / 办公协作 ==========
  { domain: 'notion.so',                 category: '效率工具', subCategory: '办公协作', confidence: 0.92 },
  { domain: 'miro.com',                  category: '效率工具', subCategory: '办公协作', confidence: 0.85 },
  { domain: 'linear.app',                category: '效率工具', subCategory: '办公协作', confidence: 0.85 },
  { domain: 'asana.com',                 category: '效率工具', subCategory: '办公协作', confidence: 0.80 },
  { domain: 'trello.com',                category: '效率工具', subCategory: '办公协作', confidence: 0.82 },
  { domain: 'jira.com',                  category: '效率工具', subCategory: '办公协作', confidence: 0.82 },
  { domain: 'atlassian.com',             category: '效率工具', subCategory: '办公协作', confidence: 0.80 },
  { domain: 'slack.com',                 category: '效率工具', subCategory: '办公协作', confidence: 0.85 },
  { domain: 'teams.microsoft.com',       category: '效率工具', subCategory: '办公协作', confidence: 0.82 },
  { domain: 'zoom.us',                   category: '效率工具', subCategory: '办公协作', confidence: 0.80 },
  { domain: 'google.com',                category: '效率工具', subCategory: '办公协作', confidence: 0.55,
    pathOverrides: [
      { pattern: '^/docs/',               subCategory: '办公协作', confidence: 0.90 },
      { pattern: '^/sheets/',             subCategory: '办公协作', confidence: 0.88 },
      { pattern: '^/slides/',             subCategory: '办公协作', confidence: 0.88 },
      { pattern: '^/drive/',              subCategory: '办公协作', confidence: 0.88 },
      { pattern: '^/calendar/',           subCategory: '办公协作', confidence: 0.85 },
      { pattern: '^/gmail/',              subCategory: '办公协作', confidence: 0.85 },
      { pattern: '^/meet/',               subCategory: '办公协作', confidence: 0.85 },
      { pattern: '^/maps/',               subCategory: '旅行出行', confidence: 0.80 },
    ]
  },

  // ========== 产品设计 ==========
  { domain: 'figma.com',                 category: '产品设计', subCategory: 'UI/UX设计', confidence: 0.92 },
  { domain: 'sketch.com',                category: '产品设计', subCategory: 'UI/UX设计', confidence: 0.85 },
  { domain: 'dribbble.com',              category: '产品设计', subCategory: '设计资源', confidence: 0.85 },
  { domain: 'behance.net',               category: '产品设计', subCategory: '设计资源', confidence: 0.82 },
  { domain: 'awwwards.com',              category: '产品设计', subCategory: '设计资源', confidence: 0.78 },
  { domain: 'material.io',               category: '产品设计', subCategory: '设计资源', confidence: 0.82 },
  { domain: 'icons8.com',                category: '产品设计', subCategory: '设计资源', confidence: 0.75 },
  { domain: 'fontawesome.com',           category: '产品设计', subCategory: '设计资源', confidence: 0.78 },
  { domain: 'googlefonts.com',           category: '产品设计', subCategory: '设计资源', confidence: 0.78 },
  { domain: 'fontshare.com',             category: '产品设计', subCategory: '设计资源', confidence: 0.70 },
  { domain: 'lottiefiles.com',           category: '产品设计', subCategory: '设计资源', confidence: 0.75 },
  { domain: 'coolors.co',                category: '产品设计', subCategory: '设计资源', confidence: 0.72 },
  { domain: 'colorhunt.co',              category: '产品设计', subCategory: '设计资源', confidence: 0.70 },

  // ========== 资讯动态 ==========
  { domain: 'infoq.com',                 category: '资讯动态', subCategory: '科技新闻', confidence: 0.85 },
  { domain: 'news.qq.com',               category: '资讯动态', subCategory: '科技新闻', confidence: 0.95 },
  { domain: '36kr.com',                  category: '资讯动态', subCategory: '科技新闻', confidence: 0.85 },
  { domain: 'huxiu.com',                 category: '资讯动态', subCategory: '科技新闻', confidence: 0.82 },
  { domain: 'juejin.cn',                 category: '学习研究', subCategory: '技术教程', confidence: 0.82 },
  { domain: 'zhihu.com',                 category: '学习研究', subCategory: '技术教程', confidence: 0.70 },
  { domain: 'reddit.com',                category: '资讯动态', subCategory: '社区讨论', confidence: 0.82 },
  { domain: 'news.ycombinator.com',      category: '资讯动态', subCategory: '科技新闻', confidence: 0.88 },
  { domain: 'hackernews.com',            category: '资讯动态', subCategory: '科技新闻', confidence: 0.85 },
  { domain: 'solidot.org',               category: '资讯动态', subCategory: '科技新闻', confidence: 0.78 },
  { domain: 'ithome.com',                category: '资讯动态', subCategory: '科技新闻', confidence: 0.82 },
  { domain: 'oschina.net',               category: '资讯动态', subCategory: '科技新闻', confidence: 0.78 },
  { domain: 'segmentfault.com',          category: '学习研究', subCategory: '技术教程', confidence: 0.80 },
  { domain: 'csdn.net',                  category: '学习研究', subCategory: '技术教程', confidence: 0.65 },

  // ========== 娱乐媒体 ==========
  { domain: 'youtube.com',               category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.88 },
  { domain: 'bilibili.com',              category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.88 },
  { domain: 'netflix.com',               category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.85 },
  { domain: 'spotify.com',               category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.85 },
  { domain: 'twitch.tv',                 category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.82 },
  { domain: 'vimeo.com',                 category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.80 },
  { domain: 'iqiyi.com',                 category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.82 },
  { domain: 'youku.com',                 category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.80 },
  { domain: 'douyin.com',                category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.80 },
  { domain: 'xiaohongshu.com',           category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.65 },
  { domain: 'steampowered.com',          category: '娱乐媒体', subCategory: '游戏动漫', confidence: 0.88 },
  { domain: 'steamcommunity.com',        category: '娱乐媒体', subCategory: '游戏动漫', confidence: 0.85 },

  // ========== 生活消费 ==========
  { domain: 'taobao.com',                category: '生活消费', subCategory: '购物比价', confidence: 0.90 },
  { domain: 'jd.com',                    category: '生活消费', subCategory: '购物比价', confidence: 0.90 },
  { domain: 'pinduoduo.com',             category: '生活消费', subCategory: '购物比价', confidence: 0.85 },
  { domain: 'amazon.com',                category: '生活消费', subCategory: '购物比价', confidence: 0.88 },
  { domain: 'amazon.co.jp',              category: '生活消费', subCategory: '购物比价', confidence: 0.85 },
  { domain: 'ebay.com',                  category: '生活消费', subCategory: '购物比价', confidence: 0.82 },
  { domain: 'etsy.com',                  category: '生活消费', subCategory: '购物比价', confidence: 0.80 },
  { domain: 'dianping.com',              category: '生活消费', subCategory: '美食生活', confidence: 0.82 },
  { domain: 'meituan.com',               category: '生活消费', subCategory: '美食生活', confidence: 0.80 },
  { domain: 'ctrip.com',                 category: '生活消费', subCategory: '旅行出行', confidence: 0.85 },
  { domain: 'airbnb.com',                category: '生活消费', subCategory: '旅行出行', confidence: 0.85 },
  { domain: 'booking.com',               category: '生活消费', subCategory: '旅行出行', confidence: 0.82 },
  { domain: 'tripadvisor.com',           category: '生活消费', subCategory: '旅行出行', confidence: 0.80 },
  { domain: 'maps.google.com',           category: '生活消费', subCategory: '旅行出行', confidence: 0.80 },

  // ========== 商业财经 ==========
  { domain: 'bloomberg.com',             category: '商业财经', subCategory: '投资理财', confidence: 0.85 },
  { domain: 'reuters.com',               category: '商业财经', subCategory: '投资理财', confidence: 0.82 },
  { domain: 'wsj.com',                   category: '商业财经', subCategory: '投资理财', confidence: 0.82 },
  { domain: 'ft.com',                    category: '商业财经', subCategory: '投资理财', confidence: 0.82 },
  { domain: 'crunchbase.com',            category: '商业财经', subCategory: '创业融资', confidence: 0.85 },
  { domain: 'pitchbook.com',             category: '商业财经', subCategory: '创业融资', confidence: 0.80 },
  { domain: 'angel.co',                  category: '商业财经', subCategory: '创业融资', confidence: 0.78 },
  { domain: 'tianyancha.com',            category: '商业财经', subCategory: '公司研究', confidence: 0.85 },
  { domain: 'qichacha.com',              category: '商业财经', subCategory: '公司研究', confidence: 0.85 },
  { domain: 'xueqiu.com',                category: '商业财经', subCategory: '投资理财', confidence: 0.85 },
  { domain: 'eastmoney.com',             category: '商业财经', subCategory: '投资理财', confidence: 0.82 },
  { domain: 'coindesk.com',              category: '商业财经', subCategory: '投资理财', confidence: 0.78 },

  // ========== 医疗健康 ==========
  { domain: 'msdmanuals.cn',             category: '医疗健康', subCategory: '健康科普', confidence: 0.85 },
  { domain: 'mayoclinic.org',            category: '医疗健康', subCategory: '健康科普', confidence: 0.82 },
  { domain: 'webmd.com',                 category: '医疗健康', subCategory: '健康科普', confidence: 0.78 },
  { domain: 'pubmed.ncbi.nlm.nih.gov',   category: '学习研究', subCategory: '学术论文', confidence: 0.85 },
  { domain: 'dxy.cn',                    category: '医疗健康', subCategory: '健康科普', confidence: 0.80 },

  // ========== 工作资料 ==========
  { domain: 'linkedin.com',              category: '工作资料', subCategory: '招聘职业', confidence: 0.85 },
  { domain: 'zhaopin.com',               category: '工作资料', subCategory: '招聘职业', confidence: 0.82 },
  { domain: 'lagou.com',                 category: '工作资料', subCategory: '招聘职业', confidence: 0.82 },
  { domain: 'bosszhipin.com',            category: '工作资料', subCategory: '招聘职业', confidence: 0.85 },
  { domain: 'indeed.com',                category: '工作资料', subCategory: '招聘职业', confidence: 0.80 },
  { domain: '51job.com',                 category: '工作资料', subCategory: '招聘职业', confidence: 0.78 },
  { domain: 'mokahr.com',                category: '工作资料', subCategory: '招聘职业', confidence: 0.75 },
  { domain: 'interviewing.io',           category: '工作资料', subCategory: '招聘职业', confidence: 0.75 },

  // ========== 国内常用平台 ==========
  { domain: 'weibo.com',                 category: '资讯动态', subCategory: '社区讨论', confidence: 0.78 },
  { domain: 'tieba.baidu.com',           category: '资讯动态', subCategory: '社区讨论', confidence: 0.75 },
  { domain: 'baidu.com',                 category: '效率工具', subCategory: '数据工具', confidence: 0.50 }, // 综合门户
  { domain: 'youtube.com',               category: '娱乐媒体', subCategory: '视频音乐', confidence: 0.88 },
  { domain: 'google.com',                category: '效率工具', subCategory: '数据工具', confidence: 0.50,
    pathOverrides: [
      { pattern: '^/docs/',               subCategory: '办公协作', confidence: 0.90 },
      { pattern: '^/drive/',              subCategory: '办公协作', confidence: 0.88 },
      { pattern: '^/gmail/',              subCategory: '办公协作', confidence: 0.85 },
      { pattern: '^/maps/',               subCategory: '生活消费', confidence: 0.80 },
      { pattern: '^/scholar/',            subCategory: '学术论文', confidence: 0.90 },
    ]
  },
]
