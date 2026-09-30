import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

// 收藏题库 · 列表：点开看详情（当时的回答 + AI 批改）
export default function Saved() {
  const { bookId } = useParams()
  const [book, setBook] = useState(null)
  const [items, setItems] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    load()
  }, [bookId])

  async function load() {
    setErr('')
    const { data: b } = await supabase.from('books').select('title').eq('id', bookId).single()
    setBook(b || null)
    const { data: chs } = await supabase.from('chapters').select('id,title').eq('book_id', bookId)
    const chMap = Object.fromEntries((chs || []).map(c => [c.id, c.title]))
    const chIds = Object.keys(chMap)
    if (!chIds.length) { setItems([]); return }
    const { data: qs, error } = await supabase
      .from('questions').select('*').in('chapter_id', chIds).eq('collected', true).order('created_at')
    if (error) { setErr(error.message); setItems([]); return }
    setItems((qs || []).map(q => ({ ...q, chTitle: chMap[q.chapter_id] })))
  }

  return (
    <div className="pt-14">
      <Link to={`/book/${bookId}`} className="text-sm text-ink/40 hover:text-ink/80 transition-colors">← 书架</Link>
      <header className="mt-4">
        <h1 className="text-xl font-semibold">收藏题</h1>
        {book && <p className="mt-1 text-xs text-ink/30">《{book.title}》</p>}
      </header>

      <div className="mt-8 border-t divider">
        {items === null && <p className="py-8 text-sm text-ink/30">加载中…</p>}
        {items !== null && items.length === 0 && (
          <p className="py-8 text-sm text-ink/30">还没有收藏。做题时点「☆ 收藏此题」就会出现在这里。</p>
        )}
        {items !== null && items.map(q => (
          <Link
            key={q.id}
            to={`/q/${q.id}`}
            className="block py-4 border-b divider hover:bg-ink/[0.03] transition-colors"
          >
            <p className="text-[15px] leading-relaxed line-clamp-2">{q.stem}</p>
            <p className="mt-1 text-xs text-ink/30">
              {q.chTitle}{q.knowledge_point ? ` · ${q.knowledge_point}` : ''}
            </p>
          </Link>
        ))}
      </div>
      {err && <p className="mt-4 text-sm text-bad/80">{err}</p>}
    </div>
  )
}
