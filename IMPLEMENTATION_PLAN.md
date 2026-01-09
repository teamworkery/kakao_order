# Implementation Plan: Phase 1 - Critical Production Blockers
## Kakao Order v3 → Production-Ready Platform

**Phase**: 1 of 4 (P0 - Critical)
**Duration**: 6-8 weeks
**Goal**: Transform MVP into production-ready commercial platform

---

## 🎯 Executive Summary

### Current State (MVP)
- ✅ Basic order management (PENDING → ACCEPT)
- ✅ Kakao OAuth login
- ✅ Menu management with drag-and-drop
- ✅ Real-time order notifications
- ❌ **No payment system** - orders without money exchange
- ❌ **No security (RLS)** - data publicly accessible
- ❌ **Minimal validation** - vulnerable to attacks
- ❌ **No GDPR compliance** - legal risk

### Phase 1 Objectives
Make the platform **commercially viable** by implementing:
1. **Payment Integration** - Toss Payments for actual transactions
2. **Security Foundation** - Row-Level Security (RLS) + validation
3. **Complete Order Workflow** - 8 statuses (PENDING → COMPLETED)
4. **GDPR Compliance** - Privacy policy, data export/deletion
5. **Rate Limiting** - Prevent abuse and attacks

---

## 📅 Implementation Roadmap

### **Milestone 1: Database Foundation** (Week 1-2)
- Create payment tables (payments, payment_logs)
- Extend order status enum (8 statuses)
- Implement Row-Level Security (RLS) policies
- Add rate limiting tables

### **Milestone 2: Security Hardening** (Week 2-3)
- Create validation utilities (Zod schemas)
- Implement rate limiter logic
- Apply validation to all routes

### **Milestone 3: Payment Integration** (Week 3-5)
- Integrate Toss Payments SDK
- Create payment routes (checkout, success, fail)
- Update order flow with payment

### **Milestone 4: Extended Order Workflow** (Week 5-6)
- Implement order status transitions
- Update owner dashboard with new statuses
- Add customer notifications

### **Milestone 5: GDPR Compliance** (Week 6-8)
- Create privacy policy & terms of service
- Implement data export feature
- Implement account deletion
- Add cookie consent banner

---

## 🔧 Detailed Implementation Tasks

### MILESTONE 1: Database Foundation

#### Task 1.1: Payment Schema (2 days)
**Files to create:**
- `supabase/migrations/001_payment_tables.sql`

**Schema:**
```sql
CREATE TABLE payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES "order"(order_id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(profile_id),
  toss_payment_key VARCHAR(200) UNIQUE,
  toss_order_id VARCHAR(200) UNIQUE,
  amount INT NOT NULL,
  status VARCHAR(20) CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED')),
  payment_method VARCHAR(50),
  card_company VARCHAR(50),
  card_number VARCHAR(20),
  receipt_url TEXT,
  failure_code VARCHAR(100),
  failure_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(payment_id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  http_status INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payment_logs_payment ON payment_logs(payment_id);
```

**Success criteria:** Migration runs without errors, indexes created

---

#### Task 1.2: Extend Order Status (1 day)
**Files to create:**
- `supabase/migrations/002_extend_order_status.sql`

**Changes:**
```sql
-- Update order table
ALTER TABLE "order"
  ADD COLUMN estimated_pickup_time TIMESTAMPTZ,
  ADD COLUMN actual_pickup_time TIMESTAMPTZ,
  ADD COLUMN cancellation_reason TEXT,
  ADD COLUMN notes TEXT;

-- Update status enum to include new statuses
-- Note: May need to drop and recreate enum or use ALTER TYPE
ALTER TYPE kakao_order ADD VALUE 'PREPARING';
ALTER TYPE kakao_order ADD VALUE 'READY';
ALTER TYPE kakao_order ADD VALUE 'COMPLETED';
ALTER TYPE kakao_order ADD VALUE 'REFUNDED';

-- Create status history table
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES "order"(order_id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  changed_by UUID REFERENCES profiles(profile_id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_history_order ON order_status_history(order_id, created_at DESC);
```

**Post-migration:** Run `npx supabase gen types typescript` to regenerate database.types.ts

---

#### Task 1.3: Row-Level Security (3 days) ⭐ CRITICAL
**Files to create:**
- `supabase/migrations/003_enable_rls.sql`

**RLS Policies:**
```sql
-- profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id AND role = OLD.role); -- Prevent role escalation

CREATE POLICY "Public can view store profiles"
  ON profiles FOR SELECT
  USING (role = 'owner');

-- menuItem table
ALTER TABLE "menuItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active menu items"
  ON "menuItem" FOR SELECT
  USING (isActive = true OR auth.uid() = profile_id);

CREATE POLICY "Owners can manage own menu items"
  ON "menuItem" FOR ALL
  USING (auth.uid() = profile_id);

-- order table
ALTER TABLE "order" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own orders"
  ON "order" FOR SELECT
  USING (
    phoneNumber IN (
      SELECT customernumber FROM profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Owners can view store orders"
  ON "order" FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Authenticated users can create orders"
  ON "order" FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update own store orders"
  ON "order" FOR UPDATE
  USING (auth.uid() = profile_id);

-- payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payments for their orders"
  ON payments FOR SELECT
  USING (
    order_id IN (
      SELECT order_id FROM "order"
      WHERE profile_id = auth.uid()
      OR phoneNumber IN (SELECT customernumber FROM profiles WHERE profile_id = auth.uid())
    )
  );

-- Similar policies for categories, orderitem, payment_logs...
```

**Testing checklist:**
- [ ] Anonymous user cannot access any data
- [ ] Customer can only see their own orders
- [ ] Owner can only see their store's data
- [ ] Cross-store access is blocked
- [ ] Menu items are publicly visible

---

#### Task 1.4: Rate Limiting Table (1 day)
**Files to create:**
- `supabase/migrations/004_rate_limiting.sql`

```sql
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL, -- IP or user ID
  action VARCHAR(50) NOT NULL,
  count INT DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, action, window_start)
);

CREATE INDEX idx_rate_limits_lookup ON rate_limits(identifier, action, window_start);

-- Cleanup old records (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
```

---

### MILESTONE 2: Security Hardening

#### Task 2.1: Validation Utilities (2 days)
**Files to create:**
- `app/lib/validation.ts`
- `app/lib/rate-limiter.server.ts`

**app/lib/validation.ts:**
```typescript
import { z } from 'zod';

// Phone number validation (Korean format)
export const phoneNumberSchema = z.string()
  .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "올바른 전화번호 형식이 아닙니다")
  .transform(val => val.replace(/-/g, '')); // Remove hyphens

// Menu item validation
export const menuItemSchema = z.object({
  name: z.string()
    .min(1, "메뉴 이름은 필수입니다")
    .max(100, "메뉴 이름은 100자 이하여야 합니다")
    .regex(/^[가-힣a-zA-Z0-9\s\-()]+$/, "특수문자는 -, ()만 허용됩니다"),
  price: z.number()
    .int("가격은 정수여야 합니다")
    .positive("가격은 0보다 커야 합니다")
    .max(1000000, "가격은 100만원 이하여야 합니다"),
  description: z.string()
    .max(500, "설명은 500자 이하여야 합니다")
    .optional(),
  category_id: z.string().uuid(),
});

// Order validation
export const orderItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number()
    .int()
    .positive()
    .max(99, "수량은 99개 이하여야 합니다"),
  price: z.number().positive(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema)
    .min(1, "최소 1개 이상의 메뉴를 선택해야 합니다")
    .max(50, "한 번에 50개 이하의 메뉴만 주문 가능합니다"),
  totalAmount: z.number()
    .positive()
    .max(10000000, "총 금액은 1000만원 이하여야 합니다"),
  phoneNumber: phoneNumberSchema,
});

// Store profile validation
export const storeProfileSchema = z.object({
  storename: z.string().min(1).max(100),
  storenumber: phoneNumberSchema,
  store_description: z.string()
    .max(500)
    .refine(
      (val) => !/<script|javascript:|onerror=/i.test(val),
      "허용되지 않는 스크립트가 포함되어 있습니다"
    )
    .optional(),
});

// Sanitization helper
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

**app/lib/rate-limiter.server.ts:**
```typescript
import { createClient } from '~/lib/supabase.server';

type RateLimitAction =
  | 'order_create'
  | 'phone_update'
  | 'menu_create'
  | 'login_attempt'
  | 'api_general';

const LIMITS: Record<RateLimitAction, { requests: number; window: number }> = {
  order_create: { requests: 10, window: 3600 }, // 10 per hour
  phone_update: { requests: 5, window: 3600 },
  menu_create: { requests: 100, window: 3600 },
  login_attempt: { requests: 5, window: 900 }, // 5 per 15 min
  api_general: { requests: 100, window: 60 },
};

export async function checkRateLimit(
  identifier: string,
  action: RateLimitAction,
  supabase: ReturnType<typeof createClient>
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const { requests, window } = LIMITS[action];
  const windowStart = new Date(Date.now() - window * 1000);

  // Get current count
  const { data, error } = await supabase
    .from('rate_limits')
    .select('count')
    .eq('identifier', identifier)
    .eq('action', action)
    .gte('window_start', windowStart.toISOString())
    .single();

  const currentCount = data?.count || 0;

  if (currentCount >= requests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + window * 1000),
    };
  }

  // Increment count
  await supabase
    .from('rate_limits')
    .upsert({
      identifier,
      action,
      count: currentCount + 1,
      window_start: windowStart.toISOString(),
    }, {
      onConflict: 'identifier,action,window_start',
    });

  return {
    allowed: true,
    remaining: requests - currentCount - 1,
    resetAt: new Date(Date.now() + window * 1000),
  };
}

// Helper for route actions
export async function withRateLimit<T>(
  request: Request,
  action: RateLimitAction,
  fn: () => Promise<T>
): Promise<T> {
  const supabase = createClient(request);
  const identifier = request.headers.get('x-forwarded-for') || 'unknown';

  const limit = await checkRateLimit(identifier, action, supabase);

  if (!limit.allowed) {
    throw new Response('Too many requests', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000).toString(),
      },
    });
  }

  return fn();
}
```

---

#### Task 2.2: Apply Validation to Order Route (2 days)
**Files to modify:**
- `app/routes/$name.tsx`

**Key changes in action function:**
```typescript
import { createOrderSchema, phoneNumberSchema } from '~/lib/validation';
import { withRateLimit } from '~/lib/rate-limiter.server';

