// 픽업 예약 슬롯 계산 (손님 결제화면에서 사용)
//
// 규칙(사용자 확정 2026-06-28):
//  - 손님은 "지금 + 가게 기본조리시간"보다 이른 시간은 못 고른다.
//  - 영업시간(store_hours) 안에서만 고를 수 있다.
//  - 슬롯 단위 10분, 당일만.
//
// now/슬롯은 브라우저(손님 로컬=KST)에서 계산한다. Date 객체는 실제 타임스탬프라
// toISOString()으로 저장하면 UTC로 변환된다. KST 오프셋(+9h)은 10/15/30분 슬롯
// 경계와 정확히 맞아떨어지므로 epoch 기준 올림이 안전하다.

export interface TodayHours {
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean | null;
}

export interface PickupSlotsResult {
  slots: Date[];
  reason: string | null; // 슬롯이 없을 때 사용자 안내 문구
}

// 영업시간 미설정 시 마지막 픽업 가능 시각 폴백 (기존 앱이 "시간정보 없음=영업중"으로 취급)
const DEFAULT_LAST_PICKUP_HOUR = 21;

function parseTimeOnto(base: Date, time: string | null): Date | null {
  if (!time) return null;
  const parts = time.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? "0");
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

export function computePickupSlots(opts: {
  todayHours: TodayHours | null | undefined;
  prepMinutes: number;
  now?: Date;
  slotMinutes?: number;
}): PickupSlotsResult {
  const { todayHours, prepMinutes } = opts;
  const now = opts.now ?? new Date();
  const slotMinutes = opts.slotMinutes ?? 10;
  const slotMs = slotMinutes * 60 * 1000;

  if (todayHours?.is_closed) {
    return { slots: [], reason: "오늘은 휴무일입니다." };
  }

  // 영업 시작/종료 — 미설정이면 시작=지금, 종료=기본 폴백 시각
  const openDate = parseTimeOnto(now, todayHours?.open_time ?? null) ?? new Date(now);
  let closeDate = parseTimeOnto(now, todayHours?.close_time ?? null);
  if (!closeDate) {
    closeDate = new Date(now);
    closeDate.setHours(DEFAULT_LAST_PICKUP_HOUR, 0, 0, 0);
  }

  // 아직 영업 시작 전이면 안내
  if (now < openDate && todayHours?.open_time) {
    // 가장 이른 시간은 영업 시작 + 조리시간으로 자연스레 계산됨 → 계속 진행
  }

  // 가장 이른 픽업 = max(지금+조리시간, 영업시작), 슬롯 경계로 올림
  const earliestRaw = Math.max(now.getTime() + prepMinutes * 60 * 1000, openDate.getTime());
  const earliest = new Date(Math.ceil(earliestRaw / slotMs) * slotMs);

  if (earliest.getTime() > closeDate.getTime()) {
    return {
      slots: [],
      reason: "오늘 픽업 가능한 시간이 지났습니다.",
    };
  }

  const slots: Date[] = [];
  for (let t = earliest.getTime(); t <= closeDate.getTime(); t += slotMs) {
    slots.push(new Date(t));
    if (slots.length >= 200) break; // 안전장치
  }

  if (slots.length === 0) {
    return { slots: [], reason: "지금은 주문을 받을 수 없습니다." };
  }

  return { slots, reason: null };
}

// "오후 6:30" 형태 (손님 표시·확인 모달·점주 화면 공용)
export function formatKoreanTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "오전" : "오후";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const mm = m.toString().padStart(2, "0");
  return `${ampm} ${h}:${mm}`;
}
