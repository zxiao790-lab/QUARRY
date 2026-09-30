// 剥掉解析文本里对单个选项的点评句（"A项错误，……；"）——
// 这些内容已由选项下方的 option_notes 呈现，正文不重复。
export function stripOptionNotes(t) {
  if (!t) return t
  const s = String(t)
    .replace(/[A-D]\s*项[^；。]*[；。]?/g, '')
    .replace(/^[；。，,\s]+|[；。,\s]+$/g, '')
    .trim()
  return s || t
}
