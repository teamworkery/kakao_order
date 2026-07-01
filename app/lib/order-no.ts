// 사람이 읽기 쉬운 주문번호 표시 (YYMMDD-NN).
// 정본은 DB order.order_no (트리거 자동 부여, migration 006). 비어 있으면
// createdat + order_id 앞자리로 폴백해 최소한 UUID 전체 노출은 피한다.

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function displayOrderNo(
  orderNo: string | null | undefined,
  createdat?: string | null,
  orderId?: string | null
): string {
  if (orderNo) return orderNo;
  // 폴백: YYMMDD-XXXX (order_no 미부여 주문 대비)
  let ymd = "";
  if (createdat) {
    const d = new Date(createdat);
    if (!Number.isNaN(d.getTime())) {
      ymd = `${String(d.getFullYear()).slice(2)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
    }
  }
  const tail = orderId ? orderId.slice(0, 4).toUpperCase() : "";
  return ymd ? `${ymd}-${tail}` : tail || "-";
}
