import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
} from "react-router";
import type { Database } from "database.types";
import { browserClient, makeSSRClient } from "~/supa_clients";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Route } from "./+types/admin";

type MenuItem = Database["public"]["Tables"]["menuItem"]["Row"];

// ActionData 타입 정의
type ActionData = {
  success?: boolean;
  error?: string;
  type?: string;
};

// 메뉴 데이터 조회
export const getadminMenuItems = async (
  client: SupabaseClient<Database>,
  profile_id: string
) => {
  const { data, error } = await client
    .from("menuItem")
    .select("*")
    .eq("profile_id", profile_id)
    .order("createdAt", { ascending: true });

  if (error) {
    console.error("메뉴 조회 오류:", error);
    return [];
  }
  return data ?? [];
};

export const loader = async ({ request }: Route.LoaderArgs) => {
  try {
    const { client } = makeSSRClient(request);
    const { data: userData, error: authError } = await client.auth.getUser();

    if (authError || !userData?.user?.id) {
      throw redirect("/login");
    }

    const userId = userData.user.id;
    const [menuItems, profileResult] = await Promise.all([
      getadminMenuItems(client, userId),
      client.from("profiles").select("*").eq("profile_id", userId).single(),
    ]);

    return {
      menuItems,
      userProfile: profileResult.data,
      userId,
    };
  } catch (error) {
    console.error("Loader 오류:", error);
    throw redirect("/login");
  }
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { client } = makeSSRClient(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;

    // 로그아웃 처리
    if (actionType === "logout") {
      await client.auth.signOut();
      return redirect("/login");
    }

    // 사용자 인증 확인
    const { data: userData, error: authError } = await client.auth.getUser();
    if (authError || !userData?.user?.id) {
      return Response.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const profile_id = userData.user.id;

    // 공통 필드 추출 및 검증
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const priceStr = formData.get("price") as string;
    const image = formData.get("image") as string;
    const isActive = formData.get("isActive") === "true";
    const category = formData.get("category") as string;
    const id = formData.get("id") as string;

    // 가격 검증
    const price = Number(priceStr);
    if (isNaN(price) || price < 0) {
      return Response.json(
        { error: "올바른 가격을 입력해주세요." },
        { status: 400 }
      );
    }

    switch (actionType) {
      case "add": {
        if (!name?.trim()) {
          return Response.json(
            { error: "메뉴명은 필수입니다." },
            { status: 400 }
          );
        }
        if (!image?.trim()) {
          return Response.json(
            { error: "이미지는 필수입니다." },
            { status: 400 }
          );
        }

        const { error } = await client.from("menuItem").insert([
          {
            name: name.trim(),
            description: description?.trim() || "",
            price,
            image: image.trim(),
            isActive,
            category: category?.trim() || "",
            profile_id,
          },
        ]);

        if (error) {
          console.error("메뉴 추가 오류:", error);
          return Response.json(
            { error: "메뉴 추가에 실패했습니다." },
            { status: 500 }
          );
        }

        return Response.json({ success: true, type: "add" });
      }

      case "edit": {
        if (!id || !name?.trim()) {
          return Response.json(
            { error: "필수 정보가 누락되었습니다." },
            { status: 400 }
          );
        }

        const { error } = await client
          .from("menuItem")
          .update({
            name: name.trim(),
            description: description?.trim() || "",
            price,
            image: image?.trim() || "",
            isActive,
            category: category?.trim() || "",
          })
          .eq("id", id)
          .eq("profile_id", profile_id); // 보안: 자신의 메뉴만 수정 가능

        if (error) {
          console.error("메뉴 수정 오류:", error);
          return Response.json(
            { error: "메뉴 수정에 실패했습니다." },
            { status: 500 }
          );
        }

        return Response.json({ success: true, type: "edit" });
      }

      case "delete": {
        if (!id) {
          return Response.json(
            { error: "삭제할 메뉴 ID가 필요합니다." },
            { status: 400 }
          );
        }

        const { error } = await client
          .from("menuItem")
          .delete()
          .eq("id", id)
          .eq("profile_id", profile_id); // 보안: 자신의 메뉴만 삭제 가능

        if (error) {
          console.error("메뉴 삭제 오류:", error);
          return Response.json(
            { error: "메뉴 삭제에 실패했습니다." },
            { status: 500 }
          );
        }

        return Response.json({ success: true, type: "delete" });
      }

      case "updateProfile": {
        if (!name?.trim()) {
          return Response.json(
            { error: "이름은 필수입니다." },
            { status: 400 }
          );
        }
        if (!formData.get("storename")?.toString().trim()) {
          return Response.json(
            { error: "가게명은 필수입니다." },
            { status: 400 }
          );
        }

        const storename = formData.get("storename") as string;
        const storenumber = formData.get("storenumber") as string;

        // 프로필이 이미 존재하는지 확인
        const { data: existingProfile } = await client
          .from("profiles")
          .select("profile_id")
          .eq("profile_id", profile_id)
          .single();

        if (existingProfile) {
          // 기존 프로필 업데이트
          const { error } = await client
            .from("profiles")
            .update({
              name: name.trim(),
              storename: storename.trim(),
              storenumber: storenumber?.trim() || null,
            })
            .eq("profile_id", profile_id);

          if (error) {
            console.error("프로필 업데이트 오류:", error);
            return Response.json(
              { error: "가게 정보 업데이트에 실패했습니다." },
              { status: 500 }
            );
          }
        } else {
          // 새 프로필 생성
          const { error } = await client.from("profiles").insert([
            {
              profile_id,
              name: name.trim(),
              storename: storename.trim(),
              storenumber: storenumber?.trim() || null,
              email: userData.user.email,
            },
          ]);

          if (error) {
            console.error("프로필 생성 오류:", error);
            return Response.json(
              { error: "가게 정보 생성에 실패했습니다." },
              { status: 500 }
            );
          }
        }

        return Response.json({ success: true, type: "updateProfile" });
      }

      default:
        return Response.json(
          { error: "알 수 없는 액션입니다." },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Action 오류:", error);
    return Response.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 개선된 이미지 업로드 컴포넌트
function ImageUploadInput({
  value,
  onChange,
  disabled = false,
  required = false,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 검증 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      setError("파일 크기는 5MB 이하여야 합니다.");
      return;
    }

    // 파일 형식 검증
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const supabase = browserClient;
      const ext = file.name.split(".").pop();
      const filename = `menu_${Date.now()}_${Math.floor(
        Math.random() * 10000
      )}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(filename, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("menu-images").getPublicUrl(filename);

      onChange(publicUrl);
    } catch (err: any) {
      setError("업로드 실패: " + (err.message || "알 수 없는 오류"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 파일 선택 버튼 */}
      <div className="flex items-center gap-3">
        <label className="relative cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled || uploading}
            className="sr-only"
          />
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors disabled:opacity-50">
            <span className="text-lg">📷</span>
            <span className="text-sm font-medium">
              {uploading ? "업로드 중..." : "이미지 선택"}
            </span>
          </div>
        </label>
        {required && (
          <span className="text-orange-500 text-sm font-medium">*</span>
        )}
      </div>

      {/* 업로드 상태 */}
      {uploading && (
        <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-200 border-t-orange-500"></div>
          <p className="text-sm text-orange-700 font-medium">
            이미지 업로드 중...
          </p>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 flex items-center gap-2">
            <span>❌</span>
            {error}
          </p>
        </div>
      )}

      {/* 이미지 미리보기 */}
      {value && !uploading && (
        <div className="relative inline-block">
          <img
            src={value}
            alt="업로드된 이미지"
            className="w-32 h-24 object-cover rounded-lg border-2 border-gray-200 shadow-sm"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg transition-colors"
            disabled={disabled}
            title="이미지 삭제"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// 토스트 알림 컴포넌트
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "success" ? "bg-green-500" : "bg-red-500";

  return (
    <div
      className={`fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-sm`}
    >
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-gray-200"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// 메인 컴포넌트
export default function AdminMenuPage() {
  const { menuItems, userProfile } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});
  const [showToast, setShowToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
    isActive: "true",
    category: "",
  });

  const isSubmitting = navigation.state === "submitting";
  const isAdding = navigation.formData?.get("actionType") === "add";
  const isEditing = navigation.formData?.get("actionType") === "edit";
  const isUpdatingProfile =
    navigation.formData?.get("actionType") === "updateProfile";

  // Action 결과 처리
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        const messages = {
          add: "메뉴가 성공적으로 추가되었습니다.",
          edit: "메뉴가 성공적으로 수정되었습니다.",
          delete: "메뉴가 성공적으로 삭제되었습니다.",
          updateProfile: "가게 정보가 성공적으로 저장되었습니다.",
        };
        setShowToast({
          message:
            messages[actionData.type as keyof typeof messages] ||
            "작업이 완료되었습니다.",
          type: "success",
        });

        // 성공 시 폼 초기화
        if (actionData.type === "add") {
          setAddForm({
            name: "",
            description: "",
            price: "",
            image: "",
            isActive: "true",
            category: "",
          });
        } else if (actionData.type === "edit") {
          setEditingId(null);
          setEditForm({});
        }
      } else if (actionData.error) {
        setShowToast({ message: actionData.error, type: "error" });
      }
    }
  }, [actionData]);

  // 폼 핸들러들
  const handleAddChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setAddForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddImageUpload = (url: string) => {
    setAddForm((prev) => ({ ...prev, image: url }));
  };

  const startEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // 수정 폼의 필드명을 실제 데이터베이스 필드명으로 매핑
    const fieldMap: { [key: string]: string } = {
      editName: "name",
      editDescription: "description",
      editPrice: "price",
      editCategory: "category",
      editIsActive: "isActive",
    };

    const actualFieldName = fieldMap[name] || name;
    const processedValue =
      actualFieldName === "isActive"
        ? value === "true"
        : actualFieldName === "price"
        ? Number(value)
        : value;

    setEditForm((prev) => ({
      ...prev,
      [actualFieldName]: processedValue,
    }));
  };

  const handleEditImageUpload = (url: string) => {
    setEditForm((prev) => ({ ...prev, image: url }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showToast && (
        <Toast
          message={showToast.message}
          type={showToast.type}
          onClose={() => setShowToast(null)}
        />
      )}

      {/* 헤더 - 모바일 우선 디자인 */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                🍴 메뉴 관리
              </h1>
              {userProfile && (
                <p className="text-sm text-gray-600 mt-1">
                  관리자:{" "}
                  <span className="font-medium text-orange-600">
                    {userProfile.email}
                  </span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <a
                href="/owner/orders"
                className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200"
              >
                📋 주문 관리
              </a>
              <Form method="post">
                <input type="hidden" name="actionType" value="logout" />
                <button
                  type="submit"
                  className="bg-gray-500 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  로그아웃
                </button>
              </Form>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 메뉴 추가 폼 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-orange-50 px-6 py-4 border-b border-orange-100">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              ➕ 새 메뉴 추가
            </h2>
          </div>
          <div className="p-6">
            <Form method="post" className="space-y-4">
              <input name="actionType" type="hidden" value="add" />

              {/* 기본 정보 그룹 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    메뉴명 <span className="text-orange-500">*</span>
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="예: 족발(앞다리)"
                    value={addForm.name}
                    onChange={handleAddChange}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    가격 (원) <span className="text-orange-500">*</span>
                  </label>
                  <input
                    name="price"
                    required
                    type="number"
                    min="0"
                    step="100"
                    placeholder="8000"
                    value={addForm.price}
                    onChange={handleAddChange}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <input
                  name="description"
                  placeholder="메뉴에 대한 간단한 설명을 입력하세요"
                  value={addForm.description}
                  onChange={handleAddChange}
                  className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                  disabled={isSubmitting}
                />
              </div>

              {/* 카테고리와 상태 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    카테고리
                  </label>
                  <input
                    name="category"
                    placeholder="예: 버거, 음료, 사이드"
                    value={addForm.category}
                    onChange={handleAddChange}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상태
                  </label>
                  <select
                    name="isActive"
                    value={addForm.isActive}
                    onChange={handleAddChange}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                    disabled={isSubmitting}
                  >
                    <option value="true">활성</option>
                    <option value="false">비활성</option>
                  </select>
                </div>
              </div>

              {/* 이미지 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  메뉴 이미지 <span className="text-orange-500">*</span>
                </label>
                <ImageUploadInput
                  value={addForm.image}
                  onChange={handleAddImageUpload}
                  disabled={isSubmitting}
                  required
                />
                <input type="hidden" name="image" value={addForm.image} />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={
                    isSubmitting || isAdding || !addForm.image || !addForm.name
                  }
                >
                  {isAdding && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  )}
                  {isAdding ? "추가 중..." : "메뉴 추가"}
                </button>
              </div>
            </Form>
          </div>
        </div>

        {/* 가게 정보 관리 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              🏪 가게 정보 관리
            </h2>
          </div>
          <div className="p-6">
            <Form method="post" className="space-y-4">
              <input name="actionType" type="hidden" value="updateProfile" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름 <span className="text-blue-500">*</span>
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="예: 김철수"
                    defaultValue={userProfile?.name || ""}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    disabled={isSubmitting || isUpdatingProfile}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    가게명 <span className="text-blue-500">*</span>
                  </label>
                  <input
                    name="storename"
                    required
                    placeholder="예: 맛있는 족발집"
                    defaultValue={userProfile?.storename || ""}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    disabled={isSubmitting || isUpdatingProfile}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  가게 전화번호
                </label>
                <input
                  name="storenumber"
                  placeholder="예: 02-1234-5678"
                  defaultValue={userProfile?.storenumber || ""}
                  className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  disabled={isSubmitting || isUpdatingProfile}
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={isSubmitting || isUpdatingProfile}
                >
                  {isSubmitting || isUpdatingProfile ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    "가게 정보 저장"
                  )}
                </button>
              </div>
            </Form>
          </div>
        </div>

        {/* 메뉴 목록 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              📋 메뉴 목록
            </h2>
            <span className="bg-orange-100 text-orange-800 text-sm font-medium px-3 py-1 rounded-full">
              {menuItems.length}개
            </span>
          </div>

          {menuItems.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🍽️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                등록된 메뉴가 없습니다
              </h3>
              <p className="text-gray-500">위에서 새 메뉴를 추가해보세요.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* 메뉴 아이템들 */}
              {menuItems.map((item: MenuItem) =>
                editingId === item.id ? (
                  // 편집 모드
                  <div
                    key={item.id}
                    className="bg-orange-50 border-l-4 border-orange-500 p-6"
                  >
                    <Form method="post" id={`edit-form-${item.id}`}>
                      <input type="hidden" name="actionType" value="edit" />
                      <input type="hidden" name="id" value={item.id} />
                      <input
                        type="hidden"
                        name="image"
                        value={editForm.image || ""}
                      />
                      <input
                        type="hidden"
                        name="name"
                        value={editForm.name || ""}
                      />
                      <input
                        type="hidden"
                        name="description"
                        value={editForm.description || ""}
                      />
                      <input
                        type="hidden"
                        name="price"
                        value={editForm.price || 0}
                      />
                      <input
                        type="hidden"
                        name="isActive"
                        value={editForm.isActive ? "true" : "false"}
                      />
                      <input
                        type="hidden"
                        name="category"
                        value={editForm.category || ""}
                      />
                    </Form>

                    <div className="flex items-start gap-2 mb-4">
                      <span className="text-orange-600 text-xl">✏️</span>
                      <h3 className="font-semibold text-gray-800">
                        메뉴 수정 중
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          이미지
                        </label>
                        <ImageUploadInput
                          value={editForm.image || ""}
                          onChange={handleEditImageUpload}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="lg:col-span-4 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            메뉴명
                          </label>
                          <input
                            value={editForm.name || ""}
                            onChange={handleEditChange}
                            name="editName"
                            placeholder="메뉴명"
                            className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            disabled={isSubmitting}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            설명
                          </label>
                          <input
                            value={editForm.description || ""}
                            onChange={handleEditChange}
                            name="editDescription"
                            placeholder="설명"
                            className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            카테고리
                          </label>
                          <input
                            value={editForm.category || ""}
                            onChange={handleEditChange}
                            name="editCategory"
                            placeholder="카테고리"
                            className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          가격 (원)
                        </label>
                        <input
                          value={editForm.price || 0}
                          onChange={handleEditChange}
                          name="editPrice"
                          type="number"
                          className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          disabled={isSubmitting}
                          min="0"
                        />
                      </div>

                      <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          상태
                        </label>
                        <select
                          value={editForm.isActive ? "true" : "false"}
                          onChange={handleEditChange}
                          name="editIsActive"
                          className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          disabled={isSubmitting}
                        >
                          <option value="true">활성</option>
                          <option value="false">비활성</option>
                        </select>
                      </div>

                      <div className="lg:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          작업
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            form={`edit-form-${item.id}`}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center gap-2"
                            disabled={
                              isSubmitting || isEditing || !editForm.name
                            }
                          >
                            {isEditing && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            )}
                            저장
                          </button>
                          <button
                            type="button"
                            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg transition-colors duration-200"
                            onClick={cancelEdit}
                            disabled={isSubmitting}
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // 일반 보기 모드
                  <div
                    key={item.id}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                      <div className="lg:col-span-2">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full lg:w-20 h-48 lg:h-16 object-cover rounded-lg shadow-sm"
                          />
                        ) : (
                          <div className="w-full lg:w-20 h-48 lg:h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-gray-400 text-2xl lg:text-base">
                              🍽️
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="lg:col-span-4">
                        <div className="mb-2">
                          <h3 className="font-semibold text-gray-900 text-lg">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-gray-600 mt-1">
                              {item.description}
                            </p>
                          )}
                          {item.category && (
                            <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full mt-2">
                              #{item.category}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="lg:col-span-2">
                        <div className="lg:text-right">
                          <p className="text-xl font-bold text-orange-600">
                            {item.price.toLocaleString()}원
                          </p>
                        </div>
                      </div>

                      <div className="lg:col-span-1">
                        {item.isActive ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                            활성
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                            <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                            비활성
                          </span>
                        )}
                      </div>

                      <div className="lg:col-span-3">
                        <div className="flex gap-2 pt-2 lg:pt-0">
                          <button
                            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 font-medium shadow-sm"
                            onClick={() => startEdit(item)}
                            disabled={isSubmitting}
                          >
                            수정
                          </button>
                          <Form method="post" className="inline">
                            <input
                              type="hidden"
                              name="actionType"
                              value="delete"
                            />
                            <input type="hidden" name="id" value={item.id} />
                            <button
                              type="submit"
                              className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 font-medium shadow-sm"
                              disabled={isSubmitting}
                              onClick={(e) => {
                                if (
                                  !confirm(
                                    `"${item.name}" 메뉴를 정말 삭제하시겠습니까?\n\n삭제된 메뉴는 복구할 수 없습니다.`
                                  )
                                ) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              삭제
                            </button>
                          </Form>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
