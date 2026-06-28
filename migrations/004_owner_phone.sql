-- 004: 점주 휴대폰 번호 컬럼 (알림톡/SMS 주문 알림 수신용)
-- 실행 방법: Supabase Dashboard의 SQL Editor에서 실행
--
-- 배경: 손님 주문 시 점주에게 가는 알림(현 SMS, 향후 알림톡)의 수신번호로
--       지금까지 storenumber(가게 전화)를 썼는데, 가게 전화가 유선이면
--       알림톡(카톡 필요)도 SMS도 도달하지 않는다. 점주가 알림을 받을
--       휴대폰 번호를 별도 컬럼으로 받는다. (storenumber=손님 공개용 가게 전화는 그대로 유지)
--
-- 보안: owner_phone 은 점주 개인 휴대폰 → 공개 뷰(public_stores)에 노출 금지.
--       기존 profiles RLS(본인 행만 SELECT/UPDATE)로 보호됨. 손님 주문 플로우는
--       서비스롤(makeAdminClient)로만 이 값을 읽어 웹훅 payload에 사용한다.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS owner_phone TEXT;

COMMENT ON COLUMN profiles.owner_phone IS '점주 휴대폰(주문 알림 수신용, 알림톡/SMS). 비공개 — public_stores 뷰에 노출 금지';
