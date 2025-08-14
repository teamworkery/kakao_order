// routes/owner.orders.tsx
import type { Database } from "database.types";
import { useEffect, useMemo, useState } from "react";
import { Form, useLoaderData } from "react-router";
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
};

type OrderItemWithMenu = {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  price: number;
  menuItem?: { id: string; name: string; price: number } | null;
};

type LoaderData = {
  orders: OrderRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: { phone: string; dateFrom: string; dateTo: string };
  userEmail: string | null;
  storename: string | null;
  name: string | null;
};

const PAGE_SIZE = 20;

/** ===================== ACTION (로그아웃) ===================== */
export async function action({ request }: ActionFunctionArgs) {
  const { client } = makeSSRClient(request);
  const form = await request.formData();
  const actionType = form.get("actionType");

  if (actionType === "logout") {
    await client.auth.signOut();
    return redirect("/login");
  }
  return null;
}

/** ===================== LOADER (SSR) ===================== */
export async function loader({ request }: LoaderFunctionArgs) {
  const { client } = makeSSRClient(request);
  const { data: userRes } = await client.auth.getUser();
  const user = userRes?.user;
  if (!user) throw redirect("/login");

  const { data: profile } = await client
    .from("profiles")
    .select("profile_id, email, storename, name")
    .eq("profile_id", user.id)
    .maybeSingle();

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const phone = (url.searchParams.get("phone") || "").trim();
  const storename = profile?.storename?.trim() || null;
  const name = profile?.name?.trim() || null;
  const userEmailOut = profile?.email?.trim() || user.email || null;

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
    .select("id:order_id, phoneNumber, totalAmount, createdat, profile_id")
    .eq("profile_id", user.id)
    .gte("createdat", dateFrom)
    .lte("createdat", dateTo);
  if (phone) dataQ.ilike("phoneNumber", `%${phone}%`);

  const { data: ordersRaw, error } = await dataQ
    .order("createdat", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;

  const orders = Array.isArray(ordersRaw) ? ordersRaw.filter(Boolean) : [];

  return new Response(
    JSON.stringify({
      orders,
      totalCount,
      page,
      pageSize: PAGE_SIZE,
      filters: { phone, dateFrom, dateTo },
      userEmail: userEmailOut,
      storename,
      name,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

/** ===================== PAGE (Client) ===================== */
export default function OwnerOrdersPage() {
  const data = useLoaderData<LoaderData>();
  const { userEmail } = data;

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
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">주문 목록</h1>

        {/* admin 페이지와 동일한 패턴: 서버 액션 기반 로그아웃 */}
        <Form method="post">
          <input type="hidden" name="actionType" value="logout" />
          <button
            type="submit"
            className="border px-3 py-1 rounded hover:bg-gray-50"
            title="로그아웃"
          >
            로그아웃
          </button>
        </Form>
      </div>

      {/* Filters */}
      <section className="flex flex-wrap gap-2 items-end mb-4 justify-between">
        <div>
          <label className="text-sm">전화번호</label>
          <br />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010..."
            className="border px-2 py-1 rounded"
          />
        </div>
        <div>
          <label className="text-sm">From</label>
          <br />
          <input
            type="datetime-local"
            value={toLocalInputValue(dateFrom)}
            onChange={(e) =>
              setDateFrom(new Date(e.target.value).toISOString())
            }
            className="border px-2 py-1 rounded"
          />
        </div>
        <div>
          <label className="text-sm">To</label>
          <br />
          <input
            type="datetime-local"
            value={toLocalInputValue(dateTo)}
            onChange={(e) => setDateTo(new Date(e.target.value).toISOString())}
            className="border px-2 py-1 rounded"
          />
        </div>
        <button onClick={applyFilters} className="border px-3 py-1 rounded">
          적용
        </button>
        {(data.userEmail || data.storename || data.name) && (
          <div className="text-sm">
            <span>관리자: </span>
            <span className="font-bold">{data.userEmail ?? "-"}</span>
            <span className="ml-3 text-gray-600">
              {data.storename?.trim?.() || "가게명 미설정"} @{" "}
              {data.name?.trim?.() || "domain 미설정"}
            </span>
          </div>
        )}
      </section>

      {/* Table */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left">시간</th>
              <th className="px-3 py-2 text-left">주문ID</th>
              <th className="px-3 py-2 text-left">전화</th>
              <th className="px-3 py-2 text-right">총액</th>
              <th className="px-3 py-2">액션</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td className="px-3 py-4" colSpan={5}>
                  데이터 없음
                </td>
              </tr>
            ) : (
              orders.map((o) =>
                o ? (
                  <tr key={o.id} className="border-t">
                    <td className="px-3 py-2">
                      {o.createdat ? fmtKST(o.createdat) : "-"}
                    </td>
                    <td className="px-3 py-2">{short(o.id)}</td>
                    <td className="px-3 py-2">{o.phoneNumber ?? "-"}</td>
                    <td className="px-3 py-2 text-right">
                      {o.totalAmount?.toLocaleString() ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className="border px-2 py-1 rounded"
                        onClick={() => setOpenId(o.id)}
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                ) : null
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-2 mt-3">
        <button
          disabled={curPage <= 1}
          onClick={() => goPage(curPage - 1)}
          className="border px-2 py-1 rounded disabled:opacity-50"
        >
          이전
        </button>
        <span>
          {curPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}
        </span>
        <button
          disabled={curPage >= Math.max(1, Math.ceil(totalCount / pageSize))}
          onClick={() => goPage(curPage + 1)}
          className="border px-2 py-1 rounded disabled:opacity-50"
        >
          다음
        </button>
      </div>

      {/* Detail Modal */}
      {openId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center"
          onClick={() => setOpenId(null)}
        >
          <div
            className="bg-white rounded p-4 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold">주문 상세: {short(openId)}</h2>
              <button onClick={() => setOpenId(null)} className="text-sm">
                닫기
              </button>
            </div>
            {itemsLoading ? (
              <p>로딩 중…</p>
            ) : items.length === 0 ? (
              <p>아이템 없음</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1">메뉴</th>
                    <th className="text-right px-2 py-1">수량</th>
                    <th className="text-right px-2 py-1">가격</th>
                    <th className="text-right px-2 py-1">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="px-2 py-1">
                        {it.menuItem?.name ?? `#${it.menuItemId}`}
                      </td>
                      <td className="px-2 py-1 text-right">{it.quantity}</td>
                      <td className="px-2 py-1 text-right">
                        {it.price.toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {(it.price * it.quantity).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toLocaleString("ko-KR", { hour12: false });
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
