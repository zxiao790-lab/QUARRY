import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { splitChapters } from '../lib/split.js'

export default function Import() {
  const nav = useNavigate()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [mode, setMode] = useState('zh')
  const [raw, setRaw] = useState('')
  const [chapters, setChapters] = useState(null) // [{title, text}]
  const [fallback, setFallback] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!title) setTitle(f.name.replace(/\.txt$/i, ''))
    const reader = new FileReader()
    reader.onload = () => setRaw(String(reader.result || ''))
    reader.readAsText(f, 'utf-8')
  }

  function preview() {
    setErr('')
    if (!raw.trim()) { setErr('还没有书的内容'); return }
    if (!title.trim()) { setErr('请先填书名'); return }
    const list = splitChapters(raw, mode)
    setFallback(!!list[0]?.fallback)
    setChapters(list.map(c => ({ ...c, titleInput: c.title })))
  }

  async function save() {
    setErr('')
    setSaving(true)
    try {
      const { data: book, error: bErr } = await supabase
        .from('books').insert({ title: title.trim(), author: author.trim() }).select().single()
      if (bErr) throw new Error(bErr.message)
      const rows = chapters.map((c, i) => ({
        book_id: book.id, idx: i, title: c.titleInput.trim() || `章节 ${i + 1}`, raw_text: c.text,
      }))
      const { error: cErr } = await supabase.from('chapters').insert(rows)
      if (cErr) {
        // 回滚：不留孤儿书
        await supabase.from('books').delete().eq('id', book.id)
        throw new Error(`章节入库失败，已回滚：${cErr.message}`)
      }
      nav(`/book/${book.id}`)
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  const totalChars = raw.length

  return (
    <div className="pt-14">
      <button onClick={() => nav('/')} className="text-sm text-ink/40 hover:text-ink/80 transition-colors">← 书架</button>
      <h1 className="mt-4 text-xl font-semibold">导入新书</h1>

      <div className="mt-8 space-y-5">
        <div className="flex gap-4">
          <label className="flex-1">
            <p className="text-xs text-ink/40 mb-1.5">书名 *</p>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="如：行为" />
          </label>
          <label className="w-36">
            <p className="text-xs text-ink/40 mb-1.5">作者</p>
            <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="可选" />
          </label>
        </div>

        <div className="flex gap-4 items-end">
          <label className="flex-1">
            <p className="text-xs text-ink/40 mb-1.5">章节切分</p>
            <select value={mode} onChange={e => setMode(e.target.value)} className="w-full px-3 py-2.5 text-sm">
              <option value="zh">中文书（第X章 / 讲 / 部分）</option>
              <option value="en">英文书（Chapter N）</option>
              <option value="single">全书作为单章</option>
            </select>
          </label>
          <label className="cursor-pointer px-4 py-2.5 text-sm border border-ink/15 rounded-[10px] hover:bg-ink/[0.05] transition-colors">
            打开 .txt
            <input type="file" accept=".txt,text/plain" onChange={onFile} className="hidden" />
          </label>
        </div>

        <label className="block">
          <p className="text-xs text-ink/40 mb-1.5">或直接粘贴正文（当前 {totalChars.toLocaleString()} 字）</p>
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            className="w-full h-44 px-3 py-2.5 text-sm leading-relaxed font-mono"
            placeholder="把书的全文粘贴到这里…"
          />
        </label>

        {err && <p className="text-sm text-bad/80">{err}</p>}

        {chapters === null ? (
          <button onClick={preview} className="px-5 py-2.5 text-sm bg-acc/25 border border-acc/25 rounded-[10px] hover:bg-acc/35 transition-colors">
            预览切分
          </button>
        ) : (
          <>
            <div className="border-t divider pt-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-ink/70">
                  切出 <span className="text-acc">{chapters.length}</span> 章 · 共 {totalChars.toLocaleString()} 字
                </p>
                <button onClick={preview} className="text-xs text-ink/40 hover:text-ink/80 transition-colors">重新切分</button>
              </div>
              {fallback && (
                <p className="mt-2 text-xs text-warn/70">
                  没有识别到章节标记，已回退为「全书单章」。可以换一种切分模式，或直接用全书单章出题。
                </p>
              )}
              <div className="mt-3 max-h-72 overflow-y-auto">
                {chapters.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b divider">
                    <span className="w-8 text-xs text-ink/25">{i + 1}</span>
                    <input
                      value={c.titleInput}
                      onChange={e => setChapters(chapters.map((x, j) => j === i ? { ...x, titleInput: e.target.value } : x))}
                      className="flex-1 px-2.5 py-1.5 text-sm"
                    />
                    <span className="w-20 text-right text-xs text-ink/25">{c.text.length.toLocaleString()} 字</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-acc/25 border border-acc/25 rounded-[10px] hover:bg-acc/35 transition-colors disabled:opacity-50"
            >
              {saving ? '入库中…' : `确认入库（${chapters.length} 章）`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
