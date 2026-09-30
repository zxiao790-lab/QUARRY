import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import QuizFlow from '../components/QuizFlow.jsx'

// 章节学习：只出没做过的题（按 attempts 判断），从第一道新题接上。
// 整章做完 → 明确告知，可一键从头再刷（历史作答保留，重做只是追加记录）。
export default function Quiz() {
  const { chapterId } = useParams()
  const nav = useNavigate()
  const [chapter, setChapter] = useState(null)
  const [fresh, setFresh] = useState(null) // 没做过的题
  const [all, setAll] = useState(null) // 全部题（重刷用）
  const [redo, setRedo] = useState(false)

  useEffect(() => {
    load()
  }, [chapterId])

  async function load() {
    const { data: ch } = await supabase.from('chapters').select('*').eq('id', chapterId).single()
    setChapter(ch || null)
    const { data: qs } = await supabase
      .from('questions').select('*').eq('chapter_id', chapterId).order('idx')
    const list = qs || []
    setAll(list)
    const ids = list.map(q => q.id)
    let done = new Set()
    if (ids.length) {
      const { data: ats } = await supabase.from('attempts').select('question_id').in('question_id', ids)
      done = new Set((ats || []).map(a => a.question_id))
    }
    setFresh(list.filter(q => !done.has(q.id)))
  }

  if (!chapter || !all || !fresh) {
    return <div className="pt-14 text-sm text-ink/30">加载中…</div>
  }

  if (!redo && fresh.length === 0) {
    if (all.length === 0) {
      return (
        <div className="pt-20 text-center">
          <p className="text-2xl font-medium">这一章还没有题目</p>
          <button onClick={() => nav(`/book/${chapter.book_id}`)} className="mt-6 text-sm text-acc hover:text-acc/80 transition-colors">
            返回书页生成题目
          </button>
        </div>
      )
    }
    return (
      <div className="pt-20 text-center">
        <p className="text-2xl font-medium">这一章都学完了</p>
        <p className="mt-3 text-sm text-ink/45">{chapter.title} · 共 {all.length} 题，作答都已存档。</p>
        <p className="mt-1 text-sm text-ink/45">答错的会出现在错题重刷里。</p>
        <div className="mt-8 flex items-center justify-center gap-5">
          <button
            onClick={() => setRedo(true)}
            className="px-5 py-2.5 text-sm bg-acc/25 border border-acc/25 rounded-[10px] hover:bg-acc/35 transition-colors"
          >
            从头再刷一遍
          </button>
          <button onClick={() => nav(`/book/${chapter.book_id}`)} className="text-sm text-ink/40 hover:text-ink/80 transition-colors">
            返回
          </button>
        </div>
      </div>
    )
  }

  return (
    <QuizFlow
      questionsIn={redo ? all : fresh}
      ordered
      scope={redo ? null : `chapter:${chapterId}`}
      title={redo ? `${chapter.title} · 重刷` : `${chapter.title}`}
      onDone={() => nav(`/book/${chapter.book_id}`)}
      onExit={() => nav(`/book/${chapter.book_id}`)}
    />
  )
}
