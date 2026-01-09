// routes/customer/delete-account.tsx
import { useState } from "react";
import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import {
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import { makeSSRClient } from "~/supa_clients";

export async function loader({ request }: LoaderFunctionArgs) {
  const { client } = makeSSRClient(request);
  const { data: userRes } = await client.auth.getUser();
  const user = userRes?.user;

  if (!user) {
    throw redirect("/login?redirect=/customer/delete-account");
  }

  // 사용자 프로필 정보 조회
  const { data: profile } = await client
    .from("profiles")
    .select("email, customernumber")
    .eq("profile_id", user.id)
    .maybeSingle();

  return {
    email: profile?.email || user.email || "",
    phone: profile?.customernumber || "",
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { client } = makeSSRClient(request);
  const form = await request.formData();
  const confirmText = form.get("confirmText");

  if (confirmText !== "계정삭제") {
    return { error: "확인 문구가 일치하지 않습니다. '계정삭제'를 정확히 입력해주세요." };
  }

  const { data: userRes } = await client.auth.getUser();
  const user = userRes?.user;

  if (!user) {
    throw redirect("/login");
  }

  try {
    // 1. 사용자의 주문 내역에서 개인정보 익명화 (법적 보관 의무)
    await client
      .from("order")
      .update({ phoneNumber: "deleted_user" })
      .eq("profile_id", user.id);

    // 2. 프로필 삭제 (또는 익명화)
    await client
      .from("profiles")
      .delete()
      .eq("profile_id", user.id);

    // 3. Supabase Auth에서 로그아웃
    await client.auth.signOut();

    // 참고: Supabase Auth 사용자 완전 삭제는 서비스 역할 키가 필요합니다.
    // 프로덕션에서는 서버 사이드에서 admin.deleteUser()를 호출해야 합니다.

    return redirect("/?deleted=true");
  } catch (error) {
    console.error("Account deletion error:", error);
    return { error: "계정 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." };
  }
}

export default function DeleteAccountPage() {
  const { email, phone } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-red-600 text-3xl">
                warning
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">계정 삭제</h1>
            <p className="text-gray-600 mt-2">
              계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.
            </p>
          </div>

          {/* 계정 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">삭제될 계정 정보</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">이메일</span>
                <span className="text-gray-900">{email || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">전화번호</span>
                <span className="text-gray-900">{phone || "-"}</span>
              </div>
            </div>
          </div>

          {/* 주의사항 */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-red-800 mb-2">주의사항</h3>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• 삭제된 계정은 복구할 수 없습니다.</li>
              <li>• 주문 내역은 법적 보관 의무에 따라 익명화되어 보관됩니다.</li>
              <li>• 카카오 계정 연결이 해제됩니다.</li>
            </ul>
          </div>

          {!showConfirm ? (
            <div className="space-y-3">
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                계정 삭제 진행
              </button>
              <a
                href="/"
                className="block w-full py-3 px-4 text-center border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
              >
                취소
              </a>
            </div>
          ) : (
            <Form method="post" className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  확인을 위해 <strong className="text-red-600">'계정삭제'</strong>를 입력해주세요
                </label>
                <input
                  type="text"
                  name="confirmText"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="계정삭제"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  autoComplete="off"
                />
              </div>

              {actionData?.error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {actionData.error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirm(false);
                    setConfirmText("");
                  }}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={confirmText !== "계정삭제" || isSubmitting}
                  className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "삭제 중..." : "삭제 확인"}
                </button>
              </div>
            </Form>
          )}
        </div>

        {/* 관련 링크 */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <a href="/privacy" className="hover:underline">개인정보 처리방침</a>
          <span className="mx-2">•</span>
          <a href="/terms" className="hover:underline">이용약관</a>
        </div>
      </div>
    </div>
  );
}
