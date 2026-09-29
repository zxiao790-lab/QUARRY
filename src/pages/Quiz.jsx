import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import QuizFlow from '../components/QuizFlow.jsx'

export default function Quiz() {
  const { chapterId } = useParams()
  const nav = useNavigate()
  const [chapter, setChapter] = useState(null)
  const [questions, setQuestions] = useState(null)

  useEffect(() => {
    load()
  }, [chapterId])

  async function load() {
    const { data: ch } = await supabase.from('chapters').select('*').eq('id', chapterId).single()
    setChapter(ch || null)
    const { data: qs } = await supabase
      .from('questions').select('*').eq('chapter_id', chapterId).order('idx')
    setQuestions(qs || [])
  }

  if (!chapter || !questions) {
    return <div className="pt-14 text-sm text-white/30">加载中…</div>
  }

  return (
    <QuizFlow
      questionsIn={questions}
      ordered
      title={`${chapter.title}`}
      onDone={() => nav(`/book/${chapter.book_id}`)}
    />
  )
}
