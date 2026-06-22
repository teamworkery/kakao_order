import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { browserClient } from "~/supa_clients";
import { BrandMark } from "~/common/components/brand-logo";
import type { Route } from "./+types/reset-password";

export const meta: Route.MetaFunction = () => {
  return [{ title: "새 비밀번호 설정 | 관리자 페이지" }];
};

const schema = z
  .object({
    password: z.string().min(6, { message: "비밀번호는 최소 6자 이상입니다." }),
    confirmPassword: z.string().min(6, { message: "비밀번호 확인을 입력해주세요." }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null); // null=확인중
  const navigate = useNavigate();

  // 복구 링크로 들어온 세션 감지 (detectSessionInUrl이 해시 토큰을 처리)
  useEffect(() => {
    let resolved = false;
    browserClient.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolved = true;
        setHasSession(true);
      }
    });

    const {
      data: { subscription },
    } = browserClient.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        resolved = true;
        setHasSession(true);
      }
    });

    // 일정 시간 후에도 세션이 없으면 만료/무효 링크로 간주
    const timer = setTimeout(() => {
      if (!resolved) setHasSession(false);
    }, 2500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const doUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setError(f.password?.[0] || f.confirmPassword?.[0] || "폼 검증 오류");
      setIsSubmitting(false);
      return;
    }

    const { error: updateError } = await browserClient.auth.updateUser({
      password: parsed.data.password,
    });

    setIsSubmitting(false);

    if (updateError) {
      setError("비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.");
      return;
    }

    // 변경 성공 → 로그인 페이지로
    await browserClient.auth.signOut();
    navigate("/login?reset=success");
  };

  return (
    <div className="bg-background-light font-display antialiased text-foreground min-h-screen flex flex-col">
      <header className="w-full px-6 py-4 lg:px-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5"><BrandMark className="size-8 text-primary" /><h2 className="text-xl font-extrabold leading-tight tracking-tight">pojang<span className="text-primary">.one</span><span className="ml-2 align-middle text-[12px] font-semibold text-muted-foreground">파트너</span></h2></Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="bg-card w-full max-w-md rounded-xl shadow-card p-8 sm:p-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">새 비밀번호 설정</h2>
            <p className="text-muted-foreground text-sm">새로 사용할 비밀번호를 입력하세요.</p>
          </div>

          {hasSession === false ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 text-destructive text-sm bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                <span className="material-symbols-outlined text-[20px]">link_off</span>
                <span>
                  유효하지 않거나 만료된 링크입니다. 비밀번호 재설정을 다시 요청해주세요.
                </span>
              </div>
              <Link
                to="/forgot-password"
                className="block text-center w-full h-12 leading-[3rem] bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
              >
                재설정 다시 요청하기
              </Link>
            </div>
          ) : hasSession === null ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <LoaderCircle className="animate-spin" />
              <span className="text-sm">링크 확인 중...</span>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={doUpdate}>
              <label className="block">
                <span className="text-foreground text-sm font-semibold mb-2 block">새 비밀번호</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                  </span>
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="새 비밀번호 (최소 6자)"
                    className="w-full h-12 pl-11 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-foreground text-sm font-semibold mb-2 block">비밀번호 확인</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                  </span>
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    placeholder="비밀번호를 다시 입력하세요"
                    className="w-full h-12 pl-11 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                  />
                </div>
              </label>
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? <LoaderCircle className="animate-spin" /> : "비밀번호 변경"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
