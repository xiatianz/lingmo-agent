"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { User, UserIdentity } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import {
  createSupabaseBrowserClient,
  getSupabaseAuthHeader,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ModelSettings {
  hasKey: boolean;
  providerLabel?: string;
  baseUrl?: string;
  model?: string;
  enabled?: boolean;
  updatedAt?: string;
}

interface PasskeyItem {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
}

type Status = { type: "success" | "error"; text: string };
type LoginAction = "github" | "passkey" | "password" | "signup" | null;
type AccountAction = "link-github" | "link-email" | "password-update" | null;
type AuthMode = "signin" | "signup";

const DEFAULT_FORM = {
  providerLabel: "OpenAI Compatible",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKey: "",
};

export function AuthControls() {
  const [configured] = useState(() => isSupabaseBrowserConfigured());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [loginOpen, setLoginOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loginAction, setLoginAction] = useState<LoginAction>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginStatus, setLoginStatus] = useState<Status | null>(null);
  const [settings, setSettings] = useState<ModelSettings | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<Status | null>(null);
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [accountAction, setAccountAction] = useState<AccountAction>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [identityStatus, setIdentityStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!configured) return;

    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data.user ?? null);
        setAccountEmail(data.user?.email ?? "");
      })
      .finally(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAccountEmail(session?.user?.email ?? "");
      if (session?.user) setLoginOpen(false);
    });

    return () => data.subscription.unsubscribe();
  }, [configured]);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    setStatus(null);
    const authHeader = await getSupabaseAuthHeader();
    const response = await fetch("/model-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ action: "get" }),
    });

    if (!response.ok) {
      setStatus({ type: "error", text: "读取模型设置失败" });
      return;
    }

    const data = await response.json();
    const nextSettings = data.settings as ModelSettings;
    setSettings(nextSettings);
    if (nextSettings?.hasKey) {
      setForm({
        providerLabel: nextSettings.providerLabel || DEFAULT_FORM.providerLabel,
        baseUrl: nextSettings.baseUrl || DEFAULT_FORM.baseUrl,
        model: nextSettings.model || DEFAULT_FORM.model,
        apiKey: "",
      });
    }
  }, [user]);

  const loadPasskeys = useCallback(async (clearStatus = true) => {
    if (!user) return;
    setPasskeyLoading(true);
    if (clearStatus) setSecurityStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      setPasskeys(data ?? []);
    } catch (error) {
      setSecurityStatus({ type: "error", text: authErrorMessage(error, "读取 Passkey 失败") });
    } finally {
      setPasskeyLoading(false);
    }
  }, [user]);

  const loadIdentities = useCallback(async (clearStatus = true) => {
    if (!user) return;
    if (clearStatus) setIdentityStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      setIdentities(data.identities ?? []);
    } catch (error) {
      setIdentityStatus({ type: "error", text: authErrorMessage(error, "读取绑定方式失败") });
    }
  }, [user]);

  useEffect(() => {
    if (!dialogOpen || !user) return;
    loadSettings().catch(() => setStatus({ type: "error", text: "读取模型设置失败" }));
    loadPasskeys().catch(() => setSecurityStatus({ type: "error", text: "读取 Passkey 失败" }));
    loadIdentities().catch(() => setIdentityStatus({ type: "error", text: "读取绑定方式失败" }));
  }, [dialogOpen, loadIdentities, loadPasskeys, loadSettings, user]);

  const signInWithGitHub = useCallback(async () => {
    setLoginAction("github");
    setLoginStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      setLoginStatus({ type: "error", text: authErrorMessage(error, "GitHub 登录失败") });
      setLoginAction(null);
    }
  }, []);

  const signInWithPasskey = useCallback(async () => {
    setLoginAction("passkey");
    setLoginStatus(null);

    try {
      ensurePasskeySupported();
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
      setLoginOpen(false);
    } catch (error) {
      setLoginStatus({ type: "error", text: authErrorMessage(error, "Passkey 登录失败") });
    } finally {
      setLoginAction(null);
    }
  }, []);

  const signInOrSignUpWithEmail = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setLoginAction(authMode === "signin" ? "password" : "signup");
      setLoginStatus(null);

      try {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) throw new Error("请输入邮箱地址");
        if (password.length < 6) throw new Error("密码至少需要 6 位");

        const supabase = createSupabaseBrowserClient();
        const { error } =
          authMode === "signin"
            ? await supabase.auth.signInWithPassword({
                email: trimmedEmail,
                password,
              })
            : await supabase.auth.signUp({
                email: trimmedEmail,
                password,
                options: {
                  emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
              });
        if (error) throw error;
        setLoginStatus({
          type: "success",
          text: authMode === "signin" ? "登录成功，正在同步账户。" : "注册成功。若项目开启邮箱验证，请先在邮箱中确认。",
        });
      } catch (error) {
        setLoginStatus({ type: "error", text: authErrorMessage(error, authMode === "signin" ? "邮箱登录失败" : "注册失败") });
      } finally {
        setLoginAction(null);
      }
    },
    [authMode, email, password]
  );

  const linkGitHub = useCallback(async () => {
    setAccountAction("link-github");
    setIdentityStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.linkIdentity({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      setIdentityStatus({ type: "error", text: authErrorMessage(error, "绑定 GitHub 失败") });
      setAccountAction(null);
    }
  }, []);

  const linkOrUpdateEmail = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setAccountAction("link-email");
      setIdentityStatus(null);

      try {
        const trimmedEmail = accountEmail.trim();
        if (!trimmedEmail) throw new Error("请输入邮箱地址");

        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (error) throw error;

        setIdentityStatus({
          type: "success",
          text: "邮箱绑定验证已发送，请在邮箱确认后使用邮箱密码登录。",
        });
        const { data } = await supabase.auth.getUser();
        setUser(data.user ?? null);
        setAccountEmail(data.user?.email ?? trimmedEmail);
        await loadIdentities(false);
      } catch (error) {
        setIdentityStatus({ type: "error", text: authErrorMessage(error, "绑定邮箱失败") });
      } finally {
        setAccountAction(null);
      }
    },
    [accountEmail, loadIdentities]
  );

  const updateAccountPassword = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setAccountAction("password-update");
      setIdentityStatus(null);

      try {
        if (accountPassword.length < 6) throw new Error("密码至少需要 6 位");

        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.updateUser({ password: accountPassword });
        if (error) throw error;
        setAccountPassword("");
        setIdentityStatus({ type: "success", text: "邮箱密码已设置，下次可直接使用邮箱和密码登录。" });
        await loadIdentities(false);
      } catch (error) {
        setIdentityStatus({ type: "error", text: authErrorMessage(error, "设置密码失败") });
      } finally {
        setAccountAction(null);
      }
    },
    [accountPassword, loadIdentities]
  );

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setDialogOpen(false);
  }, []);

  const saveSettings = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setSaving(true);
      setStatus(null);

      try {
        const authHeader = await getSupabaseAuthHeader();
        const response = await fetch("/model-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ action: "save", ...form }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "保存失败");

        setForm((prev) => ({ ...prev, apiKey: "" }));
        setSettings({ hasKey: true, providerLabel: form.providerLabel, baseUrl: form.baseUrl, model: form.model, enabled: true });
        setStatus({ type: "success", text: "模型 Key 已加密保存" });
      } catch (error) {
        setStatus({ type: "error", text: (error as Error).message });
      } finally {
        setSaving(false);
      }
    },
    [form]
  );

  const deleteSettings = useCallback(async () => {
    setSaving(true);
    setStatus(null);

    try {
      const authHeader = await getSupabaseAuthHeader();
      const response = await fetch("/model-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ action: "delete" }),
      });
      if (!response.ok) throw new Error("删除失败");
      setSettings({ hasKey: false });
      setForm(DEFAULT_FORM);
      setStatus({ type: "success", text: "已删除自定义模型 Key" });
    } catch (error) {
      setStatus({ type: "error", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }, []);

  const registerPasskey = useCallback(async () => {
    setPasskeyLoading(true);
    setSecurityStatus(null);

    try {
      ensurePasskeySupported();
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      setSecurityStatus({ type: "success", text: "Passkey 已添加，下次可用设备生物识别或安全密钥登录。" });
      await loadPasskeys(false);
    } catch (error) {
      setSecurityStatus({ type: "error", text: authErrorMessage(error, "添加 Passkey 失败") });
    } finally {
      setPasskeyLoading(false);
    }
  }, [loadPasskeys]);

  const deletePasskey = useCallback(
    async (passkeyId: string) => {
      setPasskeyLoading(true);
      setSecurityStatus(null);

      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.passkey.delete({ passkeyId });
        if (error) throw error;
        setSecurityStatus({ type: "success", text: "Passkey 已删除" });
        await loadPasskeys();
      } catch (error) {
        setSecurityStatus({ type: "error", text: authErrorMessage(error, "删除 Passkey 失败") });
      } finally {
        setPasskeyLoading(false);
      }
    },
    [loadPasskeys]
  );

  if (!configured) return null;

  const displayName =
    (user?.user_metadata?.user_name as string | undefined) ||
    (user?.user_metadata?.preferred_username as string | undefined) ||
    user?.email ||
    "已登录";
  const linkedProviders = new Set(identities.map((identity) => identity.provider));
  const hasGitHubIdentity = linkedProviders.has("github");
  const hasEmailIdentity = linkedProviders.has("email") || Boolean(user?.email);

  return (
    <div className="flex items-center gap-2">
      {user ? (
        <>
          <Button type="button" variant="secondary" size="sm" onClick={() => setDialogOpen(true)} className="hidden sm:inline-flex">
            <KeyIcon className="mr-1.5 h-3.5 w-3.5" />
            账户设置
          </Button>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="flex h-8 max-w-[128px] items-center gap-2 rounded-lg border border-white/70 bg-white/70 px-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
            title="账户与模型设置"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 text-[10px] font-bold text-white">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate">{displayName}</span>
          </button>
        </>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setLoginOpen(true)} disabled={loading}>
          <LoginIcon className="mr-1.5 h-3.5 w-3.5" />
          登录
        </Button>
      )}

      {loginOpen && !user && (
        <ModalShell title="登录灵墨" subtitle="GitHub、Passkey、邮箱密码都可以登录；首次使用 Passkey 需要先在账户设置里添加。" onClose={() => setLoginOpen(false)}>
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" className="h-11 justify-start" onClick={signInWithGitHub} disabled={Boolean(loginAction)}>
                <GitHubIcon className="mr-2 h-4 w-4" />
                {loginAction === "github" ? "正在跳转..." : "GitHub 登录"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 justify-start"
                onClick={signInWithPasskey}
                disabled={Boolean(loginAction)}
              >
                <PasskeyIcon className="mr-2 h-4 w-4" />
                {loginAction === "passkey" ? "正在验证..." : "Passkey 登录"}
              </Button>
            </div>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              <span className="text-xs text-slate-400">邮箱账号</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <div className="grid grid-cols-2 rounded-xl border border-brand-100 bg-brand-50/70 p-1 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setLoginStatus(null);
                }}
                className={cn(
                  "h-9 rounded-lg text-sm font-medium transition",
                  authMode === "signin"
                    ? "bg-white text-brand-800 shadow-sm dark:bg-slate-900 dark:text-brand-200"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                )}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setLoginStatus(null);
                }}
                className={cn(
                  "h-9 rounded-lg text-sm font-medium transition",
                  authMode === "signup"
                    ? "bg-white text-brand-800 shadow-sm dark:bg-slate-900 dark:text-brand-200"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                )}
              >
                注册
              </button>
            </div>

            <form onSubmit={signInOrSignUpWithEmail} className="space-y-3">
              <Field label="邮箱地址">
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  autoComplete="email"
                  className={inputClassName}
                />
              </Field>
              <Field label="密码">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 6 位"
                  type="password"
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                  className={inputClassName}
                />
              </Field>
              <Button type="submit" variant="secondary" className="h-11 w-full" disabled={Boolean(loginAction) || !email.trim() || password.length < 6}>
                <MailIcon className="mr-2 h-4 w-4" />
                {loginAction === "password"
                  ? "登录中..."
                  : loginAction === "signup"
                    ? "注册中..."
                    : authMode === "signin"
                      ? "邮箱密码登录"
                      : "注册邮箱账号"}
              </Button>
            </form>

            <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs leading-5 text-slate-500 dark:bg-white/5 dark:text-slate-400">
              GitHub OAuth App 的回调地址填写 Supabase：{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">https://hptvxnxdhtgivggnhlmi.supabase.co/auth/v1/callback</span>
              。站点跳转白名单仍需要允许本网站的 <span className="font-medium text-slate-700 dark:text-slate-200">/auth/callback</span>。
            </p>

            {loginStatus && <StatusMessage status={loginStatus} />}
          </div>
        </ModalShell>
      )}

      {dialogOpen && user && (
        <ModalShell title="账户与模型设置" subtitle="管理登录方式、Passkey 和你的 OpenAI 格式模型 Key。" onClose={() => setDialogOpen(false)}>
          <div className="space-y-5">
            <section className="rounded-xl border border-brand-100/80 bg-brand-50/50 p-4 dark:border-brand-700/40 dark:bg-brand-950/20">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">登录方式绑定</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  登录后可以把 GitHub、邮箱密码和 Passkey 绑定到同一个账户。
                </p>
              </div>

              <div className="mb-3 grid gap-2 sm:grid-cols-3">
                <IdentityBadge active={hasGitHubIdentity} icon={<GitHubIcon className="h-4 w-4" />} label="GitHub" />
                <IdentityBadge active={hasEmailIdentity} icon={<MailIcon className="h-4 w-4" />} label="邮箱" />
                <IdentityBadge active={passkeys.length > 0} icon={<PasskeyIcon className="h-4 w-4" />} label="Passkey" />
              </div>

              <div className="space-y-3">
                {!hasGitHubIdentity && (
                  <Button type="button" className="h-10 w-full justify-start" onClick={linkGitHub} disabled={Boolean(accountAction)}>
                    <GitHubIcon className="mr-2 h-4 w-4" />
                    {accountAction === "link-github" ? "正在跳转..." : "绑定 GitHub 登录"}
                  </Button>
                )}

                <form onSubmit={linkOrUpdateEmail} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Field label={user.email ? "当前邮箱 / 新邮箱" : "绑定邮箱"}>
                    <input
                      value={accountEmail}
                      onChange={(event) => setAccountEmail(event.target.value)}
                      placeholder="name@example.com"
                      type="email"
                      autoComplete="email"
                      className={inputClassName}
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button type="submit" variant="outline" className="h-10 w-full sm:w-auto" disabled={Boolean(accountAction) || !accountEmail.trim()}>
                      {accountAction === "link-email" ? "发送中..." : user.email ? "更新邮箱" : "绑定邮箱"}
                    </Button>
                  </div>
                </form>

                <form onSubmit={updateAccountPassword} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Field label="邮箱登录密码">
                    <input
                      value={accountPassword}
                      onChange={(event) => setAccountPassword(event.target.value)}
                      placeholder="至少 6 位"
                      type="password"
                      autoComplete="new-password"
                      className={inputClassName}
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button type="submit" variant="outline" className="h-10 w-full sm:w-auto" disabled={Boolean(accountAction) || accountPassword.length < 6}>
                      {accountAction === "password-update" ? "保存中..." : "设置密码"}
                    </Button>
                  </div>
                </form>
              </div>

              {identityStatus && <StatusMessage status={identityStatus} className="mt-3" />}
            </section>

            <section className="rounded-xl border border-brand-100/80 bg-brand-50/50 p-4 dark:border-brand-700/40 dark:bg-brand-950/20">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Passkey 安全密钥</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    添加后，退出登录再回来也能在登录弹窗里直接用 Passkey 登录。
                  </p>
                </div>
                <Button type="button" size="sm" onClick={registerPasskey} disabled={passkeyLoading}>
                  <PasskeyIcon className="mr-1.5 h-3.5 w-3.5" />
                  添加
                </Button>
              </div>

              <div className="space-y-2">
                {passkeyLoading && passkeys.length === 0 ? (
                  <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">正在读取 Passkey...</p>
                ) : passkeys.length > 0 ? (
                  passkeys.map((passkey) => (
                    <div
                      key={passkey.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/80 bg-white/75 px-3 py-2 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {passkey.friendly_name || "未命名 Passkey"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          创建于 {formatDate(passkey.created_at)}
                          {passkey.last_used_at ? `，最近使用 ${formatDate(passkey.last_used_at)}` : ""}
                        </p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => deletePasskey(passkey.id)} disabled={passkeyLoading}>
                        删除
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">
                    暂未添加 Passkey。请先确认 Supabase Dashboard 已开启 Passkey，并配置本站域名为允许来源。
                  </p>
                )}
              </div>

              {securityStatus && <StatusMessage status={securityStatus} className="mt-3" />}
            </section>

            <section>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">模型 Key 设置</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  支持 OpenAI 格式接口。保存后请求会优先使用你的 Key，并按配置跳过平台每日限额。
                </p>
              </div>

              <form onSubmit={saveSettings} className="space-y-3">
                <Field label="服务名称">
                  <input
                    value={form.providerLabel}
                    onChange={(event) => setForm((prev) => ({ ...prev, providerLabel: event.target.value }))}
                    className={inputClassName}
                  />
                </Field>
                <Field label="Base URL">
                  <input
                    value={form.baseUrl}
                    onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                    placeholder="https://api.openai.com/v1"
                    className={inputClassName}
                  />
                </Field>
                <Field label="模型名">
                  <input
                    value={form.model}
                    onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                    placeholder="gpt-4o-mini"
                    className={inputClassName}
                  />
                </Field>
                <Field label={settings?.hasKey ? "API Key（留空则沿用已保存 Key）" : "API Key"}>
                  <input
                    value={form.apiKey}
                    onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                    placeholder={settings?.hasKey ? "已保存密文 Key" : "sk-..."}
                    type="password"
                    className={inputClassName}
                  />
                </Field>

                {status && <StatusMessage status={status} />}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={signOut}>
                    退出登录
                  </Button>
                  <div className="flex items-center gap-2">
                    {settings?.hasKey && (
                      <Button type="button" variant="outline" size="sm" onClick={deleteSettings} disabled={saving}>
                        删除 Key
                      </Button>
                    )}
                    <Button type="submit" size="sm" disabled={saving || !form.baseUrl.trim() || !form.model.trim()}>
                      {saving ? "保存中..." : "加密保存"}
                    </Button>
                  </div>
                </div>
              </form>
            </section>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

const inputClassName =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500";

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[calc(100dvh-48px)] w-full max-w-[560px] overflow-y-auto rounded-xl border border-white/70 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.36)] dark:border-white/10 dark:bg-slate-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-100"
            aria-label="关闭"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function IdentityBadge({ active, icon, label }: { active: boolean; icon: ReactNode; label: string }) {
  return (
    <div
      className={cn(
        "flex h-10 items-center justify-between rounded-lg border px-3 text-xs font-medium",
        active
          ? "border-brand-200 bg-white text-brand-800 dark:border-brand-700/60 dark:bg-white/10 dark:text-brand-100"
          : "border-slate-200 bg-white/50 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500"
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span>{active ? "已绑定" : "未绑定"}</span>
    </div>
  );
}

function StatusMessage({ status, className }: { status: Status; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-lg px-3 py-2 text-xs leading-5",
        status.type === "success"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
          : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
        className
      )}
    >
      {status.text}
    </p>
  );
}

function ensurePasskeySupported() {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window) || !navigator.credentials) {
    throw new Error("当前浏览器不支持 Passkey，请使用支持 WebAuthn 的现代浏览器。");
  }
}

function authErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("sso") || lowerMessage.includes("single sign-on")) {
    return "当前账号由第三方登录创建，Supabase 暂不支持此类账号直接添加 Passkey。请先用邮箱登录后再添加。";
  }
  if (lowerMessage.includes("passkey_disabled")) {
    return "Passkey 尚未在 Supabase Dashboard 开启。";
  }
  if (lowerMessage.includes("webauthn_credential_exists")) {
    return "这个设备或安全密钥已经添加过 Passkey。";
  }
  if (lowerMessage.includes("cancel") || lowerMessage.includes("abort")) {
    return "操作已取消。";
  }
  if (message) return message;
  return fallback;
}

function formatDate(value?: string) {
  if (!value) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.38-3.37-1.38-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.93.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.95c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.95.68 1.91 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.08 10.08 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a4.5 4.5 0 1 1-2.2 3.87L4.5 20.42H2.25v-2.25L11.3 9.12a4.5 4.5 0 0 1 4.45-1.62Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 18.25 8.5 20" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function LoginIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4.5A1.5 1.5 0 0 1 21 4.5v15a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

function PasskeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.5a4.5 4.5 0 1 1 3.9 4.46" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 12.5h10M17.5 12.5v3M20.5 12.5v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 17.75c1.7.8 3.8.8 5.5 0" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h15A1.5 1.5 0 0 1 21 8.25v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.75v-7.5a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 8 8 5.5L20 8" />
    </svg>
  );
}
