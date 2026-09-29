// ============================================================
// QUARRY · ai-proxy
// 所有 DeepSeek 调用的唯一出口；API Key 只存在 settings 表，
// 仅本函数（service role）读写，前端永远接触不到。
//
// op 路由：
//   GET  ?op=key-status   → { configured: bool }
//   POST ?op=save-key     body { api_key }
//   POST ?op=test-key     body { api_key? }  不带则用已存的
//   POST ?op=generate     body { chapter_id, count? } → 出题入库
//   POST ?op=grade        body { question_id, choice, reasoning } → 批改+存档
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DS_BASE = "https://api.deepseek.com";
const MODEL = "deepseek-flash";
const MAX_CHAPTER_CHARS = 60000; // 保险丝：超长章节截断（flash 1M 上下文，一般碰不到）

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function dsChat(apiKey: string, messages: { role: string; content: string }[], opts: { thinking?: boolean; json?: boolean }) {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    stream: false,
  };
  body.thinking = { type: opts.thinking ? "enabled" : "disabled" };
  if (opts.json) {
    body.response_format = { type: "json_object" };
    body.temperature = 1.0; // 官方建议：JSON 模式下用 1.0，避免重复退化
  }
  const res = await fetch(`${DS_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 返回为空");
  return content;
}

async function getApiKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await supabase.from("settings").select("value").eq("key", "deepseek_api_key").maybeSingle();
  return data?.value || null;
}

// ---------- 提示词 ----------

const GEN_SYSTEM = `你是一位严谨的学习出题人，从书籍章节中提取知识点，设计高质量的中文选择题。

出题原则：
1. 优先考察"机制与因果"（A 如何导致 B、为什么如此）、"概念对比"（易混概念的区分）、"情境应用"（用书中原理解释现象），而不是名词解释式背诵题。
2. 干扰项来自"常见误解"或"似是而非的推理"，不能有明显错误的凑数选项。
3. 解析要说明：正确项为什么对，最关键的干扰项为什么错。
4. quote 字段必须从原文中摘取能作为依据的关键句，逐字引用，不得改写。`;

const GRADE_SYSTEM = `你是一位温和而直接的学习教练。学习者刚回答了一道选择题，并写下了选择该选项的理由。你的任务是评价理由本身，而不是重复答案。

评价原则：
1. 选对不等于理由对：选项正确但理由有漏洞时，必须明确指出。
2. 选错但理由含合理成分时，先承认合理的部分，再指出偏差出在哪里。
3. 指出错漏要具体到概念与推理链，并说明正确的理解应该是什么，可引用原文依据。
4. issues 为空数组表示理由完全成立。
语气：温和、直接、不居高临下，像一个懂行的朋友。`;

function letterOf(i: number) {
  return ["A", "B", "C", "D"][i] ?? "?";
}

// ---------- 主处理 ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const op = url.searchParams.get("op") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- key 管理 ----
    if (op === "key-status") {
      const key = await getApiKey(supabase);
      return json({ configured: !!key });
    }

    if (op === "save-key") {
      const { api_key } = await req.json();
      if (!api_key || typeof api_key !== "string") return json({ error: "api_key 不能为空" }, 400);
      const { error } = await supabase
        .from("settings")
        .upsert({ key: "deepseek_api_key", value: api_key.trim(), updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (op === "test-key") {
      const { api_key } = await req.json().catch(() => ({}));
      const key = api_key?.trim() || (await getApiKey(supabase));
      if (!key) return json({ error: "还没有可用的 API Key" }, 400);
      await dsChat(key, [{ role: "user", content: "回复：ok" }], { thinking: false });
      return json({ ok: true });
    }

    // ---- 出题 ----
    if (op === "generate") {
      const { chapter_id, count = 5 } = await req.json();
      const apiKey = await getApiKey(supabase);
      if (!apiKey) return json({ error: "尚未配置 DeepSeek API Key，请先到设置页填写" }, 400);

      const { data: chapter, error: chErr } = await supabase
        .from("chapters").select("*").eq("id", chapter_id).single();
      if (chErr || !chapter) return json({ error: "章节不存在" }, 404);

      const { data: existing, error: qErr } = await supabase
        .from("questions").select("idx").eq("chapter_id", chapter_id).order("idx", { ascending: false }).limit(1);
      if (qErr) throw new Error(qErr.message);
      const startIdx = existing?.length ? existing[0].idx + 1 : 0;

      const userPrompt = `书籍章节内容如下：

<章节开始>
${chapter.raw_text.slice(0, MAX_CHAPTER_CHARS)}
<章节结束>

请基于上述内容出 ${count} 道选择题，严格按以下 JSON 格式输出（不要输出 JSON 以外的任何内容）：
{"questions":[{"knowledge_point":"知识点名称","stem":"题干","options":["选项A内容","选项B内容","选项C内容","选项D内容"],"answer":0,"explanation":"解析","quote":"原文关键句"}]}
answer 为正确选项下标（0-3）。`;

      const content = await dsChat(apiKey, [
        { role: "system", content: GEN_SYSTEM },
        { role: "user", content: userPrompt },
      ], { thinking: false, json: true });

      let parsed: { questions?: unknown[] };
      try {
        parsed = JSON.parse(content);
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("AI 输出无法解析为 JSON");
        parsed = JSON.parse(m[0]);
      }
      const list = Array.isArray(parsed.questions) ? parsed.questions : [];
      if (!list.length) throw new Error("AI 未生成任何题目");

      const rows: Record<string, unknown>[] = [];
      for (const [i, raw] of list.entries()) {
        const q = raw as Record<string, unknown>;
        const opts = Array.isArray(q.options) ? q.options.map(String) : [];
        if (!String(q.stem || "").trim()) continue; // 空题干丢弃
        if (opts.length < 2 || opts.length > 6) continue; // 选项异常丢弃
        let ans = Number(q.answer);
        if (!Number.isInteger(ans) || ans < 0 || ans >= opts.length) {
          // 容错：AI 可能输出字母答案
          const li = ["A", "B", "C", "D", "E", "F"].indexOf(String(q.answer || "").trim().toUpperCase());
          ans = li >= 0 && li < opts.length ? li : 0;
        }
        rows.push({
          chapter_id,
          idx: startIdx + rows.length,
          knowledge_point: String(q.knowledge_point || ""),
          stem: String(q.stem || ""),
          options: opts, // 直接传数组，supabase-js 正确写入 jsonb
          answer: ans,
          explanation: String(q.explanation || ""),
          quote: String(q.quote || ""),
        });
      }
      if (!rows.length) throw new Error("AI 生成的题目全部无效，请重试");
      const { data: inserted, error: insErr } = await supabase.from("questions").insert(rows).select();
      if (insErr) throw new Error(insErr.message);
      return json({ questions: inserted, count: inserted.length });
    }

    // ---- 批改 ----
    if (op === "grade") {
      const { question_id, choice, reasoning } = await req.json();
      const apiKey = await getApiKey(supabase);
      if (!apiKey) return json({ error: "尚未配置 DeepSeek API Key，请先到设置页填写" }, 400);
      if (typeof choice !== "number" || !reasoning?.trim()) {
        return json({ error: "缺少选项或理由" }, 400);
      }

      const { data: q, error: qErr } = await supabase.from("questions").select("*").eq("id", question_id).single();
      if (qErr || !q) return json({ error: "题目不存在" }, 404);

      const verdict = choice === q.answer;
      const options = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
      const optionLines = (options as string[])
        .map((o: string, i: number) => `${letterOf(i)}. ${o}`).join("\n");

      const userPrompt = `题目：${q.stem}
选项：
${optionLines}
正确答案：${letterOf(q.answer)}
解析：${q.explanation}
原文依据：${q.quote}

学习者的选择：${letterOf(choice)}
学习者的理由：${reasoning.trim()}

请严格按以下 JSON 格式输出评价（不要输出 JSON 以外的任何内容）：
{"reasoning_valid":true,"issues":[{"type":"misunderstand","text":"具体错漏描述"}],"insight":"结合原文的补充讲解","verdict_text":"一句话总评"}
issues 的 type 取值：misunderstand（概念误解）/ gap（关键缺失）/ wrong_link（因果链错误）。`;

      const content = await dsChat(apiKey, [
        { role: "system", content: GRADE_SYSTEM },
        { role: "user", content: userPrompt },
      ], { thinking: true, json: true });

      let feedback: Record<string, unknown>;
      try {
        feedback = JSON.parse(content);
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("AI 批改输出无法解析");
        feedback = JSON.parse(m[0]);
      }

      const { data: attempt, error: aErr } = await supabase
        .from("attempts")
        .insert({ question_id, choice, reasoning: reasoning.trim(), verdict, feedback })
        .select()
        .single();
      if (aErr) throw new Error(aErr.message);

      await supabase.from("questions").update({ last_verdict: verdict }).eq("id", question_id);

      return json({ attempt: { ...attempt, feedback }, verdict });
    }

    return json({ error: `未知操作: ${op}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
