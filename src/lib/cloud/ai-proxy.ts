import type { Bookmark, ExtractedContent } from '../../types'
import { cloud } from './client'
import { isAuthenticated } from './auth'

export interface AIJobResult {
  classification?: {
    folderPath: [string, string]
    tags: string[]
    confidence: number
    reason: string
  }
  summary?: string
  keywords?: string[]
}

export async function submitToCloudAI(
  bookmark: Bookmark,
  content: ExtractedContent,
): Promise<string | null> {
  if (!await isAuthenticated()) return null

  const response = await cloud.post<{ jobId: string }>('/ai/process', {
    bookmarkId: bookmark.id,
    title: content.title,
    url: content.url,
    description: content.description,
    category: bookmark.category,
  })

  if (!response.ok) return null
  return response.data?.jobId ?? null
}

export async function pollAIJob(jobId: string): Promise<AIJobResult | null> {
  if (!await isAuthenticated()) return null

  const response = await cloud.get<AIJobResult>(`/ai/status/${jobId}`)
  if (!response.ok) return null
  return response.data ?? null
}

export function applyAIResultToBookmark(
  bookmark: Bookmark,
  result: AIJobResult,
): Bookmark {
  const updated = { ...bookmark }

  if (result.classification) {
    updated.category = result.classification.folderPath[0]
    updated.subCategory = result.classification.folderPath[1]
    updated.folderPath = result.classification.folderPath
    updated.tags = [...new Set([...updated.tags, ...result.classification.tags])]
    updated.aiCategorized = true
    updated.aiConfidence = result.classification.confidence
    updated.aiReason = result.classification.reason
  }

  if (result.summary) {
    updated.summary = result.summary
    updated.summaryGeneratedAt = Date.now()
  }

  if (result.keywords) {
    updated.keywords = result.keywords
  }

  updated.aiStatus = 'done'
  return updated
}