export async function action({ request, params }: ActionFunctionArgs) {
  return withRateLimit(request, 'order_create', async () => {
    const user = await requireAuth(request);
    const formData = await request.formData();
    const orderData = JSON.parse(formData.get('orderData') as string);

    // Validate order data
    const validationResult = createOrderSchema.safeParse(orderData);
    if (!validationResult.success) {
      return json(
        { error: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { items, totalAmount, phoneNumber } = validationResult.data;

    // Verify calculated total matches
    const calculatedTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      return json({ error: "금액이 일치하지 않습니다" }, { status: 400 });
    }

    // Create order (don't mark as PENDING yet, wait for payment)
    // ... rest of order creation logic
  });
}
```

---

#### Task 2.3: Apply Validation to Admin Route (2 days)
**Files to modify:**
- `app/routes/admin.tsx`

**Key changes:**
```typescript
import { menuItemSchema, storeProfileSchema } from '~/lib/validation';
import { withRateLimit } from '~/lib/rate-limiter.server';

// In createMenuItem action
const validationResult = menuItemSchema.safeParse(menuData);
if (!validationResult.success) {
  return json({ error: validationResult.error.errors }, { status: 400 });
}

// In updateStoreProfile action
const validationResult = storeProfileSchema.safeParse(profileData);
// ...
```

---

### MILESTONE 3: Payment Integration ⭐ MOST COMPLEX

#### Task 3.1: Toss Payments Setup (1 day)
**Dependencies:**
```bash
npm install @tosspayments/payment-sdk
```

**Environment variables (.env):**
```
TOSS_CLIENT_KEY=test_ck_xxxxx
TOSS_SECRET_KEY=test_sk_xxxxx
TOSS_SUCCESS_URL=http://localhost:5173/payment/success
TOSS_FAIL_URL=http://localhost:5173/payment/fail
```

**Files to create:**
- `app/lib/toss-payments.server.ts`

```typescript
import { createClient } from '~/lib/supabase.server';

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!;
const TOSS_API_URL = 'https://api.tosspayments.com/v1';

export class TossPaymentsService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async confirmPayment(paymentKey: string, orderId: string, amount: number) {
    const response = await fetch(`${TOSS_API_URL}/payments/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const data = await response.json();

    // Log event
    await this.logPaymentEvent(paymentKey, 'confirm', data, response.status);

    if (!response.ok) {
      throw new Error(data.message || 'Payment confirmation failed');
    }

    return data;
  }

  async createPaymentRecord(orderId: string, amount: number, profileId: string) {
    const { data, error } = await this.supabase
      .from('payments')
      .insert({
        order_id: orderId,
        profile_id: profileId,
        amount,
        status: 'PENDING',
        toss_order_id: `ORDER_${orderId}_${Date.now()}`,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePaymentRecord(
    paymentKey: string,
    tossData: any
  ) {
    const { error } = await this.supabase
      .from('payments')
      .update({
        toss_payment_key: paymentKey,
        status: 'COMPLETED',
        payment_method: tossData.method,
        card_company: tossData.card?.company,
        card_number: tossData.card?.number,
        receipt_url: tossData.receipt?.url,
        updated_at: new Date().toISOString(),
      })
      .eq('toss_order_id', tossData.orderId);

    if (error) throw error;
  }

  async logPaymentEvent(
    paymentId: string,
    eventType: string,
    eventData: any,
    httpStatus: number
  ) {
    await this.supabase
      .from('payment_logs')
      .insert({
        payment_id: paymentId,
        event_type: eventType,
        event_data: eventData,
        http_status: httpStatus,
      });
  }
}
```

---

#### Task 3.2: Payment Routes (3 days)
**Files to create:**
- `app/routes/payment/checkout.tsx`
- `app/routes/payment/success.tsx`
- `app/routes/payment/fail.tsx`

**app/routes/payment/checkout.tsx:**
```typescript
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { useLoaderData } from '@remix-run/react';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId');

  // Fetch order and payment details
  const supabase = createClient(request);
  const { data: order } = await supabase
    .from('order')
    .select('*, payments(*)')
    .eq('order_id', orderId)
    .single();

  return json({
    order,
    clientKey: process.env.TOSS_CLIENT_KEY,
    successUrl: process.env.TOSS_SUCCESS_URL,
    failUrl: process.env.TOSS_FAIL_URL,
  });
}

export default function PaymentCheckout() {
  const { order, clientKey, successUrl, failUrl } = useLoaderData<typeof loader>();

  useEffect(() => {
    loadTossPayments(clientKey).then(tossPayments => {
      tossPayments.requestPayment('카드', {
        amount: order.totalAmount,
        orderId: order.payments[0].toss_order_id,
        orderName: `주문 ${order.order_id.slice(0, 8)}`,
        customerName: order.phoneNumber,
        successUrl,
        failUrl,
      });
    });
  }, []);

  return <div>결제 진행 중...</div>;
}
```

**app/routes/payment/success.tsx:**
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const paymentKey = url.searchParams.get('paymentKey');
  const orderId = url.searchParams.get('orderId');
  const amount = Number(url.searchParams.get('amount'));

  const supabase = createClient(request);
  const toss = new TossPaymentsService(supabase);

  try {
    // Confirm payment with Toss
    const paymentData = await toss.confirmPayment(paymentKey!, orderId!, amount);

    // Update payment record
    await toss.updatePaymentRecord(paymentKey!, paymentData);

    // Update order status to PENDING (payment complete, awaiting store acceptance)
    await supabase
      .from('order')
      .update({ status: 'PENDING' })
      .eq('order_id', paymentData.orderId);

    // Send notification to store owner
    // ... n8n webhook call

    return redirect(`/customer/order-success?orderId=${paymentData.orderId}`);
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    return redirect(`/payment/fail?message=${error.message}`);
  }
}
```

**app/routes/payment/fail.tsx:**
```typescript
export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const message = url.searchParams.get('message') || '결제에 실패했습니다';

  return json({ message });
}

export default function PaymentFail() {
  const { message } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">결제 실패</h1>
      <p className="mb-6">{message}</p>
      <button onClick={() => window.history.back()}>다시 시도</button>
    </div>
  );
}
```

---

#### Task 3.3: Integrate Payment into Order Flow (2 days)
**Files to modify:**
- `app/routes/$name.tsx`

**Changes in action:**
```typescript
// After order creation
const { data: order } = await supabase
  .from('order')
  .insert({
    profile_id: storeProfile.profile_id,
    phoneNumber: validatedData.phoneNumber,
    totalAmount: validatedData.totalAmount,
    status: 'PAYMENT_PENDING', // Don't set to PENDING yet
  })
  .select()
  .single();

// Create payment record
const toss = new TossPaymentsService(supabase);
await toss.createPaymentRecord(order.order_id, order.totalAmount, storeProfile.profile_id);

// Redirect to payment page
return redirect(`/payment/checkout?orderId=${order.order_id}`);
```

---

### MILESTONE 4: Extended Order Workflow

#### Task 4.1: Order Status Manager (3 days)
**Files to create:**
- `app/lib/order-status.server.ts`

```typescript
type OrderStatus =
  | 'PAYMENT_PENDING'
  | 'PENDING'
  | 'ACCEPT'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCEL'
  | 'REFUNDED';

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PAYMENT_PENDING: ['PENDING', 'CANCEL'],
  PENDING: ['ACCEPT', 'CANCEL'],
  ACCEPT: ['PREPARING', 'CANCEL'],
  PREPARING: ['READY', 'CANCEL'],
  READY: ['COMPLETED'],
  COMPLETED: ['REFUNDED'],
  CANCEL: ['REFUNDED'],
  REFUNDED: [],
};

export class OrderStatusManager {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return STATUS_TRANSITIONS[from].includes(to);
  }

  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string,
    notes?: string
  ) {
    // Get current status
    const { data: order } = await this.supabase
      .from('order')
      .select('status')
      .eq('order_id', orderId)
      .single();

    if (!order) throw new Error('Order not found');

    // Validate transition
    if (!this.canTransition(order.status as OrderStatus, newStatus)) {
      throw new Error(`Cannot transition from ${order.status} to ${newStatus}`);
    }

    // Update order
    await this.supabase
      .from('order')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('order_id', orderId);

    // Log transition
    await this.supabase
      .from('order_status_history')
      .insert({
        order_id: orderId,
        from_status: order.status,
        to_status: newStatus,
        changed_by: userId,
        notes,
      });

    return { success: true };
  }
}
```

---

#### Task 4.2: Update Owner Orders UI (3 days)
**Files to modify:**
- `app/routes/owner.orders.tsx`

**Add new action:**
```typescript
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'updateStatus') {
    const orderId = formData.get('orderId') as string;
    const newStatus = formData.get('status') as OrderStatus;
    const notes = formData.get('notes') as string;

    const supabase = createClient(request);
    const statusManager = new OrderStatusManager(supabase);

    await statusManager.updateStatus(orderId, newStatus, user.id, notes);

    // Send notification based on status
    if (newStatus === 'READY') {
      // Notify customer pickup is ready
    }

    return json({ success: true });
  }

  // ... existing accept logic
}
```

**Update OrderDetailModal component:**
```typescript
<div className="flex gap-2">
  {order.status === 'PENDING' && (
    <button onClick={() => updateStatus('ACCEPT')}>주문 수락</button>
  )}
  {order.status === 'ACCEPT' && (
    <button onClick={() => updateStatus('PREPARING')}>조리 시작</button>
  )}
  {order.status === 'PREPARING' && (
    <button onClick={() => updateStatus('READY')}>픽업 준비 완료</button>
  )}
  {order.status === 'READY' && (
    <button onClick={() => updateStatus('COMPLETED')}>완료</button>
  )}
