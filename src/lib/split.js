// 章节切分：把整本书的纯文本切成章节列表
// mode: 'zh' 中文（第X章/讲/节/回/部分） | 'en' 英文（Chapter N） | 'single' 全书单章

const PATTERNS = {
  zh: /^[ \t]*(第[一二三四五六七八九十百千万零〇\d]+\s*[章讲节回部]|序章|序言|前言|引言|结语|后记|尾声|附录[一二三四五六七八九十\d]?)[^\n]{0,40}[ \t]*$/gm,
  en: /^[ \t]*(Chapter\s+\d+[^\n]{0,60})[ \t]*$/gim,
}

export function splitChapters(text, mode) {
  if (mode === 'single') {
    return [{ title: '全书', text: text.trim() }]
  }

  const re = new RegExp(PATTERNS[mode].source, PATTERNS[mode].flags)
  const marks = []
  let m
  while ((m = re.exec(text)) !== null) {
    marks.push({ title: m[0].trim(), start: m.index, end: re.lastIndex })
  }

  // 没切出 ≥2 章 → 回退全书单章
  if (marks.length < 2) {
    return [{ title: '全书', text: text.trim(), fallback: true }]
  }

  const chapters = []
  // 第一段切分点之前的内容 → 前言/卷首
  if (marks[0].start > 200) {
    const pre = text.slice(0, marks[0].start).trim()
    if (pre.length > 100) {
      chapters.push({ title: '卷首', text: pre })
    }
  }
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].end
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length
    const body = text.slice(start, end).trim()
    if (body.length < 50) continue // 碎片（如目录页）跳过
    chapters.push({ title: marks[i].title, text: body })
  }
  return chapters
}
