import { Link } from "react-router";
import type { Route } from "./+types/index";
import { makeSSRClient } from "~/supa_clients";
import { redirect } from "react-router";

export const meta: Route.MetaFunction = () => {
  return [{ title: "홈 | 새 앱" }];
};

export async function loader({ request }: Route.LoaderArgs) {
  const { client } = makeSSRClient(request);
  const { data: userData } = await client.auth.getUser();

  return {
    isAuthenticated: !!userData?.user,
    userId: userData?.user?.id || null,
  };
}

export default function IndexPage({ loaderData }: Route.ComponentProps) {
  const { isAuthenticated, userId } = loaderData;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl px-8 py-10 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">새 앱</h1>
          <p className="text-sm text-gray-500 mt-1">Supabase 인증 예제</p>
        </div>

        {isAuthenticated ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                로그인 상태입니다!
              </p>
              <p className="text-xs text-green-600 mt-1">
                사용자 ID: {userId}
              </p>
            </div>
            <Link
              to="/admin"
              className="block w-full text-center py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              관리자 페이지로 이동
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-gray-600">
              로그인이 필요합니다.
            </p>
            <div className="flex gap-2">
              <Link
                to="/login"
                className="flex-1 text-center py-2 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                로그인
              </Link>
              <Link
                to="/join"
                className="flex-1 text-center py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                회원가입
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