</div>
```

---

### MILESTONE 5: GDPR Compliance

#### Task 5.1: Legal Documents (3 days)
**Files to create:**
- `app/routes/legal/privacy.tsx` - Privacy policy
- `app/routes/legal/terms.tsx` - Terms of service
- `app/routes/legal/refund.tsx` - Refund policy

**Note:** These require actual legal content. Consult with a lawyer for Korean legal compliance.

---

#### Task 5.2: Data Export & Deletion (3 days)
**Files to create:**
- `app/routes/account/data.tsx`

```typescript
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  const supabase = createClient(request);

  if (intent === 'export') {
    // Collect all user data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('profile_id', user.id)
      .single();

    const { data: orders } = await supabase
      .from('order')
      .select('*, orderitem(*), payments(*)')
      .eq('phoneNumber', profile.customernumber);

    const exportData = { profile, orders };

    return json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="my-data-${Date.now()}.json"`,
      },
    });
  }

  if (intent === 'delete') {
    // Soft delete: anonymize personal data
    await supabase
      .from('profiles')
      .update({
        email: `deleted_${user.id}@deleted.com`,
        name: '[삭제된 사용자]',
        customernumber: null,
      })
      .eq('profile_id', user.id);

    // Delete auth account
    await supabase.auth.admin.deleteUser(user.id);

    return redirect('/');
  }
}
```

---

#### Task 5.3: Cookie Consent Banner (1 day)
**Files to create:**
- `app/components/CookieConsent.tsx`

```typescript
export function CookieConsent() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) setShown(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShown(false);
  };

  if (!shown) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <p>
          이 사이트는 쿠키를 사용합니다.
          <a href="/legal/privacy" className="underline">개인정보 처리방침</a>
        </p>
        <button onClick={accept}>동의</button>
      </div>
    </div>
  );
}
```

**Update `app/root.tsx`:**
```typescript
import { CookieConsent } from '~/components/CookieConsent';

export default function App() {
  return (
    <html>
      <body>
        <Outlet />
        <CookieConsent />
      </body>
    </html>
  );
}
```

---

---

## ⚡ Critical Files Reference

### Files to Create (New)
```
supabase/migrations/001_payment_tables.sql
supabase/migrations/002_extend_order_status.sql
supabase/migrations/003_enable_rls.sql
supabase/migrations/004_rate_limiting.sql
app/lib/validation.ts
app/lib/rate-limiter.server.ts
app/lib/toss-payments.server.ts
app/lib/order-status.server.ts
app/routes/payment/checkout.tsx
app/routes/payment/success.tsx
app/routes/payment/fail.tsx
app/routes/legal/privacy.tsx
app/routes/legal/terms.tsx
app/routes/account/data.tsx
app/components/CookieConsent.tsx
```

### Files to Modify (Existing)
```
app/routes/$name.tsx - Add validation, payment redirect
app/routes/admin.tsx - Add validation to menu/store updates
app/routes/owner.orders.tsx - Add status transition UI
app/root.tsx - Add CookieConsent component
database.types.ts - Regenerate after migrations
```

---

## 🚀 5-STEP EXECUTION PLAN

각 단계별로 독립적으로 실행 가능한 명확한 지시사항입니다.
Claude Code에 각 단계를 순차적으로 입력하여 진행하세요.

---

## STEP 1: Database Foundation & Security Setup
**Duration:** 2 weeks | **Priority:** P0 - CRITICAL

### Goal
데이터베이스에 결제 테이블을 추가하고, Row-Level Security(RLS)를 구현하여 보안 기반을 마련합니다.

### Prompt for Claude Code:

```
Phase 1-A: Create payment and rate limiting database tables

Create the following migration files in the supabase/migrations directory:

1. Create `supabase/migrations/001_payment_tables.sql`:
   - Create `payments` table with columns: payment_id (PK), order_id (FK), profile_id (FK), toss_payment_key, toss_order_id, amount, status (enum: PENDING/COMPLETED/FAILED/CANCELLED/REFUNDED), payment_method, card_company, card_number, receipt_url, failure_code, failure_message, created_at, updated_at
   - Create `payment_logs` table with columns: id (PK), payment_id (FK), event_type, event_data (JSONB), http_status, created_at
   - Add indexes: idx_payments_order, idx_payments_status, idx_payment_logs_payment

2. Create `supabase/migrations/002_extend_order_status.sql`:
   - Add columns to "order" table: estimated_pickup_time, actual_pickup_time, cancellation_reason, notes
   - Extend kakao_order enum to add: PREPARING, READY, COMPLETED, REFUNDED
   - Create `order_status_history` table with columns: id (PK), order_id (FK), from_status, to_status, changed_by (FK to profiles), notes, created_at
   - Add index: idx_status_history_order on (order_id, created_at DESC)

3. Create `supabase/migrations/004_rate_limiting.sql`:
   - Create `rate_limits` table with columns: id (PK), identifier (IP/user ID), action, count, window_start, created_at
   - Add unique constraint on (identifier, action, window_start)
   - Add index: idx_rate_limits_lookup
   - Create cleanup_old_rate_limits() function to delete records older than 1 hour

After creating these files, regenerate TypeScript types by running:
`npx supabase gen types typescript --local > database.types.ts`

Success criteria:
- All 3 migration files created
- No SQL syntax errors
- Types regenerated successfully
```

```
Phase 1-B: Implement Row-Level Security (RLS) policies

Create `supabase/migrations/003_enable_rls.sql` with comprehensive RLS policies:

1. profiles table:
   - Enable RLS
   - Policy: "Users can view own profile" - SELECT where auth.uid() = profile_id
   - Policy: "Users can update own profile" - UPDATE where auth.uid() = profile_id AND role = OLD.role (prevent role escalation)
   - Policy: "Public can view store profiles" - SELECT where role = 'owner'

2. menuItem table:
   - Enable RLS
   - Policy: "Anyone can view active menu items" - SELECT where isActive = true OR auth.uid() = profile_id
   - Policy: "Owners can manage own menu items" - ALL where auth.uid() = profile_id

3. categories table:
   - Enable RLS
   - Policy: "Anyone can view categories" - SELECT USING (true)
   - Policy: "Owners can manage own categories" - ALL where auth.uid() = profile_id

4. order table:
   - Enable RLS
   - Policy: "Customers can view own orders" - SELECT where phoneNumber IN (SELECT customernumber FROM profiles WHERE profile_id = auth.uid())
   - Policy: "Owners can view store orders" - SELECT where auth.uid() = profile_id
   - Policy: "Authenticated users can create orders" - INSERT WITH CHECK auth.uid() IS NOT NULL
   - Policy: "Owners can update own store orders" - UPDATE where auth.uid() = profile_id

5. orderitem table:
   - Enable RLS
   - Policy: Similar to order table, join with order table for access control

6. payments table:
   - Enable RLS
   - Policy: "Users can view payments for their orders" - SELECT where order_id IN (SELECT order_id FROM order WHERE profile_id = auth.uid() OR phoneNumber matches user's phone)

7. payment_logs and order_status_history tables:
   - Enable RLS
   - Service role only access

Test RLS by:
1. Creating a test customer account and verifying they can only see their orders
2. Creating a test owner account and verifying they can only see their store's data
3. Verifying cross-store data access is blocked
4. Verifying public can view menu items

Success criteria:
- All tables have RLS enabled
- All policies created without errors
- Security tests pass
```

### Success Criteria for Step 1:
- [ ] 4 migration files created
- [ ] All migrations run successfully
- [ ] database.types.ts regenerated
- [ ] RLS policies tested and working
- [ ] No unauthorized data access possible

---

## STEP 2: Input Validation & Rate Limiting
**Duration:** 1 week | **Priority:** P0 - CRITICAL

### Goal
모든 사용자 입력을 검증하고, API 남용을 방지하는 레이트 리미팅을 구현합니다.

### Prompt for Claude Code:

```
Phase 2-A: Create validation utilities with Zod schemas

Create `app/lib/validation.ts` with the following Zod schemas:

1. phoneNumberSchema:
   - Validate Korean phone number format: /^01[016789]-?\d{3,4}-?\d{4}$/
   - Transform to remove hyphens
   - Error message in Korean

2. menuItemSchema:
   - name: 1-100 chars, only Korean, English, numbers, -, ()
   - price: positive integer, max 1,000,000
   - description: optional, max 500 chars
   - category_id: UUID validation

3. orderItemSchema:
   - menuItemId: UUID
   - quantity: positive integer, max 99
   - price: positive number

4. createOrderSchema:
   - items: array of orderItemSchema, min 1, max 50
   - totalAmount: positive number, max 10,000,000
   - phoneNumber: use phoneNumberSchema

5. storeProfileSchema:
   - storename: 1-100 chars
   - storenumber: use phoneNumberSchema
   - store_description: optional, max 500 chars, check for script tags

6. sanitizeHtml function:
   - Replace <, >, ", ' with HTML entities
   - Prevent XSS attacks

Export all schemas and the sanitizeHtml function.

Success criteria:
- All schemas validate correctly
- Error messages are in Korean
- sanitizeHtml prevents basic XSS
```

```
Phase 2-B: Create rate limiting service

Create `app/lib/rate-limiter.server.ts` with rate limiting logic:

1. Define RateLimitAction type:
   - order_create, phone_update, menu_create, login_attempt, api_general

2. Define LIMITS configuration:
   - order_create: 10 requests per hour
   - phone_update: 5 requests per hour
   - menu_create: 100 requests per hour
   - login_attempt: 5 requests per 15 minutes
   - api_general: 100 requests per minute

3. Implement checkRateLimit function:
   - Parameters: identifier (IP or user ID), action, supabase client
   - Query rate_limits table for current count within time window
   - Return: { allowed: boolean, remaining: number, resetAt: Date }
   - If over limit, return allowed: false
   - Otherwise, upsert count increment

4. Implement withRateLimit helper:
   - Wrapper function for route actions
   - Extract IP from x-forwarded-for header
   - Call checkRateLimit
   - If not allowed, throw 429 Too Many Requests with Retry-After header
   - Otherwise, execute the provided function

Export checkRateLimit and withRateLimit.

Success criteria:
- Rate limiting logic correctly tracks requests
- 429 response when limit exceeded
- Retry-After header set correctly
```

```
Phase 2-C: Apply validation and rate limiting to routes

Modify the following files to add validation and rate limiting:

1. `app/routes/$name.tsx` (order creation action):
   - Import createOrderSchema from ~/lib/validation
   - Import withRateLimit from ~/lib/rate-limiter.server
   - Wrap action function with: return withRateLimit(request, 'order_create', async () => { ... })
   - Parse orderData from formData
   - Validate with createOrderSchema.safeParse()
   - If validation fails, return 400 with error details
   - Verify calculated total matches submitted totalAmount (within 0.01 tolerance)
   - If mismatch, return error: "금액이 일치하지 않습니다"
   - Continue with existing order creation logic

2. `app/routes/admin.tsx` (menu and profile updates):
   - Import menuItemSchema, storeProfileSchema from ~/lib/validation
   - Import withRateLimit from ~/lib/rate-limiter.server
   - In createMenuItem action:
     - Apply rate limiting: withRateLimit(request, 'menu_create', ...)
     - Validate menu data with menuItemSchema
     - Return 400 if validation fails
   - In updateStoreProfile action:
     - Validate with storeProfileSchema
     - Sanitize store_description with sanitizeHtml
     - Return 400 if validation fails

3. `app/routes/login.tsx` (login action):
   - Apply rate limiting: withRateLimit(request, 'login_attempt', ...)
   - This prevents brute force attacks

Success criteria:
- All user inputs validated
- Rate limiting applied to critical actions
- Appropriate error messages returned
- No breaking changes to existing functionality
```

### Success Criteria for Step 2:
- [ ] validation.ts created with all schemas
- [ ] rate-limiter.server.ts created and working
- [ ] $name.tsx has validation and rate limiting
- [ ] admin.tsx has validation and rate limiting
- [ ] Test: Submit invalid order data → 400 error
- [ ] Test: Exceed rate limit → 429 error

---

## STEP 3: Payment Integration (Toss Payments)
**Duration:** 2 weeks | **Priority:** P0 - CRITICAL

### Goal
Toss Payments를 통합하여 실제 결제 처리가 가능하도록 합니다.

### Prompt for Claude Code:

```
Phase 3-A: Set up Toss Payments SDK and service

1. Install Toss Payments SDK:
   Run: `npm install @tosspayments/payment-sdk`

2. Add environment variables to .env:
   ```
   TOSS_CLIENT_KEY=test_ck_xxxxx
   TOSS_SECRET_KEY=test_sk_xxxxx
   TOSS_SUCCESS_URL=http://localhost:5173/payment/success
   TOSS_FAIL_URL=http://localhost:5173/payment/fail
   ```

3. Create `app/lib/toss-payments.server.ts`:
   - Define TOSS_SECRET_KEY and TOSS_API_URL constants
   - Create TossPaymentsService class with constructor accepting supabase client
   - Implement confirmPayment(paymentKey, orderId, amount) method:
     - Call Toss API /payments/confirm with Basic auth
     - Log event to payment_logs table
     - Throw error if confirmation fails
     - Return payment data
   - Implement createPaymentRecord(orderId, amount, profileId) method:
     - Insert into payments table with status 'PENDING'
     - Generate toss_order_id: `ORDER_${orderId}_${Date.now()}`
     - Return created payment record
   - Implement updatePaymentRecord(paymentKey, tossData) method:
     - Update payments table with toss_payment_key, status 'COMPLETED', payment details
     - Extract card info, receipt URL from tossData
   - Implement logPaymentEvent(paymentId, eventType, eventData, httpStatus) method:
     - Insert into payment_logs table

Export TossPaymentsService class.

Success criteria:
- TossPaymentsService compiles without errors
- All methods properly typed
- Error handling in place
```

```
Phase 3-B: Create payment routes

Create three new routes for payment flow:

1. Create `app/routes/payment/checkout.tsx`:
   - Loader function:
     - Get orderId from query params
     - Fetch order with payments from database
     - Return: order, clientKey (env), successUrl (env), failUrl (env)
   - Component:
     - Use useLoaderData to get data
     - useEffect to load Toss Payments SDK
     - Call tossPayments.requestPayment('카드', { amount, orderId, orderName, customerName, successUrl, failUrl })
     - Display "결제 진행 중..." message

2. Create `app/routes/payment/success.tsx`:
   - Loader function:
     - Get paymentKey, orderId, amount from query params
     - Create TossPaymentsService instance
     - Call confirmPayment to verify with Toss API
     - Update payment record with updatePaymentRecord
     - Update order status to 'PENDING' (payment complete, awaiting store acceptance)
     - Send n8n webhook notification to store owner
     - Redirect to /customer/order-success?orderId=${orderId}
   - Error handling: redirect to /payment/fail on any error

3. Create `app/routes/payment/fail.tsx`:
   - Loader function:
     - Get error message from query params
     - Return { message }
   - Component:
     - Display error message
     - Provide "다시 시도" button that goes back to previous page

Success criteria:
- All three routes created
- Payment flow works in test mode
- Error handling robust
```

```
Phase 3-C: Integrate payment into existing order flow

Modify `app/routes/$name.tsx` action function:

1. After validating order data and creating order items:
   - Create order with status 'PAYMENT_PENDING' (NOT 'PENDING')
   - Insert into order table with profile_id, phoneNumber, totalAmount
   - Insert orderitem records
   - Get the created order_id

2. Create payment record:
   - Import TossPaymentsService
   - Create instance with supabase client
   - Call createPaymentRecord(order.order_id, order.totalAmount, storeProfile.profile_id)

3. Redirect to payment page:
   - return redirect(`/payment/checkout?orderId=${order.order_id}`)

4. Remove old direct order success logic (order should not complete without payment)

Update `app/routes/customer/order-success.tsx`:
- Fetch order with payment information
- Display payment method, amount, receipt link
- Display order details

Success criteria:
- Order flow: cart → validation → order creation → payment redirect → Toss → success/fail
- Orders only reach 'PENDING' status after payment completion
- Payment data stored correctly
- Receipt URL accessible
```

### Success Criteria for Step 3:
- [ ] @tosspayments/payment-sdk installed
- [ ] TossPaymentsService created
- [ ] 3 payment routes created
- [ ] $name.tsx redirects to payment
- [ ] Test payment flow works (sandbox mode)
- [ ] Orders require payment to proceed

---

## STEP 4: Extended Order Workflow & Status Management
**Duration:** 1 week | **Priority:** P0

### Goal
주문 상태를 확장하고(8단계), 사장님이 주문 진행 상황을 관리할 수 있도록 합니다.

### Prompt for Claude Code:

```
Phase 4-A: Create order status management service

Create `app/lib/order-status.server.ts`:

1. Define OrderStatus type:
   - Union of: 'PAYMENT_PENDING' | 'PENDING' | 'ACCEPT' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCEL' | 'REFUNDED'

2. Define STATUS_TRANSITIONS mapping:
   ```typescript
   const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
     PAYMENT_PENDING: ['PENDING', 'CANCEL'],
     PENDING: ['ACCEPT', 'CANCEL'],
     ACCEPT: ['PREPARING', 'CANCEL'],
     PREPARING: ['READY', 'CANCEL'],
     READY: ['COMPLETED'],
     COMPLETED: ['REFUNDED'],
     CANCEL: ['REFUNDED'],
     REFUNDED: [],
   };
   ```

3. Create OrderStatusManager class:
   - Constructor: accept supabase client
   - canTransition(from: OrderStatus, to: OrderStatus): boolean
     - Check if 'to' is in STATUS_TRANSITIONS[from]
   - async updateStatus(orderId, newStatus, userId, notes?):
     - Fetch current order status
     - Validate transition with canTransition
     - Throw error if invalid transition
     - Update order table with new status
     - Insert into order_status_history table
     - Return { success: true }

Export OrderStatusManager class.

Success criteria:
- All valid transitions allowed
- Invalid transitions blocked
- History tracking works
```

