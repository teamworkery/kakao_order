-- =====================================================================
-- 20260602000002_menu_options.sql
-- Description: 메뉴 옵션/사이즈 시스템.
--   menu_option_groups (예: "사이즈", "면 변경", "곱빼기")
--     + menu_options (그룹 내 선택지 + 추가요금 price_delta)
--   orderitem.options (jsonb) 에 주문 시 선택한 옵션 스냅샷 저장.
-- =====================================================================

CREATE TABLE IF NOT EXISTS menu_option_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  uuid NOT NULL REFERENCES "menuItem"(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES profiles(profile_id) ON DELETE CASCADE,
  name          text NOT NULL,
  min_select    int  NOT NULL DEFAULT 0,   -- 0 = 선택 안 해도 됨, >=1 = 필수
  max_select    int  NOT NULL DEFAULT 1,   -- 1 = 단일 선택, >1 = 복수 선택
  display_order int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mog_menu_item ON menu_option_groups(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_mog_profile  ON menu_option_groups(profile_id);

CREATE TABLE IF NOT EXISTS menu_options (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid NOT NULL REFERENCES menu_option_groups(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES profiles(profile_id) ON DELETE CASCADE,
  name          text NOT NULL,
  price_delta   numeric NOT NULL DEFAULT 0,
  display_order int  NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mo_group ON menu_options(group_id);

-- 주문 라인에 선택 옵션 스냅샷
ALTER TABLE orderitem ADD COLUMN IF NOT EXISTS options jsonb;

-- RLS
ALTER TABLE menu_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_options       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mog_select_public ON menu_option_groups;
CREATE POLICY mog_select_public ON menu_option_groups FOR SELECT USING (true);
DROP POLICY IF EXISTS mog_manage_owner ON menu_option_groups;
CREATE POLICY mog_manage_owner ON menu_option_groups FOR ALL TO authenticated
  USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS mo_select_public ON menu_options;
CREATE POLICY mo_select_public ON menu_options FOR SELECT USING (true);
DROP POLICY IF EXISTS mo_manage_owner ON menu_options;
CREATE POLICY mo_manage_owner ON menu_options FOR ALL TO authenticated
  USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

NOTIFY pgrst, 'reload schema';
