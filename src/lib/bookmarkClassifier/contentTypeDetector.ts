// ============================================================
// BookmarksAI · 内容类型检测器 (Stage 2)
// 从页面标题 + Meta 判断页面内容类型
// ============================================================

export type PageContentType =
  | 'tool-website'       // 工具官网
  | 'product-docs'       // 产品文档
  | 'blog-post'          // 博客文章
  | 'tutorial'           // 教程
  | 'academic-paper'     // 学术论文
  | 'video'              // 视频
  | 'github-repo'        // GitHub 仓库
  | 'news-article'       // 新闻
  | 'pricing-page'       // 定价页
  | 'api-reference'      // API 参考
  | 'community-post'     // 社区帖子
  | 'landing-page'       // 落地页
  | 'ecommerce'          // 电商
  | 'social-media'       // 社交媒体
  | 'unknown'

/**
 * 从标题 + 描述 + URL 分析中判断内容类型
 */
export function detectContentType(
  title: string,
  description: string,
  url: string
): { type: PageContentType; confidence: number } {
  const combined = `${title}\n${description}`.toLowerCase()

  // 论文
  if (/\b(arxiv|paper|论文|research|preprint|proceedings)\b/i.test(combined)) {
    return { type: 'academic-paper', confidence: 0.85 }
  }

  // GitHub 仓库
  if (/github\.com\/[\w.-]+\/[\w.-]+/.test(url) && !url.includes('/topics/')) {
    return { type: 'github-repo', confidence: 0.90 }
  }

  // 视频
  if (/\b(watch|video|youtube|bilibili|streaming|episode)\b/i.test(combined) ||
      /youtube\.com\/watch|bilibili\.com\/video/.test(url)) {
    return { type: 'video', confidence: 0.85 }
  }

  // 教程
  if (/\b(tutorial|learn|course|getting started|guide|how to|入门|教程|指南)\b/i.test(combined)) {
    return { type: 'tutorial', confidence: 0.80 }
  }

  // 定价页
  if (/\b(pricing|plans?|pro |enterprise|subscription|prices?|定价|价格|套餐)\b/i.test(combined)) {
    return { type: 'pricing-page', confidence: 0.85 }
  }

  // API 参考
  if (/\b(api reference|api docs|sdk documentation|api 文档|api 参考)\b/i.test(combined)) {
    return { type: 'api-reference', confidence: 0.82 }
  }

  // 博客文章
  if (/\b(blog|article|published|written by|posted|updated|博客|文章)\b/i.test(combined)) {
    return { type: 'blog-post', confidence: 0.75 }
  }

  // 新闻
  if (/\b(news|breaking|report|报道|新闻|日报|周刊)\b/i.test(combined)) {
    return { type: 'news-article', confidence: 0.75 }
  }

  // 社区
  if (/\b(forum|discuss|community|thread|post|reddit|stackoverflow|社区|讨论)\b/i.test(combined)) {
    return { type: 'community-post', confidence: 0.78 }
  }

  // 电商
  if (/\b(buy|shop|price|cart|order|checkout|购买|购物|下单|商品)\b/i.test(combined)) {
    return { type: 'ecommerce', confidence: 0.80 }
  }

  // 产品文档
  if (/\b(documentation|docs|manual|handbook|reference|文档|手册)\b/i.test(combined)) {
    return { type: 'product-docs', confidence: 0.78 }
  }

  // 工具官网
  if (/\b(the |meet |introducing |product |launch |platform |工具|平台)\b/i.test(combined)) {
    return { type: 'tool-website', confidence: 0.65 }
  }

  return { type: 'unknown', confidence: 0.5 }
}

/**
 * 根据内容类型获取建议的分类倾向
 */
export function getSuggestedCategoryFromType(
  type: PageContentType
): { category: string; subCategory: string } | null {
  switch (type) {
    case 'academic-paper':
      return { category: '学习研究', subCategory: '学术论文' }
    case 'tutorial':
      return { category: '学习研究', subCategory: '技术教程' }
    case 'blog-post':
      return { category: '学习研究', subCategory: '技术教程' }
    case 'news-article':
      return { category: '资讯动态', subCategory: '科技新闻' }
    case 'video':
      return { category: '娱乐媒体', subCategory: '视频音乐' }
    case 'community-post':
      return { category: '资讯动态', subCategory: '社区讨论' }
    case 'pricing-page':
      return { category: '商业财经', subCategory: '公司产品' }
    case 'ecommerce':
      return { category: '生活消费', subCategory: '购物比价' }
    case 'social-media':
      return { category: '资讯动态', subCategory: '社区讨论' }
    default:
      return null
  }
}
