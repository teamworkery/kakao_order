import { useState } from "react";
import { Button } from "~/common/components/ui/button";
import type { Route } from "./+types/login";
import { Link, useNavigate } from "react-router";
import InputPair from "~/common/components/input-pair";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { createBrowserClient } from "@supabase/ssr";
import { redirect } from "react-router"; // loader에서만 사용
import { makeSSRClient } from "~/supa_clients";

export const meta: Route.MetaFunction = () => {
  return [{ title: "Login | 관리자 페이지" }];
};

const formSchema = z.object({
  email: z.string().email("유효하지 않은 이메일 주소입니다."),
  password: z.string().min(4, {
    message: "비밀번호는 최소 6자 이상입니다.",
  }),
});

// SSR 인증 상태 체크 (서버에서 실행)
export async function loader({ request }: Route.LoaderArgs) {
  const serverclient = makeSSRClient(request);
  const userResponse = await serverclient.client.auth.getUser();
  if (userResponse.data?.user) {
    throw redirect("/admin", { headers: serverclient.headers });
  }

  return {
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL!,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
    },
  };
}

export default function LoginPage({ loaderData }: Route.ComponentProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

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

    const supabase = createBrowserClient(
      loaderData.env.SUPABASE_URL,
      loaderData.env.SUPABASE_ANON_KEY
    );

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: formValues.email as string,
        password: formValues.password as string,
      });

    setIsSubmitting(false);

    if (loginError) {
      setError(loginError.message);
      return;
    }

    if (loginData.session) {
      navigate("/admin");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
      {/* 상단 Join 버튼 */}

      {/* 로그인 카드 */}
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl px-8 py-10 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">맛있는 식당</h1>
          <p className="text-sm text-gray-500 mt-1">관리자 페이지 로그인</p>
        </div>

        <form className="space-y-5" onSubmit={doLogin}>
          <InputPair
            label="Email"
            description="이메일 주소로 로그인해주세요."
            name="email"
            id="email"
            required
            type="email"
            placeholder="ex) woomin@workery.org"
            className="rounded-lg"
          />
          <InputPair
            id="password"
            label="Password"
            description="비밀번호를 입력해주세요."
            name="password"
            required
            type="password"
            placeholder="your password"
            className="rounded-lg"
          />
          {error && (
            <p className="text-sm text-red-500 text-center mt-2">{error}</p>
          )}
          <Button
            className="w-full py-3 rounded-lg font-semibold text-lg transition-colors bg-orange-500 text-white hover:bg-orange-600 disabled:bg-gray-300 disabled:text-gray-500"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              "로그인"
            )}
          </Button>

          <Button variant={"ghost"} asChild className="w-full">
            <Link to="/join">회원가입</Link>
          </Button>
        </form>
      </div>
    </div>
  );
}
