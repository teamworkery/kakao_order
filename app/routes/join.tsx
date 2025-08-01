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
    <div className="flex flex-col relative items-center justify-center h-full">
      <Button variant={"ghost"} asChild className="absolute right-8 top-8 ">
        <Link to="/join">Join</Link>
      </Button>
      <div className="flex items-center flex-col justify-center w-full max-w-md gap-10">
        <h1 className="text-2xl font-semibold">맛있는 식당 관리자 페이지</h1>
        <form className="w-full space-y-4" onSubmit={doLogin}>
          <InputPair
            label="Email"
            description="이메일 주소로 로그인해주세요."
            name="email"
            id="email"
            required
            type="email"
            placeholder="ex) woomin@workery.org"
          />
          <InputPair
            id="password"
            label="Password"
            description="비밀번호를 입력해주세요."
            name="password"
            required
            type="password"
            placeholder="your password"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              "Log in"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
