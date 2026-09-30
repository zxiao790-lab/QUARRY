import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

const ISSUE_LABEL = {
  misunderstand: '概念误解',
  gap: '关键缺失',
  wrong_link: '因果链错误',
}

function letterOf(i) {
  return ['A', 'B', 'C', 'D'][i] ?? '?'
}

function fmtTime(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 收藏题 · 详情：题目 + 每一次作答（你的理由 / AI 批改）按时间倒序
export default function SavedDetail() {
  const { questionId } = useParams()
  const [q, setQ] = useState(null)
  const [tries, setTries] = useState(null) // attempts
  const [err, setErr] = useState('')

  useEffect(() => {
    load()
  }, [questionId])

  async function load() {
    setErr('')
    const { data: question, error } = await supabase
      .from('questions').select('*, chapters(id, book_id, title)').eq('id', questionId).single()
    if (error || !question) { setErr(error?.message || '题目不存在'); return }
    setQ(question)
    const { data: at } = await supabase
      .from('attempts').select('*').eq('question_id', questionId).order('created_at', { ascending: false })
    setTries(at || [])
  }

  if (err) {
    return (
      <div className="pt-14">
        <Link to="/" className="text-sm text-ink/40 hover:text-ink/80 transition-colors">← 书架</Link>
        <p className="mt-6 text-sm text-bad/80">{err}</p>
      </div>
    )
  }
  if (!q) return <div className="pt-14 text-sm text-ink/30">加载中…</div>

  const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
  const backTo = q.chapters ? `/book/${q.chapters.book_id}` : '/'

  return (
    <div className="pt-14">
      <Link to={q.chapters ? `/saved/${q.chapters.book_id}` : '/'} className="text-sm text-ink/40 hover:text-ink/80 transition-colors">
        ← 收藏题
      </Link>
      <header className="mt-4">
        {q.knowledge_point && <p className="text-xs text-ink/35">知识点 · {q.knowledge_point}</p>}
        <h1 className="mt-2 text-lg font-medium leading-relaxed">{q.stem}</h1>
      </header>

      <div className="mt-5 border-t divider">
        {options.map((o, i) => (
          <div key={i} className={`py-3 border-b divider text-[15px] leading-relaxed ${i === q.answer ? 'text-ok' : 'text-ink/70'}`}>
            <span className="mr-2 text-ink/35">{letterOf(i)}.</span>
            {o}
            {i === q.answer && <span className="ml-2 text-xs">✓ 正确答案</span>}
          </div>
        ))}
      </div>

      <div className="mt-6 border-t divider pt-5">
        <p className="text-xs text-ink/40 mb-2">标准解析</p>
        <p className="text-sm leading-relaxed text-ink/70">{q.explanation}</p>
      </div>
      {q.quote && (
        <div className="mt-6 border-t divider pt-5">
          <p className="text-xs text-ink/40 mb-2">原文依据</p>
          <p className="text-sm leading-relaxed text-ink/60 border-l-2 border-ink/15 pl-3">{q.quote}</p>
        </div>
      )}

      <div className="mt-8 border-t divider pt-5">
        <p className="text-xs text-ink/40">
          作答记录{tries !== null && ` · ${tries.length} 次`}
        </p>
        {tries === null && <p className="mt-3 text-sm text-ink/30">加载中…</p>}
        {tries !== null && tries.length === 0 && (
          <p className="mt-3 text-sm text-ink/30">这道题还没做过。</p>
        )}
        {tries !== null && tries.map(t => {
          const fb = t.feedback || {}
          const issues = Array.isArray(fb.issues) ? fb.issues : []
          return (
            <div key={t.id} className="mt-5 pb-5 border-b divider last:border-b-0">
              <div className="flex items-baseline justify-between">
                <p className={`text-xs ${t.verdict ? 'text-ok/85' : 'text-bad/85'}`}>
                  {fmtTime(t.created_at)} · 选了 {letterOf(t.choice)} · {t.verdict ? '✓ 答对' : '✗ 答错'}
                </p>
              </div>
              {t.reasoning && (
                <p className="mt-2 text-sm leading-relaxed text-ink/60 border-l-2 border-ink/15 pl-3">{t.reasoning}</p>
              )}
              {fb.verdict_text && <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{fb.verdict_text}</p>}
              {issues.length > 0 && (
                <div className="mt-3 space-y-2">
                  {issues.map((it, i) => (
                    <div key={i} className="text-sm leading-relaxed">
                      <span className="shrink-0 mr-2 text-[11px] px-1.5 py-0.5 rounded border border-warn/25 text-warn/75">
                        {ISSUE_LABEL[it.type] || '其他'}
                      </span>
                      <span className="text-ink/70">{it.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {fb.insight && <p className="mt-3 text-sm leading-relaxed text-ink/75">{fb.insight}</p>}
            </div>
          )
        })}
      </div>

      <div className="mt-10">
        <Link to={backTo} className="text-xs text-ink/25 hover:text-ink/60 transition-colors">
          回到书页
        </Link>
      </div>
    </div>
  )
}
