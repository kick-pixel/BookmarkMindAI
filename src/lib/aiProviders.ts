import type { AIProvider } from '../types'

export interface AIProviderPreset {
  id: AIProvider
  name: string
  region: 'global' | 'cn'
  baseUrl: string
  defaultModel: string
  docsUrl: string
  zhDesc: string
  enDesc: string
  badge?: 'recommended' | 'router' | 'fast'
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    region: 'cn',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-v4-flash',
    docsUrl: 'https://api-docs.deepseek.com/',
    zhDesc: '中文分类和摘要的默认推荐，成本低',
    enDesc: 'Recommended default for low-cost Chinese categorization and summaries',
    badge: 'recommended',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    region: 'cn',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    docsUrl: 'https://platform.moonshot.cn/docs',
    zhDesc: '长文本中文网页理解能力强',
    enDesc: 'Strong Chinese long-context page understanding',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    region: 'global',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/docs',
    zhDesc: '全球通用模型生态，适合海外用户',
    enDesc: 'Global model ecosystem for international users',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    region: 'global',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'deepseek-ai/deepseek-v4-flash',
    docsUrl: 'https://docs.api.nvidia.com/nim/',
    zhDesc: '\u82f1\u4f1f\u8fbe NIM OpenAI-compatible API\uff0c\u9002\u5408\u4e2d\u6587\u5206\u7c7b\u3001\u6807\u7b7e\u548c\u6458\u8981',
    enDesc: 'NVIDIA NIM OpenAI-compatible API for categorization, tagging, and summaries',
    badge: 'fast',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    region: 'global',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    docsUrl: 'https://openrouter.ai/docs',
    zhDesc: '一个 Key 路由多家模型，适合模型对比',
    enDesc: 'Route many models with one key, useful for model comparison',
    badge: 'router',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    region: 'cn',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    docsUrl: 'https://docs.siliconflow.cn/',
    zhDesc: '国内常用聚合平台，开源模型选择多',
    enDesc: 'China-friendly model platform with many open models',
  },
  {
    id: 'dashscope',
    name: '通义千问 DashScope',
    region: 'cn',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo-latest',
    docsUrl: 'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope',
    zhDesc: '阿里云百炼 OpenAI 兼容模式',
    enDesc: 'Alibaba Model Studio OpenAI-compatible endpoint',
  },
  {
    id: 'volcengine',
    name: '火山方舟',
    region: 'cn',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-seed-1-6-flash-250715',
    docsUrl: 'https://www.volcengine.com/docs/82379',
    zhDesc: '字节火山方舟，适合豆包模型',
    enDesc: 'Volcengine Ark endpoint for Doubao models',
  },
  {
    id: 'zhipu',
    name: '智谱 BigModel',
    region: 'cn',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    docsUrl: 'https://open.bigmodel.cn/dev/howuse/model',
    zhDesc: 'GLM 模型，国内可用性好',
    enDesc: 'GLM models with good availability in China',
  },
  {
    id: 'groq',
    name: 'Groq',
    region: 'global',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-8b-instant',
    docsUrl: 'https://console.groq.com/docs/openai',
    zhDesc: '响应速度快，适合轻量分类',
    enDesc: 'Very fast responses for lightweight classification',
    badge: 'fast',
  },
  {
    id: 'together',
    name: 'Together AI',
    region: 'global',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    docsUrl: 'https://docs.together.ai/docs/openai-api-compatibility',
    zhDesc: '开源模型生态丰富',
    enDesc: 'Broad open model ecosystem',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    region: 'global',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar',
    docsUrl: 'https://docs.perplexity.ai/',
    zhDesc: '可用于需要联网理解的模型场景',
    enDesc: 'Useful when model-side web-aware answers are needed',
  },
  {
    id: 'custom',
    name: 'Custom',
    region: 'global',
    baseUrl: '',
    defaultModel: '',
    docsUrl: '',
    zhDesc: '任意 OpenAI-compatible API',
    enDesc: 'Any OpenAI-compatible API endpoint',
  },
]

export function getProviderPreset(provider: AIProvider): AIProviderPreset {
  return AI_PROVIDER_PRESETS.find(preset => preset.id === provider) ?? AI_PROVIDER_PRESETS[0]
}
