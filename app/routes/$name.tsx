import { useState, useEffect, useMemo, useCallback } from "react";
import { Form, useLocation, redirect, useFetcher } from "react-router";
import { makeSSRClient, browserClient } from "../supa_clients";
import type { Database } from "database.types";
import type { Route } from "./+types/$name";
import type { SupabaseClient } from "@supabase/supabase-js";
import PhoneInput, { getRawPhoneNumber, validatePhoneNumber } from "~/common/components/phone-input";

type MenuItem = Database["public"]["Tables"]["menuItem"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];

// MenuItem에 카테고리 정보가 조인된 타입
type MenuItemWithCategory = MenuItem & {
  categories: Pick<Category, "id" | "name" | "display_order"> | null;
};

type MyLoaderArgs = {
  request: Request;
  params: { name?: string };
};

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

// Action 반환 타입 정의
type ActionData =
  | { success: true; phoneNumberUpdated: true }
  | { success: true; message: string; orderId: string }
  | { success: false; message: string; requiresAuth?: boolean }
  | { error: string };

export const getMenuItems = async (
  client: SupabaseClient<Database>,
  profile_id: string
) => {
  const { data, error } = await client
    .from("menuItem")
    .select("*, categories:category_id(id, name, display_order)")
    .eq("isActive", true)
    .eq("profile_id", profile_id)
    .order("displayOrder", { ascending: true })
    .order("createdAt", { ascending: true });

  if (error) {
    console.error("메뉴 로딩 실패:", error);
    return [];
  }
  return data ?? [];
};

// loader 함수에서는 client만 주입해서 사용
// 최적화: 병렬 쿼리로 데이터 페칭 성능 향상
export const loader = async ({ request, params }: MyLoaderArgs) => {
  const name = params.name;
  if (!name) throw new Response("Not Found", { status: 404 });

  const { client } = makeSSRClient(request);

  // 첫 번째 단계: 프로필 조회 (필수)
  const { data: profile, error } = await client
    .from("profiles")
    .select("profile_id, storename, store_image, store_description, storenumber, default_prep_time_minutes")
    .eq("name", name)
    .single();

  if (error || !profile) {
    console.error("Profile not found:", error);
    throw new Response("Not Found", { status: 404 });
  }

  const profile_id = profile.profile_id;
  const today = new Date().getDay();

  // 두 번째 단계: 모든 쿼리를 병렬로 실행
  const [menuItemsResult, categoriesResult, todayHoursResult, userDataResult] = await Promise.all([
    // 메뉴 아이템 조회
    getMenuItems(client, profile_id),
    // 카테고리 목록 조회
    client
      .from("categories")
      .select("id, name, display_order")
      .eq("profile_id", profile_id)
      .order("display_order", { ascending: true }),
    // 오늘의 영업시간 조회
    client
      .from("store_hours")
      .select("open_time, close_time, is_closed")
      .eq("profile_id", profile_id)
      .eq("day_of_week", today)
      .maybeSingle(),
    // 인증 상태 확인
    client.auth.getUser(),
  ]);

  const menuItems = menuItemsResult;
  const categories = categoriesResult.data || [];
  const todayHours = todayHoursResult.data;
  const user = userDataResult.data?.user || null;

  // 로그인한 사용자의 프로필 정보 가져오기
  let userProfile = null;
  let needsPhoneNumber = false;
  let userPhoneNumber = null;

  if (user) {
    const { data: profileData } = await client
      .from("profiles")
      .select("email, role, customernumber")
      .eq("profile_id", user.id)
      .maybeSingle();
    userProfile = profileData;

    // customer이고 전화번호가 없으면 입력 필요
    if (profileData?.role === "customer" && !profileData?.customernumber) {
      needsPhoneNumber = true;
    }

    // 사용자 전화번호 저장
    if (profileData?.customernumber) {
      userPhoneNumber = profileData.customernumber;
    }
  }

  return {
    menuItems,
    categories,
    user,
    userEmail: userProfile?.email || user?.email || null,
    name,
    storename: profile.storename || name,
    store_image: profile.store_image || null,
    store_description: profile.store_description || null,
    needsPhoneNumber, // 전화번호 입력 필요 플래그
    userPhoneNumber, // 사용자 전화번호
    storenumber: profile.storenumber || null, // 가게 전화번호
    prepTime: profile.default_prep_time_minutes || 15, // 기본 준비 시간 (분)
    todayHours, // 오늘 영업시간
  };
};

