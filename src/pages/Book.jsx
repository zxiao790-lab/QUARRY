import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, aiProxy } from '../lib/supabase.js'

export default function Book() {
  const { id } = useParams()
  const nav = useNavigate()
  const [book, setBook] = useState(null)
  const [chapters, setChapters] = useState([])
  const [wrongCount, setWrongCount] = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  const [generating, setGenerating] = useState(null) // 正在生成的章节 id
  const [genMsg, setGenMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data: b } = await supabase.from('books').select('*').eq('id', id).single()
    setBook(b || null)
    const { data: chs } = await supabase
      .from('chapters').select('*, questions(count)')
      .eq('book_id', id).order('idx')
    setChapters(chs || [])
    // 错题 / 收藏数量
    const chIds = (chs || []).map(c => c.id)
    if (chIds.length) {
      const [{ count: wc }, { count: sc }] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true })
          .in('chapter_id', chIds).eq('last_verdict', false),
        supabase.from('questions').select('id', { count: 'exact', head: true })
          .in('chapter_id', chIds).eq('collected', true),
      ])
      setWrongCount(wc || 0)
      setSavedCount(sc || 0)
    } else {
      setWrongCount(0); setSavedCount(0)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function generate(chapterId, chapterTitle) {
    setErr('')
    setGenerating(chapterId)
    setGenMsg(`正在读《${chapterTitle}》，提取知识点出题…（约半分钟）`)
    try {
      const r = await aiProxy('generate', { chapter_id: chapterId, count: 5 })
      setGenMsg(`已生成 ${r.count} 道题`)
      await load()
    } catch (e) {
      setErr(e.message)
      setGenMsg('')
    } finally {
      setGenerating(null)
    }
  }

  async function deleteBook() {
    const { error } = await supabase.from('books').delete().eq('id', id)
    if (error) { setErr(error.message); return }
    nav('/')
  }

  if (!book) return <div className="pt-14 text-sm text-white/30">加载中…</div>

  return (
    <div className="pt-14">
      <button onClick={() => nav('/')} className="text-sm text-white/40 hover:text-white/80 transition-colors">← 书架</button>
      <header className="mt-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">{book.title}</h1>
          {book.author && <p className="mt-1 text-xs text-white/30">{book.author}</p>}
        </div>
        <div className="flex gap-4 text-sm">
          <Link
            to={`/set/${id}?type=wrong`}
            className={`transition-colors ${wrongCount ? 'text-rose-300/80 hover:text-rose-200' : 'text-white/20 pointer-events-none'}`}
          >
            错题重刷 {wrongCount ? `(${wrongCount})` : ''}
          </Link>
          <Link
            to={`/set/${id}?type=saved`}
            className={`transition-colors ${savedCount ? 'text-amber-200/80 hover:text-amber-100' : 'text-white/20 pointer-events-none'}`}
          >
            收藏题 {savedCount ? `(${savedCount})` : ''}
          </Link>
        </div>
      </header>

      <div className="mt-8 border-t divider">
        {chapters.map((c, i) => {
          const n = c.questions?.[0]?.count ?? 0
          const busy = generating === c.id
          return (
            <div key={c.id} className="py-4 border-b divider">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] truncate">{i + 1}. {c.title}</p>
                  <p className="mt-0.5 text-xs text-white/30">
                    {c.raw_text.length.toLocaleString()} 字
                    {n > 0 && <> · {n} 道题</>}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  {busy ? (
                    <span className="text-xs text-violet-300/80 animate-pulse">出题中…</span>
                  ) : n === 0 ? (
                    <button
                      onClick={() => generate(c.id, c.title)}
                      className="px-3.5 py-1.5 text-xs bg-violet-500/25 border border-violet-300/25 rounded-lg hover:bg-violet-500/35 transition-colors"
                    >
                      生成题目
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => generate(c.id, c.title)}
                        className="text-xs text-white/40 hover:text-white/80 transition-colors"
                      >
                        +5
                      </button>
                      <Link
                        to={`/quiz/${c.id}`}
                        className="px-3.5 py-1.5 text-xs bg-white/[0.06] border border-white/12 rounded-lg hover:bg-white/[0.1] transition-colors"
                      >
                        开始学习
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {chapters.length === 0 && <p className="py-8 text-sm text-white/30">这本书还没有章节。</p>}
      </div>

      {genMsg && (
        <p className={`mt-4 text-xs text-violet-300/80 ${generating ? 'animate-pulse' : ''}`}>{genMsg}</p>
      )}
      {err && <p className="mt-4 text-sm text-rose-300/80">{err}</p>}

      <div className="mt-16 pt-4 border-t divider">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-white/25 hover:text-rose-300/70 transition-colors">
            删除这本书
          </button>
        ) : (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-white/50">删除后书、章节、题目、作答记录全部消失，不可恢复。</span>
            <button onClick={deleteBook} className="text-rose-300/90 hover:text-rose-200 font-medium">确认删除</button>
            <button onClick={() => setConfirmDelete(false)} className="text-white/40 hover:text-white/80">取消</button>
          </div>
        )}
      </div>
    </div>
  )
}