```
Phase 4-B: Update owner orders UI with status transitions

Modify `app/routes/owner.orders.tsx`:

1. Add new action intent 'updateStatus':
   - Get orderId, newStatus, notes from formData
   - Create OrderStatusManager instance
   - Call updateStatus method
   - If newStatus === 'READY', send notification to customer (n8n webhook)
   - If newStatus === 'PREPARING', send "조리 시작" notification
   - Return json({ success: true })

2. Update OrderDetailModal component:
   - Add status transition buttons based on current order status:
     - If status === 'PENDING': Show "주문 수락" button → ACCEPT
     - If status === 'ACCEPT': Show "조리 시작" button → PREPARING
     - If status === 'PREPARING': Show "픽업 준비 완료" button → READY
     - If status === 'READY': Show "완료" button → COMPLETED
     - All statuses: Show "취소" button → CANCEL
   - Add notes textarea for optional notes on status change
   - Use fetcher to submit status updates
   - Show loading state during update

3. Update order list display:
   - Add color-coded status badges:
     - PENDING: yellow
     - ACCEPT: blue
     - PREPARING: purple
     - READY: green
     - COMPLETED: gray
     - CANCEL/REFUNDED: red
   - Sort orders by status (active orders first)

4. Add status filter dropdown:
   - Filter options: All, Pending, In Progress (ACCEPT+PREPARING+READY), Completed, Cancelled
   - Update loader to filter by status

Success criteria:
- Status transitions work correctly
- Only valid transitions allowed
- Notifications sent on status changes
- UI shows appropriate buttons
- Status badges color-coded
```

```
Phase 4-C: Create customer order tracking page

Create `app/routes/customer/orders/$orderId.tsx`:

1. Loader function:
   - Get orderId from params
   - Fetch order with all relations: orderitem, menuItem, payments, profiles (store info)
   - Fetch order_status_history for timeline
   - Verify user has access to this order (via phone number match)
   - Return order data

2. Component:
   - Display order timeline with status history:
     - Show each status transition with timestamp
     - Visual timeline component (vertical line with dots)
     - Highlight current status
   - Show estimated pickup time (if PREPARING or READY)
   - Display order items with quantities and prices
   - Show total amount and payment status
   - Display store contact information
   - Add "문의하기" button (call store phone number)
   - If status is PENDING and order is < 5 minutes old:
     - Show "주문 취소" button

3. Add cancel order functionality:
   - Action function to handle cancellation
   - Update order status to 'CANCEL'
   - Initiate refund process (update payment status)
   - Send cancellation notification to store

Update `app/routes/customer/my-orders.tsx`:
- List all customer orders (fetch by phone number)
- Link each order to tracking page
- Show current status badge
- Sort by creation date DESC

Success criteria:
- Customer can track order status in real-time
- Timeline shows all status changes
- Cancel button works (with time restriction)
- Store contact info displayed
```

### Success Criteria for Step 4:
- [ ] OrderStatusManager created
- [ ] owner.orders.tsx updated with transitions
- [ ] Customer tracking page created
- [ ] Status history displayed
- [ ] Notifications sent on status changes
- [ ] Test full order flow: create → pay → accept → prepare → ready → complete

---

## STEP 5: GDPR Compliance & Legal Requirements
**Duration:** 1 week | **Priority:** P0

### Goal
GDPR 및 한국 개인정보보호법 준수를 위한 기능을 구현합니다.

### Prompt for Claude Code:

```
Phase 5-A: Create legal documents (Terms, Privacy Policy, Refund Policy)

Create the following three routes with basic legal content:

1. Create `app/routes/legal/terms.tsx`:
   - Create a comprehensive Terms of Service page
   - Include sections:
     - Service description and usage terms
     - User responsibilities (customers and restaurant owners)
     - Account termination conditions
     - Liability limitations
     - Dispute resolution process
     - Governing law (Korean law)
   - Use proper semantic HTML (h1, h2, sections)
   - Style with TailwindCSS for readability

2. Create `app/routes/legal/privacy.tsx`:
   - Create Privacy Policy page
   - Include sections:
     - What data we collect (email, phone, order history, payment info)
     - Purpose of data processing (order fulfillment, customer service)
     - Data retention periods (5 years for transaction records per Korean e-commerce law)
     - Third-party data sharing (Toss Payments, n8n, Supabase)
     - User rights (access, correction, deletion)
     - Contact information for privacy concerns
     - Security measures
     - Cookie usage
   - IMPORTANT: Add notice about legal consultation recommended
   - Link to data export/deletion page

3. Create `app/routes/legal/refund.tsx`:
   - Create Refund Policy page
   - Include sections:
     - Refund eligibility (within 5 minutes of order, before store acceptance)
     - Refund process (automatic via Toss Payments)
     - Refund timeline (3-5 business days)
     - Non-refundable conditions (after order accepted)
     - Contact for refund issues

Update `app/routes/login.tsx` and `app/routes/join.tsx`:
- Make links to /legal/terms and /legal/privacy functional
- Add checkboxes for required consent (terms) and optional consent (marketing)
- Validate consent before allowing signup

Success criteria:
- All 3 legal pages created
- Readable, well-structured content
- Links functional from login/signup
```

