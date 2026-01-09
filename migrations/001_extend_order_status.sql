-- Migration: Extend Order Status Workflow
-- Description: Add new order statuses (PREPARING, READY, COMPLETED, REFUNDED)
--              Add order metadata columns
--              Create order_status_history table

-- Step 1: Add new values to kakao_order enum
-- Note: PostgreSQL allows adding values to enums but not removing them
ALTER TYPE kakao_order ADD VALUE IF NOT EXISTS 'PREPARING';
ALTER TYPE kakao_order ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE kakao_order ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE kakao_order ADD VALUE IF NOT EXISTS 'REFUNDED';

-- Step 2: Add new columns to order table
ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS estimated_pickup_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_pickup_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 3: Create order_status_history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES "order"(order_id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  changed_by UUID REFERENCES profiles(profile_id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_status_history_order
  ON order_status_history(order_id, created_at DESC);

-- Step 5: Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_updated_at_trigger ON "order";
CREATE TRIGGER order_updated_at_trigger
  BEFORE UPDATE ON "order"
  FOR EACH ROW
  EXECUTE FUNCTION update_order_updated_at();

-- Verify: Check the updated enum values
-- SELECT enum_range(NULL::kakao_order);
