import { useState } from "react";
import { Button } from "~/common/components/ui/button";
import type { Route } from "./+types/join";
import { Link, useNavigate } from "react-router";
import InputPair from "~/common/components/input-pair";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { redirect } from "react-router";
import { makeSSRClient, browserClient } from "~/supa_clients";
import { BrandMark } from "~/common/components/brand-logo";

export const meta: Route.MetaFunction = () => {
  return [{ title: "사장님 회원가입 | pojang.one 파트너" }];
};

const formSchema = z
  .object({
    email: z.string().email("유효하지 않은 이메일 주소입니다."),
    password: z.string().min(6, {
      message: "비밀번호는 최소 6자 이상입니다.",
    }),
    confirmPassword: z.string().min(6, {
      message: "비밀번호 확인을 입력해주세요.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

// SSR 인증 상태 체크 (서버에서 실행)
// 점주(Partner Portal) 전용 — 로그인된 사용자는 /admin(없으면 온보딩)으로 보낸다.
export async function loader({ request }: Route.LoaderArgs) {
  const serverclient = makeSSRClient(request);
  const userResponse = await serverclient.client.auth.getUser();
  if (userResponse.data?.user) {
    throw redirect("/admin", { headers: serverclient.headers });
  }

  return null;
}

export default function JoinPage({ loaderData }: Route.ComponentProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();

  // 카카오로 회원가입 (점주 포털 → /admin 온보딩으로)
  const handleKakaoJoin = async () => {
    if (!agreed) {
      setError("이용약관 및 개인정보처리방침에 동의해주세요.");
      return;
    }
    const baseUrl =
      (import.meta.env.VITE_APP_URL as string | undefined) ||
      window.location.origin;
    const { error: oauthError } = await browserClient.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${baseUrl}/auth/callback?next=/admin` },
    });
    if (oauthError) {
      setError("카카오 회원가입 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const doJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!agreed) {
      setError("이용약관 및 개인정보처리방침에 동의해주세요.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const formValues = Object.fromEntries(formData.entries());

    const { success, data, error: zodError } = formSchema.safeParse(formValues);

    if (!success) {
      setError(
        zodError.flatten().fieldErrors.email?.[0] ||
          zodError.flatten().fieldErrors.password?.[0] ||
          zodError.flatten().fieldErrors.confirmPassword?.[0] ||
          "폼 검증 오류"
      );
      setIsSubmitting(false);
      return;
    }

    const { data: signUpData, error: signUpError } = await browserClient.auth.signUp(
      {
        email: formValues.email as string,
        password: formValues.password as string,
      }
    );

    setIsSubmitting(false);

    if (signUpError) {
      // 에러 메시지를 사용자 친화적으로 변환
      let friendlyMessage = "회원가입에 실패했습니다. 다시 시도해주세요.";
      if (signUpError.message.includes("User already registered")) {
        friendlyMessage = "이미 가입된 이메일 주소입니다.";
      } else if (signUpError.message.includes("Invalid email")) {
        friendlyMessage = "유효하지 않은 이메일 주소입니다.";
      } else if (signUpError.message.includes("Password should be at least")) {
        friendlyMessage = "비밀번호는 최소 6자 이상이어야 합니다.";
      } else if (signUpError.message.includes("Too many requests")) {
        friendlyMessage = "잠시 후 다시 시도해주세요. (요청이 너무 많습니다)";
      }
      setError(friendlyMessage);
      return;
    }

    if (signUpData.user) {
      setSuccess("이메일 인증 후 로그인 페이지에서 로그인 해주세요.");
    } else {
      setError("회원가입에 실패했습니다.");
    }
  };

  return (
    <div className="bg-background-light font-display antialiased text-foreground min-h-screen flex flex-col">
      {/* Header / Nav */}
      <header className="w-full px-6 py-4 lg:px-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark className="size-8 text-primary" />
          <h2 className="text-xl font-extrabold leading-tight tracking-tight">
            pojang<span className="text-primary">.one</span>
            <span className="ml-2 align-middle text-[12px] font-semibold text-muted-foreground">파트너</span>
          </h2>
        </Link>
        <a className="hidden sm:flex items-center justify-center text-sm font-bold text-muted-foreground hover:text-primary transition-colors" href="#">
          도움이 필요하신가요?
        </a>
      </header>
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="bg-card w-full max-w-5xl rounded-xl shadow-card overflow-hidden flex flex-col lg:flex-row min-h-[640px]">
          {/* Left Side: Visual / Marketing — 라이트 브랜드 톤(메인 히어로와 통일) */}
          <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-between p-10 bg-muted/40 border-r border-border overflow-hidden">
            {/* 웜 글로우 — index 히어로와 동일한 시각 언어 */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_0%,rgba(238,124,43,0.10),transparent_70%)]" />
            <div className="relative z-10">
              <BrandMark className="size-10 text-primary" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/15">
                <span className="material-symbols-outlined text-primary">restaurant</span>
              </div>
              <h1 className="text-3xl font-bold leading-tight text-foreground">오늘부터 매장 관리를<br />시작하세요.</h1>
              <p className="text-muted-foreground font-medium text-lg leading-relaxed">수많은 점주님들이 신뢰하는 플랫폼에 함께하세요.</p>
            </div>
          </div>
          {/* Right Side: Form */}
          <div className="w-full lg:w-7/12 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-border">
              <Link to="/login" className="flex-1 py-5 text-center border-b-2 border-transparent text-muted-foreground hover:text-foreground font-bold text-sm tracking-wide transition-colors">
                로그인
              </Link>
              <button className="flex-1 py-5 text-center border-b-2 border-primary text-primary font-bold text-sm tracking-wide transition-colors">
                회원가입
              </button>
            </div>
            {/* Form Container */}
            <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center max-w-2xl mx-auto w-full">
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">사장님(점주) 회원가입</h2>
                <p className="text-muted-foreground">포장 주문을 받을 가게를 운영하실 사장님을 위한 가입입니다.</p>
              </div>
              {/* 일반 주문 고객을 위한 안내 — 잘못 들어온 손님이 헷갈리지 않도록 */}
              <div className="mb-6 flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg p-3">
                <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">info</span>
                <span className="leading-relaxed">
                  주문하러 오셨나요? 손님은 <strong className="font-semibold text-foreground">가입 없이</strong> 가게 주소(예: <span className="font-mono">pojang.one/가게이름</span>)에서 바로 주문할 수 있어요.
                </span>
              </div>
              <form action="#" className="space-y-5" onSubmit={doJoin}>
                {/* Email Input */}
                <label className="block">
                  <span className="text-foreground text-sm font-semibold mb-2 block">이메일 주소</span>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <span className="material-symbols-outlined text-[20px]">mail</span>
                    </span>
                    <input
                      name="email"
                      id="email"
                      required
                      type="email"
                      className="w-full h-12 pl-11 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                      placeholder="owner@restaurant.com"
                    />
                  </div>
                </label>
                {/* Password Input */}
                <label className="block">
                  <span className="text-foreground text-sm font-semibold mb-2 block">비밀번호</span>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                    </span>
                    <input
                      name="password"
                      id="password"
                      required
                      type="password"
                      className="w-full h-12 pl-11 pr-12 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                      placeholder="비밀번호 입력 (최소 6자)"
                    />
                    <button className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground cursor-pointer" type="button">
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                  </div>
                </label>
                {/* Confirm Password Input */}
                <label className="block">
                  <span className="text-foreground text-sm font-semibold mb-2 block">비밀번호 확인</span>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                    </span>
                    <input
                      name="confirmPassword"
                      id="confirmPassword"
                      required
                      type="password"
                      className="w-full h-12 pl-11 pr-12 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                      placeholder="비밀번호를 다시 입력하세요"
                    />
                    <button className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground cursor-pointer" type="button">
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                  </div>
                </label>
                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <span>{error}</span>
                  </div>
                )}
                {/* Success Message */}
                {success && (
                  <div className="flex items-center gap-2 text-success text-sm bg-success/10 p-3 rounded-lg border border-success/20">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>{success}</span>
                  </div>
                )}
                {/* 약관 동의 */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground leading-relaxed">
                    <Link to="/terms" target="_blank" className="text-primary font-semibold hover:underline">이용약관</Link>
                    {" 및 "}
                    <Link to="/privacy" target="_blank" className="text-primary font-semibold hover:underline">개인정보처리방침</Link>
                    에 동의합니다. <span className="text-primary">*</span>
                  </span>
                </label>
                {/* Sign Up Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !agreed}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-all shadow-glow hover:-translate-y-0.5 active:translate-y-0 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    "회원가입"
                  )}
                </button>
              </form>
              {/* 카카오 회원가입 숨김 (2026-06-29): 수동 인계 단계 footgun(빈 계정 생성) 방지. 코드 보존 — 재노출 시 false→true */}
              {false && (
                <>
                  {/* Divider */}
                  <div className="relative py-6 flex items-center">
                    <div className="flex-grow border-t border-border"></div>
                    <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm font-medium">또는</span>
                    <div className="flex-grow border-t border-border"></div>
                  </div>
                  {/* Social Login (Kakao) */}
                  <button
                    type="button"
                    onClick={handleKakaoJoin}
                    className="w-full h-12 bg-[#FEE500] hover:bg-[#fadd00] text-[#3c1e1e] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 3C6.48 3 2 6.48 2 10.76C2 13.62 3.86 16.12 6.64 17.41L5.64 21.05C5.57 21.32 5.86 21.56 6.11 21.38L10.39 18.53C10.91 18.59 11.45 18.62 12 18.62C17.52 18.62 22 15.14 22 10.86C22 6.58 17.52 3 12 3Z"></path>
                    </svg>
                    <span>카카오로 회원가입</span>
                  </button>
                </>
              )}
              <p className="mt-8 text-center text-xs text-muted-foreground leading-relaxed">
                계속 진행하면 <Link className="underline hover:text-muted-foreground" to="/terms">이용약관</Link> 및 <Link className="underline hover:text-muted-foreground" to="/privacy">개인정보처리방침</Link>에 동의하는 것으로 간주됩니다.
              </p>
            </div>
          </div>
        </div>
      </main>
      {/* Simple Footer */}
      <footer className="w-full py-6 text-center text-sm text-muted-foreground">
        © 2026 워커리(Workery) · pojang.one
      </footer>
    </div>
  );
}
