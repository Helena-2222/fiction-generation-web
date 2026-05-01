# Super Story 非凡故事 · Supabase 鉴权接入指南

## 一、项目初始化

```bash
# 1. 安装依赖
npm install @supabase/supabase-js

# 2. 创建环境变量文件（若已执行过该命令则无需重复执行）
copy .env.example .env
```

在 `.env` 中填入（从 Supabase 控制台 → Settings → API 获取）：
```
VITE_SUPABASE_URL=https://你的项目ID.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon公钥
```

---

## 二、Supabase 控制台配置

### 1. 邮箱登录
- 进入 Authentication → Providers → Email
- 开启 **Enable Email provider** ✅
- "Confirm email" 建议开启（防止假邮箱）

### 2. 手机号短信登录
- Authentication → Providers → Phone
- 需要绑定短信服务商（推荐 **Twilio** 或 **阿里云**）
- 国内用阿里云需要 Supabase Pro 计划或自建，Twilio 有免费试用

### 3. 关闭邮箱确认（开发阶段，快速测试）
- Authentication → Settings → "Enable email confirmations" 关闭

---

## 三、数据库 SQL（在 Supabase SQL Editor 中执行）

如果你的项目之前已经按本文档建过 `profiles`、`novels`、`saved_sentences`，不要重复执行整段初始化 SQL。
这种情况下，请直接执行下面这段“增量迁移 SQL”，只补登录用户工作区同步需要的 `user_workspaces`：

```sql
-- 登录用户的工作区快照（跨浏览器同步收藏、历史记录和创作进度）
CREATE TABLE IF NOT EXISTS public.user_workspaces (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.user_workspaces
  TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_workspaces'
      AND policyname = 'user_workspaces: 用户只能读写自己的工作区'
  ) THEN
    CREATE POLICY "user_workspaces: 用户只能读写自己的工作区"
      ON public.user_workspaces FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_workspace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_workspaces_updated_at ON public.user_workspaces;

CREATE TRIGGER set_user_workspaces_updated_at
  BEFORE UPDATE ON public.user_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_workspace_updated_at();

NOTIFY pgrst, 'reload schema';
```

如果需要启用“作品管理 / 单人多作品”，继续执行下面这段增量迁移 SQL，新增 `works` 表：

```sql
-- 单人多作品：每个用户可以拥有多部作品，每部作品保存一份独立创作快照
CREATE TABLE IF NOT EXISTS public.works (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '未命名作品',
  genre       TEXT,
  style       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  snapshot    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS works_user_updated_idx
  ON public.works (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.works
  TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'works'
      AND policyname = 'works: 用户只能读写自己的作品'
  ) THEN
    CREATE POLICY "works: 用户只能读写自己的作品"
      ON public.works FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_works_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_works_updated_at ON public.works;

CREATE TRIGGER set_works_updated_at
  BEFORE UPDATE ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.handle_works_updated_at();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.works;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
```

如果需要启用用户中心的“创作时长 / 创作天数”统计，继续执行下面这段增量迁移 SQL，新增 `user_activity_stats` 表：

```sql
-- 用户创作统计：记录创作台停留时长和登录日期
CREATE TABLE IF NOT EXISTS public.user_activity_stats (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  writing_time_seconds  BIGINT NOT NULL DEFAULT 0,
  active_days           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_activity_stats ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.user_activity_stats
  TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_activity_stats'
      AND policyname = 'user_activity_stats: 用户只能读写自己的创作统计'
  ) THEN
    CREATE POLICY "user_activity_stats: 用户只能读写自己的创作统计"
      ON public.user_activity_stats FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_activity_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_activity_stats_updated_at ON public.user_activity_stats;

CREATE TRIGGER set_user_activity_stats_updated_at
  BEFORE UPDATE ON public.user_activity_stats
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_activity_stats_updated_at();

NOTIFY pgrst, 'reload schema';
```

如果页面仍提示“账号工作区同步失败”，先在 SQL Editor 里执行下面的检查：

```sql
SELECT to_regclass('public.user_workspaces') AS workspace_table;
```

返回值应为 `user_workspaces`。如果是 `NULL`，说明迁移没有成功执行；如果表存在但仍失败，重点检查上面的 `GRANT` 权限和 RLS 策略是否存在且已启用。

如果你已经创建了表，但页面提示 `permission denied for table user_workspaces`，可以单独执行下面这段权限修复 SQL：

```sql
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.user_workspaces
  TO authenticated;

NOTIFY pgrst, 'reload schema';
```

如果你是在一个全新的 Supabase 项目里从零初始化，再执行下面这段完整 SQL。

