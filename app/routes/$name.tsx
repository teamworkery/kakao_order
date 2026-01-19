import { useState, useEffect, useMemo, useCallback } from "react";
import { Form, useLocation, redirect, useFetcher } from "react-router";
import { makeSSRClient, browserClient } from "../supa_clients";
import type { Database } from "database.types";
import type { Route } from "./+types/$name";
import type { SupabaseClient } from "@supabase/supabase-js";
import PhoneInput, { getRawPhoneNumber, validatePhoneNumber } from "~/common/components/phone-input";

type MenuItem = Database["public"]["Tables"]["menuItem"]["Row"];
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
    const orderItems = JSON.parse(formData.get("orderItems") as string);
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
  const isAuthenticated = !!user;
  const canOrder =
    orderItems.length > 0 &&
    isPhoneValid &&
    isAuthenticated;

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
      menuItems.find(
        (item: MenuItem) =>
          selectedCategory === null ||
          (item as any).category_id === selectedCategory
      ),
    [menuItems, selectedCategory]
  );

  // 일반 메뉴 아이템 목록 - useMemo로 메모이제이션
  const regularItems = useMemo(
    () =>
      menuItems.filter(
        (item: MenuItem) =>
          (selectedCategory === null ||
            (item as any).category_id === selectedCategory) &&
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
      <header className="flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-gray-100 transition-colors">
        <button
          onClick={() => window.history.back()}
          className="size-11 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 text-gray-800 transition-colors"
          aria-label="뒤로 가기"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">
          {storename}
        </h1>
        <div className="flex items-center gap-2">
          {isAuthenticated && userEmail && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200">
              <span className="material-symbols-outlined text-gray-600 text-sm">
                account_circle
              </span>
              <span className="text-xs font-medium text-gray-700 max-w-[120px] truncate">
                {userEmail}
              </span>
            </div>
          )}
          {isAuthenticated && (
            <Form method="post">
              <input type="hidden" name="actionType" value="logout" />
              <button
                type="submit"
                className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-800 transition-colors"
                title="로그아웃"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </Form>
          )}
          {!isAuthenticated && (
            <>
              <button className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-800 transition-colors">
                <span className="material-symbols-outlined">search</span>
              </button>
              <button className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-800 transition-colors">
                <span className="material-symbols-outlined">share</span>
              </button>
            </>
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
      <div className="p-4 bg-white">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-4 bg-gray-200 group">
          {/* 가게 이미지 우선 사용, 없으면 메뉴 아이템 이미지 사용 */}
          {store_image ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url(${store_image})` }}
            ></div>
          ) : featuredItem?.image ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url(${featuredItem.image})` }}
            ></div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-primary/50">
                restaurant
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h2 className="text-3xl font-extrabold tracking-tight mb-1">
              {storename}
            </h2>
            <div className="flex items-center flex-wrap gap-3 text-sm font-medium">
              {/* 가게 전화번호 */}
              {storenumber && (
                <a
                  href={`tel:${storenumber}`}
                  className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg hover:bg-white/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-white text-lg">
                    call
                  </span>
                  {storenumber}
                </a>
              )}
              {/* 예상 준비 시간 */}
              <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                <span className="material-symbols-outlined text-white text-lg">
                  schedule
                </span>
                약 {prepTime}분
              </span>
              {/* 영업 상태 */}
              {(() => {
                // 영업시간 정보가 없으면 표시하지 않음
                if (!todayHours) return null;

                // 휴무일인 경우
                if (todayHours.is_closed) {
                  return (
                    <span className="bg-gray-500 px-2 py-1 rounded-lg text-white">
                      오늘 휴무
                    </span>
                  );
                }

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
                  const isOpen = currentTime >= openTime && currentTime < closeTime;
                  return isOpen ? (
                    <span className="bg-green-500 px-2 py-1 rounded-lg text-white">
                      영업중
                    </span>
                  ) : (
                    <span className="bg-gray-500 px-2 py-1 rounded-lg text-white">
                      영업종료
                    </span>
                  );
                }

                return null;
              })()}
            </div>
          </div>
        </div>
        {store_description && (
          <p className="text-gray-500 text-sm leading-relaxed px-1">
            {store_description}
          </p>
        )}
        {!store_description && (
          <p className="text-gray-500 text-sm leading-relaxed px-1">
            맛있는 음식을 빠르고 편리하게 주문하세요.
          </p>
        )}
      </div>

      {/* Sticky Category Navigation */}
      <div className="sticky top-[64px] z-30 bg-white border-b border-gray-100 shadow-sm">
        <nav className="flex overflow-x-auto no-scrollbar px-4 gap-8 py-0">
          <button
            onClick={() => setSelectedCategory(null)}
            className="relative flex flex-col items-center gap-3 pt-4 pb-3 min-w-max group"
          >
            <span
              className={`text-sm tracking-wide font-bold ${
                selectedCategory === null ? "text-primary" : "text-gray-500"
              }`}
            >
              전체
            </span>
            <span
              className={`absolute bottom-0 w-full h-1 rounded-t-full transition-colors ${
                selectedCategory === null ? "bg-primary" : "bg-transparent"
              }`}
            ></span>
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="relative flex flex-col items-center gap-3 pt-4 pb-3 min-w-max group"
            >
              <span
                className={`text-sm tracking-wide font-bold transition-colors ${
                  selectedCategory === cat.id
                    ? "text-primary"
                    : "text-gray-500 group-hover:text-gray-900"
                }`}
              >
                {cat.name}
              </span>
              <span
                className={`absolute bottom-0 w-full h-1 rounded-t-full transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-primary"
                    : "bg-transparent group-hover:bg-gray-200"
                }`}
              ></span>
            </button>
          ))}
        </nav>
      </div>

      {/* Menu Content */}
      <main className="flex flex-col p-4 gap-8 bg-background-light">
        {/* Featured Item (First Item - Large Card) */}
        {featuredItem && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                {categories.find(
                  (c: any) => c.id === (featuredItem as any).category_id
                )?.name || "추천 메뉴"}
              </h3>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative h-56 w-full bg-gray-100 bg-cover bg-center">
                  {featuredItem.image ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${featuredItem.image})` }}
                    ></div>
                  ) : (
                    <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                      <span className="material-symbols-outlined text-6xl text-gray-400">
                        lunch_dining
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <h4 className="text-lg font-bold text-gray-900 leading-tight">
                      {featuredItem.name}
                    </h4>
                    <span className="text-lg font-bold text-gray-900">
                      {formatPrice(featuredItem.price)}원
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {featuredItem.description || ""}
                  </p>
                  {/* Quantity Control */}
                  <div className="mt-2 flex items-center justify-end">
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => decreaseQuantity(featuredItem)}
                        className="size-9 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 hover:text-primary active:scale-95 transition-all"
                        disabled={getItemQuantity(featuredItem.id) === 0}
                      >
                        <span className="material-symbols-outlined text-xl">
                          remove
                        </span>
                      </button>
                      <span className="w-10 text-center font-bold text-gray-900 text-base">
                        {getItemQuantity(featuredItem.id)}
                      </span>
                      <button
                        type="button"
                        onClick={() => increaseQuantity(featuredItem)}
                        className="size-9 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 hover:text-primary active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-xl">
                          add
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Regular Items (Row Layout) */}
        {regularItems.length > 0 && (
          <section>
            {featuredItem && (
              <div className="flex items-center justify-between mb-4 mt-2">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                  {regularItems[0]?.category || "메뉴"}
                </h3>
              </div>
            )}
            <div className="flex flex-col gap-4">
              {regularItems.map((item: MenuItem) => (
                <div
                  key={item.id}
                  className="group flex bg-white rounded-xl p-3 shadow-sm border border-gray-100 gap-4 hover:shadow-md transition-all"
                >
                  {item.image ? (
                    <div
                      className="size-28 rounded-lg bg-gray-100 bg-cover bg-center shrink-0"
                      style={{ backgroundImage: `url(${item.image})` }}
                    ></div>
                  ) : (
                    <div className="size-28 rounded-lg bg-gray-50 shrink-0 flex items-center justify-center text-gray-300">
                      <span className="material-symbols-outlined text-[40px]">
                        lunch_dining
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col flex-1 justify-between py-0.5">
                    <div>
                      <h4 className="text-base font-bold text-gray-900 group-hover:text-primary transition-colors">
                        {item.name}
                      </h4>
                      <p className="text-gray-500 text-xs mt-1.5 leading-relaxed line-clamp-2">
                        {item.description || ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-bold text-gray-900 text-lg">
                        {formatPrice(item.price)}원
                      </span>
                      {getItemQuantity(item.id) > 0 ? (
                        <div className="flex items-center bg-gray-100 rounded-lg p-1 h-9">
                          <button
                            type="button"
                            onClick={() => decreaseQuantity(item)}
                            className="w-8 h-full flex items-center justify-center text-gray-600 hover:text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">
                              remove
                            </span>
                          </button>
                          <span className="w-7 text-center font-bold text-gray-900 text-sm">
                            {getItemQuantity(item.id)}
                          </span>
                          <button
                            type="button"
                            onClick={() => increaseQuantity(item)}
                            className="w-8 h-full flex items-center justify-center text-gray-600 hover:text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">
                              add
                            </span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => increaseQuantity(item)}
                          className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-900 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors min-h-[44px]"
                          aria-label={`${item.name} 담기`}
                        >
                          담기
                          <span className="material-symbols-outlined text-sm font-bold">
                            add
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Fixed Bottom Order Bar */}
      <div className="fixed bottom-0 z-50 w-full max-w-[480px]">
        {/* Gradient fade */}
        <div className="h-8 bg-gradient-to-b from-transparent to-white/10 w-full pointer-events-none"></div>
        <div className="bg-white border-t border-gray-100 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] p-4 rounded-t-2xl">
          {!isAuthenticated ? (
            /* Kakao Login Button - Always shown when not authenticated */
            <div className="space-y-3">
              <p className="text-center text-sm text-gray-500">주문하려면 로그인이 필요해요</p>
              <button
                onClick={handleKakaoLogin}
                className="w-full bg-[#FEE500] hover:bg-[#fdd800] active:bg-[#f5d000] text-[#3C1E1E] font-bold py-4 rounded-xl shadow-lg transition-all group active:scale-[0.98] min-h-[56px] flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3C6.48 3 2 6.48 2 10.76C2 13.62 3.86 16.12 6.64 17.41L5.64 21.05C5.57 21.32 5.86 21.56 6.11 21.38L10.39 18.53C10.91 18.59 11.45 18.62 12 18.62C17.52 18.62 22 15.14 22 10.86C22 6.58 17.52 3 12 3Z"></path>
                </svg>
                <span className="text-[15px]">카카오로 간편 로그인</span>
              </button>
            </div>
          ) : (
            /* Order Summary & Checkout Action - Always shown when authenticated */
            <div className="flex flex-col gap-3">
              {/* Phone Number Input - only show if user doesn't have phone number in profile */}
              {!userPhoneNumber && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <label
                    htmlFor="phoneNumber"
                    className="block text-sm font-bold text-gray-700 mb-2"
                  >
                    연락처를 입력해주세요
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    주문 확인 및 픽업 안내를 위해 필요합니다.
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
                <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm animate-pulse">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{orderError}</span>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex flex-col pl-1">
                  <span className="text-xs text-gray-500 font-medium">
                    총 {orderItems.reduce((sum, item) => sum + item.quantity, 0)}개
                  </span>
                  <span className="text-2xl font-bold text-gray-900 tracking-tight">
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
                    className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/30 flex items-center justify-between px-6 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px]"
                    aria-label={canOrder ? `${formatPrice(totalAmount)}원 주문하기` : "주문 조건을 확인해주세요"}
                  >
                    <span className="text-[15px]">주문하기</span>
                    <span className="bg-white/20 group-hover:bg-white/30 text-white text-xs font-bold px-2.5 py-1 rounded-md transition-colors">
                      {orderItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
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
