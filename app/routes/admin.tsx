import { useState, useEffect, useMemo, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
  useFetcher,
} from "react-router";
import type { Database, Tables } from "database.types";
import { browserClient, makeSSRClient } from "~/supa_clients";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Route } from "./+types/admin";
import { BrandMark } from "~/common/components/brand-logo";

type MenuItem = Database["public"]["Tables"]["menuItem"]["Row"];
type Category = Tables<"categories">;
type Profile = Tables<"profiles">;
type AdminOptionGroup = Tables<"menu_option_groups"> & {
  menu_options: Tables<"menu_options">[];
};

// 영업 시간 타입
type StoreHour = {
  id?: string;
  profile_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

const DAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

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
    const [menuItems, profileResult, categoriesResult, storeHoursResult, optionGroupsResult] = await Promise.all([
      getadminMenuItems(client, userId),
      client.from("profiles").select("*").eq("profile_id", userId).single(),
      client
        .from("categories")
        .select("*")
        .eq("profile_id", userId)
        .order("display_order", { ascending: true }),
      client
        .from("store_hours")
        .select("*")
        .eq("profile_id", userId)
        .order("day_of_week", { ascending: true }),
      client
        .from("menu_option_groups")
        .select("*, menu_options(*)")
        .eq("profile_id", userId)
        .order("display_order", { ascending: true }),
    ]);

    // 프로필이 아직 없거나(신규 가입), owner가 아니거나, 가게명이 없으면 온보딩 필요
    const profile = profileResult.data ?? null;
    const needsOnboarding =
      !profile || profile.role !== "owner" || !profile.storename;

    return {
      menuItems,
      userProfile: profile,
      userId,
      categories: categoriesResult.data || [],
      storeHours: storeHoursResult.data || [],
      optionGroups: optionGroupsResult.data || [],
      needsOnboarding,
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
    const categoryId = formData.get("category_id") as string;
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
            category_id:
              categoryId && categoryId.trim() !== "" ? categoryId : null,
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
            category_id:
              categoryId && categoryId.trim() !== "" ? categoryId : null,
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

      case "addCategory": {
        const categoryName = formData.get("categoryName") as string;
        if (!categoryName?.trim()) {
          return Response.json(
            { error: "카테고리 이름을 입력해주세요." },
            { status: 400 }
          );
        }

        // 현재 카테고리 개수를 확인하여 순서 설정
        const { count } = await client
          .from("categories")
          .select("*", { count: "exact", head: true })
          .eq("profile_id", profile_id);

        const display_order = (count || 0) + 1;

        const { error } = await client.from("categories").insert([
          {
            profile_id,
            name: categoryName.trim(),
            display_order,
          },
        ]);

        if (error) {
          console.error("카테고리 추가 오류:", error);
          if (error.code === "23505") {
            // Unique constraint violation
            return Response.json(
              { error: "이미 존재하는 카테고리입니다." },
              { status: 400 }
            );
          }
          return Response.json(
            { error: "카테고리 추가에 실패했습니다." },
            { status: 500 }
          );
        }

        return Response.json({ success: true, type: "addCategory" });
      }

      case "deleteCategory": {
        const categoryId = formData.get("categoryId") as string;
        if (!categoryId) {
          return Response.json(
            { error: "카테고리 ID가 필요합니다." },
            { status: 400 }
          );
        }

        // 해당 카테고리를 사용하는 메뉴 아이템이 있는지 확인
        const { count } = await client
          .from("menuItem")
          .select("*", { count: "exact", head: true })
          .eq("category_id", categoryId);

        if (count && count > 0) {
          return Response.json(
            {
              error: `이 카테고리를 사용하는 메뉴 아이템이 ${count}개 있습니다. 먼저 메뉴의 카테고리를 변경해주세요.`,
            },
            { status: 400 }
          );
        }

        const { error } = await client
          .from("categories")
          .delete()
          .eq("id", categoryId)
          .eq("profile_id", profile_id); // 보안: 자신의 카테고리만 삭제 가능

        if (error) {
          console.error("카테고리 삭제 오류:", error);
          return Response.json(
            { error: "카테고리 삭제에 실패했습니다." },
            { status: 500 }
          );
        }

        return Response.json({ success: true, type: "deleteCategory" });
      }

      case "reorderCategories": {
        const categoryOrder = formData.get("categoryOrder") as string;
        if (!categoryOrder) {
          return Response.json(
            { error: "카테고리 순서 정보가 필요합니다." },
            { status: 400 }
          );
        }

        try {
          const orderData = JSON.parse(categoryOrder) as Array<{
            id: string;
            display_order: number;
          }>;

          const updatePromises = orderData.map(({ id, display_order }) =>
            client
              .from("categories")
              .update({ display_order })
              .eq("id", id)
              .eq("profile_id", profile_id)
          );

          const results = await Promise.all(updatePromises);
          const hasError = results.some((result) => result.error);

          if (hasError) {
            console.error("카테고리 순서 업데이트 오류:", results);
            return Response.json(
              { error: "카테고리 순서 업데이트에 실패했습니다." },
              { status: 500 }
            );
          }

          return Response.json({ success: true, type: "reorderCategories" });
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
            { error: "가게 주소(URL)는 필수입니다." },
            { status: 400 }
          );
        }
        if (!formData.get("storename")?.toString().trim()) {
          return Response.json(
            { error: "가게명은 필수입니다." },
            { status: 400 }
          );
        }

        // 가게 주소(URL)는 최초 설정 후 변경 불가 — 기존 값이 있으면 강제로 유지
        const { data: existingSlugRow } = await client
          .from("profiles")
          .select("name")
          .eq("profile_id", profile_id)
          .maybeSingle();
        const lockedSlug = existingSlugRow?.name?.trim() || null;

        // 가게 주소(slug) 정규화 및 형식 검증
        const slug = lockedSlug ?? name.trim().toLowerCase();
        const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
        const RESERVED = new Set([
          "admin", "login", "join", "owner", "customer", "auth", "api",
          "privacy", "terms", "index", "assets", "static", "public",
          "menu-images", "store-images", "forgot-password", "reset-password",
        ]);
        if (!SLUG_RE.test(slug)) {
          return Response.json(
            {
              error:
                "가게 주소는 영문 소문자·숫자·하이픈(-)만 사용해 3~32자로 입력해주세요. (예: goodmorning-china)",
            },
            { status: 400 }
          );
        }
        if (RESERVED.has(slug)) {
          return Response.json(
            { error: "사용할 수 없는 주소입니다. 다른 주소를 입력해주세요." },
            { status: 400 }
          );
        }

        // 다른 가게가 이미 같은 주소를 쓰는지 확인 (자기 자신 제외, 공개 뷰 사용)
        const { data: slugOwner } = await client
          .from("public_stores")
          .select("profile_id")
          .eq("name", slug)
          .neq("profile_id", profile_id)
          .maybeSingle();
        if (slugOwner) {
          return Response.json(
            { error: "이미 사용 중인 가게 주소입니다. 다른 주소를 입력해주세요." },
            { status: 400 }
          );
        }

        const storename = formData.get("storename") as string;
        const storenumber = formData.get("storenumber") as string;
        const owner_phone = formData.get("owner_phone") as string;
        const store_image = formData.get("store_image") as string;
        const store_description = formData.get("store_description") as string;

        const profileFields = {
          name: slug,
          storename: storename.trim(),
          storenumber: storenumber?.trim() || null,
          owner_phone: owner_phone?.trim() || null,
          store_image: store_image?.trim() || null,
          store_description:
            store_description?.trim() && store_description.trim().length > 0
              ? store_description.trim().slice(0, 500)
              : null,
          role: "owner" as const, // 가게 정보를 저장하면 점주로 승격
        };

        // 프로필이 이미 존재하는지 확인
        const { data: existingProfile } = await client
          .from("profiles")
          .select("profile_id")
          .eq("profile_id", profile_id)
          .maybeSingle();

        if (existingProfile) {
          const { error } = await client
            .from("profiles")
            .update(profileFields)
            .eq("profile_id", profile_id);

          if (error) {
            console.error("프로필 업데이트 오류:", error);
            return Response.json(
              { error: "가게 정보 업데이트에 실패했습니다." },
              { status: 500 }
            );
          }
        } else {
          const { error } = await client.from("profiles").insert([
            {
              profile_id,
              email: userData.user.email,
              ...profileFields,
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

      case "updateStoreHours": {
        const storeHoursData = formData.get("storeHours") as string;
        if (!storeHoursData) {
          return Response.json(
            { error: "영업 시간 데이터가 필요합니다." },
            { status: 400 }
          );
        }

        try {
          const hours = JSON.parse(storeHoursData) as StoreHour[];

          // 각 요일별로 upsert
          for (const hour of hours) {
            const { error } = await client
              .from("store_hours")
              .upsert({
                profile_id,
                day_of_week: hour.day_of_week,
                open_time: hour.is_closed ? null : hour.open_time,
                close_time: hour.is_closed ? null : hour.close_time,
                is_closed: hour.is_closed,
              }, {
                onConflict: "profile_id,day_of_week",
              });

            if (error) {
              console.error("영업 시간 저장 오류:", error);
              return Response.json(
                { error: "영업 시간 저장에 실패했습니다." },
                { status: 500 }
              );
            }
          }

          return Response.json({ success: true, type: "updateStoreHours" });
        } catch (parseError) {
          console.error("영업 시간 데이터 파싱 오류:", parseError);
          return Response.json(
            { error: "잘못된 영업 시간 데이터입니다." },
            { status: 400 }
          );
        }
      }

      case "updatePrepTime": {
        const prepTime = Number(formData.get("prepTime") ?? 15);
        if (prepTime < 1 || prepTime > 180) {
          return Response.json(
            { error: "조리 시간은 1분에서 180분 사이여야 합니다." },
            { status: 400 }
          );
        }

        const { error } = await client
          .from("profiles")
          .update({ default_prep_time_minutes: prepTime })
          .eq("profile_id", profile_id);

        if (error) {
          console.error("조리 시간 저장 오류:", error);
          return Response.json(
            { error: "조리 시간 저장에 실패했습니다." },
            { status: 500 }
          );
        }

        return Response.json({ success: true, type: "updatePrepTime" });
      }

      case "addOptionGroup": {
        const menuItemId = formData.get("menu_item_id") as string;
        const groupName = (formData.get("groupName") as string)?.trim();
        const minSelect = Number(formData.get("min_select") ?? 0);
        const maxSelect = Number(formData.get("max_select") ?? 1);
        if (!menuItemId || !groupName) {
          return Response.json({ error: "옵션 그룹 이름을 입력해주세요." }, { status: 400 });
        }
        const { count } = await client
          .from("menu_option_groups")
          .select("*", { count: "exact", head: true })
          .eq("menu_item_id", menuItemId);
        const { error } = await client.from("menu_option_groups").insert([
          {
            profile_id,
            menu_item_id: menuItemId,
            name: groupName,
            min_select: Math.max(0, isNaN(minSelect) ? 0 : minSelect),
            max_select: Math.max(1, isNaN(maxSelect) ? 1 : maxSelect),
            display_order: (count || 0) + 1,
          },
        ]);
        if (error) {
          console.error("옵션 그룹 추가 오류:", error);
          return Response.json({ error: "옵션 그룹 추가에 실패했습니다." }, { status: 500 });
        }
        return Response.json({ success: true, type: "option" });
      }

      case "deleteOptionGroup": {
        const groupId = formData.get("groupId") as string;
        if (!groupId) return Response.json({ error: "그룹 ID가 필요합니다." }, { status: 400 });
        const { error } = await client
          .from("menu_option_groups")
          .delete()
          .eq("id", groupId)
          .eq("profile_id", profile_id);
        if (error) {
          console.error("옵션 그룹 삭제 오류:", error);
          return Response.json({ error: "옵션 그룹 삭제에 실패했습니다." }, { status: 500 });
        }
        return Response.json({ success: true, type: "option" });
      }

      case "addOption": {
        const groupId = formData.get("group_id") as string;
        const optionName = (formData.get("optionName") as string)?.trim();
        const priceDelta = Number(formData.get("price_delta") ?? 0);
        if (!groupId || !optionName) {
          return Response.json({ error: "옵션 이름을 입력해주세요." }, { status: 400 });
        }
        const { count } = await client
          .from("menu_options")
          .select("*", { count: "exact", head: true })
          .eq("group_id", groupId);
        const { error } = await client.from("menu_options").insert([
          {
            profile_id,
            group_id: groupId,
            name: optionName,
            price_delta: isNaN(priceDelta) ? 0 : priceDelta,
            display_order: (count || 0) + 1,
          },
        ]);
        if (error) {
          console.error("옵션 추가 오류:", error);
          return Response.json({ error: "옵션 추가에 실패했습니다." }, { status: 500 });
        }
        return Response.json({ success: true, type: "option" });
      }

      case "deleteOption": {
        const optionId = formData.get("optionId") as string;
        if (!optionId) return Response.json({ error: "옵션 ID가 필요합니다." }, { status: 400 });
        const { error } = await client
          .from("menu_options")
          .delete()
          .eq("id", optionId)
          .eq("profile_id", profile_id);
        if (error) {
          console.error("옵션 삭제 오류:", error);
          return Response.json({ error: "옵션 삭제에 실패했습니다." }, { status: 500 });
        }
        return Response.json({ success: true, type: "option" });
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류";
      setError("업로드 실패: " + errorMessage);
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
          <div className="flex items-center gap-2 px-4 py-2 bg-primary-light text-primary rounded-lg border border-primary/20 hover:bg-primary-light/70 transition-colors disabled:opacity-50">
            <span className="text-sm font-medium">
              {uploading ? "업로드 중..." : "이미지 선택"}
            </span>
          </div>
        </label>
        {required && (
          <span className="text-primary text-sm font-medium">*</span>
        )}
      </div>

      {/* 업로드 상태 */}
      {uploading && (
        <div className="flex items-center gap-3 p-3 bg-primary-light rounded-lg">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary/20 border-t-primary"></div>
          <p className="text-sm text-primary font-medium">
            이미지 업로드 중...
          </p>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive flex items-center gap-2">
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
            className="w-32 h-24 object-cover rounded-lg border-2 border-border shadow-sm"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg transition-colors"
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

  const bgColor = type === "success" ? "bg-success" : "bg-destructive";

  return (
    <div
      className={`fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-sm`}
    >
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-muted-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// 메인 컴포넌트
export default function AdminMenuPage() {
  const { menuItems, userProfile, categories, storeHours, optionGroups, needsOnboarding } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const optionFetcher = useFetcher();
  // 순서변경·판매토글용 백그라운드 fetcher (페이지 새로고침·스크롤 이동 없음)
  const menuFetcher = useFetcher();

  // 옵션 관리 모달 대상 메뉴 id
  const [optionMgrItemId, setOptionMgrItemId] = useState<string | null>(null);

  // 메뉴 id별 옵션 그룹
  const optionGroupsByItem = useMemo(() => {
    const map = new Map<string, AdminOptionGroup[]>();
    for (const g of (optionGroups as AdminOptionGroup[]) || []) {
      const arr = map.get(g.menu_item_id) || [];
      arr.push(g);
      map.set(g.menu_item_id, arr);
    }
    return map;
  }, [optionGroups]);

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
    category_id: "",
  });

  const [categoryName, setCategoryName] = useState("");
  const [localCategories, setLocalCategories] = useState<Category[]>(categories || []);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [isReorderingCategories, setIsReorderingCategories] = useState(false);

  // 프로필 이미지 상태
  const [storeImage, setStoreImage] = useState<string>(
    userProfile?.store_image || ""
  );

  // 영업 시간 상태
  const [localStoreHours, setLocalStoreHours] = useState<StoreHour[]>(() => {
    // 기본 영업 시간 생성 (모든 요일 10:00~22:00)
    const defaultHours: StoreHour[] = [];
    const storeHoursArray = storeHours || [];
    for (let i = 0; i < 7; i++) {
      const existing = storeHoursArray.find((h) => h.day_of_week === i);
      defaultHours.push({
        profile_id: userProfile?.profile_id || "",
        day_of_week: i,
        open_time: existing?.open_time || "10:00",
        close_time: existing?.close_time || "22:00",
        is_closed: existing?.is_closed || false,
      });
    }
    return defaultHours;
  });

  // 기본 조리 시간 상태
  const [defaultPrepTime, setDefaultPrepTime] = useState<number>(
    userProfile?.default_prep_time_minutes || 15
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

  // menuItems가 변경될 때 localMenuItems 동기화
  useEffect(() => {
    setLocalMenuItems(menuItems);
  }, [menuItems]);

  // categories가 변경될 때 localCategories 동기화
  useEffect(() => {
    setLocalCategories(categories || []);
  }, [categories]);

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
          addCategory: "카테고리가 성공적으로 추가되었습니다.",
          deleteCategory: "카테고리가 성공적으로 삭제되었습니다.",
          reorderCategories: "카테고리 순서가 성공적으로 변경되었습니다.",
          updateStoreHours: "영업 시간이 성공적으로 저장되었습니다.",
          updatePrepTime: "기본 조리 시간이 성공적으로 저장되었습니다.",
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
            category_id: "",
          });
          // 메뉴 추가 후 localMenuItems 동기화
          window.location.reload();
        } else if (actionData.type === "edit") {
          setEditingId(null);
          setEditForm({});
        } else if (actionData.type === "delete") {
          // 메뉴 삭제 후 localMenuItems 동기화
          window.location.reload();
        } else if (actionData.type === "updateProfile" && needsOnboarding) {
          // 온보딩(가게 개설) 완료 → owner로 승격되었으므로 새로고침하여 대시보드 진입
          window.location.reload();
        } else if (actionData.type === "addCategory") {
          setCategoryName("");
          window.location.reload();
        } else if (actionData.type === "deleteCategory") {
          window.location.reload();
        } else if (actionData.type === "reorderCategories") {
          window.location.reload();
        }
      } else if (actionData.error) {
        setShowToast({ message: actionData.error, type: "error" });
      }
    }
  }, [actionData]);

  // 폼 핸들러들 - useCallback으로 메모이제이션
  const handleAddChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setAddForm((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleAddImageUpload = useCallback((url: string) => {
    setAddForm((prev) => ({ ...prev, image: url }));
  }, []);

  const startEdit = useCallback((item: MenuItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm({});
  }, []);

  // 필드명 매핑 객체 - 컴포넌트 외부에서 정의하거나 useMemo 사용
  const fieldMap = useMemo(
    () => ({
      editName: "name",
      editDescription: "description",
      editPrice: "price",
      editCategoryId: "category_id",
      editIsActive: "isActive",
    }),
    []
  );

  const handleEditChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;

      const actualFieldName = fieldMap[name as keyof typeof fieldMap] || name;
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
    },
    [fieldMap]
  );

  const handleEditImageUpload = useCallback((url: string) => {
    setEditForm((prev) => ({ ...prev, image: url }));
  }, []);

  const handleStoreImageUpload = useCallback((url: string) => {
    setStoreImage(url);
  }, []);

  // 메뉴 순서 변경 함수들 - useCallback으로 메모이제이션
  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();

    if (!draggedItem || draggedItem === targetItemId) {
      setDraggedItem(null);
      return;
    }

    // 드래그된 아이템과 타겟 아이템의 위치를 찾기
    const draggedIndex = localMenuItems.findIndex(
      (item) => item.id === draggedItem
    );
    const targetIndex = localMenuItems.findIndex(
      (item) => item.id === targetItemId
    );

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      return;
    }

    // 로컬 상태를 즉시 업데이트하여 UI 반영 (낙관적 업데이트)
    const reorderedMenuItems = [...localMenuItems];
    const [draggedMenuItem] = reorderedMenuItems.splice(draggedIndex, 1);
    reorderedMenuItems.splice(targetIndex, 0, draggedMenuItem);

    const updatedMenuItems = reorderedMenuItems.map((item, index) => ({
      ...item,
      displayOrder: index + 1,
    }));

    setLocalMenuItems(updatedMenuItems);
    setDraggedItem(null);

    // 새 순서를 백그라운드로 저장 (내비게이션·오버레이 없음)
    const updatedOrder = updatedMenuItems.map((item, index) => ({
      id: item.id,
      displayOrder: index + 1,
    }));
    menuFetcher.submit(
      {
        actionType: "reorder",
        menuOrder: JSON.stringify(updatedOrder),
      },
      { method: "post" }
    );
  };

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  // 선택된 카테고리 상태 (사이드바에서 사용 - category_id)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 판매 상태 필터 (전체 / 판매중 / 품절)
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "soldout">("all");

  // 선택된 카테고리·판매상태의 메뉴만 필터링 - useMemo로 메모이제이션
  const filteredMenuItems = useMemo(
    () =>
      localMenuItems
        .filter((item) =>
          selectedCategory ? item.category_id === selectedCategory : true
        )
        .filter((item) =>
          statusFilter === "active"
            ? item.isActive
            : statusFilter === "soldout"
            ? !item.isActive
            : true
        ),
    [selectedCategory, statusFilter, localMenuItems]
  );

  // 오늘 영업 상태 (사이드바 배지용) — 실제 영업시간 데이터로 계산
  const todayStoreStatus = useMemo(() => {
    const today = new Date().getDay();
    const h = (storeHours || []).find((x) => x.day_of_week === today);
    if (!h || h.is_closed) {
      return {
        open: false,
        label: h?.is_closed ? "오늘 휴무" : "영업시간 미설정",
        range: null as string | null,
      };
    }
    const fmt = (t: string | null) => (t ? t.slice(0, 5) : null);
    const range =
      h.open_time && h.close_time
        ? `${fmt(h.open_time)} - ${fmt(h.close_time)}`
        : null;
    const toMin = (t: string) => {
      const [hh, mm] = t.split(":").map(Number);
      return hh * 60 + mm;
    };
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    let open = true;
    if (h.open_time && h.close_time) {
      open = cur >= toMin(h.open_time) && cur < toMin(h.close_time);
    }
    return { open, label: open ? "영업중" : "영업종료", range };
  }, [storeHours]);

  // 온보딩(가게 개설) 화면용 상태 — slug 미리보기
  const [onboardSlug, setOnboardSlug] = useState("");
  const previewHost = (
    (import.meta.env.VITE_APP_URL as string | undefined) || "https://pojang.one"
  ).replace(/^https?:\/\//, "");
  const normalizedSlug = onboardSlug.trim().toLowerCase();

  // 가게가 아직 없으면 개설 마법사를 보여준다
  if (needsOnboarding) {
    return (
      <div className="min-h-screen bg-background-light font-display antialiased text-foreground flex flex-col">
        <header className="w-full px-6 py-4 lg:px-12 flex items-center justify-between border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-8 text-primary" />
            <h2 className="text-xl font-extrabold leading-tight tracking-tight">
              pojang<span className="text-primary">.one</span>
              <span className="ml-2 align-middle text-[12px] font-semibold text-muted-foreground">파트너</span>
            </h2>
          </div>
          <Form method="post">
            <input type="hidden" name="actionType" value="logout" />
            <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              로그아웃
            </button>
          </Form>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-card p-8 sm:p-10">
            <div className="mb-8">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-2xl">storefront</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">가게 개설하기</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                기본 정보만 입력하면 바로 주문 페이지가 만들어집니다. 메뉴·영업시간·사진은 개설 후 언제든 추가할 수 있어요.
              </p>
            </div>

            <Form method="post" className="space-y-5">
              <input type="hidden" name="actionType" value="updateProfile" />

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  가게명 <span className="text-primary">*</span>
                </label>
                <input
                  name="storename"
                  required
                  placeholder="예: 굿모닝차이나"
                  defaultValue={userProfile?.storename || ""}
                  className="w-full h-12 px-4 rounded-lg bg-muted/50 border border-border focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  가게 주소 (URL) <span className="text-primary">*</span>
                </label>
                <input
                  name="name"
                  required
                  value={onboardSlug}
                  onChange={(e) => setOnboardSlug(e.target.value)}
                  placeholder="goodmorning-china"
                  pattern="[A-Za-z0-9][A-Za-z0-9\-]{1,30}[A-Za-z0-9]"
                  className="w-full h-12 px-4 rounded-lg bg-muted/50 border border-border focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  손님에게 공유할 주소예요. 영문 소문자·숫자·하이픈(-), 3~32자.
                  {normalizedSlug && (
                    <span className="block mt-1 text-primary font-medium break-all">
                      {previewHost}/{normalizedSlug}
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  가게 전화번호
                </label>
                <input
                  name="storenumber"
                  placeholder="예: 032-327-9696"
                  defaultValue={userProfile?.storenumber || ""}
                  className="w-full h-12 px-4 rounded-lg bg-muted/50 border border-border focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  점주 휴대폰 번호 <span className="text-primary">*주문 알림 수신</span>
                </label>
                <input
                  name="owner_phone"
                  placeholder="예: 010-1234-5678"
                  defaultValue={userProfile?.owner_phone || ""}
                  className="w-full h-12 px-4 rounded-lg bg-muted/50 border border-border focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  새 주문이 들어오면 이 번호로 카카오 알림톡(문자)이 갑니다. 카카오톡을 쓰는 <b>휴대폰</b> 번호를 입력하세요.
                </p>
              </div>

              {actionData?.error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{actionData.error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-primary hover:bg-[#d66a1f] text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting && navigation.formData?.get("actionType") === "updateProfile" ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  "가게 개설하고 시작하기"
                )}
              </button>
            </Form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light flex flex-col h-screen overflow-hidden">
      {showToast && (
        <Toast
          message={showToast.message}
          type={showToast.type}
          onClose={() => setShowToast(null)}
        />
      )}

      {/* 옵션 관리 모달 */}
      {optionMgrItemId &&
        (() => {
          const item =
            (menuItems as MenuItem[]).find((m) => m.id === optionMgrItemId) ||
            localMenuItems.find((m) => m.id === optionMgrItemId);
          const groups = optionGroupsByItem.get(optionMgrItemId) || [];
          const busy = optionFetcher.state !== "idle";
          const err = (optionFetcher.data as { error?: string } | undefined)?.error;
          return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[88vh] flex flex-col">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">옵션 관리</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{item?.name}</p>
                  </div>
                  <button
                    onClick={() => setOptionMgrItemId(null)}
                    className="text-muted-foreground hover:text-muted-foreground p-1"
                    aria-label="닫기"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {err && (
                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      {err}
                    </div>
                  )}
                  {groups.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      아직 옵션 그룹이 없습니다. 아래에서 추가하세요.
                      <br />
                      (예: 사이즈, 곱빼기, 면 변경)
                    </p>
                  )}
                  {groups.map((g) => (
                    <div key={g.id} className="border border-border rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between bg-muted/50 px-4 py-2.5 border-b border-border">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">{g.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {g.min_select >= 1 ? "필수" : "선택"} ·{" "}
                            {g.max_select <= 1 ? "단일" : `최대 ${g.max_select}`}
                          </span>
                        </div>
                        <optionFetcher.Form method="post">
                          <input type="hidden" name="actionType" value="deleteOptionGroup" />
                          <input type="hidden" name="groupId" value={g.id} />
                          <button
                            type="submit"
                            className="text-destructive hover:text-destructive/80 text-xs font-medium"
                            disabled={busy}
                            onClick={(e) => {
                              if (!confirm(`'${g.name}' 그룹을 삭제할까요? 하위 옵션도 모두 삭제됩니다.`)) e.preventDefault();
                            }}
                          >
                            그룹 삭제
                          </button>
                        </optionFetcher.Form>
                      </div>
                      <div className="divide-y divide-border">
                        {(g.menu_options || []).map((o) => (
                          <div key={o.id} className="flex items-center justify-between px-4 py-2">
                            <span className="text-sm text-foreground/80">{o.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {Number(o.price_delta) > 0 ? "+" : ""}
                                {Number(o.price_delta).toLocaleString()}원
                              </span>
                              <optionFetcher.Form method="post">
                                <input type="hidden" name="actionType" value="deleteOption" />
                                <input type="hidden" name="optionId" value={o.id} />
                                <button
                                  type="submit"
                                  className="text-muted-foreground hover:text-destructive"
                                  disabled={busy}
                                  title="옵션 삭제"
                                >
                                  <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                              </optionFetcher.Form>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* 옵션 추가 */}
                      <optionFetcher.Form
                        method="post"
                        className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-t border-border"
                        key={`addopt-${g.id}-${(g.menu_options || []).length}`}
                      >
                        <input type="hidden" name="actionType" value="addOption" />
                        <input type="hidden" name="group_id" value={g.id} />
                        <input
                          name="optionName"
                          placeholder="옵션명 (예: 곱빼기)"
                          required
                          className="flex-1 min-w-0 border border-border px-3 py-1.5 rounded-lg text-sm"
                        />
                        <input
                          name="price_delta"
                          type="number"
                          step="100"
                          defaultValue="0"
                          className="w-24 border border-border px-2 py-1.5 rounded-lg text-sm"
                          title="추가요금(원)"
                        />
                        <button
                          type="submit"
                          disabled={busy}
                          className="shrink-0 bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-foreground/90"
                        >
                          추가
                        </button>
                      </optionFetcher.Form>
                    </div>
                  ))}

                  {/* 새 옵션 그룹 추가 */}
                  <optionFetcher.Form
                    method="post"
                    className="border border-dashed border-border rounded-xl p-4 space-y-3"
                    key={`addgrp-${groups.length}`}
                  >
                    <input type="hidden" name="actionType" value="addOptionGroup" />
                    <input type="hidden" name="menu_item_id" value={optionMgrItemId} />
                    <p className="text-sm font-semibold text-foreground/80">새 옵션 그룹</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        name="groupName"
                        placeholder="그룹명 (예: 사이즈, 면 변경)"
                        required
                        className="flex-1 border border-border px-3 py-2 rounded-lg text-sm"
                      />
                      <select
                        name="min_select"
                        className="border border-border px-2 py-2 rounded-lg text-sm"
                        defaultValue="0"
                      >
                        <option value="0">선택(0)</option>
                        <option value="1">필수(1)</option>
                      </select>
                      <input
                        name="max_select"
                        type="number"
                        min="1"
                        defaultValue="1"
                        className="w-20 border border-border px-2 py-2 rounded-lg text-sm"
                        title="최대 선택 수"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full sm:w-auto bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90"
                    >
                      그룹 추가
                    </button>
                  </optionFetcher.Form>
                </div>
                <div className="p-4 border-t border-border">
                  <button
                    onClick={() => setOptionMgrItemId(null)}
                    className="w-full py-2.5 text-muted-foreground font-medium hover:bg-muted rounded-xl"
                  >
                    완료
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Top Navigation Bar */}
      <header className="flex-none flex items-center justify-between whitespace-nowrap border-b border-solid border-border bg-card px-6 py-3 z-20 shadow-sm">
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
              가게 관리
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
                placeholder="빠른 검색..."
              />
            </div>
          </label>
        </div>
        <div className="flex items-center justify-end gap-8">
          <nav className="flex items-center gap-3 sm:gap-6">
            <a
              className="text-foreground hover:text-primary transition-colors text-sm font-medium leading-normal"
              href="/admin"
            >
              메뉴
            </a>
            <a
              className="text-foreground hover:text-primary transition-colors text-sm font-medium leading-normal"
              href="/owner/orders"
            >
              주문
            </a>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("store-info-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="text-foreground hover:text-primary transition-colors text-sm font-medium leading-normal"
            >
              설정
            </button>
          </nav>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="hidden xl:flex flex-col">
                <span className="text-xs font-bold text-foreground">
                  {userProfile?.email || "관리자"}
                </span>
                <span className="text-[10px] text-muted-foreground">사장님</span>
              </div>
            </div>
            <Form method="post">
              <input type="hidden" name="actionType" value="logout" />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
                title="로그아웃"
                disabled={isSubmitting}
              >
                <span className="material-symbols-outlined text-[18px]">
                  logout
                </span>
                <span>로그아웃</span>
              </button>
            </Form>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 h-full overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-72 bg-card border-r border-border overflow-y-auto">
          <div className="p-6 flex flex-col gap-6">
            {/* Store Info Card */}
            <div className="bg-background-light p-4 rounded-xl border border-border flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="bg-primary/10 rounded-lg size-12 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    restaurant
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    todayStoreStatus.open
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      todayStoreStatus.open ? "bg-success animate-pulse" : "bg-muted-foreground"
                    }`}
                  ></span>{" "}
                  {todayStoreStatus.label}
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
                <span>{todayStoreStatus.range || "영업시간을 설정해주세요"}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("store-info-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="w-full h-8 flex items-center justify-center rounded-lg bg-card border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors"
              >
                가게 정보 수정
              </button>
            </div>
            {/* Categories */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-2 mb-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  카테고리
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
                    전체
                  </span>
                </div>
              </div>
              {/* Category Items */}
              {localCategories.map((cat) => {
                return (
                  <div
                    key={cat.id}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                      selectedCategory === cat.id
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : "text-foreground hover:bg-background-light border border-transparent hover:border-border"
                    }`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px]">
                        lunch_dining
                      </span>
                      <span
                        className={`text-sm ${
                          selectedCategory === cat.id
                            ? "font-bold"
                            : "font-medium"
                        }`}
                      >
                        {cat.name}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[18px] opacity-50 cursor-grab active:cursor-grabbing">
                      drag_indicator
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-auto p-6 border-t border-border">
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-yellow-600 text-[20px]">
                  lightbulb
                </span>
                <p className="text-xs text-yellow-800 leading-relaxed">
                  <strong>팁:</strong> 카테고리를 드래그하여 고객 앱에 표시되는
                  순서를 변경할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </aside>
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-background-light">
          <div className="flex-1 overflow-y-auto px-4 pb-20 md:px-6">
            <div className="max-w-2xl mx-auto space-y-6 pt-6">
              {/* 메뉴 추가 폼 */}
              <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-primary/10 px-6 py-4 border-b border-primary/20">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    새 메뉴 추가
                  </h2>
                </div>
                <div className="p-6">
                  <Form method="post" className="space-y-4" id="add-menu-form">
                    <input name="actionType" type="hidden" value="add" />

                    {/* 기본 정보 그룹 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground/80 mb-2">
                          메뉴명 <span className="text-primary">*</span>
                        </label>
                        <input
                          name="name"
                          required
                          placeholder="예: 햄버거"
                          value={addForm.name}
                          onChange={handleAddChange}
                          className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
                          disabled={isSubmitting}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground/80 mb-2">
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
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        설명
                      </label>
                      <input
                        name="description"
                        placeholder="메뉴에 대한 간단한 설명을 입력하세요"
                        value={addForm.description}
                        onChange={handleAddChange}
                        className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
                        disabled={isSubmitting}
                      />
                    </div>

                    {/* 카테고리와 상태 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground/80 mb-2">
                          카테고리
                        </label>
                        <select
                          name="category_id"
                          value={addForm.category_id}
                          onChange={handleAddChange}
                          className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
                          disabled={isSubmitting}
                        >
                          <option value="">카테고리 선택</option>
                          {localCategories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground/80 mb-2">
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
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
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

              {/* 카테고리 관리 */}
              <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-success/10 px-6 py-4 border-b border-success/20">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    카테고리 관리
                  </h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {/* 카테고리 추가 */}
                    <Form method="post" className="flex gap-3">
                      <input
                        type="hidden"
                        name="actionType"
                        value="addCategory"
                      />
                      <div className="flex-1">
                        <input
                          type="text"
                          name="categoryName"
                          value={categoryName}
                          onChange={(e) => setCategoryName(e.target.value)}
                          placeholder="새 카테고리 이름 (예: 버거, 음료, 사이드)"
                          className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
                          disabled={isSubmitting}
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-success hover:bg-success/90 text-success-foreground font-semibold px-6 py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting || !categoryName.trim()}
                      >
                        추가
                      </button>
                    </Form>

                    {/* 카테고리 목록 */}
                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-medium text-foreground/80 mb-3">
                        카테고리 목록 ({localCategories.length}개)
                      </h3>
                      {localCategories.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-4">
                          등록된 카테고리가 없습니다.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {localCategories.map((cat, index) => (
                            <div
                              key={cat.id}
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground text-sm font-medium w-6">
                                  {index + 1}
                                </span>
                                <span className="font-medium text-foreground">
                                  {cat.name}
                                </span>
                              </div>
                              <Form method="post" className="inline">
                                <input
                                  type="hidden"
                                  name="actionType"
                                  value="deleteCategory"
                                />
                                <input
                                  type="hidden"
                                  name="categoryId"
                                  value={cat.id}
                                />
                                <button
                                  type="submit"
                                  className="text-destructive hover:text-destructive/80 text-sm font-medium disabled:opacity-50"
                                  disabled={isSubmitting}
                                  onClick={(e) => {
                                    if (
                                      !confirm(
                                        `"${cat.name}" 카테고리를 삭제하시겠습니까?\n\n이 카테고리를 사용하는 메뉴가 있으면 삭제할 수 없습니다.`
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
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 가게 정보 관리 */}
              <div id="store-info-section" className="bg-card rounded-2xl shadow-sm overflow-hidden scroll-mt-6">
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
                        <label className="block text-sm font-medium text-foreground/80 mb-2">
                          가게 주소 (URL) <span className="text-blue-500">*</span>
                        </label>
                        <input
                          name="name"
                          required
                          placeholder="goodmorning-china"
                          pattern="[A-Za-z0-9][A-Za-z0-9\-]{1,30}[A-Za-z0-9]"
                          defaultValue={userProfile?.name || ""}
                          readOnly={!!userProfile?.name}
                          className={`w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${
                            userProfile?.name
                              ? "bg-muted/60 text-muted-foreground cursor-not-allowed"
                              : ""
                          }`}
                          disabled={isSubmitting || isUpdatingProfile}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {userProfile?.name
                            ? "가게 주소는 최초 설정 후 변경할 수 없습니다."
                            : "손님 주문 페이지 주소 · 영문 소문자·숫자·하이픈(-), 3~32자 (설정 후 변경 불가)"}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground/80 mb-2">
                          가게명 <span className="text-blue-500">*</span>
                        </label>
                        <input
                          name="storename"
                          required
                          placeholder="예: 맛있는 족발집"
                          defaultValue={userProfile?.storename || ""}
                          className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                          disabled={isSubmitting || isUpdatingProfile}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        가게 전화번호{" "}
                        <span className="text-primary font-semibold">*고객에게 보이는 번호</span>
                      </label>
                      <input
                        name="storenumber"
                        placeholder="예: 02-1234-5678"
                        defaultValue={userProfile?.storenumber || ""}
                        className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                        disabled={isSubmitting || isUpdatingProfile}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        점주 휴대폰 번호{" "}
                        <span className="text-primary font-semibold">*주문 알림 수신</span>
                      </label>
                      <input
                        name="owner_phone"
                        placeholder="예: 010-1234-5678"
                        defaultValue={userProfile?.owner_phone || ""}
                        className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                        disabled={isSubmitting || isUpdatingProfile}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        새 주문 시 이 번호로 알림톡(문자)이 발송됩니다. 카카오톡 쓰는 휴대폰 번호로 입력하세요.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
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

                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        가게 설명
                      </label>
                      <textarea
                        name="store_description"
                        placeholder="가게에 대한 설명을 입력하세요 (최대 500자)"
                        defaultValue={userProfile?.store_description || ""}
                        maxLength={500}
                        rows={4}
                        className="w-full border border-border px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base resize-none"
                        disabled={isSubmitting || isUpdatingProfile}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {(userProfile?.store_description || "").length}
                        /500자
                      </p>
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

              {/* 영업 시간 관리 */}
              <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-purple-50 px-6 py-4 border-b border-purple-100">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    영업 시간 관리
                  </h2>
                </div>
                <div className="p-6">
                  <Form method="post" className="space-y-4">
                    <input type="hidden" name="actionType" value="updateStoreHours" />
                    <input
                      type="hidden"
                      name="storeHours"
                      value={JSON.stringify(localStoreHours)}
                    />

                    <div className="space-y-1.5">
                      {localStoreHours.map((hour, index) => (
                        <div
                          key={hour.day_of_week}
                          className={`flex flex-row items-center gap-3 px-3 py-2 rounded-lg border ${
                            hour.is_closed
                              ? "bg-muted/50 border-border"
                              : "bg-card border-border"
                          }`}
                        >
                          {/* 요일 */}
                          <div className="w-14 shrink-0 text-sm font-medium text-foreground">
                            {DAY_NAMES[hour.day_of_week]}
                          </div>

                          {/* 휴무일 토글 */}
                          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={hour.is_closed}
                              onChange={(e) => {
                                const newHours = [...localStoreHours];
                                newHours[index] = {
                                  ...newHours[index],
                                  is_closed: e.target.checked,
                                };
                                setLocalStoreHours(newHours);
                              }}
                              className="w-4 h-4 text-purple-600 rounded border-border focus:ring-purple-500"
                            />
                            <span className="text-sm text-muted-foreground">휴무</span>
                          </label>

                          {/* 시간 선택 */}
                          {!hour.is_closed && (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="time"
                                value={hour.open_time || "10:00"}
                                onChange={(e) => {
                                  const newHours = [...localStoreHours];
                                  newHours[index] = {
                                    ...newHours[index],
                                    open_time: e.target.value,
                                  };
                                  setLocalStoreHours(newHours);
                                }}
                                className="px-2 py-1 border border-border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                              <span className="text-muted-foreground">~</span>
                              <input
                                type="time"
                                value={hour.close_time || "22:00"}
                                onChange={(e) => {
                                  const newHours = [...localStoreHours];
                                  newHours[index] = {
                                    ...newHours[index],
                                    close_time: e.target.value,
                                  };
                                  setLocalStoreHours(newHours);
                                }}
                                className="px-2 py-1 border border-border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                          )}

                          {hour.is_closed && (
                            <span className="text-sm text-muted-foreground italic">휴무일입니다</span>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        className="w-full sm:w-auto bg-purple-500 hover:bg-purple-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        disabled={isSubmitting}
                      >
                        {isSubmitting && navigation.formData?.get("actionType") === "updateStoreHours" && (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        )}
                        영업 시간 저장
                      </button>
                    </div>
                  </Form>
                </div>
              </div>

              {/* 기본 조리 시간 설정 */}
              <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-amber-50 px-6 py-4 border-b border-amber-100">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    기본 조리 시간 설정
                  </h2>
                </div>
                <div className="p-6">
                  <Form method="post" className="space-y-4">
                    <input type="hidden" name="actionType" value="updatePrepTime" />

                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        기본 조리 소요 시간 (분)
                      </label>
                      <p className="text-xs text-muted-foreground mb-3">
                        주문 접수 시 기본으로 제안되는 픽업 예정 시간입니다. 주문별로 조정할 수 있습니다.
                      </p>
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          name="prepTime"
                          min="5"
                          max="180"
                          step="5"
                          value={defaultPrepTime}
                          onChange={(e) => setDefaultPrepTime(Number(e.target.value))}
                          className="w-32 px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base"
                          disabled={isSubmitting}
                        />
                        <span className="text-muted-foreground">분</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        disabled={isSubmitting}
                      >
                        {isSubmitting && navigation.formData?.get("actionType") === "updatePrepTime" && (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        )}
                        조리 시간 저장
                      </button>
                    </div>
                  </Form>
                </div>
              </div>

              {/* Page Heading & Actions */}
              <div className="flex-none p-4 md:px-6 md:pt-6 md:pb-4 bg-card/50 backdrop-blur-sm z-10">
                <div className="max-w-2xl mx-auto flex flex-col gap-6">
                  <div className="flex flex-wrap justify-between gap-4 items-end">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                        <span>메뉴</span>
                        <span className="material-symbols-outlined text-[12px]">
                          chevron_right
                        </span>
                        <span className="text-primary">
                          {selectedCategory
                            ? localCategories.find(
                                (c) => c.id === selectedCategory
                              )?.name || "전체"
                            : "전체"}
                        </span>
                      </div>
                      <h1 className="text-3xl font-bold text-foreground tracking-tight">
                        {selectedCategory
                          ? localCategories.find(
                              (c) => c.id === selectedCategory
                            )?.name || "전체"
                          : "전체"}
                      </h1>
                      <p className="text-muted-foreground text-sm max-w-2xl">
                        메뉴 아이템을 관리하세요.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          document
                            .getElementById("menu-list-section")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                          setShowToast({
                            message: "메뉴 카드를 드래그해서 순서를 바꿀 수 있어요.",
                            type: "success",
                          });
                        }}
                        className="hidden sm:flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-border bg-card text-foreground text-sm font-bold hover:bg-muted transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          swap_vert
                        </span>
                        순서 변경
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          document
                            .getElementById("add-menu-form")
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className="flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          add
                        </span>
                        새 메뉴 추가
                      </button>
                    </div>
                  </div>
                  {/* Filters Toolbar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-2 rounded-xl border border-border shadow-sm">
                    <div className="flex-1 relative max-w-md">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        search
                      </span>
                      <input
                        className="w-full pl-10 pr-4 py-2 bg-transparent border-none focus:ring-0 text-sm text-foreground placeholder:text-muted-foreground"
                        placeholder="메뉴 검색..."
                        type="text"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-2 overflow-x-auto pb-2 md:pb-0">
                      <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className={`flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          statusFilter === "all"
                            ? "bg-foreground text-white"
                            : "bg-background-light text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          apps
                        </span>{" "}
                        전체
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("active")}
                        className={`flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          statusFilter === "active"
                            ? "bg-foreground text-white"
                            : "bg-background-light text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          check_circle
                        </span>{" "}
                        판매중
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("soldout")}
                        className={`flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          statusFilter === "soldout"
                            ? "bg-foreground text-white"
                            : "bg-background-light text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          cancel
                        </span>{" "}
                        품절
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Scrollable Grid Content */}
              <div id="menu-list-section" className="flex-1 overflow-y-auto px-4 pb-20 md:px-6 scroll-mt-6">
                <div className="max-w-2xl mx-auto">
                  {filteredMenuItems.length === 0 ? (
                    <div className="col-span-full p-12 text-center bg-card rounded-2xl border border-dashed border-border">
                      <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-primary text-4xl">restaurant_menu</span>
                      </div>
                      <h3 className="text-lg font-bold text-foreground mb-2">
                        {selectedCategory ? "이 카테고리에 메뉴가 없습니다" : "아직 등록된 메뉴가 없어요"}
                      </h3>
                      <p className="text-muted-foreground mb-6 leading-relaxed">
                        {selectedCategory
                          ? "다른 카테고리를 선택하거나 새 메뉴를 추가해보세요."
                          : "위에서 새 메뉴를 추가하여 고객에게 보여줄 메뉴를 등록하세요."
                        }
                      </p>
                      <button
                        onClick={() => {
                          const form = document.querySelector('form[method="post"]') as HTMLFormElement;
                          if (form) form.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors"
                      >
                        <span className="material-symbols-outlined">add</span>
                        새 메뉴 추가하기
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Menu Item Cards */}
                      {filteredMenuItems.map((item: MenuItem) =>
                        editingId === item.id ? (
                          // 편집 모드
                          <div
                            key={item.id}
                            className="md:col-span-2 bg-primary-light border-l-4 border-primary rounded-xl p-6"
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
                                name="category_id"
                                value={editForm.category_id || ""}
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

                            <div className="flex flex-col gap-4">
                              <div>
                                <label className="block text-sm font-medium text-foreground/80 mb-2">
                                  이미지
                                </label>
                                <ImageUploadInput
                                  value={editForm.image || ""}
                                  onChange={handleEditImageUpload}
                                  disabled={isSubmitting}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-foreground/80 mb-1">
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
                                <label className="block text-sm font-medium text-foreground/80 mb-1">
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
                                <label className="block text-sm font-medium text-foreground/80 mb-1">
                                  카테고리
                                </label>
                                <select
                                  value={editForm.category_id || ""}
                                  onChange={handleEditChange}
                                  name="editCategoryId"
                                  className="w-full border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                  disabled={isSubmitting}
                                >
                                  <option value="">카테고리 선택</option>
                                  {localCategories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-foreground/80 mb-1">
                                    가격 (원)
                                  </label>
                                  <input
                                    value={editForm.price || 0}
                                    onChange={handleEditChange}
                                    name="editPrice"
                                    type="number"
                                    className="w-full border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    disabled={isSubmitting}
                                    min="0"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-foreground/80 mb-1">
                                    상태
                                  </label>
                                  <select
                                    value={editForm.isActive ? "true" : "false"}
                                    onChange={handleEditChange}
                                    name="editIsActive"
                                    className="w-full border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    disabled={isSubmitting}
                                  >
                                    <option value="true">판매중</option>
                                    <option value="false">품절</option>
                                  </select>
                                </div>
                              </div>

                              <div className="flex gap-2 pt-2">
                                <button
                                  type="submit"
                                  form={`edit-form-${item.id}`}
                                  className="flex-1 justify-center bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center gap-2 font-semibold"
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
                                  className="flex-1 justify-center bg-muted hover:bg-muted/80 text-foreground/80 px-4 py-2.5 rounded-lg transition-colors duration-200 flex items-center font-medium"
                                  onClick={cancelEdit}
                                  disabled={isSubmitting}
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // 일반 보기 모드 - 카드 스타일
                          <div
                            key={item.id}
                            className={`group relative flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 ${
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
                            <div className="relative h-48 w-full overflow-hidden bg-muted">
                              {item.image ? (
                                <div
                                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                                  style={{
                                    backgroundImage: `url(${item.image})`,
                                  }}
                                ></div>
                              ) : (
                                <div className="absolute inset-0 bg-border flex items-center justify-center">
                                  <span className="text-muted-foreground text-4xl">
                                    🍽️
                                  </span>
                                </div>
                              )}
                              {!item.isActive && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <span className="bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold border border-white/20 backdrop-blur-sm">
                                    품절
                                  </span>
                                </div>
                              )}
                              <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm p-1.5 rounded-lg shadow-sm cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
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
                                    type="button"
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                                      item.isActive
                                        ? "bg-primary"
                                        : "bg-muted"
                                    }`}
                                    onClick={() => {
                                      const nextActive = !item.isActive;
                                      // 낙관적 업데이트 — 화면은 즉시 반영, DB는 백그라운드
                                      setLocalMenuItems((prev) =>
                                        prev.map((m) =>
                                          m.id === item.id
                                            ? { ...m, isActive: nextActive }
                                            : m
                                        )
                                      );
                                      menuFetcher.submit(
                                        {
                                          actionType: "edit",
                                          id: item.id,
                                          name: item.name,
                                          description: item.description || "",
                                          price: String(item.price),
                                          image: item.image || "",
                                          isActive: String(nextActive),
                                          category_id: item.category_id || "",
                                        },
                                        { method: "post" }
                                      );
                                    }}
                                  >
                                    <span className="sr-only">
                                      판매 상태 변경
                                    </span>
                                    <span
                                      className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                                        item.isActive
                                          ? "translate-x-6"
                                          : "translate-x-1"
                                      }`}
                                    ></span>
                                  </button>
                                  <span className="text-xs font-medium text-foreground">
                                    {item.isActive ? "판매중" : "품절"}
                                  </span>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    className="relative p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="옵션 관리"
                                    onClick={() => setOptionMgrItemId(item.id)}
                                    disabled={isSubmitting}
                                  >
                                    <span className="material-symbols-outlined text-[20px]">
                                      tune
                                    </span>
                                    {(optionGroupsByItem.get(item.id)?.length || 0) > 0 && (
                                      <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[9px] font-bold rounded-full size-4 flex items-center justify-center">
                                        {optionGroupsByItem.get(item.id)!.length}
                                      </span>
                                    )}
                                  </button>
                                  <button
                                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="메뉴 수정"
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
                                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                      title="메뉴 삭제"
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
