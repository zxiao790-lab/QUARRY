import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiProxy } from '../lib/supabase.js'
import { getUserAIKey, saveUserAIKey, clearUserAIKey, DEEPSEEK_PLATFORM_URL } from '../lib/userAI.js'
import ThemeToggle from '../components/ThemeToggle.jsx'

export default function Settings() {
  const nav = useNavigate()
  const [configured, setConfigured] = useState(() => !!getUserAIKey())
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null) // {ok, text}

  function test() {
    setMsg(null); setBusy('test')
    const key = apiKey.trim() || getUserAIKey()
    if (!key) { setMsg({ ok: false, text: '还没有可用的 API Key，请先填写。' }); return }
    aiProxy('test-key', { userApiKey: key })
      .then(() => setMsg({ ok: true, text: '连接成功，key 有效。' }))
      .catch(e => setMsg({ ok: false, text: e.message }))
      .finally(() => setBusy(''))
  }

  function save() {
    setMsg(null)
    if (!apiKey.trim()) { setMsg({ ok: false, text: '请先输入 API Key' }); return }
    setBusy('save')
    // 保存前先验证一次（只验证，不落库）
    aiProxy('test-key', { userApiKey: apiKey.trim() })
      .then(() => {
        saveUserAIKey(apiKey.trim())
        setConfigured(true)
        setApiKey('')
        setMsg({ ok: true, text: '已保存到本机。出题和批改功能现在可用了。' })
      })
      .catch(e => setMsg({ ok: false, text: e.message }))
      .finally(() => setBusy(''))
  }

  function remove() {
    clearUserAIKey()
    setConfigured(false)
    setMsg({ ok: true, text: '已清除本机保存的 Key。' })
  }

  return (
    <div className="pt-14">
      <button onClick={() => nav('/')} className="text-sm text-ink/40 hover:text-ink/80 transition-colors">← 返回</button>
      <h1 className="mt-4 text-xl font-semibold">设置</h1>

      <div className="mt-8 border-t divider pt-6">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px]">DeepSeek API Key</p>
          <span className={`text-xs ${configured ? 'text-ok/80' : 'text-ink/30'}`}>
            {configured ? '✓ 已配置' : '未配置'}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink/40">
          Key 只存在你这台设备的浏览器里，不进入任何服务器；换设备需重新填写。
        </p>
        <details className="mt-3 text-xs text-ink/40">
          <summary className="cursor-pointer select-none hover:text-ink/70 transition-colors">
            什么是 API Key？怎么获取？点此查看说明
          </summary>
          <div className="mt-2 leading-relaxed">
            ① 打开 <a href={DEEPSEEK_PLATFORM_URL} target="_blank" rel="noreferrer" className="text-acc/90 underline underline-offset-2">{DEEPSEEK_PLATFORM_URL.replace('https://', '')}</a>
            <br />② 注册或登录 → 左侧「API Keys」→「创建 API key」
            <br />③ 复制生成的 Key（只显示一次，请存好）→ 充值页按需充值，日常使用很省
          </div>
        </details>
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
          {configured && (
            <button
              onClick={remove}
              disabled={busy !== ''}
              className="px-4 py-2 text-xs text-ink/40 hover:text-bad/80 transition-colors disabled:opacity-40"
            >
              清除
            </button>
          )}
        </div>
        {msg && (
          <p className={`mt-4 text-sm ${msg.ok ? 'text-ok/85' : 'text-bad/85'}`}>{msg.text}</p>
        )}
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
