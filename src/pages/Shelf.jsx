import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function Shelf() {
  const [books, setBooks] = useState(null)
  const [err, setErr] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setErr('')
    const { data, error } = await supabase
      .from('books')
      .select('*, chapters(count)')
      .order('created_at', { ascending: false })
    if (error) { setErr(error.message); setBooks([]); return }
    setBooks(data || [])
  }

  return (
    <div className="pt-14">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide">Quarry</h1>
          <p className="mt-1 text-sm text-white/40">采石场 · 把厚书凿成题</p>
        </div>
        <Link to="/settings" className="text-sm text-white/40 hover:text-white/80 transition-colors">设置</Link>
      </header>

      <div className="mt-10 border-t divider">
        {books === null && <p className="py-8 text-sm text-white/30">加载中…</p>}
        {err && <p className="py-8 text-sm text-rose-300/80">{err}</p>}
        {books?.length === 0 && (
          <p className="py-8 text-sm text-white/30">书架空空，导入第一本书吧。</p>
        )}
        {books?.map(b => (
          <button
            key={b.id}
            onClick={() => nav(`/book/${b.id}`)}
            className="block w-full text-left py-5 border-b divider hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[15px]">{b.title}</span>
              <span className="text-xs text-white/30">
                {b.chapters?.[0]?.count ?? 0} 章
              </span>
            </div>
            {b.author && <p className="mt-1 text-xs text-white/30">{b.author}</p>}
          </button>
        ))}
      </div>

      <Link
        to="/import"
        className="mt-8 inline-flex items-center gap-2 text-sm text-violet-300/80 hover:text-violet-200 transition-colors"
      >
        ＋ 导入新书
      </Link>
    </div>
  )
}
