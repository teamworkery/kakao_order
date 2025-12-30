// routes/owner.orders.tsx
import type { Database } from "database.types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useLoaderData, useRevalidator } from "react-router";
import {
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import { makeSSRClient, browserClient } from "~/supa_clients";

/** ---- Types ---- */
type OrderRow = {
  id: string; // alias of order_id
  phoneNumber: string | null;
  totalAmount: number | null;
  createdat: string | null;
  profile_id: string | null;
  status: string | null; // 주문 상태 추가
};

type OrderItemWithMenu = {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  price: number;
  menuItem?: { id: string; name: string; price: number } | null;
};

const PAGE_SIZE = 20;

/** ---- LoaderData (타입 고정) ---- */
type LoaderData = {
  orders: OrderRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: { phone: string; dateFrom: string; dateTo: string };
  userEmail: string | null;
  storename: string | null;
  name: string | null;
  storenumber: string | null;
  profileId: string;
};

/** ===================== ACTION ===================== */
export async function action({ request }: ActionFunctionArgs) {
  const { client } = makeSSRClient(request);
  const form = await request.formData();
  const actionType = form.get("actionType");

  // (A) 로그아웃
  if (actionType === "logout") {
    await client.auth.signOut();
    return redirect("/login");
  }

  // (B) 주문접수 + n8n 웹훅
  if (actionType === "accept") {
    const orderId = String(form.get("orderId") ?? "");
    if (!orderId) return redirect("/owner/orders");

    // 인증 확인
    const { data: userRes } = await client.auth.getUser();
    const user = userRes?.user;
    if (!user) throw redirect("/login");

    // 내 가게 주문만 상태 변경
    const { error: upErr } = await client
      .from("order")
      .update({ status: "ACCEPT" })
      .eq("order_id", orderId)
      .eq("profile_id", user.id);
    if (upErr) throw upErr;

    // 페이로드용 데이터 조회
    const { data: order } = await client
      .from("order")
      .select("order_id, phoneNumber, totalAmount, createdat, profile_id")
      .eq("order_id", orderId)
      .maybeSingle();

    const { data: itemRows } = await client
      .from("orderitem")
      .select(
        `
        id, orderId, menuItemId, quantity, price,
        menuItem:menuItemId ( id, name, price )
      `
      )
      .eq("orderId", orderId);

    const { data: profile } = await client
      .from("profiles")
      .select("email, name, storename, storenumber")
      .eq("profile_id", user.id)
      .maybeSingle();

    const payload = {
      orderId,
      status: "ACCEPT",
      order: {
        phoneNumber: order?.phoneNumber ?? null,
        totalAmount: order?.totalAmount ?? null,
        createdAt: order?.createdat ?? null,
      },
      items: (itemRows ?? []).map((it) => ({
        id: it.id,
        menuItemId: it.menuItemId,
        menuName: it.menuItem?.name || `#${it.menuItemId}`,
        quantity: it.quantity,
        price: it.price,
        subtotal: it.price * it.quantity,
      })),
      store: {
        id: order?.profile_id ?? user.id,
        storename: profile?.storename ?? null,
        domain: profile?.name ?? null,
        email: profile?.email ?? user.email ?? null,
        storenumber: profile?.storenumber ?? null,
      },
      timestamp: new Date().toISOString(),
    };

    const hookUrl = process.env.N8N_WEBHOOK_URL;
    if (hookUrl) {
      await fetch(hookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    return redirect("/owner/orders");
  }

  return null;
}

/** ===================== LOADER (SSR) ===================== */
export async function loader({ request }: LoaderFunctionArgs) {
  const { client } = makeSSRClient(request);
  const { data: userRes } = await client.auth.getUser();
  const user = userRes?.user;
  if (!user) throw redirect("/login");

  // --- 프로필 조회 (profiles.profile_id 기준) ---
  const { data: profile } = await client
    .from("profiles")
    .select("profile_id, email, name, storename, storenumber")
    .eq("profile_id", user.id)
    .maybeSingle();

  const profileId = profile?.profile_id ?? user.id; // 안전 매핑

  // 빈문자열 정규화 + 이메일 폴백
  const storename = profile?.storename?.trim() || null;
  const name = profile?.name?.trim() || null;
  const userEmailOut = profile?.email?.trim() || user.email || null;
  const storenumber = profile?.storenumber?.trim() || null;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const phone = (url.searchParams.get("phone") || "").trim();

  // 기본: 오늘 00:00 ~ 지금
  const dateFrom =
    url.searchParams.get("dateFrom") ||
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    })();
  const dateTo = url.searchParams.get("dateTo") || new Date().toISOString();

  const offset = (page - 1) * PAGE_SIZE;

  // 총 개수 (로그인 유저 한정)
  const countQ = client
    .from("order")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .gte("createdat", dateFrom)
    .lte("createdat", dateTo);
  if (phone) countQ.ilike("phoneNumber", `%${phone}%`);
  const { count: totalCount = 0, error: countErr } = await countQ;
  if (countErr) throw countErr;

  // 페이지 데이터 (로그인 유저 한정)
  const dataQ = client
    .from("order")
    .select(
      "id:order_id, phoneNumber, totalAmount, createdat, profile_id, status"
    )
    .eq("profile_id", user.id)
    .gte("createdat", dateFrom)
    .lte("createdat", dateTo);
  if (phone) dataQ.ilike("phoneNumber", `%${phone}%`);

  const { data: ordersRaw, error } = await dataQ
    .order("createdat", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;

  const orders = Array.isArray(ordersRaw)
    ? (ordersRaw.filter(Boolean) as OrderRow[])
    : [];

  return new Response(
    JSON.stringify({
      orders,
      totalCount: totalCount ?? 0,
      page,
      pageSize: PAGE_SIZE,
      filters: { phone, dateFrom, dateTo },
      userEmail: userEmailOut,
      storename,
      name,
      storenumber,
      profileId,
    } satisfies LoaderData),
    { headers: { "Content-Type": "application/json" } }
  );
}

/** ===================== PAGE (Client) ===================== */
export default function OwnerOrdersPage() {
  const data = useLoaderData<LoaderData>();
  const { userEmail, profileId } = data;

  const revalidator = useRevalidator();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const toggleSound = async () => {
    try {
      if (soundOn) {
        // 이미 켜져 있으면 끔
        setSoundOn(false);
        return;
      }
      // 켜기: 최초 한 번은 사용자 제스처로 재생/중지하여 정책 해제
      if (!audioRef.current) {
        audioRef.current = new Audio("/notify.mp3");
        audioRef.current.preload = "auto";
      }
      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setSoundReady(true);
      setSoundOn(true);
    } catch (e) {
      console.warn("사운드 활성화 실패:", e);
      setSoundReady(false);
    }
  };

  const orders: OrderRow[] = Array.isArray(data?.orders)
    ? data.orders.filter(Boolean)
    : [];
  const totalCount: number =
    typeof data?.totalCount === "number" ? data.totalCount : 0;
  const page: number = typeof data?.page === "number" ? data.page : 1;
  const pageSize: number =
    typeof data?.pageSize === "number" ? data.pageSize : 20;
  const filters = (data?.filters ?? {
    phone: "",
    dateFrom: new Date().toISOString(),
    dateTo: new Date().toISOString(),
  }) as { phone: string; dateFrom: string; dateTo: string };

  // 필터 상태 (URL ↔ 상태 동기화)
  const [phone, setPhone] = useState(filters.phone);
  const [dateFrom, setDateFrom] = useState(filters.dateFrom);
  const [dateTo, setDateTo] = useState(filters.dateTo);

  // 상세 모달
  const [openId, setOpenId] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItemWithMenu[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // 새 주문 감지 (실시간 알림용)
  const [newOrderNotification, setNewOrderNotification] = useState<{
    orderId: string;
    items: number;
    amount: number;
  } | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );
  const [curPage, setCurPage] = useState(page);
  useEffect(() => setCurPage(page), [page]);

  /** 상세 아이템 로드(클라) */
  useEffect(() => {
    if (!openId) return;
    (async () => {
      setItemsLoading(true);
      try {
        const { data, error } = await browserClient
          .from("orderitem")
          .select(
            `
            id,
            orderId,
            menuItemId,
            quantity,
            price,
            menuItem:menuItemId ( id, name, price )
          `
          )
          .eq("orderId", openId)
          .order("id", { ascending: true });
        if (error) throw error;
        setItems((data as OrderItemWithMenu[]) ?? []);
      } finally {
        setItemsLoading(false);
      }
    })();
  }, [openId]);

  /** Realtime: 새 주문/상태변경 → 소리 + 로더 재검증 */
  useEffect(() => {
    const ch = browserClient
      .channel(`orders:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order",
          filter: `profile_id=eq.${profileId}`,
        },
        async (payload) => {
          const row = payload.new as {
            order_id: string;
            createdat: string;
            phoneNumber: string | null;
            totalAmount: number | null;
          };
          const createdIso = new Date(row.createdat).toISOString();
          const inRange = createdIso >= dateFrom && createdIso <= dateTo;
          const phoneOk =
            !phone || String(row.phoneNumber ?? "").includes(phone);
          if (inRange && phoneOk) {
            // Get order items count
            const { data: orderItems } = await browserClient
              .from("orderitem")
              .select("id")
              .eq("orderId", row.order_id);

            setNewOrderNotification({
              orderId: row.order_id,
              items: orderItems?.length || 0,
              amount: row.totalAmount || 0,
            });

            // Auto-hide notification after 10 seconds
            setTimeout(() => setNewOrderNotification(null), 10000);

            if (soundOn && audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
            revalidator.revalidate();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "order",
          filter: `profile_id=eq.${profileId}`,
        },
        () => {
          revalidator.revalidate();
        }
      )
      .subscribe();

    return () => {
      browserClient.removeChannel(ch);
    };
  }, [profileId, dateFrom, dateTo, phone, soundOn, revalidator]);

  /** 필터 적용 → URL 반영(SSR 재로딩) */
  const applyFilters = () => {
    const params = new URLSearchParams({
      page: "1",
      phone,
      dateFrom,
      dateTo,
    } as Record<string, string>);
    window.location.search = params.toString();
  };

  /** 페이지 이동 */
  const goPage = (p: number) => {
    const params = new URLSearchParams({
      page: String(p),
      phone,
      dateFrom,
      dateTo,
    } as Record<string, string>);
    window.location.search = params.toString();
  };

  return (
    <div className="font-display bg-background-light overflow-hidden h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border bg-white px-6 py-3 h-16 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="size-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-2xl">
              restaurant_menu
            </span>
          </div>
          <h2 className="text-foreground text-lg font-bold leading-tight tracking-[-0.015em]">
            Gourmet Admin
          </h2>
        </div>
        <div className="flex flex-1 justify-end gap-6 items-center">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            aria-pressed={soundOn}
            className={`flex cursor-pointer items-center justify-center rounded-full h-10 w-10 transition-colors ${
              soundOn
                ? "bg-primary/10 text-primary"
                : "bg-[#f4f2f0] text-foreground hover:bg-primary/10 hover:text-primary"
            }`}
            title="소리 알림 활성화"
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontVariationSettings: soundOn ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              volume_up
            </span>
          </button>
          {/* Store Status Toggle */}
          <div className="flex items-center gap-2 bg-[#f4f2f0] rounded-full p-1 pr-4">
            <div className="h-8 px-3 flex items-center justify-center bg-white rounded-full shadow-sm text-green-600 text-xs font-bold uppercase tracking-wider">
              Open
            </div>
            <span className="text-xs font-medium text-gray-500">
              Auto-close at 22:00
            </span>
          </div>
          {/* Profile (Kakao Style) */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-foreground">
                {data.userEmail || "Manager"}
              </span>
              <span className="text-xs text-gray-500">
                {data.storename || "Store"}
              </span>
            </div>
            <div className="relative">
              <div className="bg-primary/10 rounded-full size-10 ring-2 ring-transparent hover:ring-primary/50 transition-all cursor-pointer flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">
                  person
                </span>
              </div>
              <div
                className="absolute -bottom-1 -right-1 bg-[#FEE500] rounded-full p-0.5 border-2 border-white flex items-center justify-center"
                title="Kakao Linked"
              >
                <span className="material-symbols-outlined text-black text-[10px]">
                  chat_bubble
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Side Navigation */}
        <nav className="w-64 bg-white border-r border-border flex-col hidden md:flex shrink-0">
          <div className="p-4 flex flex-col gap-2">
            <a
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-foreground font-medium transition-colors"
              href="/admin"
            >
              <span className="material-symbols-outlined text-[22px]">
                restaurant
              </span>
              <span>Menu Mgmt</span>
            </a>
            <a
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-medium transition-colors"
              href="/owner/orders"
            >
              <span className="material-symbols-outlined text-[22px]">
                receipt_long
              </span>
              <span>All Orders</span>
            </a>
            <a
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-foreground font-medium transition-colors"
              href="#"
            >
              <span className="material-symbols-outlined text-[22px]">
                analytics
              </span>
              <span>Reports</span>
            </a>
          </div>
          <div className="mt-auto p-4 border-t border-border">
            <Form method="post">
              <input type="hidden" name="actionType" value="logout" />
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-foreground font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">
                  logout
                </span>
                <span>Logout</span>
              </button>
            </Form>
          </div>
        </nav>
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-background-light">
          {/* Real-time Notification Banner */}
          {newOrderNotification && (
            <div className="bg-primary/10 border-b border-primary/20 px-6 py-3 flex items-center justify-between animate-fade-in-down">
              <div className="flex items-center gap-3 text-primary">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </div>
                <span className="font-bold text-sm">
                  New Order #{newOrderNotification.orderId.slice(-4)} just
                  arrived!
                </span>
                <span className="text-sm text-primary/80 ml-2">
                  {newOrderNotification.items} items • ₩
                  {newOrderNotification.amount.toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => {
                  setOpenId(newOrderNotification.orderId);
                  setNewOrderNotification(null);
                }}
                className="text-xs font-bold bg-primary text-white px-4 py-1.5 rounded-full hover:bg-primary/90 transition-colors shadow-sm"
              >
                View Now
              </button>
            </div>
          )}
          {/* Content Container */}
          <div className="flex-1 flex flex-col p-6 min-w-0 overflow-hidden">
            {/* Page Header & Filters */}
            <div className="flex flex-col gap-5 mb-6 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Incoming Orders
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Manage today's orders in real-time
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm"
                  >
                    <span className="material-symbols-outlined text-lg">
                      refresh
                    </span>
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
              {/* Filter Bar */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-4 rounded-xl shadow-sm border border-border">
                <div className="md:col-span-4 relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    search
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all bg-gray-50 focus:bg-white"
                    placeholder="Search by phone number..."
                    type="text"
                  />
                </div>
                <div className="md:col-span-3">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      calendar_today
                    </span>
                    <input
                      type="datetime-local"
                      value={toLocalInputValue(dateFrom)}
                      onChange={(e) =>
                        setDateFrom(new Date(e.target.value).toISOString())
                      }
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm cursor-pointer hover:bg-gray-100 transition-colors text-gray-700"
                    />
                  </div>
                </div>
                <div className="md:col-span-3">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      calendar_today
                    </span>
                    <input
                      type="datetime-local"
                      value={toLocalInputValue(dateTo)}
                      onChange={(e) =>
                        setDateTo(new Date(e.target.value).toISOString())
                      }
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm cursor-pointer hover:bg-gray-100 transition-colors text-gray-700"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <button
                    onClick={applyFilters}
                    className="w-full h-full flex items-center justify-center gap-2 bg-foreground text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition shadow-sm"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            </div>

            {/* High Density Table */}
            <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-border text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0">
                <div className="col-span-1">ID</div>
                <div className="col-span-2">Time</div>
                <div className="col-span-2">Customer</div>
                <div className="col-span-4">Items Summary</div>
                <div className="col-span-1 text-right">Amount</div>
                <div className="col-span-2 text-center">Status</div>
              </div>
              {/* Table Body */}
              <div className="overflow-y-auto custom-scrollbar flex-1">
                {orders.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-muted-foreground">데이터 없음</p>
                  </div>
                ) : (
                  orders.map((o) =>
                    o ? (
                      <div
                        key={o.id}
                        className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#f4f2f0] items-center hover:bg-orange-50/30 transition-colors cursor-pointer group ${
                          o.status === "ACCEPT" ? "bg-green-50/30" : ""
                        }`}
                        onClick={() => setOpenId(o.id)}
                      >
                        <div className="col-span-1 font-bold text-foreground">
                          #{short(o.id)}
                        </div>
                        <div className="col-span-2 flex flex-col">
                          <span className="font-bold text-foreground text-sm">
                            {o.createdat
                              ? fmtKST(o.createdat).split(" ")[1]
                              : "-"}
                          </span>
                          <span className="text-xs text-primary font-medium">
                            {o.createdat
                              ? fmtKST(o.createdat).split(" ")[0]
                              : ""}
                          </span>
                        </div>
                        <div className="col-span-2 flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {o.phoneNumber ?? "-"}
                          </span>
                        </div>
                        <div className="col-span-4 text-sm text-gray-600 truncate pr-4">
                          {/* Items summary will be loaded in modal */}
                          <span className="font-medium text-foreground">
                            주문 상세 보기
                          </span>
                        </div>
                        <div className="col-span-1 text-right font-bold text-primary text-sm">
                          ₩{o.totalAmount?.toLocaleString() ?? "-"}
                        </div>
                        <div className="col-span-2 flex justify-center">
                          {o.status === "ACCEPT" ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                              New Order
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null
                  )
                )}
              </div>
              {/* Pagination Footer */}
              <div className="bg-gray-50 border-t border-border px-6 py-3 flex items-center justify-between text-xs text-gray-500 shrink-0">
                <span>
                  Showing {(page - 1) * pageSize + 1}-
                  {Math.min(page * pageSize, totalCount)} of {totalCount} orders
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={curPage <= 1}
                    onClick={() => goPage(curPage - 1)}
                    className="size-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-primary disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">
                      chevron_left
                    </span>
                  </button>
                  <span className="font-medium text-gray-700">
                    Page {curPage}
                  </span>
                  <button
                    disabled={curPage >= totalPages}
                    onClick={() => goPage(curPage + 1)}
                    className="size-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:text-primary hover:border-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">
                      chevron_right
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Detail Modal */}
      {openId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-white sticky top-0">
              <div className="flex flex-col">
                <h3 className="text-xl font-bold text-foreground">
                  Order #{short(openId)}
                </h3>
                <span className="text-sm text-gray-500">
                  {orders.find((o) => o.id === openId)?.createdat
                    ? fmtKST(orders.find((o) => o.id === openId)!.createdat!)
                    : "Placed today"}
                </span>
              </div>
              <button
                onClick={() => setOpenId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {/* 주문 상태 표시 */}
            <div className="px-6 py-2 border-b border-border bg-white">
              <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-bold rounded-full border border-primary/20">
                {orders.find((o) => o.id === openId)?.status === "ACCEPT"
                  ? "Pending Acceptance"
                  : "New Order"}
              </span>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto custom-scrollbar bg-background-light">
              {/* Customer Info Card */}
              <div className="bg-white p-4 rounded-xl border border-border mb-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground">
                      {orders.find((o) => o.id === openId)?.phoneNumber || "-"}
                    </p>
                    <p className="text-sm text-gray-500">Customer</p>
                  </div>
                </div>
              </div>
              {/* Order Items */}
              {itemsLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">로딩 중…</p>
                </div>
              ) : items.length === 0 ? (
                <p className="text-muted-foreground">아이템 없음</p>
              ) : (
                <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-border text-xs font-bold text-gray-500 uppercase">
                    Order Items
                  </div>
                  <div className="divide-y divide-gray-100">
                    {items.map((it) => (
                      <div key={it.id} className="p-4 flex gap-4">
                        <div className="size-16 bg-gray-100 rounded-lg bg-cover bg-center shrink-0"></div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-foreground">
                              {it.menuItem?.name ?? `#${it.menuItemId}`}
                            </h4>
                            <span className="font-medium text-foreground">
                              ₩{it.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="font-bold text-lg text-primary self-center">
                          x{it.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50 p-4 border-t border-border flex justify-between items-center">
                    <span className="font-bold text-gray-600">
                      Total Amount
                    </span>
                    <span className="text-xl font-bold text-primary">
                      ₩
                      {items
                        .reduce((sum, it) => sum + it.price * it.quantity, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer (Actions) */}
            <div className="p-4 border-t border-border bg-white sticky bottom-0">
              <div className="flex gap-3">
                <button
                  onClick={() => setOpenId(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <Form method="post" replace className="flex-[2]">
                  <input type="hidden" name="actionType" value="accept" />
                  <input type="hidden" name="orderId" value={openId ?? ""} />
                  <button
                    type="submit"
                    disabled={
                      orders.find((o) => o.id === openId)?.status === "ACCEPT"
                    }
                    className={`w-full py-3 px-4 rounded-xl font-bold transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2 ${
                      orders.find((o) => o.id === openId)?.status === "ACCEPT"
                        ? "bg-gray-400 cursor-not-allowed text-white"
                        : "bg-primary text-white hover:bg-primary/90"
                    }`}
                  >
                    <span className="material-symbols-outlined">
                      check_circle
                    </span>
                    {orders.find((o) => o.id === openId)?.status === "ACCEPT"
                      ? "접수완료"
                      : "Accept Order"}
                  </button>
                </Form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** ---- Utils ---- */
function short(id: string) {
  return id?.length > 8 ? id.slice(0, 8) + "…" : id;
}
function fmtKST(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
}
function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
