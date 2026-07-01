import { useState } from "react";
import { Button } from "~/common/components/ui/button";
import type { Route } from "./+types/login";
import { Link, useNavigate, useSearchParams } from "react-router";
import InputPair from "~/common/components/input-pair";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { redirect } from "react-router"; // loader에서만 사용
import { makeSSRClient, browserClient } from "~/supa_clients";
import { BrandMark } from "~/common/components/brand-logo";

export const meta: Route.MetaFunction = () => {
  return [{ title: "로그인 | 관리자 페이지" }];
};

const formSchema = z.object({
  email: z.string().email("유효하지 않은 이메일 주소입니다."),
  password: z.string().min(4, {
    message: "비밀번호는 최소 6자 이상입니다.",
  }),
});

// 오픈 리다이렉트 방지: 내부 경로(`/...`)만 허용하고, 프로토콜 상대(`//`)는 차단.
// 알림톡 버튼 등 외부에서 `?next=/owner/orders` 로 들어오면 로그인 후 그 페이지로 복귀한다.
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/admin";
}

// SSR 인증 상태 체크 (서버에서 실행)
// 이 페이지는 점주(Partner Portal) 전용이므로, 로그인된 사용자는 next(기본 /admin) 로 보낸다.
// (가게가 아직 없으면 /admin 이 온보딩 화면을 띄운다.)
export async function loader({ request }: Route.LoaderArgs) {
  const serverclient = makeSSRClient(request);
  const userResponse = await serverclient.client.auth.getUser();
  if (userResponse.data?.user) {
    const next = safeNext(new URL(request.url).searchParams.get("next"));
    throw redirect(next, { headers: serverclient.headers });
  }

  return null;
}

export default function LoginPage({ loaderData }: Route.ComponentProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";
  // 로그인 후 복귀할 경로 (알림톡 버튼: /owner/orders). 내부 경로만 허용.
  const next = safeNext(searchParams.get("next"));

  // 카카오 로그인 (점주 포털 → 성공 시 next(기본 /admin) 으로)
  const handleKakaoLogin = async () => {
    const baseUrl =
      (import.meta.env.VITE_APP_URL as string | undefined) ||
      window.location.origin;
    const { error: oauthError } = await browserClient.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) {
      setError("카카오 로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const doLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const formValues = Object.fromEntries(formData.entries());

    const { success, data, error: zodError } = formSchema.safeParse(formValues);

    if (!success) {
      setError(
        zodError.flatten().fieldErrors.email?.[0] ||
          zodError.flatten().fieldErrors.password?.[0] ||
          "폼 검증 오류"
      );
      setIsSubmitting(false);
      return;
    }

    const { data: loginData, error: loginError } =
      await browserClient.auth.signInWithPassword({
        email: formValues.email as string,
        password: formValues.password as string,
      });

    setIsSubmitting(false);

    if (loginError) {
      // 에러 메시지를 사용자 친화적으로 변환
      let friendlyMessage = "로그인에 실패했습니다. 다시 시도해주세요.";
      if (loginError.message.includes("Invalid login credentials")) {
        friendlyMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";
      } else if (loginError.message.includes("Email not confirmed")) {
        friendlyMessage = "이메일 인증이 필요합니다. 메일함을 확인해주세요.";
      } else if (loginError.message.includes("Too many requests")) {
        friendlyMessage = "잠시 후 다시 시도해주세요. (요청이 너무 많습니다)";
      }
      setError(friendlyMessage);
      return;
    }

    if (loginData.session) {
      navigate(next);
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
              <h1 className="text-3xl font-bold leading-tight text-foreground">매장을 효율적으로<br />관리하세요.</h1>
              <p className="text-muted-foreground font-medium text-lg leading-relaxed">주문 확인, 메뉴 업데이트, 매출 분석을 한 곳에서.</p>
            </div>
          </div>
          {/* Right Side: Form */}
          <div className="w-full lg:w-7/12 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-border">
              <button className="flex-1 py-5 text-center border-b-2 border-primary text-primary font-bold text-sm tracking-wide transition-colors">
                로그인
              </button>
              <Link to="/join" className="flex-1 py-5 text-center border-b-2 border-transparent text-muted-foreground hover:text-foreground font-bold text-sm tracking-wide transition-colors">
                회원가입
              </Link>
            </div>
            {/* Form Container */}
            <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center max-w-2xl mx-auto w-full">
              <div className="mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">다시 오신 것을 환영합니다</h2>
                <p className="text-muted-foreground">계정 정보를 입력하여 대시보드에 접속하세요.</p>
              </div>
              {resetSuccess && (
                <div className="mb-5 flex items-center gap-2 text-success text-sm bg-success/10 p-3 rounded-lg border border-success/20">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.</span>
                </div>
              )}
              <form action="#" className="space-y-5" onSubmit={doLogin}>
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
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground text-sm font-semibold">비밀번호</span>
                    <Link className="text-sm text-primary font-bold hover:underline" to="/forgot-password">비밀번호를 잊으셨나요?</Link>
                  </div>
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
                      placeholder="비밀번호를 입력하세요"
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
                {/* Login Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-all shadow-glow hover:-translate-y-0.5 active:translate-y-0 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    "로그인"
                  )}
                </button>
              </form>
              {/* 카카오 로그인 숨김 (2026-06-29): 수동 인계 단계 footgun(빈 계정 생성) 방지. 코드 보존 — 재노출 시 false→true */}
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
                    onClick={handleKakaoLogin}
                    className="w-full h-12 bg-[#FEE500] hover:bg-[#fadd00] text-[#3c1e1e] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 3C6.48 3 2 6.48 2 10.76C2 13.62 3.86 16.12 6.64 17.41L5.64 21.05C5.57 21.32 5.86 21.56 6.11 21.38L10.39 18.53C10.91 18.59 11.45 18.62 12 18.62C17.52 18.62 22 15.14 22 10.86C22 6.58 17.52 3 12 3Z"></path>
                    </svg>
                    <span>카카오로 로그인</span>
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
