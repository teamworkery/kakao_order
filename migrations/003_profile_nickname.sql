-- 003: 카카오 로그인 닉네임 저장용 컬럼
-- 실행 방법: Supabase Dashboard의 SQL Editor에서 실행
--
-- 배경: profiles.name 은 가게 도메인 슬러그(/:name)로 이미 사용 중이라
--       손님 닉네임을 담을 수 없다. 알림톡 #{고객명} 변수용으로 별도 컬럼을 둔다.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS nickname TEXT;

COMMENT ON COLUMN profiles.nickname IS '카카오 로그인 등에서 받은 표시 이름(손님). 알림톡 #{고객명} 변수에 사용';
