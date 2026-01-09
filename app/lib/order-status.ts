import type { Database } from "database.types";

export type OrderStatus = Database["public"]["Enums"]["kakao_order"];

// 상태 전환 규칙: 각 상태에서 이동 가능한 다음 상태들
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["ACCEPT", "CANCEL"],
  ACCEPT: ["PREPARING", "CANCEL"],
  PREPARING: ["READY", "CANCEL"],
  READY: ["COMPLETED"],
  COMPLETED: ["REFUNDED"],
  CANCEL: [],
  REFUNDED: [],
};

// 상태별 한국어 라벨
export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "주문 대기",
  ACCEPT: "주문 접수",
  PREPARING: "조리 중",
  READY: "픽업 대기",
  COMPLETED: "완료",
  CANCEL: "취소됨",
  REFUNDED: "환불됨",
};

// 상태별 색상 (Tailwind CSS 클래스)
export const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; border: string }> = {
  PENDING: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300" },
  ACCEPT: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
  PREPARING: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  READY: { bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  COMPLETED: { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-300" },
  CANCEL: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
  REFUNDED: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
};

// 상태 전환이 가능한지 확인
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// 현재 상태에서 이동 가능한 다음 상태 목록
export function getNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
  return STATUS_TRANSITIONS[currentStatus] ?? [];
}

// 상태별 버튼 라벨 (액션 동사형)
export const STATUS_ACTION_LABELS: Record<OrderStatus, string> = {
  PENDING: "대기",
  ACCEPT: "접수하기",
  PREPARING: "조리 시작",
  READY: "조리 완료",
  COMPLETED: "픽업 완료",
  CANCEL: "주문 취소",
  REFUNDED: "환불 처리",
};

// 주문 상태 순서 (진행 순)
export const STATUS_ORDER: OrderStatus[] = [
  "PENDING",
  "ACCEPT",
  "PREPARING",
  "READY",
  "COMPLETED",
];

// 활성 주문 상태 (완료/취소/환불 제외)
export const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDING",
  "ACCEPT",
  "PREPARING",
  "READY",
];

// 상태가 활성 상태인지 확인
export function isActiveStatus(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

// 상태가 종료 상태인지 확인
export function isFinalStatus(status: OrderStatus): boolean {
  return ["COMPLETED", "CANCEL", "REFUNDED"].includes(status);
}
