// ============================================================
// BookmarksAI · 域名特征匹配引擎 (Layer 1)
// 基于 Wappalyzer 数据 + 用户学习记录的域名→分类高速查找
// ============================================================
import { DOMAIN_MAP, type DomainMapEntry } from './domainMap'

export interface DomainMatchResult {
  folderPath: [string, string]
  confidence: number
  matchedDomain: string
  /** 是否通过路径覆写得到 */
  isPathOverride: boolean
}

/**
 * 域名前缀树 -- 从右向左构建
 * 例如 "developer.mozilla.org" 按 ["org", "mozilla", "developer"] 插入
 * 查找时也按同样的顺序匹配，返回最精确的节点
 */
type TrieNode = Map<string, TrieNode | DomainMapEntry>

class DomainTrie {
  private root: TrieNode = new Map()
  private static readonly SIG_KEY = '__sig__'

  insert(domain: string, entry: DomainMapEntry): void {
    const parts = domain.split('.').reverse()
    let node = this.root
    for (const part of parts) {
      if (!node.has(part)) {
        node.set(part, new Map())
      }
      node = node.get(part) as TrieNode
    }
    node.set(DomainTrie.SIG_KEY, entry)
  }

  lookup(hostname: string): DomainMapEntry | null {
    const parts = hostname.split('.').reverse()
    let node: TrieNode = this.root
    let lastEntry: DomainMapEntry | null = null

    for (const part of parts) {
      const child = node.get(part)
      if (!child || !(child instanceof Map)) break
      node = child
      if (node.has(DomainTrie.SIG_KEY)) {
        lastEntry = node.get(DomainTrie.SIG_KEY) as DomainMapEntry
      }
    }
    return lastEntry
  }
}

// 构建 Trie 实例（单例）
let trieInstance: DomainTrie | null = null

function getTrie(): DomainTrie {
  if (!trieInstance) {
    trieInstance = new DomainTrie()
    for (const entry of DOMAIN_MAP) {
      trieInstance.insert(entry.domain, entry)
    }
  }
  return trieInstance
}

/**
 * 从 URL 中提取纯净域名
 */
export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname.replace(/^www\./, '')
  } catch {
    return url.split('/')[0]?.toLowerCase() ?? ''
  }
}

/**
 * 判断域名是否匹配任何预置规则
 * 返回最精确匹配的 DomainMapEntry，以及可选的路径覆写
 */
export function matchDomain(
  url: string
): DomainMatchResult | null {
  const hostname = extractDomain(url)
  if (!hostname) return null

  const trie = getTrie()
  const entry = trie.lookup(hostname)
  if (!entry) return null

  // 检查路径覆写
  if (entry.pathOverrides?.length) {
    try {
      const pathname = new URL(url).pathname
      for (const override of entry.pathOverrides) {
        const regex = new RegExp(override.pattern)
        if (regex.test(pathname)) {
          return {
            folderPath: [entry.category, override.subCategory],
            confidence: override.confidence,
            matchedDomain: entry.domain,
            isPathOverride: true,
          }
        }
      }
    } catch {
      // URL 解析失败，忽略路径覆写
    }
  }

  return {
    folderPath: [entry.category, entry.subCategory],
    confidence: entry.confidence,
    matchedDomain: entry.domain,
    isPathOverride: false,
  }
}

/**
 * 获取域名匹配的概览信息（用于 AI Prompt 上下文）
 */
export function getDomainSuggestion(url: string): string {
  const result = matchDomain(url)
  if (!result) return ''
  return `${result.folderPath.join('/')} (置信度: ${(result.confidence * 100).toFixed(0)}%)`
}

// 重置 Trie（主要用于测试）
export function resetTrie(): void {
  trieInstance = null
}
