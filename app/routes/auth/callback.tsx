import { redirect } from "react-router";
import { makeSSRClient } from "../../supa_clients";
import type { Route } from "./+types/callback";

export async function loader({ request }: Route.LoaderArgs) {
  const { client, headers } = makeSSRClient(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (code) {
    const { data: sessionData, error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("OAuth callback error:", error);
      // 에러 발생 시 로그인 페이지로 리다이렉트하거나 에러 페이지로 이동
      throw redirect(`${next}?error=auth_failed`, { headers });
    }

    // 프로필 자동 생성 (customer로 기본 설정)
    if (sessionData?.user) {
      const userId = sessionData.user.id;
      const userEmail = sessionData.user.email;

      // 기존 프로필 확인
      const { data: existingProfile } = await client
        .from("profiles")
        .select("profile_id, role, customernumber")
        .eq("profile_id", userId)
        .maybeSingle();

      // 프로필이 없으면 customer로 생성
      if (!existingProfile) {
        const { error: profileError } = await client
          .from("profiles")
          .insert([
            {
              profile_id: userId,
              email: userEmail,
              role: "customer",
              customernumber: null,
            },
          ]);

        if (profileError) {
          console.error("프로필 생성 오류:", profileError);
          // 프로필 생성 실패해도 로그인은 진행 (나중에 전화번호 입력 시 생성 가능)
        }
        // 전화번호가 없어도 원래 페이지로 리다이렉트 (전화번호 입력은 $name 페이지에서 처리)
      }
      // 전화번호가 없어도 원래 페이지로 리다이렉트 (전화번호 입력은 $name 페이지에서 처리)
    }
  }

  // 성공 시 원래 페이지로 리다이렉트
  throw redirect(next, { headers });
}