export const saveOrder = async (
  client: SupabaseClient<Database>,
  orderItems: OrderItem[],
  phoneNumber: string,
  totalAmount: number,
  profile_id: string
) => {
  // 1) 주문(order) 저장
  const { data: order, error: orderError } = await client
    .from("order")
    .insert([
      {
        phoneNumber,
        totalAmount,
        status: "PENDING",
        profile_id,
      },
    ])
    .select()
    .single();

  if (orderError || !order) {
    throw orderError || new Error("주문 저장 실패 (order 테이블)");
  }

  // 2) 주문 아이템(orderItem) 저장 (여러개)
  const orderItemRows = orderItems.map((item: OrderItem) => ({
    orderId: order.order_id,
    menuItemId: item.id,
    quantity: item.quantity,
    price: item.price,
  }));

  const { error: itemError } = await client
    .from("orderitem")
    .insert(orderItemRows);

  if (itemError) {
    throw itemError;
  }

  return order.order_id;
};

// action 함수에서 client 생성 후 주입, 화살표 함수
export const action = async ({ request, params }: Route.ActionArgs) => {
  try {
    // makeSSRclient에서 client 생성 (loader 패턴과 동일)
    const { client, headers } = makeSSRClient(request);

    // 로그아웃 처리
    const formData = await request.formData();
    const actionType = formData.get("actionType");
    if (actionType === "logout") {
      await client.auth.signOut();
      return redirect("/", { headers });
    }

    // 전화번호 업데이트 처리
    if (actionType === "updatePhoneNumber") {
      const { data: userData } = await client.auth.getUser();
      if (!userData?.user) {
        return Response.json({ error: "인증이 필요합니다." }, { status: 401 });
      }

      const phoneNumber = formData.get("phoneNumber") as string;
      if (!phoneNumber?.trim()) {
        return Response.json(
          { error: "전화번호를 입력해주세요." },
          { status: 400 }
        );
      }

      // 전화번호 형식 검증 (선택사항)
      const phoneRegex = /^[0-9-]+$/;
      if (!phoneRegex.test(phoneNumber.trim())) {
        return Response.json(
          { error: "올바른 전화번호 형식이 아닙니다." },
          { status: 400 }
        );
      }

      // 프로필 업데이트
      const { error } = await client
        .from("profiles")
        .update({
          customernumber: phoneNumber.trim(),
        })
        .eq("profile_id", userData.user.id);

      if (error) {
        console.error("전화번호 업데이트 오류:", error);
        return Response.json(
          { error: "전화번호 저장에 실패했습니다." },
          { status: 500 }
        );
      }

      return Response.json({ success: true, phoneNumberUpdated: true });
    }

    // 인증 상태 확인 - 주문 시 카카오 로그인 필수
    const { data: userData, error: authError } = await client.auth.getUser();
    if (authError || !userData?.user) {
      return Response.json({
        success: false,
        message: "주문하려면 카카오 로그인이 필요합니다.",
        requiresAuth: true,
      });
    }
    let phoneNumber = formData.get("phoneNumber") as string;

    // JSON 파싱 에러 처리
    let orderItems: OrderItem[];
    try {
      const orderItemsRaw = formData.get("orderItems") as string;
      if (!orderItemsRaw) {
        return Response.json({
          success: false,
          message: "주문 항목이 없습니다.",
        }, { status: 400 });
      }
      orderItems = JSON.parse(orderItemsRaw);
    } catch (parseError) {
      console.error("주문 항목 파싱 실패:", parseError);
      return Response.json({
        success: false,
        message: "주문 데이터 형식이 올바르지 않습니다.",
      }, { status: 400 });
    }

    const totalAmount = parseInt(formData.get("totalAmount") as string);
    const autoOrder = formData.get("autoOrder") === "true"; // 자동 주문 플래그

    // 전화번호가 없으면 프로필에서 가져오기
    if (!phoneNumber || phoneNumber.trim() === "") {
      const { data: userProfile } = await client
        .from("profiles")
        .select("customernumber")
        .eq("profile_id", userData.user.id)
        .maybeSingle();

      if (userProfile?.customernumber) {
        phoneNumber = userProfile.customernumber;
      }
    }

    const name = params.name;
    const { data: profile } = await client
      .from("profiles")
      .select("profile_id, name, storename, storenumber")
      .eq("name", name)
      .single();

    const profile_id = profile?.profile_id;
    if (!profile_id) {
      throw new Error("프로필을 찾을 수 없습니다.");
    }

    const orderId = await saveOrder(
      client,
      orderItems,
      phoneNumber,
      totalAmount,
      profile_id
    );

    const payload = {
      event: "order.created",
      site: {
        pageName: name,
        storeName: profile.storename ?? name,
        profileId: profile_id,
      },
      order: {
        id: orderId,
        totalAmount,
        customerPhone: phoneNumber,
        items: orderItems, // [{id,name,price,quantity}, ...]
        createdAt: new Date().toISOString(),
        status: "PENDING", // 참고용
      },
      notify: {
        to: "store",
        phone: profile.storenumber ?? null, // n8n에서 문자 발송에 사용
      },
    };

    let notified = false;
    const hookUrl = process.env.N8N_WEBHOOK_URL_STORE;
    if (hookUrl) {
      try {
        const res = await fetch(hookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // 선택: 시크릿/멱등키 사용
            ...(process.env.N8N_WEBHOOK_STORE_SECRET
              ? { "x-webhook-secret": process.env.N8N_WEBHOOK_STORE_SECRET }
              : {}),
            "x-idempotency-key": String(orderId),
          },
          body: JSON.stringify(payload),
        });
        notified = res.ok;
      } catch (e) {
        console.error("store webhook error:", e);
      }
    } else {
      console.error("N8N_WEBHOOK_URL_STORE is not set");
    }

    return Response.json({
      success: true,
      message:
        "주문이 성공적으로 접수되었습니다. 음식점 확인 시 알림톡이 발송됩니다.",
      orderId,
    });
  } catch (error) {
    console.error("주문 저장 실패:", error);
    return Response.json({
      success: false,
      message: "주문 처리 중 오류가 발생했습니다.",
    });
  }
};

