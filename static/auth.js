import { DEFAULT_NEXT_PATH, getCurrentUser, getPostAuthNextPath, getRequestedNextPath, getSupabaseClient, getUserContact, getUserDisplayName, getUserInitial, isAnonymousUser, subscribeToAuthChanges } from "./src/auth-client.js";

const state = {
  supabase: null,
  currentUser: null,
  mode: "login",
  loading: false,
  nextPath: getPostAuthNextPath(getRequestedNextPath(DEFAULT_NEXT_PATH)),
  redirectTimer: null,
  authCleanup: null,
};

const elements = {
  guestView: document.querySelector("#auth-view-guest"),
  userView: document.querySelector("#auth-view-user"),
  title: document.querySelector("#auth-title"),
  subtitle: document.querySelector("#auth-subtitle"),
  modeLogin: document.querySelector("#auth-mode-login"),
  modeRegister: document.querySelector("#auth-mode-register"),
  form: document.querySelector("#auth-form"),
  fieldNickname: document.querySelector("#auth-field-nickname"),
  nickname: document.querySelector("#auth-nickname"),
  email: document.querySelector("#auth-email"),
  password: document.querySelector("#auth-password"),
  message: document.querySelector("#auth-message"),
  submit: document.querySelector("#auth-submit"),
  passwordResetRow: document.querySelector("#auth-password-reset-row"),
  passwordReset: document.querySelector("#auth-password-reset"),
  footerText: document.querySelector("#auth-footer-text"),
  footerSwitch: document.querySelector("#auth-footer-switch"),
  userInitial: document.querySelector("#auth-user-initial"),
  userName: document.querySelector("#auth-user-name"),
  userEmail: document.querySelector("#auth-user-email"),
};

function setMessage(type, text) {
  if (!elements.message) {
    return;
  }

  if (!text) {
    elements.message.className = "auth-message hidden";
    elements.message.textContent = "";
    return;
  }

  elements.message.className = `auth-message ${type}`;
  elements.message.textContent = text;
}

function getSubmitLabel() {
  return state.mode === "register" ? "创建账号" : "登录";
}

function updateSubmitButton() {
  if (!elements.submit) {
    return;
  }

  elements.submit.disabled = state.loading || !state.supabase;
  elements.submit.innerHTML = state.loading
    ? '<span class="spinner"></span>请稍候…'
    : getSubmitLabel();
}

function syncGuestView() {
  const isRegisterMode = state.mode === "register";

  elements.title.textContent = isRegisterMode ? "开始你的创作" : "欢迎回来";
  elements.subtitle.textContent = isRegisterMode
    ? "注册账号后，你的创作灵感、收藏与工作台进度会更方便持续管理。"
    : "登录后即可继续你的创作工作台与收藏内容。";

  elements.modeLogin.classList.toggle("active", state.mode === "login");
  elements.modeRegister.classList.toggle("active", state.mode === "register");

  elements.fieldNickname.classList.toggle("hidden", !isRegisterMode);
  elements.passwordResetRow.classList.toggle("hidden", state.mode !== "login");

  elements.footerText.textContent = isRegisterMode ? "已有账号？" : "还没有账号？";
  elements.footerSwitch.textContent = isRegisterMode ? "直接登录" : "立即注册";
}

function syncUserView() {
  if (!state.currentUser) {
    return;
  }

  elements.userInitial.textContent = getUserInitial(state.currentUser);
  elements.userName.textContent = `欢迎回来，${getUserDisplayName(state.currentUser)}`;
  elements.userEmail.textContent = getUserContact(state.currentUser);

  if (state.redirectTimer) {
    window.clearTimeout(state.redirectTimer);
  }
  state.redirectTimer = window.setTimeout(() => {
    window.location.replace(state.nextPath);
  }, 3000);
}

