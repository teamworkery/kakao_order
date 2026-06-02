-- =====================================================================
-- 20260602000001_rls_phase2_public_stores.sql
-- Description: RLS Phase 2 — protect profiles.email / customernumber.
--   Previously profiles_select_public (USING true) let anon read EVERY
--   column of EVERY profile (emails, customer phone numbers).
--   This migration:
--     1) Creates a public_stores VIEW exposing only公개 store columns.
--     2) Removes the public SELECT policy on profiles.
--     3) Adds a self-only SELECT policy so logged-in users read their own row.
--   The view is owned by the migration role (table owner) so it bypasses
--   profiles RLS and returns all stores — exposing only the safe columns.
-- =====================================================================

-- 1) 공개 가게 정보 뷰 (email/customernumber 미포함)
DROP VIEW IF EXISTS public_stores;
CREATE VIEW public_stores AS
  SELECT
    profile_id,
    name,
    storename,
    store_image,
    store_description,
    storenumber,
    default_prep_time_minutes
  FROM profiles;

GRANT SELECT ON public_stores TO anon, authenticated;

-- 2) profiles 직접 공개 SELECT 제거
DROP POLICY IF EXISTS profiles_select_public ON profiles;

-- 3) 로그인 사용자는 본인 행만 직접 SELECT 가능
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

-- PostgREST 스키마 캐시 리로드
NOTIFY pgrst, 'reload schema';
