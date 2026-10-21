import { createClient } from '@supabase/supabase-js'
import { getUserAIKey } from './userAI.js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon || anon.startsWith('填你的')) {
  // 开发期提示：未配置也能进 UI，但数据操作会失败
  console.warn('[quarry] Supabase 未配置，请复制 .env.example 为 .env 并填写')
}

export const supabase = createClient(url || 'http://localhost', anon || 'placeholder')

// 调用 ai-proxy Edge Function
// BYOK：POST 请求自动注入 localStorage 里的 key（显式传入的 userApiKey 优先）
export async function aiProxy(op, body, method = 'POST') {
  let payload = body
  if (method === 'POST') {
    payload = { ...(body || {}) }
    if (!payload.userApiKey) {
      const key = getUserAIKey()
      if (key) payload.userApiKey = key
    }
  }
  const res = await fetch(`${url}/functions/v1/ai-proxy?op=${op}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`)
  return data
}
