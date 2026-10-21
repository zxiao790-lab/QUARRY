// 用户自带 AI Key（BYOK）——只存本机 localStorage，不上传任何服务器
// 调用 AI 时随请求体带给 Edge Function，函数即转即弃，不落库
const STORAGE_KEY = 'quarry_user_ai'

export const DEEPSEEK_PLATFORM_URL = 'https://platform.deepseek.com'

export function getUserAIKey() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return ''
    const cfg = JSON.parse(raw)
    return cfg && typeof cfg === 'object' && cfg.apiKey ? String(cfg.apiKey) : ''
  } catch (e) {
    return ''
  }
}

export function saveUserAIKey(apiKey) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey: (apiKey || '').trim(), savedAt: Date.now() }))
}

export function clearUserAIKey() {
  localStorage.removeItem(STORAGE_KEY)
}
