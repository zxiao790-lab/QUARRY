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

// 折叠行：• 标题 …… 右侧 ＋/－
function Fold({ label, children, defaultOpen = false }) {
  return (
    <details className="group border-t divider pt-4 mt-4" open={defaultOpen}>
      <summary className="flex items-center justify-between cursor-pointer select-none">
        <span className="flex items-center gap-2 text-sm text-acc/85">
          <span className="w-1.5 h-1.5 rounded-full bg-acc/50"></span>
          {label}
        </span>
        <span className="text-ink/30 text-sm group-open:hidden">＋</span>
        <span className="text-ink/30 text-sm hidden group-open:inline">－</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  )
}

// 收藏题 · 详情
// 结构参照她给的设计稿：题干 → 选项（状态徽章）→ 作答记录（理由 + AI 批改折叠）
// → 原文依据折叠 → 标准解析折叠。视觉保持分割线风格，无卡片。
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
    if (error || !question) { setErr('题目加载失败'); return }
    setQ(question)
    const { data: ats } = await supabase
      .from('attempts').select('*').eq('question_id', questionId).order('created_at', { ascending: false })
    setTries(ats || [])
  }

  if (err) {
    return (
      <div className="pt-14">
        <Link to="/"><p className="text-xs text-ink/30">← 书架</p></Link>
        <p className="mt-6 text-sm text-bad/80">{err}</p>
      </div>
    )
  }
  if (!q) return <div className="pt-14 text-sm text-ink/30">加载中…</div>

  const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
  const backTo = `/book/${q.chapters?.book_id}`
  const latest = tries && tries.length ? tries[0] : null // 最近一次作答，用于选项标色

  return (
    <div className="pt-14">
      <div className="flex items-baseline justify-between">
        <Link to={backTo} className="text-xs text-ink/35 hover:text-ink/70 transition-colors">← 收藏题</Link>
        {q.knowledge_point && <p className="text-xs text-ink/30">{q.knowledge_point}</p>}
      </div>

      {/* 题干 */}
      <h1 className="mt-5 text-xl font-medium leading-relaxed">{q.stem}</h1>

      {/* 选项：正确项绿 + 徽章，你选的（最近一次）红 + 徽章 */}
      <div className="mt-4">
        {options.map((opt, i) => {
          const isAnswer = i === q.answer
          const isMine = latest && latest.choice === i
          return (
            <div key={i} className="flex gap-3.5 py-4 border-b divider">
              <span className={`shrink-0 mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center text-xs
                ${isAnswer ? 'border-ok/60 text-ok' : isMine ? 'border-bad/60 text-bad' : 'border-ink/20 text-ink/40'}`}>
                {letterOf(i)}
              </span>
              <div className="flex-1">
                <p className={`text-[15px] leading-relaxed ${isAnswer ? 'text-ok' : isMine ? 'text-bad' : 'text-ink/85'}`}>
                  {opt}
                </p>
                {isAnswer && (
                  <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full border border-ok/35 text-ok/90">✓ 正确答案</span>
                )}
                {isMine && !isAnswer && (
                  <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full border border-bad/35 text-bad/90">你的选择</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 作答记录 */}
      {tries && tries.length > 0 ? (
        <div className="mt-12">
          <h2 className="text-base font-medium border-l-2 border-acc/60 pl-2.5">
            作答记录{tries.length > 1 ? ` · ${tries.length} 次` : ''}
          </h2>
          {tries.map((t, i) => {
            const fb = t.feedback || {}
            const issues = Array.isArray(fb.issues) ? fb.issues : []
            return (
              <div key={i} className={i > 0 ? 'mt-8' : 'mt-6'}>
                <p className="text-xs text-ink/35">
                  {fmtTime(t.created_at)} · 选了 {letterOf(t.choice)} · {t.verdict ? '✓ 答对' : '✗ 答错'}
                </p>
                {t.reasoning && (
                  <p className="mt-3 text-sm leading-relaxed text-ink/70 border-l-2 border-ink/15 pl-3">{t.reasoning}</p>
                )}
                {(fb.verdict_text || issues.length > 0 || fb.insight) && (
                  <Fold label="AI 批改">
                    {fb.verdict_text && (
                      <p className="text-[15px] leading-relaxed text-ink/85">{fb.verdict_text}</p>
                    )}
                    {issues.length > 0 && (
                      <div className={fb.verdict_text ? 'mt-4 space-y-3' : 'space-y-3'}>
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
                    {fb.insight && (
                      <p className="mt-4 text-sm leading-relaxed text-ink/60">{fb.insight}</p>
                    )}
                  </Fold>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-12 text-xs text-ink/30">这道题还没有作答记录。</p>
      )}

      {/* 原文依据 / 标准解析 */}
      {q.quote && (
        <div className="mt-12">
          <Fold label="原文依据">
            <p className="text-sm leading-relaxed text-ink/55 border-l-2 border-ink/15 pl-3">{q.quote}</p>
          </Fold>
        </div>
      )}
      <div className={q.quote ? '' : 'mt-12'}>
        <Fold label="标准解析">
          <p className="text-sm leading-relaxed text-ink/70">{q.explanation}</p>
        </Fold>
      </div>

      <div className="mt-12">
        <Link to={backTo} className="text-xs text-ink/25 hover:text-ink/60 transition-colors">
          回到书页
        </Link>
      </div>
    </div>
  )
}
