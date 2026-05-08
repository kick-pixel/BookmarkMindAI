import { describe, it, expect } from 'vitest'
import { BOOKMARK_TAXONOMY, normalizeFolderPath, inferFolderByRules, getTaxonomyPrompt } from '../bookmarkTaxonomy'

describe('BOOKMARK_TAXONOMY', () => {
  it('has exactly 11 top-level categories', () => {
    expect(BOOKMARK_TAXONOMY).toHaveLength(11)
  })

  it('every group has at least one child', () => {
    for (const group of BOOKMARK_TAXONOMY) {
      expect(group.children.length).toBeGreaterThan(0)
    }
  })

  it('last group is 其他 with 待整理 child', () => {
    const last = BOOKMARK_TAXONOMY[BOOKMARK_TAXONOMY.length - 1]
    expect(last.name).toBe('其他')
    expect(last.children).toContain('待整理')
  })
})

describe('getTaxonomyPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = getTaxonomyPrompt()
    expect(prompt.length).toBeGreaterThan(100)
  })

  it('includes all category names', () => {
    const prompt = getTaxonomyPrompt()
    for (const group of BOOKMARK_TAXONOMY) {
      expect(prompt).toContain(group.name)
    }
  })
})

describe('normalizeFolderPath', () => {
  it('returns 其他/待整理 for empty input', () => {
    expect(normalizeFolderPath()).toEqual(['其他', '待整理'])
  })

  it('normalizes valid taxonomy paths', () => {
    expect(normalizeFolderPath(['技术开发', '前端开发'])).toEqual(['技术开发', '前端开发'])
  })

  it('falls back to first child for invalid second element', () => {
    const result = normalizeFolderPath(['技术开发', 'nonexistent'])
    expect(result[0]).toBe('技术开发')
    expect(result[1]).toBe(BOOKMARK_TAXONOMY[0].children[0])
  })

  it('falls back for invalid first element', () => {
    const result = normalizeFolderPath(['invalid', 'something'])
    expect(result).toEqual(['其他', '待整理'])
  })
})

describe('inferFolderByRules', () => {
  it('matches VPN-related content', () => {
    const result = inferFolderByRules({
      title: 'Best VPN for streaming',
      url: 'https://example.com/vpn',
      description: 'VPN proxy comparison',
      mainContent: '',
    })
    expect(result).toEqual(['效率工具', '网络代理'])
  })

  it('matches Web3/blockchain content', () => {
    const result = inferFolderByRules({
      title: 'Solana Faucet',
      url: 'https://faucet.solana.com',
      description: 'Get SOL for development',
      mainContent: '',
    })
    expect(result).toEqual(['技术开发', 'Web3与区块链'])
  })

  it('matches frontend development content', () => {
    const result = inferFolderByRules({
      title: 'React 19 Release Notes',
      url: 'https://react.dev/blog',
      description: 'React frontend framework',
      mainContent: '',
    })
    expect(result).toEqual(['技术开发', '前端开发'])
  })

  it('matches tutorial content', () => {
    const result = inferFolderByRules({
      title: '入门编程指南',
      url: 'https://example.com/lesson01',
      description: '新手教程 学习指南',
      mainContent: '',
    })
    expect(result).toEqual(['学习研究', '技术教程'])
  })

  it('falls back to 其他/待整理 for unclassifiable content', () => {
    const result = inferFolderByRules({
      title: 'Random page',
      url: 'https://example.com',
      description: '',
      mainContent: '',
    })
    expect(result).toEqual(['其他', '待整理'])
  })

  it('matches news content from known domains', () => {
    const result = inferFolderByRules({
      title: '科技新闻快讯',
      url: 'https://news.qq.com/article',
      description: '最新资讯 news 日报',
      mainContent: '',
    })
    expect(result).toEqual(['资讯动态', '科技新闻'])
  })
})
