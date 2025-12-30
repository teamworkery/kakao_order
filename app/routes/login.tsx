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
    <div className="bg-background-light font-display antialiased text-foreground min-h-screen flex flex-col">
      {/* Header / Nav */}
      <header className="w-full px-6 py-4 lg:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3 text-foreground">
          <div className="text-primary size-8">
            <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4C25.7818 14.2173 33.7827 22.2182 44 24C33.7827 25.7818 25.7818 33.7827 24 44C22.2182 33.7827 14.2173 25.7818 4 24C14.2173 22.2182 22.2182 14.2173 24 4Z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-bold leading-tight tracking-tight">Partner Portal</h2>
        </div>
        <a className="hidden sm:flex items-center justify-center text-sm font-bold text-muted-foreground hover:text-primary transition-colors" href="#">
          Need help?
        </a>
      </header>
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="bg-white w-full max-w-5xl rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden flex flex-col lg:flex-row min-h-[640px]">
          {/* Left Side: Visual / Marketing */}
          <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-end p-10 bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.6) 100%), url(https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800)' }}>
            <div className="relative z-10 text-white space-y-4">
              <div className="size-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 border border-white/30">
                <span className="material-symbols-outlined text-white">restaurant</span>
              </div>
              <h1 className="text-3xl font-bold leading-tight">Manage your restaurant efficiently.</h1>
              <p className="text-white/90 font-medium text-lg leading-relaxed">Track orders, update menus, and analyze sales performance all in one place.</p>
            </div>
          </div>
          {/* Right Side: Form */}
          <div className="w-full lg:w-7/12 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button className="flex-1 py-5 text-center border-b-2 border-primary text-primary font-bold text-sm tracking-wide transition-colors">
                Login
              </button>
              <Link to="/join" className="flex-1 py-5 text-center border-b-2 border-transparent text-gray-500 hover:text-gray-800 font-bold text-sm tracking-wide transition-colors">
                Sign Up
              </Link>
            </div>
            {/* Form Container */}
            <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center max-w-lg mx-auto w-full">
              <div className="mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome Back</h2>
                <p className="text-gray-500">Enter your details to access your dashboard.</p>
              </div>
              <form action="#" className="space-y-5" onSubmit={doLogin}>
                {/* Email Input */}
                <label className="block">
                  <span className="text-foreground text-sm font-semibold mb-2 block">Email Address</span>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <span className="material-symbols-outlined text-[20px]">mail</span>
                    </span>
                    <input
                      name="email"
                      id="email"
                      required
                      type="email"
                      className="w-full h-12 pl-11 pr-4 rounded-lg bg-gray-50 border border-gray-200 text-foreground placeholder:text-gray-400 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                      placeholder="owner@restaurant.com"
                    />
                  </div>
                </label>
                {/* Password Input */}
                <label className="block">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground text-sm font-semibold">Password</span>
                    <a className="text-sm text-primary font-bold hover:underline" href="#">Forgot Password?</a>
                  </div>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                    </span>
                    <input
                      name="password"
                      id="password"
                      required
                      type="password"
                      className="w-full h-12 pl-11 pr-12 rounded-lg bg-gray-50 border border-gray-200 text-foreground placeholder:text-gray-400 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                      placeholder="Enter your password"
                    />
                    <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer" type="button">
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                  </div>
                </label>
                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <span>{error}</span>
                  </div>
                )}
                {/* Login Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-primary hover:bg-[#d66a1f] text-white font-bold rounded-lg transition-all shadow-[0_4px_14px_0_rgba(238,124,43,0.39)] hover:shadow-[0_6px_20px_rgba(238,124,43,0.23)] hover:-translate-y-0.5 active:translate-y-0 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    "Log In"
                  )}
                </button>
              </form>
              {/* Divider */}
              <div className="relative py-6 flex items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">Or continue with</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>
              {/* Social Login (Kakao) */}
              <button className="w-full h-12 bg-[#FEE500] hover:bg-[#fadd00] text-[#3c1e1e] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 relative overflow-hidden">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3C6.48 3 2 6.48 2 10.76C2 13.62 3.86 16.12 6.64 17.41L5.64 21.05C5.57 21.32 5.86 21.56 6.11 21.38L10.39 18.53C10.91 18.59 11.45 18.62 12 18.62C17.52 18.62 22 15.14 22 10.86C22 6.58 17.52 3 12 3Z"></path>
                </svg>
                <span>Login with Kakao</span>
              </button>
              <p className="mt-8 text-center text-xs text-gray-400 leading-relaxed">
                By continuing, you agree to our <a className="underline hover:text-gray-600" href="#">Terms of Service</a> and <a className="underline hover:text-gray-600" href="#">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </main>
      {/* Simple Footer */}
      <footer className="w-full py-6 text-center text-sm text-gray-400">
        © 2024 Partner Portal. All rights reserved.
      </footer>
    </div>
  );
}
