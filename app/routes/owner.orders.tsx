// routes/owner.orders.tsx
import type { Route } from "./+types/owner.orders";
import type { Database } from "database.types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useRevalidator } from "react-router";
import { redirect } from "react-router";
import { makeSSRClient, browserClient } from "~/supa_clients";
import { displayOrderNo } from "~/lib/order-no";
import {
  type OrderStatus,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_ACTION_LABELS,
  getNextStatuses,
  canTransition,
  isActiveStatus,
} from "~/lib/order-status";

/** ---- Types ---- */
type OrderRow = {
  id: string; // alias of order_id
  order_no: string | null;
  phoneNumber: string | null;
  totalAmount: number | null;
  createdat: string | null;
  profile_id: string | null;
  status: OrderStatus | null;
  estimated_pickup_time: string | null;
  requested_pickup_time: string | null;
  cancel_reason: string | null;
};

type SelectedOption = { groupName: string; optionName: string; priceDelta: number };
type OrderItemWithMenu = {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  price: number;
  options?: SelectedOption[] | null;
  menuItem?: { id: string; name: string; price: number } | null;
};

// 메뉴 요약을 위한 타입
type MenuSummary = {
  orderId: string;
  summary: string;
};

const PAGE_SIZE = 20;

// 점주가 "HH:mm"로 바꾼 픽업시간을, 기준일(손님 요청시각의 KST 달력 날짜)과 합쳐
// 정확한 타임스탬프(ISO)로 만든다. KST(+09:00) 고정 조립으로 서버 TZ 영향 제거.
function buildKstIsoFromTime(
  baseIso: string | null,
  hhmm: string
): string | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const base = baseIso ? new Date(baseIso) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const datePart = base.toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  }); // YYYY-MM-DD
  const d = new Date(`${datePart}T${hhmm}:00+09:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

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
  menuSummaries: MenuSummary[];
};

/** ===================== ACTION ===================== */
export async function action({ request }: Route.ActionArgs) {
  const { client } = makeSSRClient(request);
  const form = await request.formData();
  const actionType = form.get("actionType");

  // (A) 로그아웃
  if (actionType === "logout") {
    await client.auth.signOut();
    return redirect("/login");
  }

  // (B) 주문 상태 변경 + n8n 웹훅
  if (actionType === "updateStatus") {
    const orderId = String(form.get("orderId") ?? "");
    const newStatus = form.get("newStatus") as OrderStatus;
    if (!orderId || !newStatus) return redirect("/owner/orders");

    // 인증 확인
    const { data: userRes } = await client.auth.getUser();
    const user = userRes?.user;
    if (!user) throw redirect("/login?next=/owner/orders");

    // 현재 주문 상태 + 손님 요청 픽업시간 확인
    const { data: currentOrder } = await client
      .from("order")
      .select("status, requested_pickup_time")
      .eq("order_id", orderId)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!currentOrder) {
      return { error: "주문을 찾을 수 없습니다" };
    }

    // 상태 전환 가능 여부 확인
    const currentStatus = currentOrder.status as OrderStatus;
    if (!canTransition(currentStatus, newStatus)) {
      return { error: `${STATUS_LABELS[currentStatus]}에서 ${STATUS_LABELS[newStatus]}(으)로 변경할 수 없습니다` };
    }

    const requestedPickupIso = currentOrder.requested_pickup_time ?? null;

    // 예약 모델: 손님이 고른 픽업시간을 기준으로 확정/변경.
    //  - 수락(ACCEPT): confirmedTime(HH:mm)을 점주가 바꿨으면 그 시각으로, 아니면 요청시각 그대로 확정.
    //  - 거절(CANCEL): cancelReason 사유를 저장(손님 거절 알림톡 변수).
    let estimatedPickupIso: string | null = null;
    let cancelReason: string | null = null;
    let notificationType: "confirmed" | "changed" | "rejected" | null = null;
    const updateData: {
      status: OrderStatus;
      estimated_pickup_time?: string | null;
      cancel_reason?: string | null;
    } = { status: newStatus };

    if (newStatus === "ACCEPT") {
      const confirmedHHmm = String(form.get("confirmedTime") ?? "").trim();
      const changedIso = confirmedHHmm
        ? buildKstIsoFromTime(requestedPickupIso, confirmedHHmm)
        : null;
      // 점주가 시간을 바꿨고 요청시각과 다르면 "변경", 아니면 "확정"
      const isChanged = !!changedIso && changedIso !== requestedPickupIso;
      estimatedPickupIso = changedIso ?? requestedPickupIso;
      updateData.estimated_pickup_time = estimatedPickupIso;
      notificationType = isChanged ? "changed" : "confirmed";
    } else if (newStatus === "CANCEL") {
      cancelReason = String(form.get("cancelReason") ?? "").trim() || "사장님 사정으로 주문이 취소되었습니다";
      updateData.cancel_reason = cancelReason;
      notificationType = "rejected";
    }

    // silent=true (목록 빠른 취소, 노쇼 등): 상태만 바꾸고 고객 알림 없음
    const silent = form.get("silent") === "true";

    // 내 가게 주문만 상태 변경
    const { error: upErr } = await client
      .from("order")
      .update(updateData)
      .eq("order_id", orderId)
      .eq("profile_id", user.id);
    if (upErr) throw upErr;

    // 상태 변경 이력 기록
    await client.from("order_status_history").insert({
      order_id: orderId,
      from_status: currentStatus,
      to_status: newStatus,
      changed_by: user.id,
    });

    // 페이로드용 데이터 조회
    const { data: order } = await client
      .from("order")
      .select(
        "order_id, phoneNumber, totalAmount, createdat, profile_id, estimated_pickup_time"
      )
      .eq("order_id", orderId)
      .maybeSingle();

    const { data: itemRows } = await client
      .from("orderitem")
      .select(
        `
        id, orderId, menuItemId, quantity, price, options,
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
      event: "order.accepted",
      orderId,
      status: newStatus,
      previousStatus: currentStatus,
      // 손님 알림톡 분기용: confirmed(확정) / changed(시간변경) / rejected(거절)
      notificationType,
      cancelReason,
      order: {
        phoneNumber: order?.phoneNumber ?? null,
        totalAmount: order?.totalAmount ?? null,
        createdAt: order?.createdat ?? null,
        // 손님이 요청했던 픽업시간 (변경 알림톡에서 "기존→변경" 비교용)
        requestedPickupTime: requestedPickupIso,
        // 알림톡 #{픽업시간} — 점주 확정시간 우선, 없으면 DB 기존값
        estimatedPickupTime:
          estimatedPickupIso ?? order?.estimated_pickup_time ?? null,
      },
      items: (itemRows ?? []).map((it) => ({
        id: it.id,
        menuItemId: it.menuItemId,
        menuName: it.menuItem?.name || `#${it.menuItemId}`,
        options: Array.isArray(it.options)
          ? (it.options as { optionName: string }[]).map((o) => o.optionName)
          : [],
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

    // 고객에게 알림 — 확정/시간변경(ACCEPT)은 항상 발송.
    // 거절(CANCEL) 알림은 전용 알림톡 템플릿(③ 거절) + n8n notificationType 분기가
    // 준비되기 전엔 보내면 안 된다(현 n8n은 무조건 '확정' 템플릿을 보내 거절에 오발송).
    // → 카카오 템플릿 승인 + n8n Switch 완료 후 Vercel env `ENABLE_CUSTOMER_REJECT_NOTIFY=true`로 켠다.
    const notifyCustomer =
      !silent &&
      (newStatus === "ACCEPT" ||
        (newStatus === "CANCEL" &&
          process.env.ENABLE_CUSTOMER_REJECT_NOTIFY === "true"));
    if (notifyCustomer) {
      const hookUrl = process.env.N8N_WEBHOOK_URL;
      if (hookUrl) {
        try {
          const res = await fetch(hookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            console.error(`[Webhook] 고객 알림 실패: orderId=${orderId}, status=${res.status}`);
          }
        } catch (err) {
          console.error(`[Webhook] 고객 알림 발송 에러: orderId=${orderId}`, err);
        }
      }
    }

    return redirect("/owner/orders");
  }

  // (C) 픽업 시간 설정
  if (actionType === "setPickupTime") {
    const orderId = String(form.get("orderId") ?? "");
    const pickupMinutes = Number(form.get("pickupMinutes") ?? 0);

    if (!orderId || pickupMinutes <= 0) {
      return { error: "유효한 픽업 시간을 입력해주세요" };
    }

    const { data: userRes } = await client.auth.getUser();
    const user = userRes?.user;
    if (!user) throw redirect("/login?next=/owner/orders");

    // 현재 시간 + 픽업 시간(분)으로 예상 픽업 시간 계산
    const estimatedPickupTime = new Date(Date.now() + pickupMinutes * 60 * 1000);

    const { error: upErr } = await client
      .from("order")
      .update({ estimated_pickup_time: estimatedPickupTime.toISOString() })
      .eq("order_id", orderId)
      .eq("profile_id", user.id);

    if (upErr) throw upErr;

    return redirect("/owner/orders");
  }

  return null;
}

/** ===================== LOADER (SSR) ===================== */
export async function loader({ request }: Route.LoaderArgs) {
  const { client } = makeSSRClient(request);
  const { data: userRes } = await client.auth.getUser();
  const user = userRes?.user;
  // 미인증 시 로그인 후 이 페이지로 복귀시킨다 (알림톡 버튼 → 카톡 인앱/외부 브라우저 진입 대응).
  if (!user) throw redirect("/login?next=/owner/orders");

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

  // 병렬로 count와 data 쿼리 실행
  const countQuery = client
    .from("order")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .gte("createdat", dateFrom)
    .lte("createdat", dateTo);
  if (phone) countQuery.ilike("phoneNumber", `%${phone}%`);

  const dataQuery = client
    .from("order")
    .select(
      "id:order_id, order_no, phoneNumber, totalAmount, createdat, profile_id, status, estimated_pickup_time, requested_pickup_time, cancel_reason"
    )
    .eq("profile_id", user.id)
    .gte("createdat", dateFrom)
    .lte("createdat", dateTo);
  if (phone) dataQuery.ilike("phoneNumber", `%${phone}%`);

  // Promise.all로 병렬 실행
  const [countResult, dataResult] = await Promise.all([
    countQuery,
    dataQuery.order("createdat", { ascending: false }).range(offset, offset + PAGE_SIZE - 1),
  ]);

  if (countResult.error) throw countResult.error;
  if (dataResult.error) throw dataResult.error;

  const totalCount = countResult.count ?? 0;
  const orders = Array.isArray(dataResult.data)
    ? (dataResult.data.filter(Boolean) as OrderRow[])
    : [];

  // 주문 ID 목록으로 메뉴 요약 조회
  const orderIds = orders.map((o) => o.id);
  let menuSummaries: MenuSummary[] = [];

  if (orderIds.length > 0) {
    const { data: itemsData } = await client
      .from("orderitem")
      .select(
        `
        orderId,
        quantity,
        menuItem:menuItemId ( name )
      `
      )
      .in("orderId", orderIds);

    // 주문별로 메뉴 요약 생성
    const summaryMap = new Map<string, { names: string[]; total: number }>();
    (itemsData ?? []).forEach((item) => {
      const orderId = item.orderId;
      if (!orderId) return;
      if (!summaryMap.has(orderId)) {
        summaryMap.set(orderId, { names: [], total: 0 });
      }
      const entry = summaryMap.get(orderId)!;
      const menuName = item.menuItem?.name || "메뉴";
      entry.names.push(menuName);
      entry.total += item.quantity ?? 0;
    });

    menuSummaries = orderIds.map((orderId) => {
      const entry = summaryMap.get(orderId);
      if (!entry || entry.names.length === 0) {
        return { orderId, summary: "-" };
      }
      const uniqueNames = [...new Set(entry.names)];
      if (uniqueNames.length === 1) {
        return { orderId, summary: `${uniqueNames[0]} x${entry.total}` };
      }
      if (uniqueNames.length === 2) {
        return { orderId, summary: `${uniqueNames[0]}, ${uniqueNames[1]}` };
      }
      return { orderId, summary: `${uniqueNames[0]} 외 ${uniqueNames.length - 1}개` };
    });
  }

  // plain object 반환
  return {
    orders,
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    filters: { phone, dateFrom, dateTo },
    userEmail: userEmailOut,
    storename,
    name,
    storenumber,
    profileId,
    menuSummaries,
  } satisfies LoaderData;
}

/** ===================== PAGE (Client) ===================== */
export default function OwnerOrdersPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData as LoaderData;
  const { userEmail, profileId, menuSummaries } = data;

  const revalidator = useRevalidator();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // 메뉴 요약 맵
  const menuSummaryMap = useMemo(() => {
    const map = new Map<string, string>();
    (menuSummaries ?? []).forEach((s) => map.set(s.orderId, s.summary));
    return map;
  }, [menuSummaries]);

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
            options,
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

  /** 필터 초기화 */
  const clearFilters = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const params = new URLSearchParams({
      page: "1",
      phone: "",
      dateFrom: today.toISOString(),
      dateTo: new Date().toISOString(),
    });
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
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border bg-card px-4 md:px-6 py-3 h-16 shrink-0 z-20">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center rounded-lg h-10 w-10 hover:bg-muted transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
          <div className="size-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-2xl">
              restaurant_menu
            </span>
          </div>
          <h2 className="text-foreground text-lg font-bold leading-tight tracking-[-0.015em] hidden sm:block">
            주문 관리
          </h2>
        </div>
        <div className="flex flex-1 justify-end gap-3 md:gap-6 items-center">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            aria-pressed={soundOn}
            className={`flex cursor-pointer items-center justify-center rounded-full h-10 w-10 transition-colors ${
              soundOn
                ? "bg-primary/10 text-primary"
                : "bg-muted text-foreground hover:bg-primary/10 hover:text-primary"
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
          <div className="hidden sm:flex items-center gap-2 bg-muted rounded-full p-1 pr-4">
            <div className="h-8 px-3 flex items-center justify-center bg-card rounded-full shadow-sm text-success text-xs font-bold uppercase tracking-wider">
              영업중
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              22:00 자동 마감
            </span>
          </div>
          {/* Profile (Kakao Style) */}
          <div className="flex items-center gap-3 pl-2 md:pl-4 border-l border-border">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-foreground">
                {data.userEmail || "관리자"}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.storename || "가게"}
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
                title="카카오 연동됨"
              >
                <span className="material-symbols-outlined text-black text-[10px]">
                  chat_bubble
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Drawer Overlay */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-30"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Side Navigation - Desktop: always visible, Mobile: drawer */}
        <nav
          className={`
          w-64 bg-card border-r border-border flex-col shrink-0
          md:flex md:relative
          ${mobileMenuOpen ? "flex fixed left-0 top-16 bottom-0 z-40" : "hidden"}
        `}
        >
          <div className="p-4 flex flex-col gap-2">
            <a
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground font-medium transition-colors"
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="material-symbols-outlined text-[22px]">
                restaurant
              </span>
              <span>메뉴 관리</span>
            </a>
            <a
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-medium transition-colors"
              href="/owner/orders"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="material-symbols-outlined text-[22px]">
                receipt_long
              </span>
              <span>전체 주문</span>
            </a>
            <a
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground font-medium transition-colors"
              href="#"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="material-symbols-outlined text-[22px]">
                analytics
              </span>
              <span>리포트</span>
            </a>
          </div>
          <div className="mt-auto p-4 border-t border-border">
            <Form method="post">
              <input type="hidden" name="actionType" value="logout" />
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">
                  logout
                </span>
                <span>로그아웃</span>
              </button>
            </Form>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-background-light">
          {/* Real-time Notification Banner */}
          {newOrderNotification && (
            <div className="bg-primary/10 border-b border-primary/20 px-4 md:px-6 py-3 flex items-center justify-between animate-fade-in-down">
              <div className="flex items-center gap-3 text-primary">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </div>
                <span className="font-bold text-sm">
                  새 주문 #{newOrderNotification.orderId.slice(-4)} 접수!
                </span>
                <span className="text-sm text-primary/80 ml-2 hidden sm:inline">
                  {newOrderNotification.items}개 메뉴 ·{" "}
                  {newOrderNotification.amount.toLocaleString()}원
                </span>
              </div>
              <button
                onClick={() => {
                  setOpenId(newOrderNotification.orderId);
                  setNewOrderNotification(null);
                }}
                className="text-xs font-bold bg-primary text-white px-4 py-1.5 rounded-full hover:bg-primary/90 transition-colors shadow-sm"
              >
                확인하기
              </button>
            </div>
          )}

          {/* Content Container */}
          <div className="flex-1 flex flex-col p-4 md:p-6 min-w-0 overflow-hidden">
            {/* Page Header & Filters */}
            <div className="flex flex-col gap-4 md:gap-5 mb-4 md:mb-6 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-foreground">
                    새 주문
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    실시간으로 오늘의 주문을 관리하세요
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground/80 hover:bg-muted transition shadow-sm"
                  >
                    <span className="material-symbols-outlined text-lg">
                      refresh
                    </span>
                    <span className="hidden sm:inline">새로고침</span>
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 bg-card p-4 rounded-xl shadow-sm border border-border">
                <div className="md:col-span-4 relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    search
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all bg-muted/50 focus:bg-card"
                    placeholder="전화번호로 검색..."
                    type="text"
                  />
                </div>
                <div className="md:col-span-3">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      calendar_today
                    </span>
                    <input
                      type="datetime-local"
                      value={toLocalInputValue(dateFrom)}
                      onChange={(e) =>
                        setDateFrom(new Date(e.target.value).toISOString())
                      }
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-muted/50 text-sm cursor-pointer hover:bg-muted transition-colors text-foreground/80"
                    />
                  </div>
                </div>
                <div className="md:col-span-3">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      calendar_today
                    </span>
                    <input
                      type="datetime-local"
                      value={toLocalInputValue(dateTo)}
                      onChange={(e) =>
                        setDateTo(new Date(e.target.value).toISOString())
                      }
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-muted/50 text-sm cursor-pointer hover:bg-muted transition-colors text-foreground/80"
                    />
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <button
                    onClick={applyFilters}
                    className="flex-1 h-full flex items-center justify-center gap-2 bg-foreground text-white rounded-lg text-sm font-medium hover:bg-foreground/90 transition shadow-sm py-2"
                  >
                    필터 적용
                  </button>
                  <button
                    onClick={clearFilters}
                    className="px-3 h-full flex items-center justify-center bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted transition py-2"
                    title="초기화"
                  >
                    <span className="material-symbols-outlined text-lg">
                      refresh
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Table / Mobile Card View */}
            <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
              {/* Desktop Table Header - Hidden on Mobile */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-muted/50 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                <div className="col-span-1">주문번호</div>
                <div className="col-span-2">시간</div>
                <div className="col-span-2">고객</div>
                <div className="col-span-3">메뉴</div>
                <div className="col-span-1 text-right">금액</div>
                <div className="col-span-3 text-center">상태 / 처리</div>
              </div>

              {/* Table Body / Card List */}
              <div className="overflow-y-auto custom-scrollbar flex-1">
                {orders.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-muted-foreground text-2xl">
                        receipt_long
                      </span>
                    </div>
                    <p className="text-foreground/80 font-medium mb-1">
                      주문 내역이 없습니다
                    </p>
                    <p className="text-muted-foreground text-sm">
                      선택한 기간에 해당하는 주문이 없어요.
                      <br />
                      필터를 변경하거나 새 주문을 기다려주세요.
                    </p>
                  </div>
                ) : (
                  orders.map((o) =>
                    o ? (
                      <div key={o.id}>
                        {/* Desktop Row */}
                        <div
                          className={`hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-border items-center hover:bg-primary-light/30 transition-colors cursor-pointer group ${
                            o.status && isActiveStatus(o.status)
                              ? ""
                              : "bg-muted/50"
                          } ${o.status === "PENDING" ? "bg-yellow-50/30" : ""}`}
                          onClick={() => setOpenId(o.id)}
                        >
                          <div className="col-span-1 font-bold text-foreground">
                            {displayOrderNo(o.order_no, o.createdat, o.id)}
                          </div>
                          <div className="col-span-2 flex flex-col">
                            <span className="font-bold text-foreground text-sm">
                              {o.createdat ? fmtKstTime(o.createdat) : "-"}
                            </span>
                            <span className="text-xs text-primary font-medium">
                              {o.createdat ? fmtKstDate(o.createdat) : ""}
                            </span>
                          </div>
                          <div className="col-span-2 flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              {o.phoneNumber ?? "-"}
                            </span>
                          </div>
                          <div className="col-span-3 text-sm text-muted-foreground truncate pr-4">
                            <span className="font-medium text-foreground">
                              {menuSummaryMap.get(o.id) || "-"}
                            </span>
                            {(o.estimated_pickup_time ||
                              o.requested_pickup_time) && (
                              <span className="flex items-center gap-1 text-xs font-medium text-primary mt-0.5">
                                <span className="material-symbols-outlined text-sm">
                                  event_available
                                </span>
                                {o.estimated_pickup_time
                                  ? "픽업 확정 "
                                  : "픽업 요청 "}
                                {fmtKstTime(
                                  (o.estimated_pickup_time ||
                                    o.requested_pickup_time)!
                                )}
                              </span>
                            )}
                          </div>
                          <div className="col-span-1 text-right font-bold text-primary text-sm">
                            {o.totalAmount?.toLocaleString() ?? "-"}원
                          </div>
                          <div className="col-span-3 flex flex-col items-center justify-center gap-1.5">
                            {o.status && (
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[o.status].bg} ${STATUS_COLORS[o.status].text}`}
                              >
                                {STATUS_LABELS[o.status]}
                              </span>
                            )}
                            <QuickActions o={o} />
                          </div>
                        </div>

                        {/* Mobile Card */}
                        <div
                          className={`md:hidden p-4 border-b border-border cursor-pointer active:bg-primary-light/50 transition-colors ${
                            o.status && isActiveStatus(o.status)
                              ? ""
                              : "bg-muted/50"
                          } ${o.status === "PENDING" ? "bg-yellow-50/30" : ""}`}
                          onClick={() => setOpenId(o.id)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">
                                {displayOrderNo(o.order_no, o.createdat, o.id)}
                              </span>
                              {o.status && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[o.status].bg} ${STATUS_COLORS[o.status].text}`}
                                >
                                  {STATUS_LABELS[o.status]}
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-primary text-sm">
                              {o.totalAmount?.toLocaleString() ?? "-"}원
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-base">
                                schedule
                              </span>
                              {o.createdat ? fmtKstTime(o.createdat) : "-"}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-base">
                                phone
                              </span>
                              {o.phoneNumber ?? "-"}
                            </span>
                          </div>
                          {(o.estimated_pickup_time || o.requested_pickup_time) && (
                            <div className="flex items-center gap-1 text-sm font-medium text-primary mb-2">
                              <span className="material-symbols-outlined text-base">
                                event_available
                              </span>
                              {o.estimated_pickup_time ? "픽업 확정 " : "픽업 요청 "}
                              {fmtKstTime(
                                (o.estimated_pickup_time ||
                                  o.requested_pickup_time)!
                              )}
                            </div>
                          )}
                          <div className="text-sm text-foreground/80 truncate">
                            {menuSummaryMap.get(o.id) || "-"}
                          </div>
                          {o.status &&
                            (o.status === "PENDING" || isActiveStatus(o.status)) && (
                              <div className="mt-3 flex justify-end">
                                <QuickActions o={o} />
                              </div>
                            )}
                        </div>
                      </div>
                    ) : null
                  )
                )}
              </div>

              {/* Pagination Footer */}
              <div className="bg-muted/50 border-t border-border px-4 md:px-6 py-3 flex items-center justify-between text-xs text-muted-foreground shrink-0">
                <span className="hidden sm:inline">
                  {totalCount > 0
                    ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalCount)} / 총 ${totalCount}건`
                    : "0건"}
                </span>
                <span className="sm:hidden">
                  {totalCount > 0 ? `총 ${totalCount}건` : "0건"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={curPage <= 1}
                    onClick={() => goPage(curPage - 1)}
                    className="size-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">
                      chevron_left
                    </span>
                  </button>
                  <span className="font-medium text-foreground/80">
                    {curPage} / {totalPages}
                  </span>
                  <button
                    disabled={curPage >= totalPages}
                    onClick={() => goPage(curPage + 1)}
                    className="size-8 flex items-center justify-center rounded-lg border border-border bg-card text-foreground/80 hover:text-primary hover:border-primary transition-colors"
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
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="bg-card md:rounded-2xl rounded-t-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] md:max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between bg-card sticky top-0">
              <div className="flex flex-col">
                <h3 className="text-lg md:text-xl font-bold text-foreground">
                  주문 {(() => {
                    const o = orders.find((x) => x.id === openId);
                    return displayOrderNo(o?.order_no, o?.createdat, openId);
                  })()}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {orders.find((o) => o.id === openId)?.createdat
                    ? `${fmtKstDate(orders.find((o) => o.id === openId)!.createdat!)} ${fmtKstTime(orders.find((o) => o.id === openId)!.createdat!)}`
                    : "오늘 주문됨"}
                </span>
              </div>
              <button
                onClick={() => setOpenId(null)}
                className="text-muted-foreground hover:text-foreground p-2"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* 주문 상태 표시 */}
            <div className="px-4 md:px-6 py-2 border-b border-border bg-card">
              {(() => {
                const currentStatus = orders.find(
                  (o) => o.id === openId
                )?.status;
                if (!currentStatus) return null;
                const colors = STATUS_COLORS[currentStatus];
                return (
                  <span
                    className={`px-3 py-1 text-sm font-bold rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
                  >
                    {STATUS_LABELS[currentStatus]}
                  </span>
                );
              })()}
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar bg-background-light">
              {/* 픽업 시간 설정 카드 */}
              {(() => {
                const order = orders.find((o) => o.id === openId);
                const currentStatus = order?.status;
                const pickupTime = order?.estimated_pickup_time;
                const showPickupInput =
                  currentStatus &&
                  isActiveStatus(currentStatus) &&
                  currentStatus !== "READY" &&
                  currentStatus !== "COMPLETED";

                return (
                  <div className="bg-card p-4 rounded-xl border border-border mb-4 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-primary-light rounded-lg text-primary">
                        <span className="material-symbols-outlined">
                          schedule
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-foreground">픽업 시간</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          손님 요청:{" "}
                          <span className="font-medium text-foreground">
                            {order?.requested_pickup_time
                              ? new Date(
                                  order.requested_pickup_time
                                ).toLocaleString("ko-KR", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })
                              : "-"}
                          </span>
                        </p>
                        {pickupTime && (
                          <p className="text-sm text-primary font-medium mt-0.5">
                            확정:{" "}
                            {new Date(pickupTime).toLocaleString("ko-KR", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    {showPickupInput && (
                      <Form method="post" replace className="flex gap-2 items-end">
                        <input
                          type="hidden"
                          name="actionType"
                          value="setPickupTime"
                        />
                        <input
                          type="hidden"
                          name="orderId"
                          value={openId ?? ""}
                        />
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground block mb-1">
                            픽업 시간 조정 — 지금부터 N분 후로 변경
                          </label>
                          <input
                            type="number"
                            name="pickupMinutes"
                            min="1"
                            max="180"
                            defaultValue={15}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            placeholder="예: 15"
                          />
                        </div>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
                        >
                          조정
                        </button>
                      </Form>
                    )}
                  </div>
                );
              })()}

              {/* Customer Info Card */}
              <div className="bg-card p-4 rounded-xl border border-border mb-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground">
                      {orders.find((o) => o.id === openId)?.phoneNumber || "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">고객 연락처</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              {itemsLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
                  <p className="mt-3 text-muted-foreground text-sm">
                    주문 정보를 불러오는 중...
                  </p>
                </div>
              ) : items.length === 0 ? (
                <div className="p-6 text-center">
                  <span className="material-symbols-outlined text-muted-foreground text-3xl mb-2">
                    inventory_2
                  </span>
                  <p className="text-muted-foreground text-sm">
                    주문 아이템 정보가 없습니다
                  </p>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-4 py-2 bg-muted/50 border-b border-border text-xs font-bold text-muted-foreground uppercase">
                    주문 메뉴
                  </div>
                  <div className="divide-y divide-border">
                    {items.map((it) => (
                      <div key={it.id} className="p-4 flex gap-4">
                        <div className="size-14 md:size-16 bg-muted rounded-lg bg-cover bg-center shrink-0"></div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-foreground text-sm md:text-base">
                              {it.menuItem?.name ?? `#${it.menuItemId}`}
                            </h4>
                            <span className="font-medium text-foreground text-sm">
                              {it.price.toLocaleString()}원
                            </span>
                          </div>
                          {Array.isArray(it.options) && it.options.length > 0 && (
                            <p className="text-xs text-primary mt-1 font-medium">
                              {it.options.map((o) => o.optionName).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="font-bold text-lg text-primary self-center">
                          x{it.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-muted/50 p-4 border-t border-border flex justify-between items-center">
                    <span className="font-bold text-muted-foreground">합계</span>
                    <span className="text-xl font-bold text-primary">
                      {items
                        .reduce((sum, it) => sum + it.price * it.quantity, 0)
                        .toLocaleString()}
                      원
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer (Actions) */}
            <div className="p-4 border-t border-border bg-card sticky bottom-0">
              {(() => {
                const order = orders.find((o) => o.id === openId);
                const currentStatus = order?.status;
                if (!currentStatus) return null;
                const nextStatuses = getNextStatuses(currentStatus);

                // 손님 요청 픽업시간 → 시간입력 기본값(HH:mm). 점주가 바꾸면 그 시각으로 확정.
                const reqIso = order?.requested_pickup_time ?? null;
                const reqHHmm = reqIso
                  ? (() => {
                      const d = new Date(reqIso);
                      return `${String(d.getHours()).padStart(2, "0")}:${String(
                        d.getMinutes()
                      ).padStart(2, "0")}`;
                    })()
                  : "";
                // 거절 사유 (손님 거절 알림톡 #{거절사유}로 발송)
                const CANCEL_REASONS = [
                  "재료 소진으로 주문이 어렵습니다",
                  "주문이 많아 시간 내 준비가 어렵습니다",
                  "영업 종료(마감)로 주문이 어렵습니다",
                  "요청하신 픽업 시간에 맞추기 어렵습니다",
                ];
                const isRejecting = currentStatus === "PENDING";

                return (
                  <div className="flex flex-col gap-3">
                    {/* 다음 상태 버튼들 */}
                    {nextStatuses.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {nextStatuses.map((nextStatus) => {
                          const isCancel = nextStatus === "CANCEL";
                          const isAccept = nextStatus === "ACCEPT";
                          return (
                            <Form
                              key={nextStatus}
                              method="post"
                              replace
                              className="w-full"
                            >
                              <input
                                type="hidden"
                                name="actionType"
                                value="updateStatus"
                              />
                              <input
                                type="hidden"
                                name="orderId"
                                value={openId ?? ""}
                              />
                              <input
                                type="hidden"
                                name="newStatus"
                                value={nextStatus}
                              />
                              {isAccept && (
                                <div className="mb-2">
                                  <label className="text-xs text-muted-foreground block mb-1">
                                    픽업 시간 — 손님 요청 시간 그대로 확정하거나 바꿔서 확정하세요
                                  </label>
                                  <input
                                    type="time"
                                    name="confirmedTime"
                                    defaultValue={reqHHmm}
                                    required
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                  />
                                </div>
                              )}
                              {isCancel && (
                                <div className="mb-2">
                                  <label className="text-xs text-muted-foreground block mb-1">
                                    {isRejecting ? "거절" : "취소"} 사유 — 손님에게 알림톡으로 안내됩니다
                                  </label>
                                  <select
                                    name="cancelReason"
                                    defaultValue={CANCEL_REASONS[0]}
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-background"
                                  >
                                    {CANCEL_REASONS.map((r) => (
                                      <option key={r} value={r}>
                                        {r}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <button
                                type="submit"
                                className={`w-full py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                                  isCancel
                                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                                    : "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30"
                                }`}
                              >
                                <span className="material-symbols-outlined text-lg">
                                  {isCancel ? "cancel" : "check_circle"}
                                </span>
                                {isCancel && isRejecting
                                  ? "주문 거절"
                                  : STATUS_ACTION_LABELS[nextStatus]}
                              </button>
                            </Form>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-2">
                        이 주문은 최종 상태입니다
                      </div>
                    )}
                    {/* 닫기 버튼 */}
                    <button
                      onClick={() => setOpenId(null)}
                      className="w-full py-3 px-4 rounded-xl border border-border text-foreground/80 font-bold hover:bg-muted transition-colors"
                    >
                      닫기
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** ---- Utils ---- */
function short(id: string) {
  return id?.length > 8 ? id.slice(0, 8) + "..." : id;
}
function fmtKST(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
}
// KST 날짜/시간 분리 표기 (기존 fmtKST(...).split(" ")는 ko-KR 포맷 때문에 월/시간이
// 뒤섞여 잘못 나왔음 → 명시적 헬퍼로 교체)
function fmtKstDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  });
}
function fmtKstTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// 목록에서 바로 쓰는 빠른 처리 버튼:
//  - PENDING: [접수] (손님 요청 픽업시간 그대로 확정, 고객 확정 알림톡 발송)
//  - 진행중(ACCEPT/PREPARING/READY): [완료] / [취소](상태만 변경, silent — 고객 자동안내 없음)
//  픽업시간 조정·거절(사유 안내)은 행을 눌러 상세에서 처리.
function QuickActions({ o }: { o: OrderRow }) {
  if (!o.status) return null;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  if (o.status === "PENDING") {
    return (
      <Form method="post" replace onClick={stop}>
        <input type="hidden" name="actionType" value="updateStatus" />
        <input type="hidden" name="orderId" value={o.id} />
        <input type="hidden" name="newStatus" value="ACCEPT" />
        <button
          type="submit"
          onClick={stop}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          접수
        </button>
      </Form>
    );
  }
  if (isActiveStatus(o.status)) {
    return (
      <div className="flex gap-1.5" onClick={stop}>
        <Form method="post" replace onClick={stop}>
          <input type="hidden" name="actionType" value="updateStatus" />
          <input type="hidden" name="orderId" value={o.id} />
          <input type="hidden" name="newStatus" value="COMPLETED" />
          <button
            type="submit"
            onClick={stop}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-bold hover:bg-success/25 border border-success/30 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">task_alt</span>
            완료
          </button>
        </Form>
        <Form method="post" replace onClick={stop}>
          <input type="hidden" name="actionType" value="updateStatus" />
          <input type="hidden" name="orderId" value={o.id} />
          <input type="hidden" name="newStatus" value="CANCEL" />
          <input type="hidden" name="silent" value="true" />
          <button
            type="submit"
            onClick={(e) => {
              e.stopPropagation();
              if (
                !confirm(
                  "이 주문을 취소할까요?\n상태만 '취소됨'으로 바뀌고, 고객 자동 안내는 없습니다."
                )
              )
                e.preventDefault();
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 border border-destructive/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">cancel</span>
            취소
          </button>
        </Form>
      </div>
    );
  }
  return null;
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
