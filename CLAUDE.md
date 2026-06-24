# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⏭️ 다음 작업
- 🧭 **전략 점검(2026-06-07) — 시장·경쟁 게이트 = 조건부 GO, 재포지셔닝 권고**: 현 포지셔닝("수수료 없는 카카오 포장주문")은 카카오·네이버·무료QR 레드오션. **진짜 공백 = 현장현금+영업신고증 무관**(시장상인·노점; 카카오 픽업은 선결제 필수라 못 옴). 3대 재정렬 = ① 타겟 **시장 단골 미리주문 업종**(반찬·떡·정육·족발·김밥; 노점 일반 제외) ② 수익 **스마트상점 SaaS 바우처**(자부담 0~3천) ③ 카피 **현금OK·가입간편**(탈세 소구 금지+가드레일). **다음=빌드 그만, 검증부터** — 거점 시장 1곳 + 상인 5~7곳 인터뷰. 상세: `시장노점_현금미리주문_웨지/`(README→06_종합판단). ⚠️ 아래 dev 백로그는 *현 배포 유지보수*용이며, 재포지셔닝 검증 통과 전엔 신규 dev 투자 보류 권장.
- **현재 상태**: `refactor` 브랜치. **🎨 디자인 재통일 — 깔끔한 라이트 톤 + 새 `p.` 브랜드 마크 (2026-06-22 커밋 `14ef62d`, **2026-06-23 prod 배포 완료**)**: 사용자 피드백("메인만 톤이 튄다, join 쪽이 낫다")으로 방향 전환 — 메인의 "따뜻한 포장마차" 단독 톤을 **앱 전체가 이미 쓰던 깔끔한 join 톤**에 맞춤. 🏮 이모지 전면 제거 → 소문자 `p.` SVG 마크(`app/common/components/brand-logo.tsx` 단일 소스) + 파비콘 재생성(`scripts/gen-favicons.mjs`, 의존성 없는 자작 래스터라이저). `app.css` 토큰을 웜뉴트럴(`#fbfaf8`)·radius 0.75·중립 `shadow-card`로, 13개 페이지 하드코딩 gray/red/green→시맨틱 토큰 스윕. typecheck·build·전페이지 200 검증. **`14ef62d`까지 `master` ff·push로 prod 라이브 확인**(2026-06-23, `www.pojang.one` 홈·실가게·`favicon.svg`·`apple-touch-icon` 전부 200). ⚠️ 바로 아래 "따뜻한 포장마차" 설명은 이 커밋으로 대체됨(히스토리 참고용). — **이전(2026-06-03 prod 배포)**: 차가운 미니멀 SaaS 톤을 웜 브랜드 톤으로 전환. `app.css` 토큰을 크림 베이스(`#fbf6ef`)·웜 베이지 보더·radius 0.875로, 웜 그림자 토큰(`shadow-warm/-lg/glow`) 추가, **Pretendard 한글폰트**(`root.tsx`)로 한/영 톤 통일. `index.tsx` 전면 재작성(등불 글로우 히어로·둥근 카드·한밤 포장마차 출시기념 섹션, 데모 링크를 실가게 `/goodmorning-china`로). 토큰만 바꿔도 손님화면·로그인 자동 일관화, **대시보드는 Shadcn 유지**. `0001a19`까지 `master` ff·push로 prod 라이브 확인. **앞선 배포(같은 날)**: `refactor` 누적분(가게등록·옵션·RLS2·주문SMS)을 최초 배포 + env 3개(`SUPABASE_SERVICE_ROLE_KEY`·`N8N_WEBHOOK_URL`·`N8N_WEBHOOK_URL_STORE`) Vercel production 주입. prod·로컬 동일 Supabase(`wkhgugajknrvpcobwlrv`), `VITE_APP_URL`=`https://www.pojang.one`.
- **다음 작업 (전부 사용자 확인/외부 계정 필요 — 진행 전 문의)**:
  1. **카카오 OAuth prod 수동검증** — `www.pojang.one`에서 카카오 로그인 1회 실행해 redirect(`/auth/callback`) 정상 확인(도메인 불변이라 기존 등록 유효 추정).
  2. **카카오 알림톡 전환** — 비즈채널·발신프로필·템플릿 승인 후 n8n HTTP 노드를 알림톡 엔드포인트로 교체(SMS는 폴백 유지). 현재는 SMS 실발송 가동 중. **(2026-06-21 준비분)** 템플릿 4종 초안 작성됨(주문접수/픽업완료/접수불가/사장님알림 — progress.md 참조), `#{고객명}`용 **닉네임 저장 코드 구현 완료**(`migrations/003_profile_nickname.sql`·`auth/callback.tsx`·`database.types.ts`), **migration 003 운영 DB 적용 완료**. **검수용 사업자정보(워커리) 홈 푸터 표기 + prod 배포 완료**(`9f8338c`까지 `master` ff·push, `www.pojang.one` 푸터 라이브 — 채널 예약알림↔서비스↔사업자 워커리 연관성 노출, **검수 사이트 URL=`https://www.pojang.one`**). `[KAKAO DEBUG]` 로그 제거 완료. **🎯 현재 다음 과제 (2026-06-24): 카카오 알림톡 실발송 연결 — 템플릿 등록 완료**. provider=**Aligo(알리고)**, 고객 발송 워크플로=**`kakao_order_customer_sms`**(n8n id `3OdyLnA9plF1gBRv`, webhook `/webhook/kakao_customer`, 점주 ACCEPT 시 호출; 노드 Webhook→Build(Code)→Send SMS(ALIGO LMS `apis.aligo.in/send/`)). **✅ 앱 코드 완료(2026-06-24, 커밋 전)**: 픽업시간 갭 해소 — 수락+조리시간 통합(`owner.orders.tsx` updateStatus 액션이 `pickupMinutes` 받아 `estimated_pickup_time` 계산·저장, ACCEPT 버튼에 조리시간 입력 결합), ACCEPT payload에 `order.estimatedPickupTime` 추가 → 템플릿 변수 6개(가게명=store.storename·주문번호=orderId·주문내역=items·결제금액=order.totalAmount·픽업시간=order.estimatedPickupTime·가게전화=store.storenumber) 전부 payload에 존재. **🔲 남은 일=n8n 1패스**: Build 노드에서 6변수 포맷(픽업시간 ISO→"오후 N시" 한글) + Send 노드를 Aligo 알림톡 `kakaoapi.aligo.in/akv10/alimtalk/send/`로 교체, `message_1`=승인 템플릿 원문 글자단위 일치, SMS는 failover(`fsubject_1`/`fmessage_1`)로 폴백 유지. **착수에 필요한 외부값 3개(사용자 제공 대기)**: ① 발신프로필키(senderkey) ② 템플릿코드(tpl_code) ③ Aligo 알림톡 apikey(SMS key와 별도일 수 있음). 문서 `알림톡_템플릿/주문접수안내.md`.
  3. **커스텀 SMTP 연결** — 가입 이메일 인증·비번 재설정 메일 실발송 (Supabase 기본 SMTP는 시간당 수통 제한·스팸함行 → 운영 부적합). 제공자 미정. `SUPABASE_ACCESS_TOKEN`이 있으면 Management API로 주입 가능하나, **현재 `.env`의 PAT은 만료/손상(JWT decode 실패)** → 재발급 필요.
  4. `N8N_WEBHOOK_STORE_SECRET` 생성 → `.env` + n8n 동기화 (`$name.tsx:343`)
  5. `.env` 정리 — `DATABASE_URL` host 가 타 프로젝트(`szmdt…`), 운영 ref(`wkhgugajknrvpcobwlrv`)로 교체 + `SUPABASE_ACCESS_TOKEN` 재발급
  6. (제품 결정) 1계정 다점포
