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

// 메뉴 데이터 조회 - displayOrder 순서대로 정렬
export const getadminMenuItems = async (
  client: SupabaseClient<Database>,
  profile_id: string
) => {
  const { data, error } = await client
    .from("menuItem")
    .select("*")
    .eq("profile_id", profile_id)
    .order("displayOrder", { ascending: true })
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

        // 현재 메뉴 개수를 확인하여 순서 설정
        const { count } = await client
          .from("menuItem")
          .select("*", { count: "exact", head: true })
          .eq("profile_id", profile_id);

        const displayOrder = (count || 0) + 1;

        const { error } = await client.from("menuItem").insert([
          {
            name: name.trim(),
            description: description?.trim() || "",
            price,
            image: image.trim(),
            isActive,
            category: category?.trim() || "",
            profile_id,
            displayOrder,
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

      case "reorder": {
        const menuOrder = formData.get("menuOrder") as string;
        if (!menuOrder) {
          return Response.json(
            { error: "메뉴 순서 정보가 필요합니다." },
            { status: 400 }
          );
        }

        try {
          const orderData = JSON.parse(menuOrder) as Array<{
            id: string;
            displayOrder: number;
          }>;

          // 배치 업데이트를 위한 쿼리들
          const updatePromises = orderData.map(({ id, displayOrder }) =>
            client
              .from("menuItem")
              .update({ displayOrder })
              .eq("id", id)
              .eq("profile_id", profile_id)
          );

          const results = await Promise.all(updatePromises);
          const hasError = results.some((result) => result.error);

          if (hasError) {
            console.error("메뉴 순서 업데이트 오류:", results);
            return Response.json(
              { error: "메뉴 순서 업데이트에 실패했습니다." },
              { status: 500 }
            );
          }

          return Response.json({ success: true, type: "reorder" });
        } catch (parseError) {
          console.error("순서 데이터 파싱 오류:", parseError);
          return Response.json(
            { error: "잘못된 순서 데이터입니다." },
            { status: 400 }
          );
        }
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
        const store_image = formData.get("store_image") as string;

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
              store_image: store_image?.trim() || null,
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
              store_image: store_image?.trim() || null,
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
  bucketName = "menu-images",
  filenamePrefix = "menu",
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  required?: boolean;
  bucketName?: string;
  filenamePrefix?: string;
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
      const filename = `${filenamePrefix}_${Date.now()}_${Math.floor(
        Math.random() * 10000
      )}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filename, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucketName).getPublicUrl(filename);

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

  // 프로필 이미지 상태
  const [storeImage, setStoreImage] = useState<string>(
    userProfile?.store_image || ""
  );

  // 메뉴 순서 변경을 위한 상태
  const [isReordering, setIsReordering] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [localMenuItems, setLocalMenuItems] = useState<MenuItem[]>(menuItems);

  const isSubmitting = navigation.state === "submitting";
  const isAdding = navigation.formData?.get("actionType") === "add";
  const isEditing = navigation.formData?.get("actionType") === "edit";
  const isUpdatingProfile =
    navigation.formData?.get("actionType") === "updateProfile";
  const isReorderingMenu =
    isReordering || navigation.formData?.get("actionType") === "reorder";

  // menuItems가 변경될 때 localMenuItems 동기화
  useEffect(() => {
    setLocalMenuItems(menuItems);
  }, [menuItems]);

  // userProfile이 변경될 때 storeImage 동기화
  useEffect(() => {
    if (userProfile?.store_image) {
      setStoreImage(userProfile.store_image);
    }
  }, [userProfile?.store_image]);

  // Action 결과 처리
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        const messages = {
          add: "메뉴가 성공적으로 추가되었습니다.",
          edit: "메뉴가 성공적으로 수정되었습니다.",
          delete: "메뉴가 성공적으로 삭제되었습니다.",
          reorder: "메뉴 순서가 성공적으로 변경되었습니다.",
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
          // 메뉴 추가 후 localMenuItems 동기화
          window.location.reload();
        } else if (actionData.type === "edit") {
          setEditingId(null);
          setEditForm({});
        } else if (actionData.type === "delete") {
          // 메뉴 삭제 후 localMenuItems 동기화
          window.location.reload();
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

  const handleStoreImageUpload = (url: string) => {
    setStoreImage(url);
  };

  // 메뉴 순서 변경 함수들
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();

    if (!draggedItem || draggedItem === targetItemId) {
      setDraggedItem(null);
      return;
    }

    setIsReordering(true);

    try {
      // 현재 메뉴 순서를 가져와서 순서 변경
      const currentOrder = localMenuItems.map((item, index) => ({
        id: item.id,
        displayOrder: index + 1,
      }));

      // 드래그된 아이템과 타겟 아이템의 위치를 찾기
      const draggedIndex = currentOrder.findIndex(
        (item) => item.id === draggedItem
      );
      const targetIndex = currentOrder.findIndex(
        (item) => item.id === targetItemId
      );

      if (draggedIndex === -1 || targetIndex === -1) return;

      // 순서 재배열
      const reorderedItems = [...currentOrder];
      const [draggedItemOrder] = reorderedItems.splice(draggedIndex, 1);

      if (draggedIndex < targetIndex) {
        // 아래로 드래그한 경우
        reorderedItems.splice(targetIndex, 0, draggedItemOrder);
      } else {
        // 위로 드래그한 경우
        reorderedItems.splice(targetIndex, 0, draggedItemOrder);
      }

      // 새로운 순서로 displayOrder 업데이트
      const updatedOrder = reorderedItems.map((item, index) => ({
        ...item,
        displayOrder: index + 1,
      }));

      // 로컬 상태를 즉시 업데이트하여 UI 반영
      const reorderedMenuItems = [...localMenuItems];
      const [draggedMenuItem] = reorderedMenuItems.splice(draggedIndex, 1);
      reorderedMenuItems.splice(targetIndex, 0, draggedMenuItem);

      // displayOrder 업데이트
      const updatedMenuItems = reorderedMenuItems.map((item, index) => ({
        ...item,
        displayOrder: index + 1,
      }));

      setLocalMenuItems(updatedMenuItems);

      // FormData를 사용하여 순서 업데이트 요청
      const formData = new FormData();
      formData.append("actionType", "reorder");
      formData.append("menuOrder", JSON.stringify(updatedOrder));

      const response = await fetch(window.location.href, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("순서 변경에 실패했습니다.");
      }
    } catch (error) {
      console.error("순서 변경 오류:", error);
      setShowToast({
        message: "메뉴 순서 변경에 실패했습니다.",
        type: "error",
      });
      // 실패 시 원래 순서로 복원
      setLocalMenuItems(menuItems);
    } finally {
      setIsReordering(false);
      setDraggedItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  // 카테고리 목록 추출
  const categories = Array.from(
    new Set(
      localMenuItems
        .map((item) => item.category)
        .filter((cat): cat is string => Boolean(cat))
    )
  );

  // 선택된 카테고리 상태 (사이드바에서 사용)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 선택된 카테고리의 메뉴만 필터링
  const filteredMenuItems = selectedCategory
    ? localMenuItems.filter((item) => item.category === selectedCategory)
    : localMenuItems;

  return (
    <div className="min-h-screen bg-background-light flex flex-col h-screen overflow-hidden">
      {showToast && (
        <Toast
          message={showToast.message}
          type={showToast.type}
          onClose={() => setShowToast(null)}
        />
      )}

      {/* Top Navigation Bar */}
      <header className="flex-none flex items-center justify-between whitespace-nowrap border-b border-solid border-border bg-white px-6 py-3 z-20 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="size-8 text-primary">
              <svg
                fill="none"
                viewBox="0 0 48 48"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_6_319)">
                  <path
                    d="M8.57829 8.57829C5.52816 11.6284 3.451 15.5145 2.60947 19.7452C1.76794 23.9758 2.19984 28.361 3.85056 32.3462C5.50128 36.3314 8.29667 39.7376 11.8832 42.134C15.4698 44.5305 19.6865 45.8096 24 45.8096C28.3135 45.8096 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z"
                    fill="currentColor"
                  ></path>
                </g>
                <defs>
                  <clipPath id="clip0_6_319">
                    <rect fill="white" height="48" width="48"></rect>
                  </clipPath>
                </defs>
              </svg>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">
              My Restaurant Admin
            </h2>
          </div>
          <label className="hidden md:flex flex-col min-w-40 !h-10 w-64">
            <div className="flex w-full flex-1 items-stretch rounded-xl h-full border border-transparent focus-within:border-primary/50 transition-colors">
              <div className="text-muted-foreground flex border-none bg-background-light items-center justify-center pl-4 rounded-l-xl border-r-0">
                <span className="material-symbols-outlined text-[20px]">
                  search
                </span>
              </div>
              <input
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-foreground focus:outline-0 focus:ring-0 border-none bg-background-light focus:border-none h-full placeholder:text-muted-foreground px-3 rounded-l-none border-l-0 text-sm font-normal leading-normal"
                placeholder="Quick search..."
              />
            </div>
          </label>
        </div>
        <div className="flex items-center justify-end gap-8">
          <nav className="hidden lg:flex items-center gap-6">
            <a
              className="text-foreground hover:text-primary transition-colors text-sm font-medium leading-normal"
              href="/admin"
            >
              Menu
            </a>
            <a
              className="text-foreground hover:text-primary transition-colors text-sm font-medium leading-normal"
              href="/owner/orders"
            >
              Orders
            </a>
            <a
              className="text-foreground hover:text-primary transition-colors text-sm font-medium leading-normal"
              href="#"
            >
              Settings
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="hidden xl:flex flex-col">
                <span className="text-xs font-bold text-foreground">
                  {userProfile?.email || "Admin"}
                </span>
                <span className="text-[10px] text-muted-foreground">Owner</span>
              </div>
            </div>
            <Form method="post">
              <input type="hidden" name="actionType" value="logout" />
              <button
                type="submit"
                className="flex items-center justify-center rounded-full size-9 bg-yellow-400 text-[#3c1e1e] hover:bg-yellow-500 transition-colors"
                title="Logged in with Kakao"
                disabled={isSubmitting}
              >
                <span className="material-symbols-outlined text-[20px]">
                  chat_bubble
                </span>
              </button>
            </Form>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 h-full overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-72 bg-white border-r border-border overflow-y-auto">
          <div className="p-6 flex flex-col gap-6">
            {/* Store Info Card */}
            <div className="bg-background-light p-4 rounded-xl border border-border flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="bg-primary/10 rounded-lg size-12 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    restaurant
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-green-200">
                  <span className="size-1.5 rounded-full bg-green-600 animate-pulse"></span>{" "}
                  Open
                </div>
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground">
                  {userProfile?.storename || "가게명"}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {userProfile?.name || "도메인"}
                </p>
              </div>
              <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                <span className="material-symbols-outlined text-[14px]">
                  schedule
                </span>
                <span>10:00 AM - 10:00 PM</span>
              </div>
              <button className="w-full h-8 flex items-center justify-center rounded-lg bg-white border border-border text-foreground text-xs font-medium hover:bg-gray-50 transition-colors">
                Edit Store Info
              </button>
            </div>
            {/* Categories */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-2 mb-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Categories
                </h3>
                <button className="text-primary hover:text-primary/80">
                  <span className="material-symbols-outlined text-[18px]">
                    add
                  </span>
                </button>
              </div>
              {/* All Items */}
              <div
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  selectedCategory === null
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "text-foreground hover:bg-background-light border border-transparent hover:border-border"
                }`}
                onClick={() => setSelectedCategory(null)}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px]">
                    apps
                  </span>
                  <span
                    className={`text-sm ${
                      selectedCategory === null ? "font-bold" : "font-medium"
                    }`}
                  >
                    All Items
                  </span>
                </div>
              </div>
              {/* Category Items */}
              {categories.map((cat) => (
                <div
                  key={cat}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "text-foreground hover:bg-background-light border border-transparent hover:border-border"
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">
                      lunch_dining
                    </span>
                    <span
                      className={`text-sm ${
                        selectedCategory === cat ? "font-bold" : "font-medium"
                      }`}
                    >
                      {cat}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[18px] opacity-50 cursor-grab active:cursor-grabbing">
                    drag_indicator
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto p-6 border-t border-border">
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-yellow-600 text-[20px]">
                  lightbulb
                </span>
                <p className="text-xs text-yellow-800 leading-relaxed">
                  <strong>Tip:</strong> Drag categories to reorder how they
                  appear in the customer app.
                </p>
              </div>
            </div>
          </div>
        </aside>
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-background-light">
          <div className="flex-1 overflow-y-auto px-6 pb-20 md:px-10">
            <div className="max-w-7xl mx-auto space-y-6 pt-6">
              {/* 메뉴 추가 폼 */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-primary/10 px-6 py-4 border-b border-primary/20">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    새 메뉴 추가
                  </h2>
                </div>
                <div className="p-6">
                  <Form method="post" className="space-y-4">
                    <input name="actionType" type="hidden" value="add" />

                    {/* 기본 정보 그룹 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          메뉴명 <span className="text-primary">*</span>
                        </label>
                        <input
                          name="name"
                          required
                          placeholder="예: 족발(앞다리)"
                          value={addForm.name}
                          onChange={handleAddChange}
                          className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
                          disabled={isSubmitting}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          가격 (원) <span className="text-primary">*</span>
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
                          className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
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
                          className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
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
                          className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
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
                        메뉴 이미지 <span className="text-primary">*</span>
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
                        className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
                        disabled={
                          isSubmitting ||
                          isAdding ||
                          !addForm.image ||
                          !addForm.name
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
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    가게 정보 관리
                  </h2>
                </div>
                <div className="p-6">
                  <Form method="post" className="space-y-4">
                    <input
                      name="actionType"
                      type="hidden"
                      value="updateProfile"
                    />

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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        가게 이미지
                      </label>
                      <ImageUploadInput
                        value={storeImage}
                        onChange={handleStoreImageUpload}
                        disabled={isSubmitting || isUpdatingProfile}
                        bucketName="store-images"
                        filenamePrefix="store"
                      />
                      <input
                        type="hidden"
                        name="store_image"
                        value={storeImage}
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

              {/* Page Heading & Actions */}
              <div className="flex-none p-6 md:px-10 md:pt-10 md:pb-6 bg-white/50 backdrop-blur-sm z-10">
                <div className="max-w-7xl mx-auto flex flex-col gap-6">
                  <div className="flex flex-wrap justify-between gap-4 items-end">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                        <span>Menu</span>
                        <span className="material-symbols-outlined text-[12px]">
                          chevron_right
                        </span>
                        <span className="text-primary">
                          {selectedCategory || "All Items"}
                        </span>
                      </div>
                      <h1 className="text-3xl font-bold text-foreground tracking-tight">
                        {selectedCategory || "All Items"}
                      </h1>
                      <p className="text-muted-foreground text-sm max-w-2xl">
                        Manage your menu items here. Prices include VAT.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button className="hidden sm:flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-border bg-white text-foreground text-sm font-bold hover:bg-gray-50 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">
                          swap_vert
                        </span>
                        Reorder Items
                      </button>
                      <button
                        onClick={() => {
                          const form = document.querySelector(
                            'form[method="post"]'
                          ) as HTMLFormElement;
                          if (form) {
                            const input = form.querySelector(
                              'input[name="actionType"]'
                            ) as HTMLInputElement;
                            if (input) input.value = "add";
                            form.scrollIntoView({ behavior: "smooth" });
                          }
                        }}
                        className="flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          add
                        </span>
                        Add New Item
                      </button>
                    </div>
                  </div>
                  {/* Filters Toolbar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-2 rounded-xl border border-border shadow-sm">
                    <div className="flex-1 relative max-w-md">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        search
                      </span>
                      <input
                        className="w-full pl-10 pr-4 py-2 bg-transparent border-none focus:ring-0 text-sm text-foreground placeholder:text-muted-foreground"
                        placeholder="Search items..."
                        type="text"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-2 overflow-x-auto pb-2 md:pb-0">
                      <button className="flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-medium">
                        <span className="material-symbols-outlined text-[16px]">
                          apps
                        </span>{" "}
                        All
                      </button>
                      <button className="flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg bg-background-light text-muted-foreground hover:bg-gray-200 transition-colors text-xs font-medium">
                        <span className="material-symbols-outlined text-[16px]">
                          check_circle
                        </span>{" "}
                        Available
                      </button>
                      <button className="flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg bg-background-light text-muted-foreground hover:bg-gray-200 transition-colors text-xs font-medium">
                        <span className="material-symbols-outlined text-[16px]">
                          cancel
                        </span>{" "}
                        Sold Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Scrollable Grid Content */}
              <div className="flex-1 overflow-y-auto px-6 pb-20 md:px-10">
                <div className="max-w-7xl mx-auto">
                  {filteredMenuItems.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="text-6xl mb-4">🍽️</div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        등록된 메뉴가 없습니다
                      </h3>
                      <p className="text-muted-foreground">
                        위에서 새 메뉴를 추가해보세요.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {/* 순서 변경 중 로딩 표시 */}
                      {isReorderingMenu && (
                        <div className="p-6 text-center bg-blue-50 border-l-4 border-blue-500">
                          <div className="flex items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-500"></div>
                            <p className="text-blue-700 font-medium">
                              메뉴 순서를 변경하는 중...
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Menu Item Cards */}
                      {filteredMenuItems.map((item: MenuItem) =>
                        editingId === item.id ? (
                          // 편집 모드
                          <div
                            key={item.id}
                            className="bg-orange-50 border-l-4 border-orange-500 p-6"
                          >
                            <Form method="post" id={`edit-form-${item.id}`}>
                              <input
                                type="hidden"
                                name="actionType"
                                value="edit"
                              />
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
                              <span className="material-symbols-outlined text-primary text-xl">
                                edit
                              </span>
                              <h3 className="font-semibold text-foreground">
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
                                    className="w-full border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                                    className="w-full border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                                    className="w-full border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center gap-2"
                                    disabled={
                                      isSubmitting ||
                                      isEditing ||
                                      !editForm.name
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
                          // 일반 보기 모드 - 카드 스타일
                          <div
                            key={item.id}
                            className={`group relative flex flex-col rounded-2xl bg-white border border-border overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 ${
                              draggedItem === item.id
                                ? "opacity-50 scale-95 shadow-lg"
                                : draggedItem && draggedItem !== item.id
                                ? "opacity-80"
                                : ""
                            } ${!item.isActive ? "opacity-90" : ""}`}
                            draggable={!isReordering}
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, item.id)}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                              {item.image ? (
                                <div
                                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                                  style={{
                                    backgroundImage: `url(${item.image})`,
                                  }}
                                ></div>
                              ) : (
                                <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                                  <span className="text-gray-400 text-4xl">
                                    🍽️
                                  </span>
                                </div>
                              )}
                              {!item.isActive && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <span className="bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold border border-white/20 backdrop-blur-sm">
                                    SOLD OUT
                                  </span>
                                </div>
                              )}
                              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-1.5 rounded-lg shadow-sm cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="material-symbols-outlined text-foreground text-[20px]">
                                  drag_indicator
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col flex-1 p-5 gap-3">
                              <div className="flex justify-between items-start gap-2">
                                <h3 className="font-bold text-lg text-foreground leading-tight">
                                  {item.name}
                                </h3>
                                <span className="font-bold text-primary text-lg">
                                  {item.price.toLocaleString()}원
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {item.description || ""}
                              </p>
                              {item.category && (
                                <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                                  {item.category}
                                </span>
                              )}
                              <div className="mt-auto pt-4 flex items-center justify-between border-t border-dashed border-border">
                                <div className="flex items-center gap-2">
                                  <button
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                                      item.isActive
                                        ? "bg-primary"
                                        : "bg-gray-300"
                                    }`}
                                    onClick={() => {
                                      // Toggle active status
                                      const form =
                                        document.createElement("form");
                                      form.method = "post";
                                      form.innerHTML = `
                                <input type="hidden" name="actionType" value="edit" />
                                <input type="hidden" name="id" value="${
                                  item.id
                                }" />
                                <input type="hidden" name="name" value="${
                                  item.name
                                }" />
                                <input type="hidden" name="description" value="${
                                  item.description || ""
                                }" />
                                <input type="hidden" name="price" value="${
                                  item.price
                                }" />
                                <input type="hidden" name="image" value="${
                                  item.image || ""
                                }" />
                                <input type="hidden" name="isActive" value="${!item.isActive}" />
                                <input type="hidden" name="category" value="${
                                  item.category || ""
                                }" />
                              `;
                                      document.body.appendChild(form);
                                      form.submit();
                                    }}
                                  >
                                    <span className="sr-only">
                                      Toggle availability
                                    </span>
                                    <span
                                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        item.isActive
                                          ? "translate-x-6"
                                          : "translate-x-1"
                                      }`}
                                    ></span>
                                  </button>
                                  <span className="text-xs font-medium text-foreground">
                                    {item.isActive ? "On Menu" : "Sold Out"}
                                  </span>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="Edit Item"
                                    onClick={() => startEdit(item)}
                                    disabled={isSubmitting}
                                  >
                                    <span className="material-symbols-outlined text-[20px]">
                                      edit
                                    </span>
                                  </button>
                                  <Form method="post" className="inline">
                                    <input
                                      type="hidden"
                                      name="actionType"
                                      value="delete"
                                    />
                                    <input
                                      type="hidden"
                                      name="id"
                                      value={item.id}
                                    />
                                    <button
                                      type="submit"
                                      className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                      title="Delete Item"
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
                                      <span className="material-symbols-outlined text-[20px]">
                                        delete
                                      </span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
