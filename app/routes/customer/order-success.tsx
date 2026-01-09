import { Link } from "react-router";
import { Button } from "~/common/components/ui/button";
import { makeSSRClient } from "~/supa_clients";
import { STATUS_LABELS, STATUS_COLORS, type OrderStatus } from "~/lib/order-status";
import type { LoaderFunctionArgs } from "react-router";

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
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    return { order: null, items: [] };
  }

  const { client } = makeSSRClient(request);

  // 주문 정보 조회 (가게 정보 포함)
  const { data: order } = await client
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
    .eq("order_id", orderId)
    .maybeSingle();

  // 주문 아이템 조회
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
    .eq("orderId", orderId);

  return {
    order: order as OrderData | null,
    items: (items as OrderItem[]) || [],
  };
}

interface LoaderData {
  order: OrderData | null;
  items: OrderItem[];
}

export default function OrderSuccessPage({ loaderData }: { loaderData: LoaderData }) {
  const { order, items } = loaderData;

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-red-600 text-3xl">error</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">주문을 찾을 수 없습니다</h1>
            <p className="text-gray-600">주문 정보가 없거나 잘못된 주문번호입니다.</p>
          </div>
          <Link to="/">
            <Button className="w-full" size="lg">홈으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusColors = order.status ? STATUS_COLORS[order.status] : null;
  const statusLabel = order.status ? STATUS_LABELS[order.status] : "알 수 없음";

  // 픽업 시간 포맷
  const formatPickupTime = (isoString: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleString("ko-KR", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const pickupTime = formatPickupTime(order.estimated_pickup_time);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="w-full max-w-md mx-auto space-y-4">
        {/* 성공 헤더 */}
        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">주문이 완료되었습니다!</h1>
          <p className="text-gray-600">음식점 확인 후 알림톡이 발송됩니다.</p>
        </div>

        {/* 주문 상태 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">주문 상태</span>
            {statusColors && (
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusColors.bg} ${statusColors.text}`}>
                {statusLabel}
              </span>
            )}
          </div>
        </div>

        {/* 픽업 시간 (설정된 경우) */}
        {pickupTime && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <span className="material-symbols-outlined text-primary">schedule</span>
              </div>
              <div>
                <p className="text-sm text-primary/80">예상 픽업 시간</p>
                <p className="text-lg font-bold text-primary">{pickupTime}</p>
              </div>
            </div>
          </div>
        )}

        {/* 가게 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-900 mb-3">가게 정보</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-gray-400">store</span>
              <span className="text-gray-700">{order.profile?.storename || "가게 이름 없음"}</span>
            </div>
            {order.profile?.storenumber && (
              <a
                href={`tel:${order.profile.storenumber}`}
                className="flex items-center gap-3 text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-gray-400">call</span>
                <span>{order.profile.storenumber}</span>
              </a>
            )}
          </div>
        </div>

        {/* 주문 내역 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">주문 내역</h3>
            <p className="text-xs text-gray-500 mt-1">주문번호: {order.order_id.slice(0, 8)}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((item: OrderItem) => (
              <div key={item.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{item.menuItem?.name || "메뉴"}</p>
                  <p className="text-sm text-gray-500">수량: {item.quantity}개</p>
                </div>
                <p className="font-bold text-gray-900">
                  ₩{(item.price * item.quantity).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <span className="font-bold text-gray-700">총 결제금액</span>
            <span className="text-xl font-bold text-primary">
              ₩{order.totalAmount?.toLocaleString() || 0}
            </span>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-yellow-600">info</span>
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">결제 안내</p>
              <p>결제는 가게에서 픽업 시 현장에서 진행됩니다.</p>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="space-y-3">
          <Link to="/customer/orders" className="block">
            <Button variant="outline" className="w-full" size="lg">
              내 주문 내역 보기
            </Button>
          </Link>
          <Link to="/" className="block">
            <Button className="w-full" size="lg">
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
