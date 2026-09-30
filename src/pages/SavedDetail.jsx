import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { stripOptionNotes } from '../lib/text.js'

const ISSUE_LABEL = {
  misunderstand: '概念误解',
  gap: '关键缺失',
  wrong_link: '因果链错误',
}

const LETTER = ['A', 'B', 'C', 'D']

function letterOf(i) {
  return LETTER[i] ?? '?'
}

// 收藏题 · 详情
// 层级：题干 + 选项（正确绿/你选的红，带淡底）→ 作答记录（理由 + AI批改折叠）
// → 原文依据（宋体引用块，直接展示）→ 标准解析（默认 3 行，可展开）
export default function SavedDetail() {
  const { questionId } = useParams()
  const [q, setQ] = useState(null)
  const [tries, setTries] = useState(null) // attempts，时间倒序
  const [exp, setExp] = useState(false) // 标准解析是否展开
  const [err, setErr] = useState('')

  useEffect(() => {
    load()
  }, [questionId])

  async function load() {
    setErr('')
    const { data: question, error } = await supabase
      .from('questions').select('*, chapters(id, book_id, title)').eq('id', questionId).single()
    if (error) { setErr(error.message); return }
    setQ(question || null)
    const { data: ats } = await supabase
      .from('attempts').select('*').eq('question_id', questionId).order('created_at', { ascending: false })
    setTries(ats || [])
  }

  if (err) return <div className="pt-14 text-sm text-bad/80">{err}</div>
  if (!q) return <div className="pt-14 text-sm text-ink/30">加载中…</div>

  const backTo = `/book/${q.chapters?.book_id}`
  const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
  const optionNotes = typeof q.option_notes === 'string' ? JSON.parse(q.option_notes) : (q.option_notes || [])
  const latest = tries?.[0]

  return (
    <div className="pt-14">
      <div className="flex items-baseline justify-between">
        <Link to={backTo} className="text-xs text-ink/25 hover:text-ink/60 transition-colors">← 收藏题</Link>
        {q.chapters?.title && <p className="text-xs text-ink/25">{q.chapters.title}</p>}
      </div>
      {q.knowledge_point && <p className="mt-2 text-xs text-ink/35">知识点 · {q.knowledge_point}</p>}

      {/* 题干 */}
      <h1 className="mt-4 text-xl font-medium leading-relaxed">{q.stem}</h1>

      {/* 选项：正确=淡绿底绿字，你选的=淡红底红字 */}
      <div className="mt-6">
        {options.map((opt, i) => {
          const isAnswer = i === q.answer
          const isMine = latest && latest.choice === i
          return (
            <div
              key={i}
              className={`flex gap-3 py-3.5 px-3 ${isAnswer ? 'bg-ok/[0.08] rounded-lg' : isMine ? 'bg-bad/[0.08] rounded-lg' : ''} ${i < options.length - 1 ? 'mb-px border-b divider' : ''}`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-xs mt-0.5
                  ${isAnswer ? 'border-ok/60 text-ok' : isMine ? 'border-bad/60 text-bad' : 'border-ink/20 text-ink/45'}`}
              >
                {LETTER[i]}
              </span>
              <div className="flex-1">
                <p className={`text-[15px] leading-relaxed ${isAnswer ? 'text-ok' : isMine ? 'text-bad' : 'text-ink/80'}`}>{opt}</p>
                {optionNotes[i] && (
                  <p className="mt-1 text-xs leading-relaxed text-ink/40">{optionNotes[i]}</p>
                )}
                {isAnswer && (
                  <span className="inline-block mt-1.5 text-[11px] px-1.5 py-0.5 rounded border border-ok/30 text-ok/90">✓ 正确答案</span>
                )}
                {isMine && !isAnswer && (
                  <span className="inline-block mt-1.5 text-[11px] px-1.5 py-0.5 rounded border border-bad/30 text-bad/90">你的选择</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 作答记录：理由 + AI批改折叠（状态信息选项区已标出，不再重复） */}
      {tries !== null && tries.length > 0 && (
        <div className="mt-10">
          <h2 className="text-[15px] font-medium border-l-2 border-acc/60 pl-2.5">作答记录</h2>
          {tries.map((t, i) => {
            let fb = null
            try { fb = typeof t.feedback === 'string' ? JSON.parse(t.feedback) : t.feedback } catch { fb = null }
            const hasFb = fb && (fb.verdict_text || fb.insight || (fb.issues && fb.issues.length))
            const issues = fb?.issues || []
            return (
              <div key={i} className="mt-5">
                {t.reasoning && (
                  <p className="text-sm leading-relaxed text-ink/70 border-l-2 border-ink/15 pl-3">{t.reasoning}</p>
                )}
                {hasFb && (
                  <details className="group mt-4">
                    <summary className="flex items-center justify-between cursor-pointer select-none">
                      <span className="flex items-center gap-2 text-sm text-acc/85">
                        <span className="w-1.5 h-1.5 rounded-full bg-acc/50"></span>
                        AI 批改
                      </span>
                      <span className="text-ink/30 text-sm group-open:hidden">＋</span>
                      <span className="text-ink/30 text-sm hidden group-open:inline">－</span>
                    </summary>
                    <div className="mt-4">
                      {fb.verdict_text && <p className="text-[15px] leading-relaxed text-ink/85">{fb.verdict_text}</p>}
                      {issues.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {issues.map((it, k) => (
                            <div key={k} className="text-sm leading-relaxed">
                              <span className="shrink-0 mr-2 text-[11px] px-1.5 py-0.5 rounded border border-warn/25 text-warn/75">
                                {ISSUE_LABEL[it.type] || '其他'}
                              </span>
                              <span className="text-ink/70">{it.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}
      {tries !== null && tries.length === 0 && (
        <p className="mt-10 text-xs text-ink/30">这道题还没有作答记录。</p>
      )}

      {/* 原文解析：与作答记录同板块层级；补充讲解（学习材料）跟在其后 */}
      {(q.quote || q.source_note) && (
        <div className="mt-10">
          <h2 className="text-[15px] font-medium border-l-2 border-acc/60 pl-2.5">原文解析</h2>
          {q.quote && (
            <p className="mt-4 font-song text-[15px] leading-relaxed text-ink/60 border-l-2 border-ink/15 pl-3">{q.quote}</p>
          )}
          {q.source_note && (
            <p className="mt-3 text-sm leading-relaxed text-ink/55">{q.source_note}</p>
          )}
        </div>
      )}
      {(() => {
        const latestFb = tries?.[0] ? (typeof tries[0].feedback === 'string' ? (() => { try { return JSON.parse(tries[0].feedback) } catch { return null } })() : tries[0].feedback) : null
        if (!latestFb?.insight) return null
        return (
          <div className="mt-8">
            <p className="text-xs text-ink/40 mb-2">补充讲解</p>
            <p className="text-sm leading-relaxed text-ink/75">{latestFb.insight}</p>
          </div>
        )
      })()}

      {/* 标准解析：默认 3 行，可展开 */}
      {q.explanation && (
        <div className="mt-8">
          <p className="text-xs text-ink/40 mb-2">标准解析</p>
          <p className={`text-sm leading-relaxed text-ink/70 ${exp ? '' : 'line-clamp-3'}`}>{q.explanation}</p>
          {stripOptionNotes(q.explanation).length > 90 && !exp && (
            <button onClick={() => setExp(true)} className="mt-2 text-xs text-acc/80 hover:text-acc transition-colors">
              展开更多
            </button>
          )}
        </div>
      )}

      <div className="mt-12">
        <Link to={backTo} className="text-xs text-ink/25 hover:text-ink/60 transition-colors">
          回到书页
        </Link>
      </div>
    </div>
  )
}
