// routes/customer/orders.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router";
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { makeSSRClient, browserClient } from "~/supa_clients";
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

  // 해당 전화번호로 된 주문 조회 - JOIN으로 orderitem까지 한 번에 가져오기
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
      ),
      orderitem (
        id,
        quantity,
        price,
        menuItem:menuItemId (
          name
        )
      )
    `)
    .eq("phoneNumber", profile.customernumber)
    .order("createdat", { ascending: false })
    .limit(20);

  // N+1 쿼리 해결: JOIN으로 가져온 데이터를 변환
  const ordersWithItems: OrderData[] = (orders || []).map((order) => ({
    order_id: order.order_id,
    phoneNumber: order.phoneNumber,
    totalAmount: order.totalAmount,
    status: order.status,
    createdat: order.createdat,
    estimated_pickup_time: order.estimated_pickup_time,
    profile: order.profile,
    items: ((order as any).orderitem as OrderItem[]) || [],
  }));

  return { orders: ordersWithItems, hasPhone: true };
}

interface LoaderReturnType {
  orders: OrderData[];
  hasPhone: boolean;
}

export default function CustomerOrdersPage({ loaderData }: { loaderData: LoaderReturnType }) {
  const { orders: initialOrders, hasPhone } = loaderData;
  const [orders, setOrders] = useState<OrderData[]>(initialOrders);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Supabase Realtime 구독 - 주문 상태 변경 감지
  useEffect(() => {
    if (!hasPhone || initialOrders.length === 0) return;

    // 활성 주문의 ID 목록
    const activeOrderIds = initialOrders
      .filter((o) => o.status && isActiveStatus(o.status))
      .map((o) => o.order_id);

    if (activeOrderIds.length === 0) return;

    // Realtime 채널 구독
    const channel = browserClient
      .channel("order-status-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "order",
          filter: `order_id=in.(${activeOrderIds.join(",")})`,
        },
        (payload) => {
          const updatedOrder = payload.new as {
            order_id: string;
            status: OrderStatus;
            estimated_pickup_time: string | null;
          };

          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order.order_id === updatedOrder.order_id
                ? {
                    ...order,
                    status: updatedOrder.status,
                    estimated_pickup_time: updatedOrder.estimated_pickup_time,
                  }
                : order
            )
          );
          setLastUpdate(new Date());
        }
      )
      .subscribe();

    return () => {
      browserClient.removeChannel(channel);
    };
  }, [hasPhone, initialOrders]);

  // initialOrders가 변경되면 orders 상태도 업데이트
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  // 전화번호가 없는 경우
  if (!hasPhone) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-sm p-8 text-center">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-primary text-4xl">shopping_bag</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-3">아직 주문 내역이 없어요</h1>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            첫 주문을 해보세요!
            <br />
            주문하시면 연락처가 자동 등록되어
            <br />
            내역을 확인하실 수 있습니다.
          </p>
          <Link to="/">
            <Button className="w-full min-h-[52px]" size="lg">
              <span className="material-symbols-outlined mr-2">storefront</span>
              가게 둘러보기
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 주문이 없는 경우
  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-sm p-8 text-center">
          <div className="mx-auto w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-muted-foreground text-4xl">receipt_long</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-3">주문 내역이 없어요</h1>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            아직 주문하신 내역이 없습니다.
            <br />
            맛있는 음식을 주문해보세요!
          </p>
          <Link to="/">
            <Button className="w-full min-h-[52px]" size="lg">
              <span className="material-symbols-outlined mr-2">restaurant_menu</span>
              주문하러 가기
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 날짜 포맷 - useCallback으로 메모이제이션
  const formatDate = useCallback((isoString: string | null) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // 픽업 시간 포맷 - useCallback으로 메모이제이션
  const formatPickupTime = useCallback((isoString: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, []);

  // 활성 주문과 완료 주문 분리 - useMemo로 메모이제이션
  const activeOrders = useMemo(
    () => orders.filter((o: OrderData) => o.status && isActiveStatus(o.status)),
    [orders]
  );
  const completedOrders = useMemo(
    () => orders.filter((o: OrderData) => o.status && !isActiveStatus(o.status)),
    [orders]
  );

  return (
    <div className="min-h-screen bg-muted/50">
      {/* 헤더 */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="p-2.5 -ml-2 hover:bg-muted active:bg-border rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="뒤로 가기"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="text-center">
            <h1 className="font-bold text-lg">내 주문 내역</h1>
            {activeOrders.length > 0 && (
              <p className="text-xs text-success flex items-center justify-center gap-1">
                <span className="inline-block w-2 h-2 bg-success rounded-full animate-pulse"></span>
                실시간 업데이트 중
              </p>
            )}
          </div>
          <div className="w-10"></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 진행 중인 주문 */}
        {activeOrders.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
              진행 중인 주문
            </h2>
            <div className="space-y-3">
              {activeOrders.map((order: OrderData) => {
                const statusColors = order.status ? STATUS_COLORS[order.status] : null;
                const statusLabel = order.status ? STATUS_LABELS[order.status] : "";
                const pickupTime = formatPickupTime(order.estimated_pickup_time);

                return (
                  <div key={order.order_id} className="bg-card rounded-xl shadow-sm overflow-hidden">
                    {/* 상태 배너 */}
                    <div className={`px-4 py-2 ${statusColors?.bg || "bg-muted"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-sm ${statusColors?.text || "text-foreground/80"}`}>
                          {statusLabel}
                        </span>
                        {pickupTime && (
                          <span className="text-xs text-muted-foreground">
                            픽업 예정: {pickupTime}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 주문 정보 */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-foreground">
                            {order.profile?.storename || "가게"}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.createdat)}</p>
                        </div>
                        <p className="font-bold text-primary">
                          ₩{order.totalAmount?.toLocaleString() || 0}
                        </p>
                      </div>

                      {/* 메뉴 요약 */}
                      <p className="text-sm text-muted-foreground mb-3">
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
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
              지난 주문
            </h2>
            <div className="space-y-3">
              {completedOrders.map((order: OrderData) => {
                const statusColors = order.status ? STATUS_COLORS[order.status] : null;
                const statusLabel = order.status ? STATUS_LABELS[order.status] : "";

                return (
                  <div key={order.order_id} className="bg-card rounded-xl shadow-sm p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-foreground">
                          {order.profile?.storename || "가게"}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(order.createdat)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground/80">
                          ₩{order.totalAmount?.toLocaleString() || 0}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors?.bg || ""} ${statusColors?.text || ""}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* 메뉴 요약 */}
                    <p className="text-sm text-muted-foreground">
                      {order.items.slice(0, 2).map((item: OrderItem) => item.menuItem?.name).join(", ")}
                      {order.items.length > 2 && ` 외 ${order.items.length - 2}개`}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 홈으로 - 하단 고정 여유 공간 확보 */}
        <div className="pt-4 pb-8">
          <Link to="/">
            <Button variant="outline" className="w-full min-h-[52px]" size="lg">
              <span className="material-symbols-outlined mr-2">home</span>
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