```
Phase 5-B: Implement data export and account deletion

Create `app/routes/account/data.tsx`:

1. Loader function:
   - Require authentication
   - Display two options: Export Data, Delete Account
   - Show warnings about account deletion

2. Action function with two intents:

   Intent 'export':
   - Fetch all user data:
     - Profile (email, name, phone, role)
     - All orders with orderitem, payments
     - Store data if user is owner (storename, menu items, categories)
   - Create JSON export: { profile, orders, store }
   - Return as downloadable JSON file
   - Headers: Content-Disposition: attachment; filename="my-data-{timestamp}.json"

   Intent 'delete':
   - SOFT DELETE: Anonymize personal data (keep order records for legal compliance)
   - Update profiles table:
     - email → `deleted_{user_id}@deleted.com`
     - name → '[삭제된 사용자]'
     - customernumber → null
     - store_description → null
   - Delete user from Supabase Auth: supabase.auth.admin.deleteUser(user.id)
   - Show 14-day recovery period notice (implement recovery mechanism)
   - Redirect to homepage with logout

3. Component:
   - Display data export button with description
   - Display account deletion section with:
     - Warning about irreversible action
     - Explanation of what data is deleted vs. retained
     - Confirmation modal with "type DELETE to confirm" input
     - Final "Delete My Account" button

Add link to this page in user profile/settings menu.

Success criteria:
- Export downloads complete user data as JSON
- Account deletion anonymizes personal info
- Legal data retained for 5 years
- Confirmation required for deletion
```

```
Phase 5-C: Add cookie consent banner

1. Create `app/components/CookieConsent.tsx`:
   - useState to track if banner should be shown
   - useEffect to check localStorage for 'cookie-consent'
   - If no consent stored, show banner
   - Component displays fixed bottom banner with:
     - Message: "이 사이트는 쿠키를 사용합니다."
     - Link to /legal/privacy
     - "동의" button
   - On accept: store 'accepted' in localStorage, hide banner
   - Style as fixed bottom bar with dark background, white text

2. Update `app/root.tsx`:
   - Import CookieConsent component
   - Add <CookieConsent /> before closing </body> tag
   - Ensure it appears on all pages

3. Optional: Add cookie preferences page
   - Create `app/routes/legal/cookies.tsx`
   - Allow users to manage cookie preferences
   - Categories: Essential (always on), Analytics (optional)

Success criteria:
- Cookie banner shows on first visit
- Consent stored in localStorage
- Banner doesn't show after acceptance
- Privacy policy link works
```

```
Phase 5-D: Update signup flow with consent tracking

Modify `app/routes/join.tsx`:

1. Add consent checkboxes:
   - Required: "이용약관 동의" (link to /legal/terms) - MUST be checked
   - Required: "개인정보 처리방침 동의" (link to /legal/privacy) - MUST be checked
   - Optional: "마케팅 정보 수신 동의" - can be unchecked

2. Validate consent before signup:
   - Check that required consents are true
   - Return error if not agreed

3. Store consent in database:
   - Add columns to profiles table (if not exists):
     - terms_agreed_at TIMESTAMPTZ
     - privacy_agreed_at TIMESTAMPTZ
     - marketing_consent BOOLEAN
   - Save timestamps when user signs up

4. Update database migration:
   - Create `supabase/migrations/005_consent_tracking.sql`
   - Add consent columns to profiles table

Success criteria:
- Cannot signup without required consents
- Consent timestamps stored
- Marketing consent optional
- Clear links to legal documents
```

### Success Criteria for Step 5:
- [ ] 3 legal pages created (terms, privacy, refund)
- [ ] Data export works
- [ ] Account deletion anonymizes data
- [ ] Cookie consent banner shows
- [ ] Consent tracked in database
- [ ] All GDPR requirements met

---

## 📋 Final Verification Checklist

After completing all 5 steps, verify the following:

### Security
- [ ] RLS enabled on all tables
- [ ] All user inputs validated with Zod
- [ ] Rate limiting applied to critical actions
- [ ] XSS prevention in place
- [ ] No SQL injection vulnerabilities

### Payment
- [ ] Toss Payments integration works (test mode)
- [ ] Payment confirmation successful
- [ ] Payment logs created
- [ ] Receipt URL accessible
- [ ] Orders require payment

### Order Workflow
- [ ] 8 status states implemented
- [ ] Valid transitions only
- [ ] Status history tracked
- [ ] Customer can track orders
- [ ] Store owner can manage statuses

### GDPR Compliance
- [ ] Terms of Service exists
- [ ] Privacy Policy exists
- [ ] Refund Policy exists
- [ ] Data export works
- [ ] Account deletion works
- [ ] Cookie consent banner shows
- [ ] Consent tracked

### Functionality
- [ ] Customer can order and pay
- [ ] Store owner can accept/manage orders
- [ ] Real-time notifications work
- [ ] Email and Kakao login work
- [ ] Menu management works
- [ ] No breaking changes to existing features

---

## 🎉 Success! Next Steps

After Phase 1 completion, you'll have:
- ✅ Production-ready payment system
- ✅ Enterprise-grade security
- ✅ Complete order management
- ✅ GDPR compliance
- ✅ Commercial viability

**Ready for Phase 2:** Customer experience enhancements
- Customer order history
- Operating hours management
- Delivery/pickup options
- Reviews and ratings
- Inventory management
- Analytics dashboard

---

## 💡 Usage Instructions

각 STEP의 프롬프트를 Claude Code에 순차적으로 복사하여 실행하세요:

1. **STEP 1 프롬프트 전체 복사** → Claude Code에 붙여넣기 → 완료 대기
2. 완료 후 테스트 및 검증
3. **STEP 2 프롬프트 전체 복사** → 실행
4. 이런 식으로 STEP 5까지 진행

각 단계는 독립적으로 실행 가능하며, 이전 단계가 완료되어야 다음 단계로 진행할 수 있습니다.

#### 1.1 결제 시스템 통합 ⭐️ CRITICAL
**현재 문제**:
- 결제 처리 완전 부재
- 주문이 돈 거래 없이 진행됨
- 거래 기록 없음

**요구사항**:
1. **결제 게이트웨이 선택 및 통합**
   - 한국 시장: Toss Payments, Portone(구 아임포트), KG이니시스
   - 권장: **Toss Payments** (간편한 API, 한국 시장 최적화)
   - 지원 결제 수단:
     - 카드 결제 (신용/체크)
     - 카카오페이
     - 네이버페이
     - 토스페이
     - 간편 계좌이체

2. **Database Schema 추가**
   ```sql
   -- payments 테이블
   - payment_id (PK)
   - order_id (FK)
   - amount (정수, 원 단위)
   - payment_method (enum: CARD, KAKAOPAY, NAVERPAY, TOSSPAY, TRANSFER)
   - payment_status (enum: PENDING, COMPLETED, FAILED, REFUNDED, PARTIAL_REFUND)
   - payment_key (PG사 거래 고유키)
   - pg_transaction_id
   - receipt_url
   - failed_reason (nullable)
   - created_at, updated_at

   -- refunds 테이블
   - refund_id (PK)
   - payment_id (FK)
   - refund_amount
   - refund_reason
   - refund_status (enum: PENDING, COMPLETED, FAILED)
   - requested_by (FK to profiles)
   - requested_at
   - completed_at
   ```

3. **주문 흐름 수정**
   - 기존: 주문 → 즉시 DB 저장 → 사장님 확인
   - 신규: 주문 → 결제 진행 → **결제 성공 시에만** DB 저장 → 사장님 확인

4. **구현 파일**
   - `/app/routes/$name.tsx`: 결제 버튼 추가, 결제 모달
   - `/app/routes/payment/callback.tsx`: 결제 승인 콜백 처리
   - `/app/routes/payment/fail.tsx`: 결제 실패 페이지
   - `/app/lib/payment.server.ts`: 결제 로직 추상화
   - `/app/routes/admin/payments.tsx`: 결제 내역 조회 (사장님용)

5. **영수증 및 세금계산서**
   - 자동 영수증 발급 (PG사 연동)
   - 주문 상세에서 영수증 다운로드

6. **보안 고려사항**
   - 결제 금액 서버 검증 (클라이언트 변조 방지)
   - PG사 webhook 서명 검증
   - 멱등성 키(idempotency key) 구현

---

#### 1.2 보안 강화 - Row Level Security (RLS) ⭐️ CRITICAL
**현재 문제**:
- Supabase RLS 미구현
- 애플리케이션 레벨 필터링만 존재
- 직접 API 호출 시 데이터 노출 위험

**요구사항**:
1. **Supabase RLS 정책 설정**
   ```sql
   -- profiles 테이블
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view own profile"
   ON profiles FOR SELECT
   USING (auth.uid() = profile_id);

   CREATE POLICY "Users can update own profile"
   ON profiles FOR UPDATE
   USING (auth.uid() = profile_id);

   -- menuItem 테이블
   ALTER TABLE "menuItem" ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Anyone can view active menu items"
   ON "menuItem" FOR SELECT
   USING (true);

   CREATE POLICY "Owners can manage own menu items"
   ON "menuItem" FOR ALL
   USING (auth.uid() = profile_id);

   -- order 테이블
   ALTER TABLE "order" ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Owners can view own store orders"
   ON "order" FOR SELECT
   USING (auth.uid() = profile_id);

   CREATE POLICY "Customers can view own orders"
   ON "order" FOR SELECT
   USING (
     EXISTS (
       SELECT 1 FROM profiles
       WHERE profiles.profile_id = auth.uid()
       AND profiles.customernumber = "order".phoneNumber
     )
   );

   CREATE POLICY "Owners can update own store orders"
   ON "order" FOR UPDATE
   USING (auth.uid() = profile_id);

   -- categories 테이블
   ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Anyone can view categories"
   ON categories FOR SELECT
   USING (true);

   CREATE POLICY "Owners can manage own categories"
   ON categories FOR ALL
   USING (auth.uid() = profile_id);
   ```