```sql
-- 用户扩展信息表（补充 auth.users 的字段）
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname    TEXT DEFAULT '创作者',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 小说创作记录
CREATE TABLE public.novels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '未命名故事',
  genre       TEXT,
  synopsis    TEXT,
  world_view  JSONB DEFAULT '{}',
  outline     JSONB DEFAULT '{}',
  content     TEXT DEFAULT '',
  word_count  INT DEFAULT 0,
  status      TEXT DEFAULT 'draft',   -- draft | published
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 收藏的句子
CREATE TABLE public.saved_sentences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  source_novel_id UUID REFERENCES public.novels(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 登录用户的工作区快照（跨浏览器同步收藏、历史记录和创作进度）
CREATE TABLE public.user_workspaces (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 单人多作品：每部作品保存一份独立创作快照
CREATE TABLE public.works (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '未命名作品',
  genre       TEXT,
  style       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  snapshot    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 用户创作统计：创作台停留时长 + 登录日期
CREATE TABLE public.user_activity_stats (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  writing_time_seconds  BIGINT NOT NULL DEFAULT 0,
  active_days           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 行级别安全策略（Row Level Security）—— 用户只能看/改自己的数据
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_sentences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workspaces  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.works            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_stats ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.user_workspaces, public.works
  TO authenticated;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.user_activity_stats
  TO authenticated;

-- profiles 策略
CREATE POLICY "profiles: 用户只能读写自己的数据"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- novels 策略
CREATE POLICY "novels: 用户只能读写自己的小说"
  ON public.novels FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- saved_sentences 策略
CREATE POLICY "sentences: 用户只能读写自己的收藏"
  ON public.saved_sentences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_workspaces 策略
CREATE POLICY "user_workspaces: 用户只能读写自己的工作区"
  ON public.user_workspaces FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "works: 用户只能读写自己的作品"
  ON public.works FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_activity_stats: 用户只能读写自己的创作统计"
  ON public.user_activity_stats FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 工作区更新时间自动刷新
CREATE OR REPLACE FUNCTION public.handle_user_workspace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_workspaces_updated_at
  BEFORE UPDATE ON public.user_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_workspace_updated_at();

CREATE INDEX IF NOT EXISTS works_user_updated_idx
  ON public.works (user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.handle_works_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_works_updated_at
  BEFORE UPDATE ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.handle_works_updated_at();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.works;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_activity_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_activity_stats_updated_at
  BEFORE UPDATE ON public.user_activity_stats
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_activity_stats_updated_at();

NOTIFY pgrst, 'reload schema';

-- 新用户注册时自动创建 profile（数据库触发器）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', '创作者')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 四、useAuth Hook（在任意组件中使用）

```jsx
// hooks/useAuth.js
import { useEffect, useState } from 'react';
import { supabase } from '../AuthPage'; // 或从单独的 supabase.js 中导入

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取当前登录状态
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) await fetchProfile(session.user.id);
        else { setProfile(null); setLoading(false); }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    setLoading(false);
  };

  const logout = () => supabase.auth.signOut();

  return { user, profile, loading, logout };
}
```

---

## 五、路由保护（React Router v6）

```jsx
// components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>加载中…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

// App.jsx 中使用
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthPage from './AuthPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import CreatePage from './pages/CreatePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"     element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage onSuccess={() => navigate('/create')} />} />
        <Route path="/create" element={
          <ProtectedRoute>
            <CreatePage />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 六、数据操作示例

```js
// 保存小说
const saveNovel = async (novelData) => {
  const { data, error } = await supabase
    .from('novels')
    .upsert({ ...novelData, user_id: user.id })
    .select()
    .single();
  return { data, error };
};

// 获取用户所有小说
const fetchMyNovels = async () => {
  const { data } = await supabase
    .from('novels')
    .select('id, title, genre, word_count, updated_at')
    .order('updated_at', { ascending: false });
  return data;
};

// 收藏句子
const saveSentence = async (content, novelId) => {
  await supabase.from('saved_sentences').insert({
    user_id: user.id,
    content,
    source_novel_id: novelId,
  });
};

// 获取收藏列表
const fetchFavorites = async () => {
  const { data } = await supabase
    .from('saved_sentences')
    .select('*')
    .order('created_at', { ascending: false });
  return data;
};

// 保存当前登录用户的工作区
const saveWorkspace = async (workspaceSnapshot) => {
  const { data, error } = await supabase
    .from('user_workspaces')
    .upsert({
      user_id: user.id,
      workspace_snapshot: workspaceSnapshot,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('updated_at')
    .single();
  return { data, error };
};

// 读取当前登录用户的工作区
const fetchWorkspace = async () => {
  const { data, error } = await supabase
    .from('user_workspaces')
    .select('workspace_snapshot, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: data?.workspace_snapshot
      ? {
          ...data.workspace_snapshot,
          updatedAt: data.workspace_snapshot.updatedAt || data.updated_at,
        }
      : null,
    error: null,
  };
};
```

---

> 游客模式下的历史记录和收藏仍建议保存在浏览器本地；`user_workspaces` 仅用于登录用户的账号级同步。

## 七、侧边栏头像区域改造（与现有代码集成）

现有的 `sidebar-avatar-toggle` 按钮区域，改造后：
- **未登录**：点击跳转到 `/auth` 登录页
- **已登录**：显示用户昵称首字母，点击展开个人面板

```jsx
// 在侧边栏组件中引入 useAuth
const { user, profile, logout } = useAuth();

// 头像按钮改为：
<button onClick={() => !user ? navigate('/auth') : togglePanel()}>
  {user ? (profile?.nickname?.[0] || '创') : <UserIcon />}
</button>

// 面板中用户名改为：
<div className="sidebar-profile-name">
  {profile?.nickname || '创作者'}
</div>
```

---

## 八、免费额度说明（Supabase Free Tier）

| 资源 | 免费额度 |
|------|---------|
| 数据库存储 | 500 MB |
| 月活用户 | 50,000 |
| 邮件发送 | 4 封/小时（需配置 SMTP 或 Resend 突破限制）|
| 文件存储 | 1 GB |
| 带宽 | 5 GB/月 |

> 对于初期项目完全足够。配合 **Resend**（每月 3000 封免费）解决邮件发送限制。
