// routes/customer/orders.tsx
import { Link } from "react-router";
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { makeSSRClient } from "~/supa_clients";
import { STATUS_LABELS, STATUS_COLORS, type OrderStatus, isActiveStatus } from "~/lib/order-status";
import { Button } from "~/common/components/ui/button";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  menuItem: {
    name: string;
  } | null;
}

interface OrderData {
  order_id: string;
  phoneNumber: string | null;
  totalAmount: number | null;
  status: OrderStatus | null;
  createdat: string | null;
  estimated_pickup_time: string | null;
  profile: {
    storename: string | null;
    storenumber: string | null;
    name: string | null;
  } | null;
  items: OrderItem[];
}

export function meta() {
  return [
    { title: "내 주문 내역 | 포장주문" },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { client } = makeSSRClient(request);
  const { data: userRes } = await client.auth.getUser();
  const user = userRes?.user;

  if (!user) {
    throw redirect("/login?redirect=/customer/orders");
  }

  // 사용자 프로필에서 전화번호 조회
  const { data: profile } = await client
    .from("profiles")
    .select("customernumber")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!profile?.customernumber) {
    return { orders: [], hasPhone: false };
  }

  // 해당 전화번호로 된 주문 조회
  const { data: orders } = await client
    .from("order")
    .select(`
      order_id,
      phoneNumber,
      totalAmount,
      status,
      createdat,
      estimated_pickup_time,
      profile:profile_id (
        storename,
        storenumber,
        name
      )
    `)
    .eq("phoneNumber", profile.customernumber)
    .order("createdat", { ascending: false })
    .limit(20);

  // 각 주문의 아이템 조회
  const ordersWithItems: OrderData[] = [];

  for (const order of orders || []) {
    const { data: items } = await client
      .from("orderitem")
      .select(`
        id,
        quantity,
        price,
        menuItem:menuItemId (
          name
        )
      `)
      .eq("orderId", order.order_id);

    ordersWithItems.push({
      ...order,
      items: (items as OrderItem[]) || [],
    } as OrderData);
  }

  return { orders: ordersWithItems, hasPhone: true };
}

interface LoaderReturnType {
  orders: OrderData[];
  hasPhone: boolean;
}

export default function CustomerOrdersPage({ loaderData }: { loaderData: LoaderReturnType }) {
  const { orders, hasPhone } = loaderData;

  // 전화번호가 없는 경우
  if (!hasPhone) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-gray-400 text-3xl">phone_disabled</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">전화번호가 등록되지 않았습니다</h1>
          <p className="text-gray-600 mb-6">주문을 하시면 전화번호가 자동으로 등록됩니다.</p>
          <Link to="/">
            <Button className="w-full" size="lg">가게 둘러보기</Button>
          </Link>
        </div>
      </div>
    );
  }

  // 주문이 없는 경우
  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-gray-400 text-3xl">receipt_long</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">주문 내역이 없습니다</h1>
          <p className="text-gray-600 mb-6">아직 주문하신 내역이 없습니다.</p>
          <Link to="/">
            <Button className="w-full" size="lg">주문하러 가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  // 날짜 포맷
  const formatDate = (isoString: string | null) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 픽업 시간 포맷
  const formatPickupTime = (isoString: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // 활성 주문과 완료 주문 분리
  const activeOrders = orders.filter((o: OrderData) => o.status && isActiveStatus(o.status));
  const completedOrders = orders.filter((o: OrderData) => o.status && !isActiveStatus(o.status));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-bold text-lg">내 주문 내역</h1>
          <div className="w-10"></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 진행 중인 주문 */}
        {activeOrders.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              진행 중인 주문
            </h2>
            <div className="space-y-3">
              {activeOrders.map((order: OrderData) => {
                const statusColors = order.status ? STATUS_COLORS[order.status] : null;
                const statusLabel = order.status ? STATUS_LABELS[order.status] : "";
                const pickupTime = formatPickupTime(order.estimated_pickup_time);

                return (
                  <div key={order.order_id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* 상태 배너 */}
                    <div className={`px-4 py-2 ${statusColors?.bg || "bg-gray-100"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-sm ${statusColors?.text || "text-gray-700"}`}>
                          {statusLabel}
                        </span>
                        {pickupTime && (
                          <span className="text-xs text-gray-600">
                            픽업 예정: {pickupTime}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 주문 정보 */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-gray-900">
                            {order.profile?.storename || "가게"}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(order.createdat)}</p>
                        </div>
                        <p className="font-bold text-primary">
                          ₩{order.totalAmount?.toLocaleString() || 0}
                        </p>
                      </div>

                      {/* 메뉴 요약 */}
                      <p className="text-sm text-gray-600 mb-3">
                        {order.items.slice(0, 2).map((item: OrderItem) => item.menuItem?.name).join(", ")}
                        {order.items.length > 2 && ` 외 ${order.items.length - 2}개`}
                      </p>

                      {/* 가게 연락처 */}
                      {order.profile?.storenumber && (
                        <a
                          href={`tel:${order.profile.storenumber}`}
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <span className="material-symbols-outlined text-base">call</span>
                          가게에 전화하기
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 완료된 주문 */}
        {completedOrders.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              지난 주문
            </h2>
            <div className="space-y-3">
              {completedOrders.map((order: OrderData) => {
                const statusColors = order.status ? STATUS_COLORS[order.status] : null;
                const statusLabel = order.status ? STATUS_LABELS[order.status] : "";

                return (
                  <div key={order.order_id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">
                          {order.profile?.storename || "가게"}
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(order.createdat)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-700">
                          ₩{order.totalAmount?.toLocaleString() || 0}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors?.bg || ""} ${statusColors?.text || ""}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* 메뉴 요약 */}
                    <p className="text-sm text-gray-600">
                      {order.items.slice(0, 2).map((item: OrderItem) => item.menuItem?.name).join(", ")}
                      {order.items.length > 2 && ` 외 ${order.items.length - 2}개`}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 홈으로 */}
        <div className="pt-4">
          <Link to="/">
            <Button variant="outline" className="w-full" size="lg">
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
