import { useState } from "react";
import { Button } from "~/common/components/ui/button";
import { Link, useNavigate } from "react-router";
import InputPair from "~/common/components/input-pair";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { createBrowserClient } from "@supabase/ssr";
import { redirect } from "react-router";
import { makeSSRClient } from "~/supa_clients";
import type { Route } from "./+types/join";

export const meta: Route.MetaFunction = () => {
  return [{ title: "회원가입 | 맛있는 식당" }];
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

export default function JoinPage({ loaderData }: Route.ComponentProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const doJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
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

    const supabase = createBrowserClient(
      loaderData.env.SUPABASE_URL,
      loaderData.env.SUPABASE_ANON_KEY
    );

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email: formValues.email as string,
        password: formValues.password as string,
      }
    );

    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (signUpData.user) {
      setSuccess("이메일 인증 후 로그인 페이지에서 로그인 해주세요.");
    } else {
      setError("회원가입에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
      {/* 회원가입 카드 */}
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl px-8 py-10 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">맛있는 식당</h1>
          <p className="text-sm text-gray-500 mt-1">회원가입</p>
        </div>

        <form className="space-y-5" onSubmit={doJoin}>
          <InputPair
            label="Email"
            description="사용할 이메일 주소를 입력해주세요.(인증필요)"
            name="email"
            id="email"
            required
            type="email"
            placeholder="example@example.com"
            className="rounded-lg"
          />
          <InputPair
            id="password"
            label="Password"
            description="6자 이상의 비밀번호를 입력해주세요."
            name="password"
            required
            type="password"
            placeholder="your password"
            className="rounded-lg"
          />
          <InputPair
            id="confirmPassword"
            label="Password Confirm"
            description="비밀번호를 한 번 더 입력해주세요."
            name="confirmPassword"
            required
            type="password"
            placeholder="confirm your password"
            className="rounded-lg"
          />
          {error && (
            <p className="text-sm text-red-500 text-center mt-2">{error}</p>
          )}

          {/* ✅ 성공 메시지 표시 */}
          {success && (
            <p className="text-sm text-green-600 text-center mt-2">{success}</p>
          )}

          <Button
            className="w-full py-3 rounded-lg font-semibold text-lg transition-colors bg-orange-500 text-white hover:bg-orange-600 disabled:bg-gray-300 disabled:text-gray-500"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              "회원가입"
            )}
          </Button>

          <Button variant={"ghost"} asChild className="w-full">
            <Link to="/login">이미 계정이 있으신가요? 로그인</Link>
          </Button>
        </form>
      </div>
    </div>
  );
}


