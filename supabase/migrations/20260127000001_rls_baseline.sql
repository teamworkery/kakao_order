-- =====================================================================
-- 003_rls_baseline.sql (filename uses Supabase migrations timestamp)
-- Description: Enable RLS on all public tables + storage policies.
--              Baseline policies — owner-only writes, public reads where
--              required for the customer-facing store page.
-- Notes:
--   - profiles.email / profiles.customernumber leak via SELECT public.
--     Recommended follow-up: move to a VIEW that exposes only public columns.
--   - order/orderitem allow customer self-select when their profile
--     customernumber matches order.phoneNumber (raw digits format used
--     by getRawPhoneNumber()).
--   - 001 (order_status_history) and 002 (store_hours) already applied.
-- =====================================================================

-- 1) Enable RLS on every public table
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "menuItem"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE orderitem             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_hours           ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- profiles
-- =====================================================================
DROP POLICY IF EXISTS profiles_select_public ON profiles;
CREATE POLICY profiles_select_public
  ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS profiles_delete_own ON profiles;
CREATE POLICY profiles_delete_own
  ON profiles FOR DELETE TO authenticated
  USING (auth.uid() = profile_id);

-- =====================================================================
-- categories
-- =====================================================================
DROP POLICY IF EXISTS categories_select_public ON categories;
CREATE POLICY categories_select_public
  ON categories FOR SELECT USING (true);

DROP POLICY IF EXISTS categories_manage_owner ON categories;
CREATE POLICY categories_manage_owner
  ON categories FOR ALL TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- =====================================================================
-- menuItem
-- =====================================================================
DROP POLICY IF EXISTS menu_select_public ON "menuItem";
CREATE POLICY menu_select_public
  ON "menuItem" FOR SELECT USING (true);

DROP POLICY IF EXISTS menu_manage_owner ON "menuItem";
CREATE POLICY menu_manage_owner
  ON "menuItem" FOR ALL TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- =====================================================================
-- order
-- =====================================================================
DROP POLICY IF EXISTS order_select_owner ON "order";
CREATE POLICY order_select_owner
  ON "order" FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

-- Customer can read their own orders by phoneNumber == own customernumber
DROP POLICY IF EXISTS order_select_self_customer ON "order";
CREATE POLICY order_select_self_customer
  ON "order" FOR SELECT TO authenticated
  USING (
    "phoneNumber" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.profile_id = auth.uid()
        AND p.customernumber = "order"."phoneNumber"
    )
  );

DROP POLICY IF EXISTS order_insert_authenticated ON "order";
CREATE POLICY order_insert_authenticated
  ON "order" FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS order_update_owner ON "order";
CREATE POLICY order_update_owner
  ON "order" FOR UPDATE TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- No DELETE policy by design: hard delete disabled.

-- =====================================================================
-- orderitem
-- =====================================================================
DROP POLICY IF EXISTS orderitem_select_related ON orderitem;
CREATE POLICY orderitem_select_related
  ON orderitem FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.order_id = orderitem."orderId"
        AND (
          o.profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.profile_id = auth.uid()
              AND p.customernumber = o."phoneNumber"
          )
        )
    )
  );

DROP POLICY IF EXISTS orderitem_insert_authenticated ON orderitem;
CREATE POLICY orderitem_insert_authenticated
  ON orderitem FOR INSERT TO authenticated
  WITH CHECK (true);

-- =====================================================================
-- order_status_history
-- =====================================================================
DROP POLICY IF EXISTS history_select_owner ON order_status_history;
CREATE POLICY history_select_owner
  ON order_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.order_id = order_status_history.order_id
        AND o.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS history_insert_owner ON order_status_history;
CREATE POLICY history_insert_owner
  ON order_status_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.order_id = order_status_history.order_id
        AND o.profile_id = auth.uid()
    )
  );

-- =====================================================================
-- store_hours (002 had named policies; recreate to align naming)
-- =====================================================================
DROP POLICY IF EXISTS "Anyone can view store hours" ON store_hours;
DROP POLICY IF EXISTS "Owners can manage their store hours" ON store_hours;
DROP POLICY IF EXISTS store_hours_select_public ON store_hours;
DROP POLICY IF EXISTS store_hours_manage_owner ON store_hours;

CREATE POLICY store_hours_select_public
  ON store_hours FOR SELECT USING (true);

CREATE POLICY store_hours_manage_owner
  ON store_hours FOR ALL TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- =====================================================================
-- storage.objects — bucket policies for menu-images / store-images
-- =====================================================================
-- Remove dangerous anon-upload policies
DROP POLICY IF EXISTS "Allow anon upload to menu-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload to store-images" ON storage.objects;

-- Authenticated users can upload
DROP POLICY IF EXISTS storage_authenticated_upload ON storage.objects;
CREATE POLICY storage_authenticated_upload
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('menu-images', 'store-images')
  );

-- Owner can update their own uploads
DROP POLICY IF EXISTS storage_owner_update ON storage.objects;
CREATE POLICY storage_owner_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('menu-images', 'store-images')
    AND owner = auth.uid()
  );

-- Owner can delete their own uploads
DROP POLICY IF EXISTS storage_owner_delete ON storage.objects;
CREATE POLICY storage_owner_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('menu-images', 'store-images')
    AND owner = auth.uid()
  );

-- Public SELECT works because both buckets are marked public — CDN serves
-- files directly without going through PostgREST.