2. **마이그레이션 파일 생성**
   - `/supabase/migrations/001_enable_rls.sql`
   - 버전 관리 및 롤백 가능하도록

3. **RLS 정책 테스트**
   - 단위 테스트로 각 정책 검증
   - 권한 없는 접근 시도 차단 확인

---

#### 1.3 입력 검증 및 보안 강화
**현재 문제**:
- 최소한의 검증만 존재
- XSS, SQL Injection 위험
- 레이트 리미팅 없음

**요구사항**:

1. **Zod 스키마 확장**
   ```typescript
   // app/lib/validation.ts (신규 생성)

   export const menuItemSchema = z.object({
     name: z.string()
       .min(1, "메뉴 이름은 필수입니다")
       .max(100, "메뉴 이름은 100자 이하여야 합니다")
       .regex(/^[가-힣a-zA-Z0-9\s\-()]+$/, "특수문자는 -, ()만 허용됩니다"),
     price: z.number()
       .int("가격은 정수여야 합니다")
       .positive("가격은 0보다 커야 합니다")
       .max(1000000, "가격은 100만원 이하여야 합니다"),
     description: z.string()
       .max(500, "설명은 500자 이하여야 합니다")
       .optional(),
     category_id: z.string().uuid(),
   });

   export const orderItemSchema = z.object({
     menuItemId: z.string().uuid(),
     quantity: z.number()
       .int()
       .positive()
       .max(99, "수량은 99개 이하여야 합니다"),
   });

   export const orderSchema = z.object({
     items: z.array(orderItemSchema)
       .min(1, "최소 1개 이상의 메뉴를 선택해야 합니다")
       .max(50, "한 번에 50개 이하의 메뉴만 주문 가능합니다"),
     totalAmount: z.number()
       .positive()
       .max(10000000, "총 금액은 1000만원 이하여야 합니다"),
   });

   export const phoneNumberSchema = z.string()
     .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "올바른 전화번호 형식이 아닙니다");

   export const storeDescriptionSchema = z.string()
     .max(500, "설명은 500자 이하여야 합니다")
     .refine(
       (val) => !/<script|javascript:|onerror=/i.test(val),
       "허용되지 않는 스크립트가 포함되어 있습니다"
     );
   ```

2. **이미지 업로드 검증 강화**
   ```typescript
   // app/lib/image-validation.ts

   const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
   const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
   const MIN_DIMENSION = 200;
   const MAX_DIMENSION = 4000;

   export async function validateImage(file: File) {
     // MIME 타입 검증
     if (!ALLOWED_MIME_TYPES.includes(file.type)) {
       throw new Error("JPEG, PNG, WebP 형식만 지원합니다");
     }

     // 파일 크기 검증
     if (file.size > MAX_FILE_SIZE) {
       throw new Error("파일 크기는 5MB 이하여야 합니다");
     }

     // 이미지 차원 검증 (브라우저)
     const img = new Image();
     const url = URL.createObjectURL(file);

     return new Promise((resolve, reject) => {
       img.onload = () => {
         URL.revokeObjectURL(url);
         if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
           reject(new Error("이미지는 최소 200x200px 이상이어야 합니다"));
         }
         if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
           reject(new Error("이미지는 최대 4000x4000px 이하여야 합니다"));
         }
         resolve(true);
       };
       img.onerror = () => {
         URL.revokeObjectURL(url);
         reject(new Error("유효하지 않은 이미지 파일입니다"));
       };
       img.src = url;
     });
   }
   ```

3. **Rate Limiting 구현**
   ```typescript
   // app/lib/rate-limit.server.ts

   import { createClient } from '@supabase/supabase-js';

   // Upstash Redis 또는 Supabase Edge Functions 활용

   const RATE_LIMITS = {
     order: { requests: 5, window: 60 }, // 1분당 5회 주문
     login: { requests: 5, window: 300 }, // 5분당 5회 로그인 시도
     api: { requests: 100, window: 60 }, // 1분당 100회 API 호출
   };

   export async function checkRateLimit(
     identifier: string, // IP or user ID
     action: keyof typeof RATE_LIMITS
   ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
     // Redis 기반 토큰 버킷 또는 슬라이딩 윈도우 구현
     // 또는 Supabase Edge Functions의 Deno KV 활용
   }
   ```

4. **XSS 방지**
   - React는 기본적으로 XSS 방지하지만, `dangerouslySetInnerHTML` 사용 금지
   - 사용자 입력 텍스트는 DOMPurify로 sanitize
   - CSP(Content Security Policy) 헤더 설정

5. **CSRF 방지**
   - Supabase Auth는 기본적으로 CSRF 토큰 처리
   - Form action에 CSRF 토큰 추가 검증

---

#### 1.4 주문 상태 워크플로우 완성
**현재 문제**:
- PENDING → ACCEPT만 존재
- 고객에게 진행 상황 알림 없음
- CANCEL 상태 미구현

**요구사항**:

1. **확장된 주문 상태**
   ```typescript
   // database.types.ts 수정

   export type OrderStatus =
     | "PAYMENT_PENDING"    // 결제 대기 중
     | "PAYMENT_FAILED"     // 결제 실패
     | "PENDING"            // 주문 접수 대기 (결제 완료)
     | "ACCEPTED"           // 사장님 수락
     | "PREPARING"          // 조리 중
     | "READY"              // 픽업 준비 완료
     | "COMPLETED"          // 완료
     | "CANCELLED_BY_CUSTOMER"  // 고객 취소
     | "CANCELLED_BY_STORE"     // 가게 취소
     | "REFUNDED";          // 환불 완료
   ```

2. **상태 전환 규칙**
   ```
   PAYMENT_PENDING → PAYMENT_FAILED (결제 실패 시)
   PAYMENT_PENDING → PENDING (결제 성공 시)
   PENDING → ACCEPTED (사장님 수락)
   PENDING → CANCELLED_BY_STORE (사장님 거부, 30분 이내)
   ACCEPTED → PREPARING (조리 시작)
   PREPARING → READY (조리 완료)
   READY → COMPLETED (고객 픽업 완료)

   PENDING → CANCELLED_BY_CUSTOMER (주문 후 5분 이내)
   ACCEPTED → CANCELLED_BY_CUSTOMER (불가, 환불 요청만 가능)

   CANCELLED_BY_* → REFUNDED (환불 처리 완료)
   ```

3. **상태 변경 API**
   ```typescript
   // app/routes/api/orders/$orderId/status.tsx

   export async function action({ request, params }: ActionFunctionArgs) {
     const user = await requireAuth(request);
     const { orderId } = params;
     const { newStatus, reason } = await request.json();

     // 1. 권한 검증
     // 2. 현재 상태 확인
     // 3. 유효한 전환인지 검증
     // 4. 상태 업데이트
     // 5. 고객/사장님에게 알림 발송
     // 6. 환불이 필요한 경우 환불 처리
   }
   ```

4. **고객 알림 통합**
   - 카카오 알림톡 (주문 접수, 조리 시작, 픽업 준비 완료)
   - SMS 대체 발송
   - 웹 푸시 알림 (옵션)

---

#### 1.5 GDPR 및 개인정보 보호
**현재 문제**:
- 약관 링크만 존재, 실제 문서 없음
- 데이터 삭제 메커니즘 없음
- 쿠키 동의 없음

**요구사항**:

1. **법적 문서 작성**
   - `/app/routes/legal/terms.tsx`: 이용약관
   - `/app/routes/legal/privacy.tsx`: 개인정보 처리방침
   - `/app/routes/legal/refund.tsx`: 환불 정책

   내용 포함:
   - 수집하는 개인정보 항목 (이메일, 전화번호, 주문 내역)
   - 개인정보 보유 기간 (전자상거래법: 5년)
   - 제3자 제공 (PG사, n8n)
   - 회원 탈퇴 및 데이터 삭제 권리

2. **쿠키 동의 배너**
   ```typescript
   // app/components/CookieConsent.tsx

   - 필수 쿠키: 인증, 세션
   - 선택 쿠키: 분석 (Google Analytics)
   - 동의 여부 localStorage 저장
   ```

3. **데이터 삭제 기능**
   ```typescript
   // app/routes/settings/delete-account.tsx

   - 계정 삭제 요청
   - 14일 대기 기간 (복구 가능)
   - 주문 데이터는 법적 의무로 5년간 익명화 보관
   - 개인정보(이메일, 전화번호)는 즉시 삭제
   ```

4. **데이터 내보내기**
   ```typescript
   // app/routes/settings/export-data.tsx

   - JSON 형식으로 모든 개인 데이터 다운로드
   - 주문 내역, 프로필 정보 포함
   ```

5. **개인정보 수집 동의**
   - 회원가입 시 약관 동의 체크박스 (필수/선택 구분)
   - 전화번호 수집 시 별도 동의 (customer/phone.tsx)
   - 마케팅 수신 동의 (옵션)

---

### Phase 2: Core User Experience (P1)
**예상 기간**: 4-5주
**목표**: 고객과 사장님 모두에게 완전한 경험 제공

#### 2.1 고객 주문 내역 및 추적
**요구사항**:

1. **고객 마이페이지**
   ```typescript
   // app/routes/customer/my-orders.tsx

   - 모든 주문 내역 표시 (최신순)
   - 주문 상태별 필터링 (진행 중, 완료, 취소)
   - 무한 스크롤 또는 페이지네이션
   - 각 주문 클릭 시 상세 보기
   ```

2. **실시간 주문 추적**
   ```typescript
   // app/routes/customer/orders/$orderId.tsx

   - 주문 상태 타임라인 UI
   - Supabase Realtime으로 실시간 업데이트
   - 예상 픽업 시간 표시
   - 가게 전화번호 (문의용)
   ```

3. **주문 취소 기능**
   ```typescript
   // 조건:
   - 주문 후 5분 이내
   - 상태가 PENDING일 때만
   - 취소 사유 입력 (선택)
   - 자동 환불 처리
   ```

4. **재주문 기능**
   - 과거 주문에서 "다시 주문하기" 버튼
   - 장바구니에 동일 아이템 자동 추가

---

#### 2.2 가게 운영시간 관리
**요구사항**:

1. **Database Schema**
   ```sql
   CREATE TABLE operating_hours (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     profile_id UUID REFERENCES profiles(profile_id) ON DELETE CASCADE,
     day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
     -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
     open_time TIME NOT NULL,
     close_time TIME NOT NULL,
     is_closed BOOLEAN DEFAULT false,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(profile_id, day_of_week)
   );

   CREATE TABLE special_hours (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     profile_id UUID REFERENCES profiles(profile_id) ON DELETE CASCADE,
     date DATE NOT NULL,
     open_time TIME,
     close_time TIME,
     is_closed BOOLEAN DEFAULT false,
     reason TEXT, -- "공휴일", "휴가" 등
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(profile_id, date)
   );
   ```

