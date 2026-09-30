import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiProxy } from '../lib/supabase.js'
import ThemeToggle from '../components/ThemeToggle.jsx'

export default function Settings() {
  const nav = useNavigate()
  const [configured, setConfigured] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null) // {ok, text}
  const [err, setErr] = useState('')

  useEffect(() => {
    aiProxy('key-status', null, 'GET')
      .then(r => setConfigured(!!r.configured))
      .catch(e => { setConfigured(false); setErr(e.message) })
  }, [])

  async function test() {
    setErr(''); setMsg(null); setBusy('test')
    try {
      await aiProxy('test-key', apiKey.trim() ? { api_key: apiKey.trim() } : {})
      setMsg({ ok: true, text: '连接成功，key 有效。' })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy('')
    }
  }

  async function save() {
    setErr(''); setMsg(null)
    if (!apiKey.trim()) { setErr('请先输入 API Key'); return }
    setBusy('save')
    try {
      // 保存前先验证一次
      await aiProxy('test-key', { api_key: apiKey.trim() })
      await aiProxy('save-key', { api_key: apiKey.trim() })
      setConfigured(true)
      setApiKey('')
      setMsg({ ok: true, text: '已保存。出题和批改功能现在可用了。' })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="pt-14">
      <button onClick={() => nav('/')} className="text-sm text-ink/40 hover:text-ink/80 transition-colors">← 返回</button>
      <h1 className="mt-4 text-xl font-semibold">设置</h1>

      <div className="mt-8 border-t divider pt-6">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px]">DeepSeek API Key</p>
          <span className={`text-xs ${configured ? 'text-ok/80' : 'text-ink/30'}`}>
            {configured === null ? '查询中…' : configured ? '✓ 已配置' : '未配置'}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink/40">
          在 platform.deepseek.com 创建。Key 存在你自己的 Supabase 数据库里，
          仅服务端读写，前端永远接触不到明文；换设备无需重新填写。
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={configured ? '已配置（输入新 key 可替换）' : 'sk-…'}
          className="mt-4 w-full px-3 py-2.5 text-sm"
        />
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={test}
            disabled={busy !== ''}
            className="px-4 py-2 text-xs border border-ink/15 rounded-lg hover:bg-ink/[0.05] transition-colors disabled:opacity-40"
          >
            {busy === 'test' ? '测试中…' : '测试连接'}
          </button>
          <button
            onClick={save}
            disabled={busy !== '' || !apiKey.trim()}
            className="px-4 py-2 text-xs bg-acc/25 border border-acc/25 rounded-lg hover:bg-acc/35 transition-colors disabled:opacity-40"
          >
            {busy === 'save' ? '保存中…' : '保存'}
          </button>
        </div>
        {msg && (
          <p className={`mt-4 text-sm ${msg.ok ? 'text-ok/85' : 'text-bad/85'}`}>{msg.text}</p>
        )}
        {err && <p className="mt-4 text-sm text-bad/85">{err}</p>}
      </div>

      <div className="mt-10 border-t divider pt-6 flex items-baseline justify-between">
        <p className="text-[15px]">外观</p>
        <ThemeToggle asText />
      </div>

      <div className="mt-10 border-t divider pt-6">
        <p className="text-xs leading-relaxed text-ink/35">
          模型固定使用 deepseek-flash：出题关思考模式（快、省），批改理由开思考模式（质量优先）。
        </p>
      </div>
    </div>
  )
}
