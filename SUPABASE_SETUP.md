# 神经元脚本 · Supabase 鉴权接入指南

## 一、项目初始化

```bash
# 1. 安装依赖
npm install @supabase/supabase-js

# 2. 创建环境变量文件（Vite 项目）
touch .env.local
```

在 `.env.local` 中填入（从 Supabase 控制台 → Settings → API 获取）：
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

-- 行级别安全策略（Row Level Security）—— 用户只能看/改自己的数据
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_sentences  ENABLE ROW LEVEL SECURITY;

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
```

---

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
