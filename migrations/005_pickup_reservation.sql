-- 005: 픽업 예약 모델 (손님이 픽업 시간을 직접 선택)
-- 실행 방법: Supabase Dashboard SQL Editor 또는 Management API database/query
--
-- 배경: 기존 플로우는 손님이 픽업시간을 모른 채 주문을 "확정"하고,
--       점주가 사후에 픽업시간을 통보했다(손님이 15~20분 기대했는데
--       1시간이라 하면 빼도 박도 못함). 이를 "손님이 결제화면에서
--       원하는 픽업 시간을 직접 고르는" 예약 모델로 전환한다.
--       선택 범위는 [지금 + 가게 기본조리시간] ~ [오늘 영업종료], 10분 단위.
--
--   requested_pickup_time : 손님이 고른 희망 픽업 시각
--   estimated_pickup_time : (기존 컬럼 재활용) 점주가 확정한 픽업 시각
--   cancel_reason         : 점주가 주문을 거절(CANCEL)할 때의 사유 코드/문구
--                           → 손님 거절 알림톡의 #{거절사유} 변수로 사용

ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS requested_pickup_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

COMMENT ON COLUMN "order".requested_pickup_time IS '손님이 선택한 희망 픽업 시각 (예약 모델)';
COMMENT ON COLUMN "order".cancel_reason IS '점주 거절 사유 (거절 알림톡 변수). NULL=거절 아님';