2. **관리자 설정 UI**
   ```typescript
   // app/routes/admin/operating-hours.tsx

   - 요일별 운영시간 설정
   - 휴무일 지정
   - 특정 날짜 임시 휴업 설정
   - 브레이크 타임 설정 (선택)
   ```

3. **고객 주문 페이지 검증**
   ```typescript
   // app/routes/$name.tsx

   - 현재 시간이 운영시간 내인지 확인
   - 운영시간 외: 주문 버튼 비활성화 + "영업시간: 10:00 - 22:00" 표시
   - 임시 휴업 중: "금일 휴무" 표시
   ```

4. **자동 주문 마감**
   - 마감 시간 30분 전부터 "곧 마감" 배지 표시
   - 마감 시간 자동으로 신규 주문 차단

---

#### 2.3 픽업/배달 옵션
**요구사항**:

1. **Database Schema**
   ```sql
   ALTER TABLE profiles ADD COLUMN delivery_enabled BOOLEAN DEFAULT false;
   ALTER TABLE profiles ADD COLUMN delivery_fee INT DEFAULT 0;
   ALTER TABLE profiles ADD COLUMN min_delivery_amount INT DEFAULT 0;

   ALTER TABLE "order" ADD COLUMN order_type VARCHAR(10) CHECK (order_type IN ('PICKUP', 'DELIVERY'));
   ALTER TABLE "order" ADD COLUMN delivery_address TEXT;
   ALTER TABLE "order" ADD COLUMN delivery_detail_address TEXT;
   ALTER TABLE "order" ADD COLUMN delivery_request TEXT;
   ALTER TABLE "order" ADD COLUMN estimated_pickup_time TIMESTAMPTZ;
   ```

2. **주문 시 선택**
   ```typescript
   // app/routes/$name.tsx

   - 라디오 버튼: 픽업 / 배달 선택
   - 배달 선택 시:
     - 주소 입력 (Kakao 주소 API)
     - 상세 주소
     - 요청사항
     - 배달비 자동 계산
     - 최소 주문 금액 검증
   - 픽업 선택 시:
     - 픽업 시간 선택 (15분 단위, 현재 시간 + 30분부터)
   ```

3. **관리자 설정**
   ```typescript
   // app/routes/admin/settings.tsx

   - 배달 서비스 활성화 토글
   - 배달비 설정
   - 최소 주문 금액 설정
   - 배달 가능 반경 (추후 지도 연동)
   ```

---

#### 2.4 리뷰 및 평점 시스템
**요구사항**:

1. **Database Schema**
   ```sql
   CREATE TABLE reviews (
     review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     order_id UUID REFERENCES "order"(order_id) ON DELETE CASCADE UNIQUE,
     profile_id UUID REFERENCES profiles(profile_id) ON DELETE CASCADE,
     customer_id UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
     rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
     comment TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_reviews_profile ON reviews(profile_id);
   CREATE INDEX idx_reviews_rating ON reviews(rating);
   ```

2. **리뷰 작성**
   ```typescript
   // app/routes/customer/orders/$orderId/review.tsx

   - 주문 완료 상태에서만 작성 가능
   - 1회만 작성 가능 (수정 가능)
   - 별점 1-5
   - 텍스트 리뷰 (선택, 최대 500자)
   - 작성 후 토스트: "리뷰 작성 완료!"
   ```

3. **리뷰 표시**
   ```typescript
   // app/routes/$name.tsx

   - 가게 상단에 평균 별점 표시 (현재 하드코딩된 4.8 대체)
   - "리뷰 보기" 버튼 → 리뷰 목록 모달
   - 최신순, 별점순 정렬
   - 페이지네이션 (20개씩)
   ```

4. **관리자 리뷰 관리**
   ```typescript
   // app/routes/admin/reviews.tsx

   - 모든 리뷰 조회
   - 별점 통계 (5점: X개, 4점: Y개 ...)
   - 부적절한 리뷰 신고 (향후 기능)
   ```

---

#### 2.5 재고 관리
**요구사항**:

1. **Database Schema**
   ```sql
   ALTER TABLE "menuItem" ADD COLUMN stock_enabled BOOLEAN DEFAULT false;
   ALTER TABLE "menuItem" ADD COLUMN stock_quantity INT DEFAULT 0;
   ALTER TABLE "menuItem" ADD COLUMN low_stock_threshold INT DEFAULT 5;
   ```

2. **관리자 UI**
   ```typescript
   // app/routes/admin.tsx (메뉴 수정 모달에 추가)

   - "재고 관리 활성화" 체크박스
   - 현재 재고 수량 입력
   - 품절 임계값 설정
   - 재고 부족 시 자동 품절 처리 옵션
   ```

3. **주문 시 재고 차감**
   ```typescript
   // app/routes/$name.tsx action

   1. 트랜잭션 시작
   2. 각 주문 항목의 재고 확인
   3. 재고 부족 시 에러 반환: "죄송합니다. [메뉴명]의 재고가 부족합니다"
   4. 재고 차감
   5. 주문 생성
   6. 트랜잭션 커밋

   // 주문 취소 시 재고 복구
   ```

4. **재고 알림**
   - 재고가 임계값 이하로 떨어지면 사장님에게 알림
   - 자동으로 isActive = false 처리 옵션

---

#### 2.6 분석 및 리포팅 (사장님용)
**요구사항**:

1. **Dashboard 구현**
   ```typescript
   // app/routes/admin/dashboard.tsx (신규)

   핵심 지표 (KPI Cards):
   - 오늘 매출
   - 오늘 주문 수
   - 평균 주문 금액
   - 이번 달 누적 매출

   차트:
   - 지난 7일 매출 추이 (라인 차트)
   - 시간대별 주문 분포 (바 차트)
   - 인기 메뉴 Top 5 (파이 차트)

   라이브러리: Recharts 또는 Chart.js
   ```

2. **리포트 페이지**
   ```typescript
   // app/routes/admin/reports.tsx (현재 # 링크 대체)

   필터:
   - 날짜 범위 선택
   - 주문 상태별 필터

   리포트 항목:
   - 총 매출
   - 총 주문 수
   - 평균 주문 금액
   - 취소율
   - 메뉴별 판매 수량
   - 시간대별 매출

   내보내기:
   - CSV 다운로드
   - Excel 다운로드 (xlsx)
   ```

3. **Database 최적화**
   ```sql
   -- 분석 쿼리 성능을 위한 인덱스
   CREATE INDEX idx_order_created_at ON "order"(createdat);
   CREATE INDEX idx_order_status ON "order"(status);
   CREATE INDEX idx_order_profile_status ON "order"(profile_id, status, createdat);
   CREATE INDEX idx_orderitem_menuitem ON orderitem(menuItemId);
   ```

---

### Phase 3: Platform Features (P2)
**예상 기간**: 3-4주
**목표**: 경쟁력 있는 플랫폼 기능

#### 3.1 가게 검색 및 발견
**요구사항**:

1. **홈페이지 개편**
   ```typescript
   // app/routes/_index.tsx

   현재: 단순 배너
   신규:
   - 헤더: 로고, 검색바, 로그인/마이페이지
   - 히어로 섹션: "내 가게를 온라인으로" CTA
   - 인기 가게 섹션 (평점순 Top 12)
   - 최근 오픈한 가게 (신규 가입순)
   - 카테고리별 탐색 (한식, 중식, 일식, 카페 등)
   - 푸터: 회사 정보, 약관, 문의
   ```

2. **가게 목록 페이지**
   ```typescript
   // app/routes/stores.tsx

   - 그리드 레이아웃 (카드형)
   - 각 카드: 가게 이미지, 이름, 평점, 대표 메뉴 3개
   - 필터: 카테고리, 배달 가능, 영업 중
   - 정렬: 인기순, 평점순, 신규순
   - 검색 기능
   ```

3. **검색 기능**
   ```typescript
   // app/routes/api/search.tsx

   - 가게 이름 검색
   - 메뉴 검색 (전체 가게의 메뉴)
   - PostgreSQL Full-Text Search 활용
   - 자동완성 (Autocomplete)
   ```

4. **Database Schema**
   ```sql
   ALTER TABLE profiles ADD COLUMN category VARCHAR(50);
   -- 카테고리: 한식, 중식, 일식, 양식, 카페, 디저트, 치킨, 피자 등

   CREATE INDEX idx_profiles_category ON profiles(category);

   -- Full-text search 인덱스
   ALTER TABLE profiles ADD COLUMN search_vector tsvector;
   CREATE INDEX idx_profiles_search ON profiles USING GIN(search_vector);
   ```

---

#### 3.2 다중 사용자 및 권한 관리
**요구사항**:

1. **역할 확장**
   ```typescript
   // database.types.ts

   export type UserRole =
     | "customer"
     | "owner"
     | "staff"      // 신규: 직원
     | "admin";     // 신규: 플랫폼 관리자

   export type StaffPermission =
     | "view_orders"
     | "manage_orders"
     | "view_menu"
     | "manage_menu"
     | "view_reports"
     | "manage_settings";
   ```

2. **Database Schema**
   ```sql
   CREATE TABLE staff_members (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     store_profile_id UUID REFERENCES profiles(profile_id) ON DELETE CASCADE,
     staff_profile_id UUID REFERENCES profiles(profile_id) ON DELETE CASCADE,
     permissions TEXT[] DEFAULT '{}',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(store_profile_id, staff_profile_id)
   );
   ```

3. **직원 초대 기능**
   ```typescript
   // app/routes/admin/staff.tsx

   - 이메일로 직원 초대
   - 권한 체크박스 선택
   - 초대 수락 링크 발송
   - 직원 목록 및 권한 수정
   - 직원 제거
   ```

4. **권한 검증 미들웨어**
   ```typescript
   // app/lib/permissions.server.ts

   export async function requirePermission(
     request: Request,
     permission: StaffPermission
   ) {
     const user = await requireAuth(request);
     // 권한 확인 로직
   }
   ```

---

#### 3.3 고객 지원 및 문의
**요구사항**:

1. **가게별 문의 기능**
   ```typescript
   // app/routes/$name/contact.tsx

   - 간단한 문의 폼
   - 이메일 또는 Supabase 메시지로 전송
   - 사장님 대시보드에서 확인
   ```

2. **FAQ 페이지**
   ```typescript
   // app/routes/faq.tsx

   - 고객용 FAQ
   - 사장님용 FAQ
   - 검색 기능
   ```

3. **헬프 센터**
   ```typescript
   // app/routes/help.tsx

   - 주문 방법
   - 결제 문제
   - 환불 방법
   - 가게 등록 방법
   ```

