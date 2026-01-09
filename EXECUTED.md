# Executed Implementation Details

이 문서는 IMPLEMENTATION_PLAN.md에서 완료된 작업의 상세 내용을 기록합니다.

---

## Milestone 1 & 2: Extended Order Workflow + Database Foundation

**완료일:** 2024-01-09
**커밋:** `51f0e5a`

### 변경 사항

#### 1. Database Schema 변경

**Migration 파일:** `migrations/001_extend_order_status.sql`

```sql
-- kakao_order enum 확장
ALTER TYPE kakao_order ADD VALUE IF NOT EXISTS 'PREPARING';
ALTER TYPE kakao_order ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE kakao_order ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE kakao_order ADD VALUE IF NOT EXISTS 'REFUNDED';

-- order 테이블 컬럼 추가
ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS estimated_pickup_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_pickup_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- order_status_history 테이블 생성
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES "order"(order_id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  changed_by UUID REFERENCES profiles(profile_id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_order
  ON order_status_history(order_id, created_at DESC);
```

#### 2. 새로운 주문 상태 워크플로우

```
PENDING → ACCEPT → PREPARING → READY → COMPLETED
    ↓        ↓          ↓
  CANCEL   CANCEL     CANCEL     → REFUNDED
```

| 상태 | 한국어 라벨 | 설명 |
|------|-------------|------|
| PENDING | 주문 대기 | 새 주문 접수됨 |
| ACCEPT | 주문 접수 | 가게에서 주문 확인 |
| PREPARING | 조리 중 | 음식 조리 중 |
| READY | 픽업 대기 | 조리 완료, 픽업 대기 |
| COMPLETED | 완료 | 고객 픽업 완료 |
| CANCEL | 취소됨 | 주문 취소 |
| REFUNDED | 환불됨 | 환불 처리됨 |

#### 3. 생성된 파일

| 파일 | 설명 |
|------|------|
| `app/lib/order-status.ts` | 상태 전환 규칙, 라벨, 색상 유틸리티 |
| `migrations/001_extend_order_status.sql` | DB 마이그레이션 스크립트 |

#### 4. 수정된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `app/routes/owner.orders.tsx` | 동적 상태 버튼, 상태별 색상 표시, 상태 변경 이력 기록 |
| `database.types.ts` | 새로운 enum 값 및 테이블 타입 반영 |

---

## Milestone 3: GDPR Compliance

**완료일:** 2024-01-09
**커밋:** `9e2d2c8`

### 변경 사항

#### 1. 개인정보 처리방침 페이지

**파일:** `app/routes/privacy.tsx`
**경로:** `/privacy`

내용:
- 개인정보 수집 및 이용 목적
- 수집하는 개인정보 항목
- 보유 및 이용 기간
- 제3자 제공 정책
- 파기 절차
- 정보주체 권리
- 쿠키 사용 안내
- 개인정보 보호책임자 연락처

#### 2. 이용약관 페이지

**파일:** `app/routes/terms.tsx`
**경로:** `/terms`

내용:
- 서비스 정의 및 목적
- 이용자 의무
- 주문 및 결제 안내
- 픽업 정책
- 면책조항
- 분쟁 해결 절차
- 회원 탈퇴 안내

#### 3. 계정 삭제 기능

**파일:** `app/routes/customer/delete-account.tsx`
**경로:** `/customer/delete-account`

기능:
- 로그인 필요
- 삭제 전 확인 문구 입력 ("계정삭제")
- 주문 내역 익명화 (법적 보관 의무)
- 프로필 데이터 삭제
- 로그아웃 처리

#### 4. 쿠키 동의 배너

**파일:** `app/common/components/cookie-consent.tsx`

기능:
- 첫 방문 시 하단에 표시
- localStorage에 동의 상태 저장
- 동의/거부 버튼
- 개인정보 처리방침 링크

#### 5. 수정된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `app/root.tsx` | CookieConsent 컴포넌트 추가 |

---

## 참고 사항

- 데이터 내보내기 기능은 사용자 요청에 따라 구현하지 않음
- Security Hardening (Milestone 4)과 Payment Integration (Milestone 5)은 DEFERRED 상태
