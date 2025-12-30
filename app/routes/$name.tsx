import { useState, useEffect } from "react";
import { Form, useLocation, redirect } from "react-router";
import { makeSSRClient, browserClient } from "../supa_clients";
import type { Database } from "database.types";
import type { Route } from "./+types/$name";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export const getMenuItems = async (
  client: SupabaseClient<Database>,
  profile_id: string
) => {
  const { data, error } = await client
    .from("menuItem")
    .select("*")
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
export const loader = async ({ request, params }: MyLoaderArgs) => {
  const name = params.name;
  if (!name) throw new Response("Not Found", { status: 404 });

  const { client } = makeSSRClient(request);
  const { data: profile, error } = await client
    .from("profiles")
    .select("profile_id, storename, store_image")
    .eq("name", name)
    .single();

  if (error || !profile) {
    console.error("Profile not found:", error);
    throw new Response("Not Found", { status: 404 });
  }

  const profile_id = profile.profile_id;
  const menuItems = await getMenuItems(client, profile_id);

  // 인증 상태 확인
  const { data: userData } = await client.auth.getUser();
  const user = userData?.user || null;

  // 로그인한 사용자의 프로필 정보 가져오기
  let userProfile = null;
  let needsPhoneNumber = false;
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
  }

  return {
    menuItems,
    user,
    userEmail: userProfile?.email || user?.email || null,
    name,
    storename: profile.storename || name,
    store_image: profile.store_image || null,
    needsPhoneNumber, // 전화번호 입력 필요 플래그
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
      return {
        success: false,
        message: "주문하려면 카카오 로그인이 필요합니다.",
        requiresAuth: true,
      };
    }
    let phoneNumber = formData.get("phoneNumber") as string;
    const orderItems = JSON.parse(formData.get("orderItems") as string);
    const totalAmount = parseInt(formData.get("totalAmount") as string);
    const autoOrder = formData.get("autoOrder") === "true"; // 자동 주문 플래그

    // 자동 주문인 경우 프로필에서 전화번호 가져오기
    if (autoOrder && (!phoneNumber || phoneNumber.trim() === "")) {
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

    return {
      success: true,
      message:
        "주문이 성공적으로 접수되었습니다. 음식점 확인 시 알림톡이 발송됩니다.",
      orderId,
    };
  } catch (error) {
    console.error("주문 저장 실패:", error);
    return {
      success: false,
      message: "주문 처리 중 오류가 발생했습니다.",
    };
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
  actionData,
}: Route.ComponentProps) {
  const {
    menuItems,
    user: initialUser,
    userEmail,
    name,
    storename,
    store_image,
    needsPhoneNumber,
  } = loaderData;
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [user, setUser] = useState(initialUser);
  const [showPhoneModal, setShowPhoneModal] = useState(needsPhoneNumber);
  const [phoneInput, setPhoneInput] = useState("");
  const location = useLocation();

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
    if (actionData?.success) {
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
        phoneNumber: phoneNumber.trim() || null,
      };
      sessionStorage.setItem("pendingOrder", JSON.stringify(orderData));
    }
  };

  // 카카오 로그인 함수
  const handleKakaoLogin = async () => {
    // 주문 정보를 sessionStorage에 저장
    saveOrderToSession();

    const currentUrl = `${window.location.origin}${location.pathname}`;
    const { error } = await browserClient.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${
          window.location.origin
        }/auth/callback?next=${encodeURIComponent(currentUrl)}`,
      },
    });

    if (error) {
      console.error("카카오 로그인 오류:", error);
      alert("카카오 로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ko-KR").format(price);
  };

  const categories = Array.from(
    new Set(menuItems.map((item: MenuItem) => item.category).filter(Boolean))
  );

  const increaseQuantity = (menuItem: MenuItem) => {
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
  };

  const decreaseQuantity = (menuItem: MenuItem) => {
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
  };

  const getItemQuantity = (menuId: string) => {
    const item = orderItems.find((item) => item.id === menuId);
    return item ? item.quantity : 0;
  };

  const totalAmount = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const isAuthenticated = !!user;
  const canOrder =
    orderItems.length > 0 && phoneNumber.trim() !== "" && isAuthenticated;

  const handleSubmit = (e: React.FormEvent) => {
    if (!canOrder) {
      e.preventDefault();
      alert("메뉴를 선택하고 전화번호를 입력해주세요.");
      return;
    }
    // 주문 정보를 sessionStorage에 저장 (전화번호 입력 후 자동 주문을 위해)
    saveOrderToSession();
  };

  if (!menuItems || menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            등록된 메뉴가 없습니다.
          </h2>
          <p className="text-gray-600">
            해당 페이지의 관리자라면 관리자 페이지에서 메뉴를 등록해주세요.
          </p>
        </div>
      </div>
    );
  }

  // 첫 번째 메뉴 아이템 (Featured로 표시)
  const featuredItem = menuItems.find(
    (item: MenuItem) =>
      selectedCategory === null || item.category === selectedCategory
  );
  const regularItems = menuItems.filter(
    (item: MenuItem) =>
      (selectedCategory === null || item.category === selectedCategory) &&
      item.id !== featuredItem?.id
  );

  return (
    <div className="w-full max-w-[480px] bg-background-light min-h-screen shadow-2xl relative pb-40 flex flex-col mx-auto">
      {/* 전화번호 입력 모달 */}
      {showPhoneModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">전화번호 입력</h2>
            <p className="text-gray-600 mb-4">
              주문을 위해 전화번호를 입력해주세요.
            </p>
            <Form method="post" className="space-y-4">
              <input
                type="hidden"
                name="actionType"
                value="updatePhoneNumber"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  전화번호 *
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="010-1234-5678"
                  required
                  className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              {actionData &&
                "error" in actionData &&
                typeof actionData.error === "string" && (
                  <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">
                    {actionData.error}
                  </div>
                )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  저장하기
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-gray-100 transition-colors">
        <button className="size-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-800 transition-colors">
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
      {actionData && (
        <div className="px-4 py-2">
          <div
            className={`border px-4 py-3 rounded-xl mb-4 ${
              actionData.success
                ? "bg-green-100 border-green-400 text-green-700"
                : "bg-red-100 border-red-400 text-red-700"
            }`}
          >
            {actionData.message}
            {actionData.success && actionData.orderId && (
              <p className="text-sm mt-1">주문번호: {actionData.orderId}</p>
            )}
            {actionData.requiresAuth && (
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
              <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                <span className="material-symbols-outlined text-yellow-400 text-lg fill-1">
                  star
                </span>
                4.8 (500+)
              </span>
              <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                <span className="material-symbols-outlined text-white text-lg">
                  schedule
                </span>
                20-30 min
              </span>
              <span className="bg-primary px-2 py-1 rounded-lg text-white">
                Free Delivery
              </span>
            </div>
          </div>
        </div>
        <p className="text-gray-500 text-sm leading-relaxed px-1">
          맛있는 음식을 빠르고 편리하게 주문하세요.
        </p>
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
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="relative flex flex-col items-center gap-3 pt-4 pb-3 min-w-max group"
            >
              <span
                className={`text-sm tracking-wide font-bold transition-colors ${
                  selectedCategory === cat
                    ? "text-primary"
                    : "text-gray-500 group-hover:text-gray-900"
                }`}
              >
                {cat}
              </span>
              <span
                className={`absolute bottom-0 w-full h-1 rounded-t-full transition-colors ${
                  selectedCategory === cat
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
                {featuredItem.category || "추천 메뉴"}
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
                          className="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors"
                        >
                          Add
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
          <div className="flex flex-col gap-3">
            {/* Kakao Login Prompt */}
            {!isAuthenticated && (
              <button
                onClick={handleKakaoLogin}
                className="flex items-center justify-center gap-2.5 w-full bg-[#FEE500] hover:bg-[#fdd800] text-[#3C1E1E] font-semibold py-3.5 rounded-xl transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px] fill-current">
                  chat_bubble
                </span>
                <span className="text-[15px]">카카오톡으로 로그인하기</span>
              </button>
            )}

            {/* Order Summary & Checkout Action */}
            {orderItems.length > 0 && (
              <div className="flex flex-col gap-3">
                {/* Phone Number Input */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <label
                    htmlFor="phoneNumber"
                    className="block text-xs font-bold text-gray-700 mb-1.5"
                  >
                    전화번호 *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <span className="material-symbols-outlined text-[18px]">
                        phone
                      </span>
                    </span>
                    <input
                      type="tel"
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="01012345678"
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex flex-col pl-1">
                    <span className="text-xs text-gray-500 font-medium">
                      Total (
                      {orderItems.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                      items)
                    </span>
                    <span className="text-2xl font-bold text-gray-900 tracking-tight">
                      {formatPrice(totalAmount)}원
                    </span>
                  </div>
                  {isAuthenticated ? (
                    <Form
                      method="post"
                      className="flex-1"
                      onSubmit={handleSubmit}
                    >
                      <input
                        type="hidden"
                        name="orderItems"
                        value={JSON.stringify(orderItems)}
                      />
                      <input
                        type="hidden"
                        name="totalAmount"
                        value={totalAmount}
                      />
                      <input
                        type="hidden"
                        name="phoneNumber"
                        value={phoneNumber}
                      />
                      <button
                        type="submit"
                        disabled={!canOrder}
                        className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/30 flex items-center justify-between px-6 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="text-[15px]">Place Order</span>
                        <span className="bg-white/20 group-hover:bg-white/30 text-white text-xs font-bold px-2.5 py-1 rounded-md transition-colors">
                          {orderItems.reduce(
                            (sum, item) => sum + item.quantity,
                            0
                          )}
                        </span>
                      </button>
                    </Form>
                  ) : (
                    <button
                      onClick={handleKakaoLogin}
                      className="flex-1 bg-primary hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/30 flex items-center justify-between px-6 transition-all group active:scale-[0.98]"
                    >
                      <span className="text-[15px]">Place Order</span>
                      <span className="bg-white/20 group-hover:bg-white/30 text-white text-xs font-bold px-2.5 py-1 rounded-md transition-colors">
                        {orderItems.reduce(
                          (sum, item) => sum + item.quantity,
                          0
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
