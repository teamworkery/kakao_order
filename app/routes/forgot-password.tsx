import { useState } from "react";
import { Link } from "react-router";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { browserClient } from "~/supa_clients";
import type { Route } from "./+types/forgot-password";

export const meta: Route.MetaFunction = () => {
  return [{ title: "비밀번호 찾기 | 관리자 페이지" }];
};

const schema = z.object({
  email: z.string().email("유효하지 않은 이메일 주소입니다."),
});

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const doReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;

    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.flatten().fieldErrors.email?.[0] || "폼 검증 오류");
      setIsSubmitting(false);
      return;
    }

    const baseUrl =
      (import.meta.env.VITE_APP_URL as string | undefined) ||
      window.location.origin;

    const { error: resetError } = await browserClient.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${baseUrl}/reset-password` }
    );

    setIsSubmitting(false);

    if (resetError) {
      // 이메일 존재 여부 노출 방지를 위해 성공 메시지를 동일하게 처리
      console.error("비밀번호 재설정 메일 발송 오류:", resetError);
    }
    // 보안상 항상 동일한 안내 (계정 존재 여부 비노출)
    setSent(true);
  };

  return (
    <div className="bg-background-light font-display antialiased text-foreground min-h-screen flex flex-col">
      <header className="w-full px-6 py-4 lg:px-12 flex items-center justify-between">
        <Link to="/login" className="flex items-center gap-3 text-foreground">
          <div className="text-primary size-8">
            <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4C25.7818 14.2173 33.7827 22.2182 44 24C33.7827 25.7818 25.7818 33.7827 24 44C22.2182 33.7827 14.2173 25.7818 4 24C14.2173 22.2182 22.2182 14.2173 24 4Z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-bold leading-tight tracking-tight">Partner Portal</h2>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="bg-white w-full max-w-md rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-8 sm:p-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">비밀번호 재설정</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
            </p>
          </div>

          {sent ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 text-green-700 text-sm bg-green-50 p-4 rounded-lg border border-green-100">
                <span className="material-symbols-outlined text-[20px]">mark_email_read</span>
                <span>
                  입력하신 이메일로 재설정 링크를 보냈습니다. 메일함(스팸함 포함)을 확인해주세요.
                </span>
              </div>
              <Link
                to="/login"
                className="block text-center w-full h-12 leading-[3rem] bg-primary hover:bg-[#d66a1f] text-white font-bold rounded-lg transition-colors"
              >
                로그인으로 돌아가기
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={doReset}>
              <label className="block">
                <span className="text-foreground text-sm font-semibold mb-2 block">이메일 주소</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <span className="material-symbols-outlined text-[20px]">mail</span>
                  </span>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="owner@restaurant.com"
                    className="w-full h-12 pl-11 pr-4 rounded-lg bg-gray-50 border border-gray-200 text-foreground placeholder:text-gray-400 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                  />
                </div>
              </label>
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-primary hover:bg-[#d66a1f] text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? <LoaderCircle className="animate-spin" /> : "재설정 링크 보내기"}
              </button>
              <p className="text-center text-sm text-gray-500">
                <Link to="/login" className="text-primary font-bold hover:underline">
                  로그인으로 돌아가기
                </Link>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
