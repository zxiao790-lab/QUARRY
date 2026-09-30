import { useEffect, useMemo, useRef, useState } from 'react'
import { aiProxy, supabase } from '../lib/supabase.js'

const ISSUE_LABEL = {
  misunderstand: '概念误解',
  gap: '关键缺失',
  wrong_link: '因果链错误',
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function QuizFlow({ questionsIn, title, ordered = true, onDone, scope, onExit }) {
  const [order, setOrder] = useState(null) // 题目 id 顺序（恢复进度时来自快照）
  const [ready, setReady] = useState(false)
  const [idx, setIdx] = useState(0)
  const [choice, setChoice] = useState(null)
  const [reasoning, setReasoning] = useState('')
  const [grading, setGrading] = useState(false)
  const [result, setResult] = useState(null) // aiProxy('grade') 的返回
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  const [finished, setFinished] = useState(false)
  const [hint, setHint] = useState('') // 恢复进度提示

  // 顺序：先按恢复快照，否则按 ordered/shuffle 生成；集合变化时新题追加
  const questions = useMemo(() => {
    const byId = new Map(questionsIn.map(x => [x.id, x]))
    let list = order ? order.map(id => byId.get(id)).filter(Boolean) : (ordered ? [...questionsIn] : shuffle(questionsIn))
    for (const x of questionsIn) if (!list.find(y => y.id === x.id)) list.push(x)
    return list
  }, [order, questionsIn, ordered])

  const q = questions[idx]
  const qIdRef = useRef(null)
  const restoredRef = useRef(null)

  // 挂载：读取云端进度，恢复位置与草稿
  useEffect(() => {
    let alive = true
    ;(async () => {
      let prog = null
      let loadErr = null
      if (scope) {
        const { data, error } = await supabase.from('quiz_progress').select('*').eq('scope', scope).maybeSingle()
        prog = data
        loadErr = error
      }
      if (!alive) return
      if (loadErr) {
        setHint('进度同步不可用（' + (loadErr.message || '未知错误') + '），答题仍在继续')
        return
      }
      if (prog?.order_json) setOrder(prog.order_json)
      if (prog) {
        let list = null
        if (prog.order_json) {
          list = prog.order_json.map(id => questionsIn.find(x => x.id === id)).filter(Boolean)
          if (!list.length) list = null
        }
        const n = list ? list.length : questionsIn.length
        const i = Math.min(Math.max(0, prog.idx), n - 1)
        setIdx(i)
        if (list) restoredRef.current = list[i]?.id || null
        if (prog.draft) {
          if (typeof prog.draft.choice === 'number') setChoice(prog.draft.choice)
          setReasoning(prog.draft.reasoning || '')
          if (prog.draft.result) setResult(prog.draft.result)
        }
        if (prog.idx > 0 || prog.draft) {
          setHint(`已恢复进度 · 第 ${i + 1} / ${n} 题`)
          setTimeout(() => alive && setHint(''), 4000)
        }
      }
      setReady(true)
    })()
    return () => { alive = false }
  }, [scope, questionsIn])

  // 云端进度：静默自动保存（翻题立即存；草稿停顿后存）
  function saveProgress(i, d) {
    if (!scope || !ready) return
    supabase.from('quiz_progress').upsert({
      scope,
      idx: i,
      order_json: order || questions.map(x => x.id),
      draft: d,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'scope' }).then(({ error }) => {
      if (error) console.warn('[进度保存失败]', error.message)
    })
  }

  const hasDraft = choice !== null || reasoning !== '' || !!result
  useEffect(() => {
    if (!ready || !q) return
    const t = setTimeout(() => saveProgress(idx, hasDraft ? { choice, reasoning, result } : null), 700)
    return () => clearTimeout(t)
  }, [choice, reasoning, result, idx, ready, q?.id])

  // 换题时重置本轮状态（恢复落点除外）
  useEffect(() => {
    if (!q) return
    if (qIdRef.current === null || qIdRef.current === restoredRef.current) {
      qIdRef.current = q.id
      return
    }
    if (qIdRef.current === q.id) return
    qIdRef.current = q.id
    setSaved(!!q.collected)
    setChoice(null)
    setReasoning('')
    setResult(null)
    setErr('')
  }, [q?.id])

  if (finished) {
    return (
      <div className="pt-20 text-center">
        <p className="text-2xl font-medium">这一轮凿完了</p>
        <p className="mt-3 text-sm text-ink/45">共 {questions.length} 题，理由都已存档。</p>
        <button
          onClick={onDone}
          className="mt-8 px-5 py-2.5 text-sm bg-acc/25 border border-acc/25 rounded-[10px] hover:bg-acc/35 transition-colors"
        >
          返回
        </button>
      </div>
    )
  }

  if (!questions.length) {
    return <p className="pt-14 text-sm text-ink/30">这里没有可刷的题。</p>
  }

  const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options

  async function submit() {
    setErr('')
    setGrading(true)
    try {
      const r = await aiProxy('grade', { question_id: q.id, choice, reasoning })
      setResult(r)
    } catch (e) {
      setErr(e.message)
    } finally {
      setGrading(false)
    }
  }

  async function toggleCollect() {
    const next = !saved
    setSaved(next)
    const { error } = await supabase.from('questions').update({ collected: next }).eq('id', q.id)
    if (error) setSaved(!next) // 失败回滚
  }

  function next() {
    if (idx + 1 >= questions.length) {
      setFinished(true)
      if (scope) supabase.from('quiz_progress').delete().eq('scope', scope) // 做完清进度
      return
    }
    const nIdx = idx + 1
    setIdx(nIdx)
    saveProgress(nIdx, null) // 翻题立即落库
  }

  return (
    <div className="pt-14">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-4 min-w-0">
          {onExit && (
            <button onClick={onExit} className="shrink-0 text-xs text-ink/35 hover:text-ink/75 transition-colors">
              ← 退出
            </button>
          )}
          <p className="text-xs text-ink/35 truncate">{title}</p>
        </div>
        <p className="shrink-0 ml-4 text-xs text-ink/35">{idx + 1} / {questions.length}</p>
      </div>
      <div className="mt-2 h-px bg-ink/10">
        <div
          className="h-px bg-acc/60 transition-all duration-500"
          style={{ width: `${((idx + (result ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>
      {hint && <p className="mt-3 text-xs text-acc/70">{hint}</p>}

      {q.knowledge_point && (
        <p className="mt-6 text-xs text-ink/35">知识点 · {q.knowledge_point}</p>
      )}
      <h2 className="mt-2 text-[17px] leading-relaxed font-medium">{q.stem}</h2>

      {/* 选项 */}
      <div className="mt-6 border-t divider">
        {options.map((opt, i) => {
          const isChoice = choice === i
          const isAnswer = result && i === q.answer
          const isWrongPick = result && isChoice && i !== q.answer
          return (
            <button
              key={i}
              disabled={!!result || grading}
              onClick={() => setChoice(i)}
              className={`block w-full text-left py-3.5 px-3 border-b divider text-[15px] leading-relaxed transition-colors
                ${result ? 'cursor-default' : 'hover:bg-ink/[0.03]'}
                ${isAnswer ? 'text-ok' : ''}
                ${isWrongPick ? 'text-bad' : ''}
                ${!result && isChoice ? 'bg-acc/15 text-acc' : ''}`}
            >
              <span className="mr-2 text-ink/35">{['A', 'B', 'C', 'D'][i]}.</span>
              {opt}
              {isAnswer && <span className="ml-2 text-xs">✓ 正确答案</span>}
              {isWrongPick && <span className="ml-2 text-xs">你的选择</span>}
            </button>
          )
        })}
      </div>

      {/* 理由输入 */}
      {!result && (
        <div className="mt-6">
          <label className="block">
            <p className="text-xs text-ink/45 mb-2">
              你的选择理由 <span className="text-ink/25">（必须填写 · 因果、机制、印象来源都可以）</span>
            </p>
            <textarea
              value={reasoning}
              onChange={e => setReasoning(e.target.value)}
              disabled={grading}
              className="w-full h-32 px-3.5 py-3 text-sm leading-relaxed"
              placeholder="我选这个，是因为…"
            />
          </label>
          {err && <p className="mt-3 text-sm text-bad/80">{err}</p>}
          <button
            onClick={submit}
            disabled={grading || choice === null || !reasoning.trim()}
            className="mt-4 px-5 py-2.5 text-sm bg-acc/25 border border-acc/25 rounded-[10px] hover:bg-acc/35 transition-colors disabled:opacity-30"
          >
            {grading ? 'AI 正在读你的理由…' : '提交，让 AI 批改'}
          </button>
        </div>
      )}

      {/* 批改结果 */}
      {result && (() => {
        const fb = result.attempt?.feedback || {}
        const issues = Array.isArray(fb.issues) ? fb.issues : []
        const valid = result.verdict && fb.reasoning_valid !== false
        return (
          <div className="mt-8">
            <div className="border-t divider pt-6">
              <p className={`text-lg font-medium ${result.verdict ? 'text-ok' : 'text-bad'}`}>
                {result.verdict ? '✓ 选项正确' : '✗ 选项错误'}
                {!valid && <span className="ml-3 text-sm text-warn/85">但理由有漏洞</span>}
              </p>
              {fb.verdict_text && (
                <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{fb.verdict_text}</p>
              )}
            </div>

            {reasoning.trim() && (
              <div className="mt-6 border-t divider pt-5">
                <p className="text-xs text-ink/40 mb-2">我的理由 <span className="text-ink/25">（你提交时的原话）</span></p>
                <p className="text-sm leading-relaxed text-ink/60 border-l-2 border-ink/15 pl-3">{reasoning}</p>
              </div>
            )}

            {issues.length > 0 && (
              <div className="mt-6 border-t divider pt-5">
                <p className="text-xs text-ink/40 mb-3">理由中的错漏</p>
                <div className="space-y-3">
                  {issues.map((it, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="shrink-0 mt-0.5 text-[11px] px-1.5 py-0.5 rounded border border-warn/25 text-warn/75 h-fit">
                        {ISSUE_LABEL[it.type] || '错漏'}
                      </span>
                      <p className="text-sm leading-relaxed text-ink/80">{it.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {issues.length === 0 && valid && (
              <div className="mt-6 border-t divider pt-5">
                <p className="text-sm text-ok/80">理由完全成立，推理链没有问题。</p>
              </div>
            )}

            {fb.insight && (
              <div className="mt-6 border-t divider pt-5">
                <p className="text-xs text-ink/40 mb-2">补充讲解</p>
                <p className="text-sm leading-relaxed text-ink/75">{fb.insight}</p>
              </div>
            )}

            <div className="mt-6 border-t divider pt-5">
              <p className="text-xs text-ink/40 mb-2">原文依据</p>
              <p className="text-sm leading-relaxed text-ink/60 border-l-2 border-ink/15 pl-3">{q.quote}</p>
            </div>

            <div className="mt-6 border-t divider pt-5">
              <p className="text-xs text-ink/40 mb-2">标准解析</p>
              <p className="text-sm leading-relaxed text-ink/70">{q.explanation}</p>
            </div>

            <div className="mt-8 flex items-center gap-5">
              <button
                onClick={next}
                className="px-5 py-2.5 text-sm bg-acc/25 border border-acc/25 rounded-[10px] hover:bg-acc/35 transition-colors"
              >
                {idx + 1 >= questions.length ? '完成' : '下一题'}
              </button>
              <button onClick={toggleCollect} className="text-sm text-ink/40 hover:text-warn transition-colors">
                {saved ? '★ 已收藏' : '☆ 收藏此题'}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
