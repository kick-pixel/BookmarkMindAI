import type { ExtractedContent } from '../types'

export const AI_ERROR_CODES = {
  CONFIG_REQUIRED: 'AI_CONFIG_REQUIRED',
  AUTH_REQUIRED: 'CONTENT_AUTH_REQUIRED',
  CONTENT_NOT_READY: 'CONTENT_NOT_READY',
  SPARSE_CONTENT: 'CONTENT_SPARSE',
} as const

export type AIErrorCode = typeof AI_ERROR_CODES[keyof typeof AI_ERROR_CODES]

const AUTH_GATE_PATTERNS = [
  /请先登录|登录后查看|登录后继续|未登录|账号登录|扫码登录|微信登录|手机登录|验证码|会话过期|访问受限|无权访问|权限不足|需要授权|认证失败/i,
  /sign[\s-]?in|log[\s-]?in|logged out|sign up|register|captcha|verify your identity|authentication required|unauthorized|forbidden|access denied|permission denied|session expired/i,
]

const AUTH_URL_PATTERNS = [
  /\/(login|signin|sign-in|auth|oauth|sso|account|accounts|passport)(\/|[?#]|$)/i,
  /[?&](login|signin|auth|sso|redirect_uri|returnUrl|continue)=/i,
]

export function isAIErrorCode(error: string | undefined): error is AIErrorCode {
  return Boolean(error && Object.values(AI_ERROR_CODES).includes(error as AIErrorCode))
}

export function getUnreadableContentErrorCode(content: ExtractedContent): AIErrorCode {
  if (isLikelyAuthGate(content)) return AI_ERROR_CODES.AUTH_REQUIRED
  const sparseText = [
    content.title,
    content.description,
    content.mainContent,
  ].filter(Boolean).join('\n').trim()
  return sparseText.length > 0 ? AI_ERROR_CODES.SPARSE_CONTENT : AI_ERROR_CODES.CONTENT_NOT_READY
}

export function isLikelyAuthGate(content: ExtractedContent): boolean {
  const text = [
    content.title,
    content.description,
    content.mainContent,
  ].filter(Boolean).join('\n')
  return AUTH_GATE_PATTERNS.some(pattern => pattern.test(text)) ||
    AUTH_URL_PATTERNS.some(pattern => pattern.test(content.url))
}