// --- 3. meta function
export const meta: Route.MetaFunction = () => {
  return [
    { title: "맛있는 식당 | 메뉴 주문" },
    {
      name: "description",
      content: "맛있는 식당의 메뉴를 선택하고 주문하세요",
    },
  ];
};

// --- 4. React 컴포넌트
export default function OrderPage({
  loaderData,
  actionData: rawActionData,
}: Route.ComponentProps) {
  const actionData = rawActionData as ActionData | undefined;
  const {
    menuItems,
    categories,
    user: initialUser,
    userEmail,
    name,
    storename,
    store_image,
    store_description,
    needsPhoneNumber,
    userPhoneNumber,
    storenumber,
    prepTime,
    todayHours,
  } = loaderData;
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [user, setUser] = useState(initialUser);
  const [showPhoneModal, setShowPhoneModal] = useState(needsPhoneNumber);
  const [phoneInput, setPhoneInput] = useState("");
  const [showOrderConfirmModal, setShowOrderConfirmModal] = useState(false);
  const location = useLocation();
  const fetcher = useFetcher();

  // 프로필에서 가져온 전화번호가 있으면 사용, 없으면 입력한 전화번호 사용 (하이픈 제거)
  const rawPhoneNumber = getRawPhoneNumber(phoneNumber);
  const effectivePhoneNumber = userPhoneNumber || rawPhoneNumber;
  const isPhoneValid = userPhoneNumber ? true : validatePhoneNumber(phoneNumber).isValid;

  // 인증 상태 실시간 확인
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user: currentUser },
      } = await browserClient.auth.getUser();
      setUser(currentUser);
    }
    checkAuth();

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = browserClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 주문 성공 시 sessionStorage 정리
  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      // 주문 성공 시 sessionStorage에서 주문 정보 삭제
      sessionStorage.removeItem("pendingOrder");
    }
  }, [actionData]);

  // 전화번호 업데이트 성공 시 모달 닫기
  useEffect(() => {
    if (
      actionData &&
      "phoneNumberUpdated" in actionData &&
      actionData.phoneNumberUpdated
    ) {
      setShowPhoneModal(false);
      // 페이지 새로고침하여 needsPhoneNumber 상태 업데이트
      window.location.reload();
    }
  }, [actionData]);

  // 주문 정보를 sessionStorage에 저장
  const saveOrderToSession = () => {
    if (orderItems.length > 0) {
      const orderData = {
        orderItems,
        totalAmount,
        storeName: name,
        phoneNumber: effectivePhoneNumber.trim() || null,
      };
      sessionStorage.setItem("pendingOrder", JSON.stringify(orderData));
    }
  };

  // 카카오 로그인 함수
  const handleKakaoLogin = async () => {
    // 주문 정보를 sessionStorage에 저장
    saveOrderToSession();

    // 환경 변수가 있으면 사용, 없으면 window.location.origin 사용
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;

    // 현재 페이지 경로 (상대 경로만 - pathname + search)
    const currentPath = location.pathname;
    const currentSearch = location.search;
    const nextPath = `${currentPath}${currentSearch}`; // 상대 경로만

    // callback URL 생성 (redirectTo는 절대 URL, next는 상대 경로)
    const callbackUrl = `${baseUrl}/auth/callback?next=${encodeURIComponent(
      nextPath
    )}`;

    console.log("OAuth redirectTo:", callbackUrl); // 디버깅용
    console.log("Next path (relative):", nextPath); // 디버깅용

    const { data, error } = await browserClient.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (error) {
      console.error("카카오 로그인 오류:", error);
      alert("카카오 로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      return;
    }

    // data.url이 있으면 수동으로 리다이렉트 (필요한 경우)
    if (data?.url) {
      window.location.href = data.url;
    }
  };

  // 가격 포맷 함수 - useCallback으로 메모이제이션
  const formatPrice = useCallback((price: number) => {
    return new Intl.NumberFormat("ko-KR").format(price);
  }, []);

  // 수량 증가 함수 - useCallback으로 메모이제이션
  const increaseQuantity = useCallback((menuItem: MenuItem) => {
    setOrderItems((prev) => {
      const existingItem = prev.find((item) => item.id === menuItem.id);
      if (existingItem) {
        return prev.map((item) =>
          item.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            id: menuItem.id,
            name: menuItem.name,
            price: menuItem.price,
            quantity: 1,
          },
        ];
      }
    });
  }, []);

  // 수량 감소 함수 - useCallback으로 메모이제이션
  const decreaseQuantity = useCallback((menuItem: MenuItem) => {
    setOrderItems((prev) => {
      const existingItem = prev.find((item) => item.id === menuItem.id);
      if (existingItem && existingItem.quantity > 1) {
        return prev.map((item) =>
          item.id === menuItem.id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      } else {
        return prev.filter((item) => item.id !== menuItem.id);
      }
    });
  }, []);

  // 아이템 수량 조회 - useCallback으로 메모이제이션
  const getItemQuantity = useCallback((menuId: string) => {
    const item = orderItems.find((item) => item.id === menuId);
    return item ? item.quantity : 0;
  }, [orderItems]);

  // 총 금액 계산 - useMemo로 메모이제이션
  const totalAmount = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [orderItems]
  );

  // 영업 상태 확인 - useMemo로 메모이제이션
  const isStoreOpen = useMemo(() => {
    // 영업시간 정보가 없으면 영업 중으로 간주
    if (!todayHours) return true;

    // 휴무일인 경우
    if (todayHours.is_closed) return false;

    // 영업시간 확인
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const parseTime = (timeStr: string | null) => {
      if (!timeStr) return null;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const openTime = parseTime(todayHours.open_time);
    const closeTime = parseTime(todayHours.close_time);

    if (openTime !== null && closeTime !== null) {
      return currentTime >= openTime && currentTime < closeTime;
    }

    return true; // 시간 정보가 없으면 영업 중으로 간주
  }, [todayHours]);

  const isAuthenticated = !!user;
  const canOrder =
    orderItems.length > 0 &&
    isPhoneValid &&
    isAuthenticated &&
    isStoreOpen;

  // 주문 불가 상태 메시지
  const [orderError, setOrderError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    if (!canOrder) {
      if (orderItems.length === 0) {
        setOrderError("주문할 메뉴를 선택해주세요.");
        // 3초 후 에러 메시지 자동 제거
        setTimeout(() => setOrderError(null), 3000);
      } else if (!userPhoneNumber && !isPhoneValid) {
        setOrderError("전화번호를 올바르게 입력해주세요. (예: 010-1234-5678)");
        setTimeout(() => setOrderError(null), 3000);
      }
      return;
    }
    // 주문 정보를 sessionStorage에 저장 (전화번호 입력 후 자동 주문을 위해)
    saveOrderToSession();
    // 확인 모달 표시
    setShowOrderConfirmModal(true);
  };

  // 실제 주문 제출
  const submitOrder = () => {
    const formData = new FormData();
    formData.append("orderItems", JSON.stringify(orderItems));
    formData.append("totalAmount", String(totalAmount));
    formData.append("phoneNumber", effectivePhoneNumber);

    fetcher.submit(formData, { method: "POST" });
  };

  // fetcher 결과 처리
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const result = fetcher.data as { success?: boolean; orderId?: string; message?: string };
      if (result.success && result.orderId) {
        // 주문 성공 시 완료 페이지로 이동
        window.location.href = `/customer/order-success?orderId=${result.orderId}`;
      } else if (result.message) {
        alert(result.message);
        setShowOrderConfirmModal(false);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";

  if (!menuItems || menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-gray-400">restaurant_menu</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            아직 메뉴가 준비되지 않았어요
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            가게에서 메뉴를 준비 중입니다.
            <br />
            잠시 후 다시 방문해주세요.
          </p>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            이전 페이지로
          </button>
        </div>
      </div>
    );
  }

  // 첫 번째 메뉴 아이템 (Featured로 표시) - useMemo로 메모이제이션
  const featuredItem = useMemo(
    () =>
      (menuItems as MenuItemWithCategory[]).find(
        (item) =>
          selectedCategory === null ||
          item.category_id === selectedCategory
      ),
    [menuItems, selectedCategory]
  );

  // 일반 메뉴 아이템 목록 - useMemo로 메모이제이션
  const regularItems = useMemo(
    () =>
      (menuItems as MenuItemWithCategory[]).filter(
        (item) =>
          (selectedCategory === null ||
            item.category_id === selectedCategory) &&
          item.id !== featuredItem?.id
      ),
    [menuItems, selectedCategory, featuredItem?.id]
  );

  return (
    <div className="w-full max-w-[480px] bg-background-light min-h-screen shadow-2xl relative pb-46 flex flex-col mx-auto">
      {/* 전화번호 입력 모달 */}
      {showPhoneModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-2xl text-primary">phone</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">연락처를 알려주세요</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                주문 확인과 픽업 안내를 위해 필요합니다.
                <br />
                <span className="text-primary font-medium">한 번만 입력하면 다음부터 자동 저장됩니다.</span>
              </p>
            </div>
            <Form method="post" className="space-y-4">
              <input
                type="hidden"
                name="actionType"
                value="updatePhoneNumber"
              />
              <div>
                <PhoneInput
                  value={phoneInput}
                  onChange={setPhoneInput}
                  autoFocus
                />
                <input type="hidden" name="phoneNumber" value={getRawPhoneNumber(phoneInput)} />
              </div>
              {actionData &&
                "error" in actionData &&
                typeof actionData.error === "string" && (
                  <div className="text-red-700 text-sm bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    {actionData.error}
                  </div>
                )}
              <button
                type="submit"
                disabled={!validatePhoneNumber(phoneInput).isValid}
                className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">check</span>
                저장하고 계속하기
              </button>
            </Form>
          </div>
        </div>
      )}

      {/* 주문 확인 모달 */}
      {showOrderConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">주문 확인</h2>
              <button
                onClick={() => setShowOrderConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
                disabled={isSubmitting}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* 주문 내역 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* 가게 정보 */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <span className="material-symbols-outlined text-primary">store</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{storename}</p>
                  <p className="text-sm text-gray-500">포장 주문</p>
                </div>
              </div>

              {/* 연락처 */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <span className="material-symbols-outlined text-blue-500">phone</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">연락처</p>
                  <p className="font-medium text-gray-900">{effectivePhoneNumber}</p>
                </div>
              </div>

              {/* 주문 아이템 */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-bold text-gray-700">주문 내역</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {orderItems.map((item) => (
                    <div key={item.id} className="p-4 flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatPrice(item.price)}원 x {item.quantity}
                        </p>
                      </div>
                      <p className="font-bold text-gray-900">
                        {formatPrice(item.price * item.quantity)}원
                      </p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                  <span className="font-bold text-gray-700">총 결제금액</span>
                  <span className="text-xl font-bold text-primary">
                    {formatPrice(totalAmount)}원
                  </span>
                </div>
              </div>

              {/* 안내 메시지 */}
              <div className="space-y-3">
                <div className="flex gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <span className="material-symbols-outlined text-yellow-600 shrink-0">payments</span>
                  <div className="text-sm text-yellow-800">
                    <p className="font-bold">현장 결제</p>
                    <p>결제는 가게에서 음식 수령 시 진행됩니다.</p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <span className="material-symbols-outlined text-red-600 shrink-0">warning</span>
                  <div className="text-sm text-red-800">
                    <p className="font-bold">주문 확정 전 확인해주세요</p>
                    <p>주문 접수 후에는 취소가 어렵습니다. 메뉴와 수량을 다시 한번 확인해주세요.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="p-4 border-t border-gray-100 space-y-3">
              <button
                onClick={submitOrder}
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[56px]"
                aria-label={isSubmitting ? "주문 처리 중입니다" : "주문 확정하기"}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>주문 처리 중...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>주문 확정하기</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowOrderConfirmModal(false)}
                disabled={isSubmitting}
                className="w-full py-3 text-gray-600 font-medium hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 min-h-[48px]"
                aria-label="주문 취소하고 돌아가기"
              >
                다시 확인할게요
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 h-14 bg-white/80 backdrop-blur-xl sticky top-0 z-40 border-b border-border">
        <button
          onClick={() => window.history.back()}
          className="size-10 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors"
          aria-label="뒤로 가기"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <h1 className="text-[15px] font-semibold text-foreground tracking-tight truncate max-w-[60%]">
          {storename}
        </h1>
        <div className="flex items-center gap-1">
          {isAuthenticated && userEmail && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 h-8 rounded-md bg-muted">
              <span className="material-symbols-outlined text-muted-foreground text-[16px]">
                account_circle
              </span>
              <span className="text-xs font-medium text-muted-foreground max-w-[120px] truncate">
                {userEmail}
              </span>
            </div>
          )}
          {isAuthenticated && (
            <Form method="post">
              <input type="hidden" name="actionType" value="logout" />
              <button
                type="submit"
                className="size-10 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
                title="로그아웃"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </Form>
          )}
        </div>
      </header>

      {/* 성공/실패 메시지 */}
      {actionData && "message" in actionData && (
        <div className="px-4 py-2">
          <div
            className={`border px-4 py-3 rounded-xl mb-4 ${
              "success" in actionData && actionData.success
                ? "bg-green-100 border-green-400 text-green-700"
                : "bg-red-100 border-red-400 text-red-700"
            }`}
          >
            {actionData.message}
            {"success" in actionData && actionData.success && "orderId" in actionData && actionData.orderId && (
              <p className="text-sm mt-1">주문번호: {actionData.orderId}</p>
            )}
            {"requiresAuth" in actionData && actionData.requiresAuth && (
              <button
                onClick={handleKakaoLogin}
                className="mt-3 w-full py-2 px-4 bg-[#FEE500] text-[#3c1e1e] rounded-lg font-bold hover:bg-[#fadd00] transition-colors"
              >
                카카오로 로그인하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* Restaurant Hero Section */}
      <div className="px-4 pt-4 pb-6 bg-background">
        <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-muted group">
          {/* 가게 이미지 우선 사용, 없으면 메뉴 아이템 이미지 사용 */}
          {store_image ? (
            <img
              src={store_image}
              alt={storename}
              loading="eager"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : featuredItem?.image ? (
            <img
              src={featuredItem.image}
              alt={storename}
              loading="eager"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-muted-foreground/40">
                restaurant
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"></div>
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h2 className="text-[26px] font-semibold tracking-tight mb-2 leading-tight">
              {storename}
            </h2>
            <div className="flex items-center flex-wrap gap-1.5 text-[13px] font-medium">
              {/* 가게 전화번호 */}
              {storenumber && (
                <a
                  href={`tel:${storenumber}`}
                  className="flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 h-7 rounded-md hover:bg-white/25 transition-colors"
                >
                  <span className="material-symbols-outlined text-white text-[15px]">
                    call
                  </span>
                  {storenumber}
                </a>
              )}
              {/* 예상 준비 시간 */}
              <span className="flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 h-7 rounded-md">
                <span className="material-symbols-outlined text-white text-[15px]">
                  schedule
                </span>
                약 {prepTime}분
              </span>
              {/* 영업 상태 */}
              {(() => {
                if (!todayHours) return null;

                if (todayHours.is_closed) {
                  return (
                    <span className="bg-white/15 backdrop-blur-md px-2.5 h-7 inline-flex items-center rounded-md text-white">
                      오늘 휴무
                    </span>
                  );
                }

                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();

                const parseTime = (timeStr: string | null) => {
                  if (!timeStr) return null;
                  const [hours, minutes] = timeStr.split(':').map(Number);
                  return hours * 60 + minutes;
                };

                const openTime = parseTime(todayHours.open_time);
                const closeTime = parseTime(todayHours.close_time);

                if (openTime !== null && closeTime !== null) {
                  const isOpen = currentTime >= openTime && currentTime < closeTime;
                  return isOpen ? (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/95 px-2.5 h-7 rounded-md text-white">
                      <span className="size-1.5 rounded-full bg-white"></span>
                      영업중
                    </span>
                  ) : (
                    <span className="bg-white/15 backdrop-blur-md px-2.5 h-7 inline-flex items-center rounded-md text-white">
                      영업종료
                    </span>
                  );
                }

                return null;
              })()}
            </div>
          </div>
        </div>
        {(store_description || true) && (
          <p className="text-muted-foreground text-[13px] leading-relaxed mt-4 px-0.5">
            {store_description || "맛있는 음식을 빠르고 편리하게 주문하세요."}
          </p>
        )}
      </div>

      {/* Sticky Category Navigation */}
      <div className="sticky top-14 z-30 bg-background/85 backdrop-blur-xl border-b border-border">
        <nav className="flex overflow-x-auto no-scrollbar px-4 gap-6">
          <button
            onClick={() => setSelectedCategory(null)}
            className="relative flex items-center pt-3.5 pb-3 min-w-max"
          >
            <span
              className={`text-[13px] tracking-tight font-medium transition-colors ${
                selectedCategory === null ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              전체
            </span>
            {selectedCategory === null && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full"></span>
            )}
          </button>
          {categories.map((cat: Pick<Category, "id" | "name" | "display_order">) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="relative flex items-center pt-3.5 pb-3 min-w-max"
            >
              <span
                className={`text-[13px] tracking-tight font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.name}
              </span>
              {selectedCategory === cat.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full"></span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Menu Content */}
      <main className="flex flex-col px-4 pb-48 pt-2 gap-10 bg-background">
        {/* Featured Item (First Item - Large Card) */}
        {featuredItem && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
                {categories.find(
                  (c: Pick<Category, "id" | "name" | "display_order">) => c.id === featuredItem?.category_id
                )?.name || "추천 메뉴"}
              </h3>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Featured
              </span>
            </div>
            <article className="flex flex-col bg-card rounded-xl border border-border overflow-hidden">
              <div className="relative aspect-[4/3] w-full bg-muted overflow-hidden">
                {featuredItem.image ? (
                  <img
                    src={featuredItem.image}
                    alt={featuredItem.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted flex items-center justify-center">
                    <span className="material-symbols-outlined text-6xl text-muted-foreground/40">
                      lunch_dining
                    </span>
                  </div>
                )}
              </div>
              <div className="p-5 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-3">
                  <h4 className="text-[17px] font-semibold text-foreground leading-tight tracking-tight">
                    {featuredItem.name}
                  </h4>
                  <span className="text-[15px] font-semibold text-foreground tabular-nums whitespace-nowrap">
                    {formatPrice(featuredItem.price)}원
                  </span>
                </div>
                {featuredItem.description && (
                  <p className="text-muted-foreground text-[13px] leading-relaxed">
                    {featuredItem.description}
                  </p>
                )}
                {/* Quantity Control */}
                <div className="mt-1 flex items-center justify-end">
                  {getItemQuantity(featuredItem.id) > 0 ? (
                    <div className="inline-flex items-center bg-muted rounded-lg h-10 p-1">
                      <button
                        type="button"
                        onClick={() => decreaseQuantity(featuredItem)}
                        className="size-8 flex items-center justify-center rounded-md text-foreground hover:bg-background transition-colors"
                        aria-label={`${featuredItem.name} 수량 감소`}
                      >
                        <span className="material-symbols-outlined text-[18px]">remove</span>
                      </button>
                      <span className="w-9 text-center font-semibold text-foreground text-[13px] tabular-nums">
                        {getItemQuantity(featuredItem.id)}
                      </span>
                      <button
                        type="button"
                        onClick={() => increaseQuantity(featuredItem)}
                        className="size-8 flex items-center justify-center rounded-md text-foreground hover:bg-background transition-colors"
                        aria-label={`${featuredItem.name} 수량 증가`}
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => increaseQuantity(featuredItem)}
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-secondary text-secondary-foreground text-[13px] font-medium hover:bg-secondary/80 transition-colors"
                      aria-label={`${featuredItem.name} 담기`}
                    >
                      담기
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          </section>
        )}

        {/* Regular Items (Row Layout) */}
        {regularItems.length > 0 && (
          <section>
            {featuredItem && (
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
                  {regularItems[0]?.category || "메뉴"}
                </h3>
                <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                  {regularItems.length}개
                </span>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {regularItems.map((item: MenuItemWithCategory) => (
                <article
                  key={item.id}
                  className="group flex bg-card rounded-xl p-3 border border-border gap-3.5 hover:border-foreground/15 transition-colors"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      loading="lazy"
                      className="size-28 rounded-lg bg-muted object-cover shrink-0"
                    />
                  ) : (
                    <div className="size-28 rounded-lg bg-muted shrink-0 flex items-center justify-center text-muted-foreground/40">
                      <span className="material-symbols-outlined text-[36px]">
                        lunch_dining
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col flex-1 justify-between py-0.5 min-w-0">
                    <div className="min-w-0">
                      <h4 className="text-[15px] font-semibold text-foreground tracking-tight truncate">
                        {item.name}
                      </h4>
                      {item.description && (
                        <p className="text-muted-foreground text-[12px] mt-1 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 gap-2">
                      <span className="font-semibold text-foreground text-[15px] tabular-nums">
                        {formatPrice(item.price)}원
                      </span>
                      {getItemQuantity(item.id) > 0 ? (
                        <div className="inline-flex items-center bg-muted rounded-lg h-9 p-0.5">
                          <button
                            type="button"
                            onClick={() => decreaseQuantity(item)}
                            className="size-8 flex items-center justify-center rounded-md text-foreground hover:bg-background transition-colors"
                            aria-label={`${item.name} 수량 감소`}
                          >
                            <span className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <span className="w-7 text-center font-semibold text-foreground text-[12px] tabular-nums">
                            {getItemQuantity(item.id)}
                          </span>
                          <button
                            type="button"
                            onClick={() => increaseQuantity(item)}
                            className="size-8 flex items-center justify-center rounded-md text-foreground hover:bg-background transition-colors"
                            aria-label={`${item.name} 수량 증가`}
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => increaseQuantity(item)}
                          className="inline-flex items-center justify-center gap-1 h-9 px-3.5 rounded-lg bg-secondary text-secondary-foreground text-[12px] font-medium hover:bg-secondary/80 transition-colors"
                          aria-label={`${item.name} 담기`}
                        >
                          담기
                          <span className="material-symbols-outlined text-[14px]">add</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Fixed Bottom Order Bar */}
      <div className="fixed bottom-0 z-50 w-full max-w-[480px]">
        <div className="bg-background/95 backdrop-blur-xl border-t border-border px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {!isAuthenticated ? (
            /* Kakao Login Button - Always shown when not authenticated */
            <div className="space-y-2.5">
              <p className="text-center text-[12px] text-muted-foreground">주문하려면 로그인이 필요해요</p>
              <button
                onClick={handleKakaoLogin}
                className="w-full bg-[#FEE500] hover:bg-[#FDD800] active:bg-[#F5D000] text-[#3C1E1E] font-medium h-12 rounded-lg transition-colors flex items-center justify-center gap-2 tracking-tight"
              >
                <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3C6.48 3 2 6.48 2 10.76C2 13.62 3.86 16.12 6.64 17.41L5.64 21.05C5.57 21.32 5.86 21.56 6.11 21.38L10.39 18.53C10.91 18.59 11.45 18.62 12 18.62C17.52 18.62 22 15.14 22 10.86C22 6.58 17.52 3 12 3Z"></path>
                </svg>
                <span className="text-[14px]">카카오로 간편 로그인</span>
              </button>
            </div>
          ) : (
            /* Order Summary & Checkout Action - Always shown when authenticated */
            <div className="flex flex-col gap-2.5">
              {/* Phone Number Input - only show if user doesn't have phone number in profile */}
              {!userPhoneNumber && (
                <div className="bg-muted rounded-lg p-3">
                  <label
                    htmlFor="phoneNumber"
                    className="block text-[12px] font-medium text-foreground mb-1"
                  >
                    연락처
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    주문 확인 및 픽업 안내용
                  </p>
                  <PhoneInput
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={setPhoneNumber}
                    className="text-sm py-2"
                    required
                  />
                </div>
              )}

              {/* 주문 에러 메시지 */}
              {orderError && (
                <div className="px-3 py-2.5 bg-destructive/5 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-[12px]">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{orderError}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                    {orderItems.reduce((sum, item) => sum + item.quantity, 0)}개
                  </span>
                  <span className="text-[20px] font-semibold text-foreground tracking-tight tabular-nums leading-none mt-0.5">
                    {formatPrice(totalAmount)}원
                  </span>
                </div>
                <Form method="post" className="flex-1" onSubmit={handleSubmit}>
                  <input
                    type="hidden"
                    name="orderItems"
                    value={JSON.stringify(orderItems)}
                  />
                  <input type="hidden" name="totalAmount" value={totalAmount} />
                  <input
                    type="hidden"
                    name="phoneNumber"
                    value={effectivePhoneNumber}
                  />
                  <button
                    type="submit"
                    disabled={!canOrder}
                    className={`w-full h-12 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium tracking-tight text-[14px] ${
                      !isStoreOpen
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                    }`}
                    aria-label={!isStoreOpen ? "영업 종료" : canOrder ? `${formatPrice(totalAmount)}원 주문하기` : "주문 조건을 확인해주세요"}
                  >
                    <span>{!isStoreOpen ? "영업 종료" : "주문하기"}</span>
                    {isStoreOpen && orderItems.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md bg-white/20 text-[11px] font-semibold tabular-nums">
                        {orderItems.reduce((sum, item) => sum + item.quantity, 0)}
                      </span>
                    )}
                  </button>
                </Form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
