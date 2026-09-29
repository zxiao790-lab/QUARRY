# Quarry · 采石场

把厚书凿成题。导入一本书 → AI 按章出机制类选择题 → **每道题必须写下你的理由** → AI 批改选项对错 + 理由中的错漏，附原文依据。

- 前端：Vite + React + Tailwind v4（静态站，可部署任意静态托管）
- 数据：Supabase（books / chapters / questions / attempts）
- AI：DeepSeek `deepseek-flash`（出题关思考模式，批改开思考模式），经 Supabase Edge Function `ai-proxy` 中转，API Key 只存在服务端

---

## 部署步骤（一次性，按顺序）

### ① 建表（2 分钟）

1. 打开 Supabase 项目 Dashboard，左侧（或全局搜索）找到 **SQL Editor**
2. New query → 把 `supabase/migration.sql` 全文粘贴进去 → **Run**
3. 看到 `Success` 即完成。可重复执行，不会破坏已有数据

### ② 拿 anon key（1 分钟）

1. Supabase Dashboard → 全局搜索 **API keys**（或 Settings → API）
2. 复制 `anon` / `publishable` 那个公开 key（**不是** service_role）
3. 本地开发：复制 `.env.example` 为 `.env`，填入 URL 和 anon key

### ③ 部署 Edge Function（ai-proxy）

需要 Supabase CLI 和 access token（Dashboard → Account → Access Tokens 生成）。

```bash
npm install -g supabase
supabase login                      # 粘贴 access token
supabase link --project-ref gglooxeazedvfuaddmiw
supabase functions deploy ai-proxy
```

部署成功后，这个地址会生效：
`https://gglooxeazedvfuaddmiw.supabase.co/functions/v1/ai-proxy`

### ④ 部署前端

任意静态托管（Vercel：导入仓库，零配置，构建命令 `npm run build`，产物目录 `dist`）。
若用 Vercel，在项目 Settings → Environment Variables 里加：

```
VITE_SUPABASE_URL=https://gglooxeazedvfuaddmiw.supabase.co
VITE_SUPABASE_ANON_KEY=<你的 anon key>
```

### ⑤ 填 DeepSeek key

打开网站 → 右上角 **设置** → 粘贴 DeepSeek API Key（platform.deepseek.com 申请）→ 测试连接 → 保存。
Key 存在你自己 Supabase 的 `settings` 表里，仅服务端函数可读写，前端永远接触不到。

---

## 使用流程

```
书架 → 导入新书（.txt 或粘贴，自动按章切分，可改标题）→ 确认入库
     → 书详情 → 某章「生成题目」（一次 5 题，可多次点追加）
     → 开始学习：选选项 → 填理由（必填）→ AI 批改
        · 选项对错（前端即时判，不花 token）
        · 理由评价（哪里成立 / 概念误解 / 关键缺失 / 因果链错误）
        · 补充讲解 + 原文依据 + 标准解析
     → 批改后可 ☆ 收藏
     → 书详情页有「错题重刷」「收藏题」入口，题目打乱顺序
        · 刷对的题自动退出错题集
```

## 设计说明

- **判分双维度**：选对 ≠ 理由对。AI 只负责评价理由，因此能抓出"答案蒙对了但理解是错的"这种最有价值的情况。
- **出题偏机制题**：因果 / 对比 / 情境应用为主，名词背诵为辅，干扰项取自常见误解。
- **数据模型**：每次作答（理由 + 批改）都存 `attempts`，你的思考记录全程留档。
- **安全边界**：books/chapters/questions/attempts 四表 anon 可读写（私人应用，前提是不公开分享站点 URL）；`settings` 表（存 DeepSeek key）anon 完全不可访问，只有 Edge Function 用 service role 读写。

## 本地开发

```bash
npm install
cp .env.example .env   # 填入 Supabase URL + anon key
npm run dev
```

Edge Function 本地调试：`supabase functions serve ai-proxy`（需在 `supabase/.env` 放 `SUPABASE_SERVICE_ROLE_KEY`，或直接用线上已部署版本）。
