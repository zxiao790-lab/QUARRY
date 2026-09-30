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

// 收藏题 · 详情
// 层级（参考 Anki 的渐进揭示）：首屏 = 题目 + 你的作答 + AI 一句话总评；
// 逐条批改 / 延伸讲解 / 标准解析全部折叠，点开才看。
export default function SavedDetail() {
  const { questionId } = useParams()
  const [q, setQ] = useState(null)
  const [tries, setTries] = useState(null) // attempts，时间倒序
  const [err, setErr] = useState('')

  useEffect(() => {
    load()
  }, [questionId])

  async function load() {
    setErr('')
    const { data: question, error } = await supabase
      .from('questions').select('*, chapters(id, book_id, title)').eq('id', questionId).single()
    if (error) { setErr(error.message); setQ(null); setTries([]); return }
    setQ(question)
    const { data: ats } = await supabase
      .from('attempts').select('*').eq('question_id', questionId).order('created_at', { ascending: false })
    setTries(ats || [])
  }

  if (err) return <div className="pt-14 text-sm text-bad/80">{err}</div>
  if (!q || !tries) return <div className="pt-14 text-sm text-ink/30">加载中…</div>

  const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
  const backTo = q.chapters ? `/book/${q.chapters.book_id}` : '/'

  return (
    <div className="pt-14">
      <div className="flex items-baseline justify-between">
        <Link to="/saved" className="text-xs text-ink/35 hover:text-ink/75 transition-colors">← 收藏题</Link>
        {q.knowledge_point && <p className="text-xs text-ink/25 truncate ml-4">{q.knowledge_point}</p>}
      </div>

      {/* 题干 */}
      <h1 className="mt-6 text-[17px] leading-relaxed font-medium">{q.stem}</h1>

      {/* 选项：紧凑一行一项 */}
      <div className="mt-5 border-t divider">
        {options.map((opt, i) => (
          <div key={i} className={`py-3 border-b divider text-[15px] leading-relaxed flex gap-2.5 ${i === q.answer_idx ? 'text-ok' : 'text-ink/70'}`}>
            <span className="text-ink/35">{letterOf(i)}.</span>
            <span className="flex-1">{opt}</span>
            {i === q.answer_idx && <span className="shrink-0">✓</span>}
          </div>
        ))}
      </div>

      {/* 作答回看：她的理由 + AI 一句话总评 */}
      {tries.length > 0 ? (
        <div className="mt-8">
          <p className="text-xs text-ink/35">作答记录 · {tries.length} 次</p>
          {tries.map((a, idx) => {
            const fb = a.feedback || {}
            const issues = Array.isArray(fb.issues) ? fb.issues : []
            return (
              <div key={a.id} className={`pb-6 ${idx > 0 ? 'pt-6 border-t divider mt-6' : ''}`}>
                <p className="text-xs">
                  <span className="text-ink/35">{fmtTime(a.created_at)}</span>
                  <span className="mx-2 text-ink/20">·</span>
                  <span className="text-ink/60">选了 {letterOf(a.choice)}</span>
                  <span className={`ml-2 font-medium ${a.verdict ? 'text-ok' : 'text-bad'}`}>{a.verdict ? '✓ 答对' : '✗ 答错'}</span>
                </p>
                {a.reasoning?.trim() && (
                  <p className="mt-3 text-sm leading-relaxed text-ink/60 border-l-2 border-ink/15 pl-3">{a.reasoning}</p>
                )}
                {fb.verdict_text && (
                  <p className="mt-4 text-[15px] leading-relaxed text-acc/90">{fb.verdict_text}</p>
                )}

                {/* 深度内容全部折叠 */}
                {issues.length > 0 && (
                  <details className="mt-4 group">
                    <summary className="text-xs text-ink/35 cursor-pointer select-none hover:text-ink/70 transition-colors">
                      <span className="inline-block w-3 text-acc/60 group-open:rotate-45 transition-transform">＋</span>
                      {' '}AI 逐条批改 · {issues.length} 条
                    </summary>
                    <div className="mt-3 space-y-4">
                      {issues.map((it, i) => (
                        <div key={i} className="text-sm leading-relaxed">
                          <span className="shrink-0 mr-2 text-[11px] px-1.5 py-0.5 rounded border border-warn/25 text-warn/75">
                            {ISSUE_LABEL[it.type] || '其他'}
                          </span>
                          <span className="text-ink/70">{it.text}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {fb.insight && (
                  <details className="mt-3 group">
                    <summary className="text-xs text-ink/35 cursor-pointer select-none hover:text-ink/70 transition-colors">
                      <span className="inline-block w-3 text-acc/60 group-open:rotate-45 transition-transform">＋</span>
                      {' '}AI 延伸讲解
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-ink/70">{fb.insight}</p>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-8 text-xs text-ink/30">这道题还没有作答记录。</p>
      )}

      {/* 标准解析 + 原文依据 */}
      <details className="mt-2 group border-t divider pt-4">
        <summary className="text-xs text-ink/35 cursor-pointer select-none hover:text-ink/70 transition-colors">
          <span className="inline-block w-3 text-acc/60 group-open:rotate-45 transition-transform">＋</span>
          {' '}标准解析与原文依据
        </summary>
        <p className="mt-4 text-sm leading-relaxed text-ink/70">{q.explanation}</p>
        {q.source_quote && (
          <p className="mt-4 text-sm leading-relaxed text-ink/50 border-l-2 border-ink/15 pl-3">{q.source_quote}</p>
        )}
      </details>

      <div className="mt-12">
        <Link to={backTo} className="text-xs text-ink/25 hover:text-ink/60 transition-colors">
          回到书页
        </Link>
      </div>
    </div>
  )
}
