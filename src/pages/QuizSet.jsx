import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import QuizFlow from '../components/QuizFlow.jsx'

// 错题重刷 · 打乱顺序刷题库里的错题
// 刷对了会自动更新 last_verdict = true → 自动退出错题集
export default function QuizSet() {
  const { bookId } = useParams()
  const nav = useNavigate()
  const [questions, setQuestions] = useState(null)

  useEffect(() => {
    load()
  }, [bookId])

  async function load() {
    const { data: chs } = await supabase.from('chapters').select('id').eq('book_id', bookId)
    const chIds = (chs || []).map(c => c.id)
    if (!chIds.length) { setQuestions([]); return }
    const { data: qs } = await supabase
      .from('questions').select('*').in('chapter_id', chIds).eq('last_verdict', false)
    setQuestions(qs || [])
  }

  if (questions === null) {
    return <div className="pt-14 text-sm text-ink/30">加载中…</div>
  }

  return (
    <QuizFlow
      questionsIn={questions}
      ordered={false}
      scope={`wrong:${bookId}`}
      title="错题重刷 · 打乱顺序"
      onDone={() => nav(`/book/${bookId}`)}
      onExit={() => nav(`/book/${bookId}`)}
    />
  )
}
