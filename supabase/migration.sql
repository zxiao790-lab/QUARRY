-- ============================================================
-- QUARRY 数据库初始化
-- 执行方式：Supabase Dashboard → 左侧/全局搜索 "SQL Editor" →
--           New query → 粘贴本文件全部内容 → Run
-- 幂等：可重复执行，不会破坏已有数据
-- ============================================================

create table if not exists settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

create table if not exists books (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  author     text default '',
  created_at timestamptz default now()
);

create table if not exists chapters (
  id       uuid primary key default gen_random_uuid(),
  book_id  uuid not null references books(id) on delete cascade,
  idx      int  not null,
  title    text not null,
  raw_text text not null
);
create index if not exists chapters_book_idx on chapters(book_id, idx);

create table if not exists questions (
  id             uuid primary key default gen_random_uuid(),
  chapter_id     uuid not null references chapters(id) on delete cascade,
  idx            int  not null default 0,
  knowledge_point text default '',
  stem           text not null,
  options        jsonb not null,
  answer         int  not null,
  explanation    text default '',
  quote          text default '',
  collected      boolean default false,
  last_verdict   boolean,          -- 最近一次作答的对错：null=从未作答，true=最近一次对，false=在错题集
  created_at     timestamptz default now()
);
create index if not exists questions_chapter_idx on questions(chapter_id, idx);

create table if not exists attempts (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  choice      int  not null,
  reasoning   text not null,
  verdict     boolean not null,
  feedback    jsonb,
  created_at  timestamptz default now()
);
create index if not exists attempts_question_idx on attempts(question_id, created_at desc);

-- ---------- RLS ----------
alter table settings  enable row level security;
alter table books     enable row level security;
alter table chapters  enable row level security;
alter table questions enable row level security;
alter table attempts  enable row level security;

-- settings 表不给 anon 任何策略：DeepSeek API Key 只允许服务端（Edge Function 用 service role）读写

-- 其余表：单用户私人应用，anon 全放行（前提：项目 URL 不公开分享）
create policy "anon_all_books"     on books     for all to anon using (true) with check (true);
create policy "anon_all_chapters"  on chapters  for all to anon using (true) with check (true);
create policy "anon_all_questions" on questions for all to anon using (true) with check (true);
create policy "anon_all_attempts"  on attempts  for all to anon using (true) with check (true);
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

-- 增量：出题时一次性生成原文解读与选项解读（2026-09-30）
alter table questions add column if not exists source_note text;
alter table questions add column if not exists option_notes jsonb;
