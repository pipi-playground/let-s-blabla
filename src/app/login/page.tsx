"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearCache } from "@/lib/client/cache";

type Tab = "signup" | "login";

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("signup");
  const [prefillEmail, setPrefillEmail] = useState("");
  const [justSignedUp, setJustSignedUp] = useState(false);

  function handleSignedUp(email: string) {
    setPrefillEmail(email);
    setJustSignedUp(true);
    setTab("login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold">렛블블</h1>
        <p className="mt-1 text-sm text-neutral-500">
          단축버튼 하나로 상대에게 푸시알림을 보내보세요
        </p>
      </div>

      <div className="grid grid-cols-2 rounded-lg bg-neutral-100 p-1 text-sm font-medium">
        <button
          className={`rounded-md py-2 transition ${
            tab === "signup" ? "bg-white shadow-sm" : "text-neutral-500"
          }`}
          onClick={() => setTab("signup")}
        >
          회원가입
        </button>
        <button
          className={`rounded-md py-2 transition ${
            tab === "login" ? "bg-white shadow-sm" : "text-neutral-500"
          }`}
          onClick={() => {
            setJustSignedUp(false);
            setTab("login");
          }}
        >
          로그인
        </button>
      </div>

      {tab === "signup" ? (
        <SignupForm onSignedUp={handleSignedUp} />
      ) : (
        <LoginForm initialEmail={prefillEmail} showSignedUpNotice={justSignedUp} />
      )}
    </main>
  );
}

function SignupForm({ onSignedUp }: { onSignedUp: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않아요.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: nickname.trim() ? { nickname: nickname.trim() } : undefined,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      // 이메일 인증이 켜져 있는 프로젝트일 경우: Supabase 대시보드에서
      // Authentication > Providers > Email > "Confirm email"을 꺼두세요.
      setError("가입은 완료됐지만 자동 로그인에 실패했어요. 로그인 탭에서 다시 시도해주세요.");
      setLoading(false);
      return;
    }

    // 가입 즉시 로그인시키지 않고, 로그인 탭에서 직접 로그인하도록 세션을 비운다.
    await supabase.auth.signOut();
    setLoading(false);
    onSignedUp(email);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field label="이메일">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="you@example.com"
        />
      </Field>
      <Field label="비밀번호">
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="6자 이상"
        />
      </Field>
      <Field label="비밀번호 확인">
        <input
          type="password"
          required
          minLength={6}
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className="input"
          placeholder="비밀번호 다시 입력"
        />
      </Field>
      <Field label="닉네임 (선택)">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="input"
          placeholder="비워두면 블블이00 형식으로 자동 부여"
          maxLength={20}
        />
      </Field>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary mt-2">
        {loading ? "가입 중..." : "가입하기"}
      </button>
    </form>
  );
}

function LoginForm({
  initialEmail = "",
  showSignedUpNotice = false,
}: {
  initialEmail?: string;
  showSignedUpNotice?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("이메일 또는 비밀번호가 올바르지 않아요.");
      setLoading(false);
      return;
    }

    // 이전 계정의 캐시가 남아 있지 않도록 로그인 직후 비움
    clearCache();
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {showSignedUpNotice && (
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600">
          가입이 완료됐어요. 로그인해주세요.
        </p>
      )}
      <Field label="이메일">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="you@example.com"
        />
      </Field>
      <Field label="비밀번호">
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
      </Field>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary mt-2">
        {loading ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
      {label}
      {children}
    </label>
  );
}