---

#### 3.4 개선된 온보딩
**요구사항**:

1. **사장님 온보딩 마법사**
   ```typescript
   // app/routes/onboarding/welcome.tsx

   단계별 가이드:
   1. 환영 페이지
   2. 가게 정보 입력 (이름, 전화번호, 카테고리)
   3. 가게 이미지 업로드
   4. 첫 메뉴 3개 등록
   5. 운영시간 설정
   6. 결제 정보 연동
   7. 완료! 가게 페이지 미리보기

   - 진행률 표시 (1/7)
   - "나중에 하기" 옵션
   - 완료 후 체크리스트 제공
   ```

2. **샘플 데이터**
   - 새 가게에 샘플 메뉴 자동 생성 (선택)
   - "샘플입니다" 워터마크
   - 쉽게 삭제 가능

3. **튜토리얼 투어**
   - react-joyride 라이브러리 사용
   - 첫 로그인 시 주요 기능 안내
   - "투어 건너뛰기" 옵션

---

### Phase 4: Technical Excellence (P2-P3)
**예상 기간**: 2-3주
**목표**: 안정성, 성능, 유지보수성

#### 4.1 에러 처리 및 모니터링
**요구사항**:

1. **Error Boundary 구현**
   ```typescript
   // app/components/ErrorBoundary.tsx

   - 전역 에러 바운더리
   - 로컬 에러 바운더리 (섹션별)
   - 사용자 친화적 에러 메시지
   - 에러 리포팅 버튼
   ```

2. **Sentry 통합**
   ```typescript
   // app/lib/monitoring.ts

   import * as Sentry from "@sentry/remix";

   - 프론트엔드 에러 추적
   - 백엔드 에러 추적
   - 성능 모니터링
   - 사용자 피드백 수집
   ```

3. **구조화된 로깅**
   ```typescript
   // app/lib/logger.server.ts

   import winston from 'winston';

   export const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || 'info',
     format: winston.format.json(),
     transports: [
       new winston.transports.File({ filename: 'error.log', level: 'error' }),
       new winston.transports.File({ filename: 'combined.log' }),
     ],
   });

   // 사용:
   logger.info('Order created', { orderId, userId, amount });
   logger.error('Payment failed', { error, orderId });
   ```

4. **헬스 체크 엔드포인트**
   ```typescript
   // app/routes/api/health.tsx

   export async function loader() {
     const checks = {
       database: await checkDatabaseConnection(),
       supabase: await checkSupabaseConnection(),
       payment: await checkPaymentGateway(),
     };

     const isHealthy = Object.values(checks).every(c => c.status === 'ok');

     return json(checks, {
       status: isHealthy ? 200 : 503,
     });
   }
   ```

---

#### 4.2 성능 최적화
**요구사항**:

1. **이미지 최적화**
   ```typescript
   // app/lib/image-optimizer.ts

   - Sharp 라이브러리로 서버 사이드 리사이징
   - WebP 변환
   - 썸네일 자동 생성 (200x200, 400x400)
   - Lazy loading 적용
   - srcset으로 반응형 이미지
   ```

2. **Database 쿼리 최적화**
   ```typescript
   // 현재 N+1 쿼리 문제 해결

   // app/routes/$name.tsx
   - 메뉴 아이템 + 카테고리를 JOIN으로 한 번에 가져오기
   - 불필요한 필드 제외 (select specific columns)

   // app/routes/owner.orders.tsx
   - 주문 + 주문 아이템 + 메뉴 정보를 한 쿼리로
   - 페이지네이션 최적화 (LIMIT/OFFSET → cursor-based)
   ```

3. **캐싱 전략**
   ```typescript
   // app/lib/cache.server.ts

   - Redis 또는 Upstash 연동
   - 메뉴 데이터 캐싱 (5분)
   - 가게 정보 캐싱 (10분)
   - 카테고리 캐싱 (30분)
   - 캐시 무효화 로직 (수정 시)
   ```

4. **번들 최적화**
   ```typescript
   // vite.config.ts

   - Code splitting by route
   - Tree shaking 확인
   - 불필요한 라이브러리 제거
   - Bundle analyzer로 분석
   ```

---

#### 4.3 테스트 인프라
**요구사항**:

1. **단위 테스트 (Vitest)**
   ```typescript
   // app/lib/__tests__/validation.test.ts

   - Zod 스키마 검증 테스트
   - 유틸리티 함수 테스트
   - 비즈니스 로직 테스트
   ```

2. **통합 테스트**
   ```typescript
   // app/routes/__tests__/$name.test.tsx

   - 주문 플로우 테스트
   - 결제 플로우 테스트
   - 인증 플로우 테스트
   ```

3. **E2E 테스트 (Playwright)**
   ```typescript
   // tests/e2e/order-flow.spec.ts

   - 고객 주문 전체 플로우
   - 사장님 주문 수락 플로우
   - 관리자 메뉴 등록 플로우
   ```

4. **CI/CD 통합**
   ```yaml
   # .github/workflows/test.yml

   - 모든 PR에 자동 테스트 실행
   - 커버리지 리포트
   - 테스트 실패 시 merge 차단
   ```

---

#### 4.4 접근성 (a11y)
**요구사항**:

1. **WCAG 2.1 AA 준수**
   - 모든 이미지에 alt 텍스트
   - 적절한 색상 대비 (4.5:1 이상)
   - 키보드 네비게이션 지원
   - 스크린 리더 호환

2. **Semantic HTML**
   - 올바른 heading 구조 (h1 → h2 → h3)
   - nav, main, footer 태그 사용
   - button vs link 올바른 사용

3. **ARIA 속성**
   ```typescript
   - aria-label for icon-only buttons
   - aria-describedby for form validation
   - role="alert" for error messages
   - aria-live for realtime updates
   ```

4. **자동 테스트**
   ```typescript
   // tests/a11y.spec.ts

   import { expect, test } from '@playwright/test';
   import { injectAxe, checkA11y } from 'axe-playwright';

   test('homepage is accessible', async ({ page }) => {
     await page.goto('/');
     await injectAxe(page);
     await checkA11y(page);
   });
   ```

---

## 📊 성공 지표 (KPIs)

### 기술 지표
- [ ] 페이지 로드 시간 < 2초 (Lighthouse)
- [ ] Core Web Vitals 통과 (LCP, FID, CLS)
- [ ] 테스트 커버리지 > 70%
- [ ] 에러율 < 0.1%
- [ ] API 응답 시간 < 500ms (p95)

### 비즈니스 지표
- [ ] 결제 성공률 > 98%
- [ ] 주문 취소율 < 5%
- [ ] 사장님 온보딩 완료율 > 80%
- [ ] 고객 재주문율 > 40%
- [ ] 평균 평점 > 4.0

### 보안 지표
- [ ] OWASP Top 10 취약점 없음
- [ ] RLS 100% 적용
- [ ] 개인정보 암호화 100%
- [ ] GDPR 완전 준수

---

## 🛠 기술 스택 업데이트

### 추가 필요 라이브러리
```json
{
  "dependencies": {
    "@toss/payment-sdk": "^latest",
    "@sentry/remix": "^latest",
    "redis": "^latest",
    "winston": "^latest",
    "zod": "^latest",
    "recharts": "^latest",
    "react-joyride": "^latest",
    "dompurify": "^latest",
    "@radix-ui/react-toast": "^latest"
  },
  "devDependencies": {
    "vitest": "^latest",
    "@playwright/test": "^latest",
    "axe-playwright": "^latest",
    "@testing-library/react": "^latest",
    "@testing-library/user-event": "^latest"
  }
}
```

### 외부 서비스
- **Toss Payments**: 결제 처리
- **Sentry**: 에러 추적 및 성능 모니터링
- **Upstash Redis**: 캐싱 및 레이트 리미팅
- **Kakao 주소 API**: 주소 검색
- **Kakao 알림톡**: 주문 알림

---

## 📅 예상 일정

| Phase | 기간 | 주요 마일스톤 |
|-------|------|---------------|
| Phase 1 (P0) | 6-8주 | 결제, 보안, 기본 워크플로우 완성 |
| Phase 2 (P1) | 4-5주 | 고객 경험, 운영 기능 완성 |
| Phase 3 (P2) | 3-4주 | 플랫폼 기능, 발견성 개선 |
| Phase 4 (P2-P3) | 2-3주 | 안정성, 성능, 테스트 |
| **총계** | **15-20주** | **약 4-5개월** |

---

## 🚀 다음 단계

1. **우선순위 확정**: 사용자와 Phase 1 범위 최종 확인
2. **기술 스택 검증**: 결제 게이트웨이 선택 (Toss vs Portone)
3. **데이터베이스 마이그레이션 계획**: 스키마 변경 전략
4. **팀 구성**: 필요한 역할 파악 (개발자, 디자이너, QA)
5. **MVP 정의**: Phase 1 중 최소 기능 세트 결정

---

## ✅ 체크리스트: Production Readiness

### Security
- [ ] RLS 100% 적용
- [ ] 입력 검증 및 Sanitization
- [ ] Rate Limiting
- [ ] HTTPS 강제
- [ ] CSRF 보호
- [ ] XSS 방지
- [ ] SQL Injection 방지
- [ ] 환경 변수 보안

### Legal & Compliance
- [ ] 이용약관
- [ ] 개인정보 처리방침
- [ ] 환불 정책
- [ ] 쿠키 정책
- [ ] GDPR 준수
- [ ] 데이터 삭제 기능
- [ ] 데이터 내보내기

### Performance
- [ ] Lighthouse 점수 > 90
- [ ] 이미지 최적화
- [ ] Code Splitting
- [ ] 캐싱 전략
- [ ] Database 인덱스
- [ ] CDN 사용

### Reliability
- [ ] Error Boundaries
- [ ] 에러 추적 (Sentry)
- [ ] 구조화된 로깅
- [ ] 헬스 체크 엔드포인트
- [ ] 백업 전략
- [ ] 재해 복구 계획

### Testing
- [ ] 단위 테스트 > 70% 커버리지
- [ ] 통합 테스트
- [ ] E2E 테스트
- [ ] 접근성 테스트
- [ ] CI/CD 파이프라인

### Business
- [ ] 결제 통합
- [ ] 주문 워크플로우 완성
- [ ] 고객 지원 채널
- [ ] 분석 및 리포팅
- [ ] 온보딩 프로세스

---

이 PRD는 **Kakao Order v3를 실제 상용 서비스로 만들기 위한 종합 로드맵**입니다. 모든 기능은 우선순위에 따라 단계별로 구현하며, 특히 **Phase 1 (P0) 항목은 필수**입니다.

다음 작업: 사용자와 우선순위 및 범위 조율 후 구현 시작