function render() {
  const isLoggedIn = Boolean(state.currentUser) && !isAnonymousUser(state.currentUser);
  elements.guestView.classList.toggle("hidden", isLoggedIn);
  elements.userView.classList.toggle("hidden", !isLoggedIn);

  if (isLoggedIn) {
    syncUserView();
  } else {
    syncGuestView();
  }

  updateSubmitButton();
}

function translateAuthError(error) {
  const rawMessage = String(error?.message || error || "").trim();
  const mappedMessages = {
    "Invalid login credentials": "邮箱或密码不正确。",
    "Email not confirmed": "该邮箱还没有完成验证，请先查收验证邮件。",
    "User already registered": "该邮箱已经注册，可以直接登录。",
    "Token has expired or is invalid": "验证码已过期或无效，请重新获取。",
    "Password should be at least 6 characters": "密码长度至少需要 6 位。",
  };
  return mappedMessages[rawMessage] || rawMessage || "登录失败，请稍后重试。";
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function setLoading(value) {
  state.loading = value;
  updateSubmitButton();
}

async function handlePasswordReset() {
  const email = String(elements.email.value || "").trim();
  if (!validateEmail(email)) {
    setMessage("error", "请先填写可用的邮箱地址。");
    return;
  }

  setMessage("", "");
  setLoading(true);
  try {
    const { error } = await state.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(state.nextPath)}`,
    });
    if (error) {
      throw error;
    }
    setMessage("success", "重置密码邮件已经发送，请前往邮箱查收。");
  } catch (error) {
    setMessage("error", translateAuthError(error));
  } finally {
    setLoading(false);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  setMessage("", "");

  if (!state.supabase) {
    setMessage("error", "身份服务尚未准备好，请刷新页面后重试。");
    return;
  }

  const email = String(elements.email.value || "").trim();
  const password = String(elements.password.value || "");
  const nickname = String(elements.nickname.value || "").trim();

  if (!validateEmail(email)) {
    setMessage("error", "请输入正确的邮箱地址。");
    return;
  }
  if (password.length < 6) {
    setMessage("error", "请输入至少 6 位的密码。");
    return;
  }

  setLoading(true);
  try {
    if (state.mode === "register") {
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(state.nextPath)}`,
          data: {
            nickname: nickname || "创作者",
          },
        },
      });
      if (error) {
        throw error;
      }
      if (data?.session?.user) {
        window.location.replace(state.nextPath);
        return;
      }
      setMessage("success", "注册成功，请前往邮箱完成验证后再登录。");
    } else {
      const { error } = await state.supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        throw error;
      }
      window.location.replace(state.nextPath);
    }
  } catch (error) {
    setMessage("error", translateAuthError(error));
  } finally {
    setLoading(false);
  }
}

function bindEvents() {
  elements.modeLogin.addEventListener("click", () => {
    state.mode = "login";
    setMessage("", "");
    render();
  });

  elements.modeRegister.addEventListener("click", () => {
    state.mode = "register";
    setMessage("", "");
    render();
  });

  elements.footerSwitch.addEventListener("click", () => {
    state.mode = state.mode === "login" ? "register" : "login";
    setMessage("", "");
    render();
  });

  elements.passwordReset.addEventListener("click", handlePasswordReset);
  elements.form.addEventListener("submit", handleSubmit);
}

async function init() {
  bindEvents();
  render();
  setLoading(true);

  try {
    state.supabase = await getSupabaseClient();
    state.currentUser = await getCurrentUser();
    state.authCleanup = await subscribeToAuthChanges((_event, session) => {
      state.currentUser = session?.user ?? null;
      render();
    });
  } catch (error) {
    setMessage("error", translateAuthError(error));
  } finally {
    setLoading(false);
    render();
  }
}

window.addEventListener("beforeunload", () => {
  if (state.redirectTimer) {
    window.clearTimeout(state.redirectTimer);
  }
  if (typeof state.authCleanup === "function") {
    state.authCleanup();
  }
});

init();
