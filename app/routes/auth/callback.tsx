import { redirect } from "react-router";
import { makeSSRClient } from "../../supa_clients";
import type { Route } from "./+types/callback";

export async function loader({ request }: Route.LoaderArgs) {
  const { client, headers } = makeSSRClient(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("OAuth callback error:", error);
      // 에러 발생 시 로그인 페이지로 리다이렉트하거나 에러 페이지로 이동
      throw redirect(`${next}?error=auth_failed`, { headers });
    }
  }

  // 성공 시 원래 페이지로 리다이렉트
  throw redirect(next, { headers });
}

