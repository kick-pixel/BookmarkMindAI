import type { AIConfig, UserSettings } from '../types'
import { getProviderPreset } from './aiProviders'

export const BUILT_IN_FREE_AI = {
  provider: 'nvidia',
  apiKey: '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',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'deepseek-ai/deepseek-v4-flash',
} as const

export const FREE_AI_UNSTABLE_MESSAGE =
  '\u5185\u7f6e\u514d\u8d39\u6a21\u578b\u6682\u65f6\u4e0d\u53ef\u7528\u6216\u4e0d\u7a33\u5b9a\uff0c\u5efa\u8bae\u5230\u8bbe\u7f6e\u4e2d\u5207\u6362\u4e3a\u201c\u4e2a\u4eba\u6a21\u578b\u201d\u5e76\u914d\u7f6e\u81ea\u5df1\u7684 API Key\u3002'

export const FREE_AI_QUOTA_MESSAGE =
  '\u5185\u7f6e\u514d\u8d39\u6a21\u578b\u672c\u6708\u989d\u5ea6\u5df2\u7528\u5b8c\uff0c\u5efa\u8bae\u5230\u8bbe\u7f6e\u4e2d\u5207\u6362\u4e3a\u201c\u4e2a\u4eba\u6a21\u578b\u201d\uff0c\u4f7f\u7528\u81ea\u5df1\u7684 API Key \u540e\u4e0d\u53d7\u63d2\u4ef6\u989d\u5ea6\u9650\u5236\u3002'

export function resolveAIConfig(settings: UserSettings): AIConfig {
  const preset = getProviderPreset(settings.aiProvider)
  const apiKey = settings.apiKeys[settings.aiProvider]
  const configuredBaseUrl =
    settings.aiBaseUrls[settings.aiProvider] ||
    (settings.aiProvider === 'custom' ? settings.customBaseUrl : '') ||
    preset.baseUrl
  const configuredModel =
    settings.aiModels[settings.aiProvider] ||
    (settings.aiProvider === 'custom' ? settings.customModel : '') ||
    preset.defaultModel

  if (settings.aiServiceMode === 'byok' && apiKey && configuredBaseUrl && configuredModel) {
    return {
      provider: settings.aiProvider,
      apiKey,
      baseUrl: configuredBaseUrl,
      model: configuredModel,
    }
  }

  return {
    provider: BUILT_IN_FREE_AI.provider,
    apiKey: BUILT_IN_FREE_AI.apiKey,
    baseUrl: BUILT_IN_FREE_AI.baseUrl,
    model: BUILT_IN_FREE_AI.model,
  }
}

export function isUsingBuiltInFreeAI(settings: UserSettings): boolean {
  return !(settings.aiServiceMode === 'byok' && settings.apiKeys[settings.aiProvider])
}
