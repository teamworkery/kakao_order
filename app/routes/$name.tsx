import { useState, useEffect } from "react";
import { Form, useLocation } from "react-router";
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
    .select("profile_id")
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

  return { menuItems, user, name };
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
    
    // 인증 상태 확인 - 주문 시 카카오 로그인 필수
    const { data: userData, error: authError } = await client.auth.getUser();
    if (authError || !userData?.user) {
      return {
        success: false,
        message: "주문하려면 카카오 로그인이 필요합니다.",
        requiresAuth: true,
      };
    }

    const formData = await request.formData();
    const phoneNumber = formData.get("phoneNumber") as string;
    const orderItems = JSON.parse(formData.get("orderItems") as string);
    const totalAmount = parseInt(formData.get("totalAmount") as string);

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
  const { menuItems, user: initialUser, name } = loaderData;
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [user, setUser] = useState(initialUser);
  const location = useLocation();

  // 인증 상태 실시간 확인
  useEffect(() => {
    async function checkAuth() {
      const { data: { user: currentUser } } = await browserClient.auth.getUser();
      setUser(currentUser);
    }
    checkAuth();
    
    // 인증 상태 변경 감지
    const { data: { subscription } } = browserClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 카카오 로그인 함수
  const handleKakaoLogin = async () => {
    const currentUrl = `${window.location.origin}${location.pathname}`;
    const { error } = await browserClient.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentUrl)}`,
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
  const canOrder = orderItems.length > 0 && phoneNumber.trim() !== "" && isAuthenticated;

  const handleSubmit = (e: React.FormEvent) => {
    if (!canOrder) {
      e.preventDefault();
      alert("메뉴를 선택하고 전화번호를 입력해주세요.");
      return;
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-sm mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">맛있는 식당</h1>
          <p className="text-sm text-gray-600">메뉴를 선택하고 주문하세요</p>
        </div>
      </div>

      {/* 성공/실패 메시지 */}
      {actionData && (
        <div className="max-w-sm mx-auto px-4 py-2">
          <div
            className={`border px-4 py-3 rounded mb-4 ${
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
                className="mt-3 w-full py-2 px-4 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
              >
                카카오로 로그인하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 로그인 상태 표시 */}
      {!isAuthenticated && (
        <div className="max-w-sm mx-auto px-4 py-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm text-yellow-800 mb-2">
              주문하려면 카카오 로그인이 필요합니다.
            </p>
            <button
              onClick={handleKakaoLogin}
              className="w-full py-2 px-4 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z" />
              </svg>
              카카오로 로그인
            </button>
          </div>
        </div>
      )}

      {/* 카테고리 네비게이션 */}
      <div className="max-w-sm mx-auto px-4 py-2 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`inline-block px-4 py-2 rounded-full text-sm font-semibold mr-2 ${
            selectedCategory === null
              ? "bg-orange-500 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          전체
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`inline-block px-4 py-2 rounded-full text-sm font-semibold mr-2 ${
              selectedCategory === cat
                ? "bg-orange-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 메뉴 리스트 */}
      <div className="max-w-sm mx-auto px-4 py-4 pb-140">
        <div className="space-y-4">
          {menuItems
            .filter(
              (item: MenuItem) =>
                selectedCategory === null || item.category === selectedCategory
            )
            .map((item: MenuItem) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden"
              >
                <div className="aspect-w-16 aspect-h-9">
                  <img
                    src={item.image ?? undefined}
                    alt={item.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop";
                    }}
                  />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {item.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.description}
                      </p>
                      {item.category && (
                        <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded mt-1">
                          {item.category}
                        </span>
                      )}
                      <p className="text-lg font-bold text-orange-600 mt-2">
                        {formatPrice(item.price)}원
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => decreaseQuantity(item)}
                        className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300 transition-colors"
                        disabled={getItemQuantity(item.id) === 0}
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold text-lg">
                        {getItemQuantity(item.id)}
                      </span>
                      <button
                        type="button"
                        onClick={() => increaseQuantity(item)}
                        className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 transition-colors"
                      >
                        +
                      </button>
                    </div>
                    {getItemQuantity(item.id) > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-gray-600">소계</p>
                        <p className="font-semibold text-orange-600">
                          {formatPrice(item.price * getItemQuantity(item.id))}원
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* 전화번호 입력 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
          <label
            htmlFor="phoneNumber"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            전화번호 *
          </label>
          <input
            type="tel"
            id="phoneNumber"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="01012345678 (- 없이 숫자만 입력)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
            required
          />
        </div>
      </div>

      {/* 하단 고정 주문 요약 */}
      {orderItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-sm mx-auto px-4 py-4">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">주문 내역</h3>
              <div className="space-y-1">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.name} x {item.quantity}
                    </span>
                    <span className="font-medium">
                      {formatPrice(item.price * item.quantity)}원
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center mb-4 pt-2 border-t border-gray-200">
              <span className="text-lg font-semibold text-gray-900">
                총 금액
              </span>
              <span className="text-xl font-bold text-orange-600">
                {formatPrice(totalAmount)}원
              </span>
            </div>

            {isAuthenticated ? (
              <Form method="post" onSubmit={handleSubmit}>
                <input
                  type="hidden"
                  name="orderItems"
                  value={JSON.stringify(orderItems)}
                />
                <input type="hidden" name="totalAmount" value={totalAmount} />
                <input type="hidden" name="phoneNumber" value={phoneNumber} />

                <button
                  type="submit"
                  disabled={!canOrder}
                  className={`w-full py-4 rounded-lg font-semibold text-lg transition-colors ${
                    canOrder
                      ? "bg-orange-500 text-white hover:bg-orange-600"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {canOrder
                    ? "주문하기"
                    : "메뉴 선택 및 전화번호 입력"}
                </button>
              </Form>
            ) : (
              <button
                onClick={handleKakaoLogin}
                className="w-full py-4 rounded-lg font-semibold text-lg transition-colors bg-yellow-400 text-black hover:bg-yellow-500 flex items-center justify-center gap-2"
              >
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z" />
                </svg>
                카카오로 로그인하여 주문하기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
