-- 002: 영업 시간 관리 테이블
-- 실행 방법: Supabase Dashboard의 SQL Editor에서 실행

-- store_hours 테이블 생성
CREATE TABLE IF NOT EXISTS store_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(profile_id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, day_of_week)
);

-- RLS 활성화
ALTER TABLE store_hours ENABLE ROW LEVEL SECURITY;

-- 정책: 누구나 영업 시간 조회 가능
CREATE POLICY "Anyone can view store hours"
  ON store_hours FOR SELECT
  USING (true);

-- 정책: 본인 가게 영업 시간만 수정 가능
CREATE POLICY "Owners can manage their store hours"
  ON store_hours FOR ALL
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_store_hours_profile
  ON store_hours(profile_id);

-- profiles 테이블에 기본 조리 시간 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_prep_time_minutes INTEGER DEFAULT 15;

COMMENT ON TABLE store_hours IS '가게별 요일별 영업 시간 관리';
COMMENT ON COLUMN store_hours.day_of_week IS '요일 (0=일요일, 1=월요일, ..., 6=토요일)';
COMMENT ON COLUMN store_hours.open_time IS '영업 시작 시간';
COMMENT ON COLUMN store_hours.close_time IS '영업 종료 시간';
COMMENT ON COLUMN store_hours.is_closed IS '휴무일 여부';
COMMENT ON COLUMN profiles.default_prep_time_minutes IS '기본 조리 소요 시간 (분)';
