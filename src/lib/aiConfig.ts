import type { AIConfig, UserSettings } from '../types'
import { AI_ERROR_CODES } from './aiErrors'
import { getProviderPreset } from './aiProviders'

export const BYOK_CONFIG_REQUIRED_MESSAGE = AI_ERROR_CODES.CONFIG_REQUIRED

/** 过滤空字符串，确保返回有效的配置值 */
function nonEmpty(v: string | undefined): string | undefined {
  return v && v.trim() ? v.trim() : undefined
}

export function resolveAIConfig(settings: UserSettings): AIConfig | null {
  const preset = getProviderPreset(settings.aiProvider)
  const apiKey = nonEmpty(settings.apiKeys[settings.aiProvider])
  const configuredBaseUrl =
    nonEmpty(settings.aiBaseUrls[settings.aiProvider]) ||
    nonEmpty(settings.aiProvider === 'custom' ? settings.customBaseUrl : '') ||
    preset.baseUrl
  const configuredModel =
    nonEmpty(settings.aiModels[settings.aiProvider]) ||
    nonEmpty(settings.aiProvider === 'custom' ? settings.customModel : '') ||
    preset.defaultModel

  if (apiKey && configuredBaseUrl && configuredModel) {
    return {
      provider: settings.aiProvider,
      apiKey,
      baseUrl: configuredBaseUrl,
      model: configuredModel,
    }
  }

  return null
}
