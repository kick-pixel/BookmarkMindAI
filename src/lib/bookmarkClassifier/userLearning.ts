// ============================================================
// BookmarksAI · 用户修正学习模块
// 用户手动修正书签分类 → 学习更新规则权重
// ============================================================
import type { Bookmark } from '../../types'

// 用户修正记录存储 key
const LEARNING_STORAGE_KEY = 'bai_classifier_learning'

export interface UserCorrectionRecord {
  url: string
  originalFolderPath: string[]
  correctedFolderPath: string[]
  correctedAt: number
  count: number  // 同 URL 修正次数
}

export interface LearnedRule {
  domain: string
  preferredCategory: string
  preferredSubCategory: string
  confidence: number
  correctionCount: number
}

/**
 * 读取用户学习记录
 */
async function getCorrectionRecords(): Promise<UserCorrectionRecord[]> {
  try {
    const result = await chrome.storage.local.get(LEARNING_STORAGE_KEY)
    return (result[LEARNING_STORAGE_KEY] as UserCorrectionRecord[]) ?? []
  } catch {
    return []
  }
}

/**
 * 保存用户学习记录
 */
async function saveCorrectionRecords(records: UserCorrectionRecord[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [LEARNING_STORAGE_KEY]: records })
  } catch {
    // storage 失败时静默忽略
  }
}

/**
 * 记录用户手动修正
 */
export async function recordUserCorrection(
  bookmark: Bookmark,
  oldFolderPath: string[],
  newFolderPath: string[],
): Promise<void> {
  if (oldFolderPath.join('/') === newFolderPath.join('/')) return

  const records = await getCorrectionRecords()
  const existing = records.find(r => r.url === bookmark.url)

  if (existing) {
    existing.correctedFolderPath = newFolderPath
    existing.correctedAt = Date.now()
    existing.count += 1
  } else {
    records.push({
      url: bookmark.url,
      originalFolderPath: oldFolderPath,
      correctedFolderPath: newFolderPath,
      correctedAt: Date.now(),
      count: 1,
    })
  }

  // 保留最近 200 条
  const trimmed = records.slice(-200)
  await saveCorrectionRecords(trimmed)
}

/**
 * 从 URL 提取域名
 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * 聚合所有学习规则
 */
export async function getLearnedRules(): Promise<LearnedRule[]> {
  const records = await getCorrectionRecords()
  const byDomain = new Map<string, { corrected: string; count: number }>()

  for (const record of records) {
    const domain = extractDomain(record.url)
    const correctedKey = record.correctedFolderPath.join('/')

    const existing = byDomain.get(domain) ?? { corrected: correctedKey, count: 0 }
    // 取最新的修正
    existing.corrected = correctedKey
    existing.count += record.count
    byDomain.set(domain, existing)
  }

  return Array.from(byDomain.entries())
    .filter(([, data]) => data.count >= 2) // 至少修正 2 次才纳入规则
    .map(([domain, data]) => {
      const [category, subCategory = '待整理'] = data.corrected.split('/')
      return {
        domain,
        preferredCategory: category,
        preferredSubCategory: subCategory,
        confidence: Math.min(0.5 + data.count * 0.1, 0.85),
        correctionCount: data.count,
      }
    })
    .sort((a, b) => b.confidence - a.confidence)
}

/**
 * 检查是否有用户学习规则匹配
 */
export async function matchLearnedRule(url: string): Promise<{ folderPath: [string, string]; confidence: number } | null> {
  const domain = extractDomain(url)
  if (!domain) return null

  const rules = await getLearnedRules()
  const matched = rules.find(r => r.domain === domain)

  if (!matched) return null

  return {
    folderPath: [matched.preferredCategory, matched.preferredSubCategory],
    confidence: matched.confidence,
  }
}

/**
 * 清除学习记录
 */
export async function clearLearningRecords(): Promise<void> {
  await saveCorrectionRecords([])
}
