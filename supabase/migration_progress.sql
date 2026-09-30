-- 增量迁移：做题进度表（2026-09-30）
-- 在 Supabase SQL Editor 执行一次即可

create table if not exists quiz_progress (
  scope      text primary key,           -- 'chapter:{章节id}' / 'wrong:{书id}'
  idx        int not null default 0,     -- 当前做到第几题（0 起）
  order_json jsonb,                      -- 打乱刷题时的顺序快照（题目 id 数组）
  draft      jsonb,                      -- 当前题草稿 {choice, reasoning, result}
  updated_at timestamptz not null default now()
);

alter table quiz_progress enable row level security;

-- 与本应用其他表同一模式：单用户，anon 全放行
create policy "anon_all_quiz_progress" on quiz_progress for all to anon using (true) with check (true);