- **펜딩 — 셀러 셀프가입 가드레일 (검증 단계엔 보류, 마찰 늘리지 말 것 · 갱신 2026-06-24)**: 현재 `/join`은 누구나 가입→가게 등록 폼 제출 시 `role:owner` 자동 승격, 승인·검증 없음(셀프서비스 SaaS 표준이라 *보안 구멍 아님*). 다만 ① URL 스쿼팅/스팸 가게, ② 사업자 검증 부재 잠재 리스크. **트래픽·스팸 실관측 전엔 막지 않는다.** 착수 시 (B) **이메일 인증 완료자만 가게 생성** 가드 한 줄(`admin.tsx` 가게 생성 action) — 단 SMTP(위 3번) 선결 필요. 무거운 승인 큐는 스팸 관측 후. (2026-06-24 세션: `/join` 카피만 "사장님 전용+손님은 가입불필요" 안내로 명확화 완료, 게이트는 미적용)
- **✅ 디자인 톤 통일 완료 (2026-06-24, 커밋 전)**: login/join 좌측 패널 다크 Unsplash사진→라이트 브랜드 패널(웜 글로우+`p.`마크)로 교체, 앱 전체 `orange-*`/하드코딩 hex(admin·owner.orders·$name)→토큰(`primary`/`primary-light`/`border`/`shadow-glow`) 스윕. typecheck·전페이지 200 검증. **prod 미배포·미커밋** → 알림톡 작업분과 함께 배포 예정.
- **시작 명령어**: `npm run dev` / prod 회귀 검증 `curl https://www.pojang.one/goodmorning-china -o /dev/null -w "%{http_code}\n"`

