import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import QuizFlow from '../components/QuizFlow.jsx'

// 错题重刷 / 收藏题 —— 打乱顺序刷
// 错题判定：last_verdict = false（最近一次作答错了）
// 刷对了会自动更新 last_verdict = true → 自动退出错题集
export default function QuizSet() {
  const { bookId } = useParams()
  const [params] = useSearchParams()
  const type = params.get('type') === 'saved' ? 'saved' : 'wrong'
  const nav = useNavigate()
  const [questions, setQuestions] = useState(null)

  useEffect(() => {
    load()
  }, [bookId, type])

  async function load() {
    const { data: chs } = await supabase.from('chapters').select('id').eq('book_id', bookId)
    const chIds = (chs || []).map(c => c.id)
    if (!chIds.length) { setQuestions([]); return }

    let query = supabase.from('questions').select('*').in('chapter_id', chIds)
    query = type === 'saved' ? query.eq('collected', true) : query.eq('last_verdict', false)
    const { data: qs } = await query
    setQuestions(qs || [])
  }

  if (questions === null) {
    return <div className="pt-14 text-sm text-white/30">加载中…</div>
  }

  return (
    <QuizFlow
      questionsIn={questions}
      ordered={false}
      title={type === 'saved' ? '收藏题 · 打乱重刷' : '错题重刷 · 打乱顺序'}
      onDone={() => nav(`/book/${bookId}`)}
    />
  )
}
