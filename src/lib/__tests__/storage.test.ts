import { describe, it, expect } from 'vitest'
import { normalizeUrl, getDomain, computeStatus } from '../storage'
import type { Bookmark } from '../../types'

describe('normalizeUrl', () => {
  it('removes trailing slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
  })

  it('removes hash', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page')
  })

  it('sorts query parameters', () => {
    const result = normalizeUrl('https://example.com?b=2&a=1')
    // URL constructor adds / before ? when there is no pathname
    expect(result).toBe('https://example.com/?a=1&b=2')
  })

  it('returns trimmed url for invalid urls', () => {
    expect(normalizeUrl('  not-a-url  ')).toBe('not-a-url')
  })
})

describe('getDomain', () => {
  it('extracts hostname without www', () => {
    expect(getDomain('https://www.example.com/path')).toBe('example.com')
  })

  it('returns empty string for invalid urls', () => {
    expect(getDomain('not-a-url')).toBe('')
  })
})

describe('computeStatus', () => {
  const now = Date.now()
  const DAY = 1000 * 60 * 60 * 24

  it('returns sleeping for never visited', () => {
    const bm = { lastVisitedAt: undefined } as Bookmark
    expect(computeStatus(bm)).toBe('sleeping')
  })

  it('returns active for recent visit', () => {
    const bm = { lastVisitedAt: now - 10 * DAY } as Bookmark
    expect(computeStatus(bm)).toBe('active')
  })

  it('returns idle for 30-90 day visit', () => {
    const bm = { lastVisitedAt: now - 60 * DAY } as Bookmark
    expect(computeStatus(bm)).toBe('idle')
  })

  it('returns sleeping for 90+ day visit', () => {
    const bm = { lastVisitedAt: now - 100 * DAY } as Bookmark
    expect(computeStatus(bm)).toBe('sleeping')
  })
})