## Project Overview

포장 주문 (Takeout Order) Application - a web-based ordering system for Korean restaurants. Production domain: pojang.one

**Key Policies:**
- Takeout orders only (no delivery)
- No payment processing
- Orders cannot be cancelled after submission
- Pickup time calculation and display is a core feature

## Commands

```bash
# Development
npm run dev              # Start dev server (port 5173)
npm run build            # Build for production
npm run start            # Run production server
npm run typecheck        # Run TypeScript type checking

# Database
npm run db:typegen       # Regenerate Supabase types → database.types.ts
```

## Architecture

### Tech Stack
- React Router 7.5.3 (SSR enabled)
- Supabase (PostgreSQL + Auth)
- TailwindCSS 4.1.4 + Shadcn UI (new-york style)
- n8n webhooks for SMS notifications

### Project Structure
- `/app` - Main application (active development)
- `/newapp` - Simplified boilerplate for reference
- `/migrations` - Database migrations
- `database.types.ts` - Auto-generated Supabase types

### Routes
```
/                       → Homepage with banner
/:name                  → Store ordering page (dynamic)
/login, /join           → Authentication
/admin                  → Admin dashboard (store setup)
/owner/orders           → Order management for store owners
/auth/callback          → OAuth callback
/customer/phone         → Customer phone lookup
/customer/order-success → Order confirmation page
```

### Supabase Client Pattern
Two clients in `app/supa_clients.ts`:
- `browserClient` - Client-side operations (uses `VITE_` prefixed env vars)
- `makeSSRClient(request)` - Server-side with cookie handling (returns `{ client, headers }`)

### Environment Variables
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   # Client-side
SUPABASE_URL, SUPABASE_ANON_KEY              # Server-side
SUPABASE_SERVICE_ROLE_KEY                    # Privileged operations
N8N_WEBHOOK_URL                              # Customer SMS
N8N_WEBHOOK_URL_STORE                        # Store owner SMS
VITE_APP_URL                                 # App URL (localhost:5173 / pojang.one)
```

## React Router 7 Conventions

### Page Component Structure
```typescript
import type { Route } from "./+types/routename";

export function loader({ request }: Route.LoaderArgs) {
  return { data: "value" };  // Return plain objects, not json()
}

export function action({ request }: Route.ActionArgs) {
  return { success: true };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Page Title" }];
}

export default function Page({ loaderData, actionData }: Route.ComponentProps) {
  // Access data via props, NOT useLoaderData/useActionData
}
```

### Key Rules
- Import from `react-router`, never `@remix-run/*`
- Return plain objects from loaders (no `json()` function)
- Use `data()` only when returning with status codes
- Components receive `Route.ComponentProps` with `loaderData`/`actionData`

## Component Conventions

### UI Components
- Import from Shadcn UI (`~/common/components/ui/*`), never directly from Radix
- Path alias: `~` maps to `./app`
- Use `cn()` from `~/lib/utils` for class merging

### Naming
- Directories: lowercase with dashes (`components/auth-wizard`)
- Variables: descriptive with auxiliary verbs (`isLoading`, `hasError`)
- Named exports for components

### TypeScript
- Prefer interfaces over types
- Avoid enums; use maps instead
- Functional components only (no classes)

## Authentication Flow
1. Supabase SSR client handles cookie-based sessions
2. Check auth in loader functions using `makeSSRClient(request)`
3. Role-based access via `profiles.role` (customer vs. store owner)
4. OAuth callback handled at `/auth/callback`
