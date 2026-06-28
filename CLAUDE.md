# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⏭️ 다음 작업
- 🧭 **전략 점검(2026-06-07) — 시장·경쟁 게이트 = 조건부 GO, 재포지셔닝 권고**: 현 포지셔닝("수수료 없는 카카오 포장주문")은 카카오·네이버·무료QR 레드오션. **진짜 공백 = 현장현금+영업신고증 무관**(시장상인·노점; 카카오 픽업은 선결제 필수라 못 옴). 3대 재정렬 = ① 타겟 **시장 단골 미리주문 업종**(반찬·떡·정육·족발·김밥; 노점 일반 제외) ② 수익 **스마트상점 SaaS 바우처**(자부담 0~3천) ③ 카피 **현금OK·가입간편**(탈세 소구 금지+가드레일). **다음=빌드 그만, 검증부터** — 거점 시장 1곳 + 상인 5~7곳 인터뷰. 상세: `시장노점_현금미리주문_웨지/`(README→06_종합판단). ⚠️ 아래 dev 백로그는 *현 배포 유지보수*용이며, 재포지셔닝 검증 통과 전엔 신규 dev 투자 보류 권장.
- **[active·P1] 🔁 픽업 예약 모델(B) — 앱·DB 구현·배포 완료, 거절 알림톡만 외부작업 대기 (2026-06-28 밤)** — 손님이 결제화면에서 **픽업시간 직접 선택**(지금+기본조리시간 ~ 영업종료, 10분, 당일) + 점주 **확정/시간변경/거절(사유)**. migration 005(`requested_pickup_time`·`cancel_reason`) 운영적용·코드 배포 완료. 상세 progress.md 2026-06-28(밤). **🔲 남은 외부작업(거절·시간변경 알림톡 실발송)**: ① 카카오 콘솔 거절·시간변경 템플릿 등록·승인(문안=`알림톡_템플릿/고객_주문상태_3종.md`) ② n8n 손님 워크플로(`3OdyLnA9plF1gBRv`)에 `notificationType`(confirmed/changed/rejected) Switch 3분기 추가 ③ 완료 후 Vercel env **`ENABLE_CUSTOMER_REJECT_NOTIFY=true`**로 거절 고객통지 ON(기본 OFF=오발송 방지). 수락/시간변경 통지는 기존 템플릿으로 이미 동작. · 갱신 2026-06-28
- **현재 상태**: `master` 브랜치. **점주 로그인 복귀 + 알림톡 버튼 `openExternalBrowser` (커밋 `2ac4332`, 2026-06-28 prod 배포·검증 완료)** — 카톡 인앱브라우저 재로그인 마찰 해소(`/owner/orders` 미인증→`/login?next=…` 복귀 + 버튼 URL `?openExternalBrowser=1`). 상세 progress.md 2026-06-28(저녁). — 이전: **🎨 디자인 재통일 — 깔끔한 라이트 톤 + 새 `p.` 브랜드 마크 (2026-06-22 커밋 `14ef62d`, **2026-06-23 prod 배포 완료**)**: 사용자 피드백("메인만 톤이 튄다, join 쪽이 낫다")으로 방향 전환 — 메인의 "따뜻한 포장마차" 단독 톤을 **앱 전체가 이미 쓰던 깔끔한 join 톤**에 맞춤. 🏮 이모지 전면 제거 → 소문자 `p.` SVG 마크(`app/common/components/brand-logo.tsx` 단일 소스) + 파비콘 재생성(`scripts/gen-favicons.mjs`, 의존성 없는 자작 래스터라이저). `app.css` 토큰을 웜뉴트럴(`#fbfaf8`)·radius 0.75·중립 `shadow-card`로, 13개 페이지 하드코딩 gray/red/green→시맨틱 토큰 스윕. typecheck·build·전페이지 200 검증. **`14ef62d`까지 `master` ff·push로 prod 라이브 확인**(2026-06-23, `www.pojang.one` 홈·실가게·`favicon.svg`·`apple-touch-icon` 전부 200). ⚠️ 바로 아래 "따뜻한 포장마차" 설명은 이 커밋으로 대체됨(히스토리 참고용). — **이전(2026-06-03 prod 배포)**: 차가운 미니멀 SaaS 톤을 웜 브랜드 톤으로 전환. `app.css` 토큰을 크림 베이스(`#fbf6ef`)·웜 베이지 보더·radius 0.875로, 웜 그림자 토큰(`shadow-warm/-lg/glow`) 추가, **Pretendard 한글폰트**(`root.tsx`)로 한/영 톤 통일. `index.tsx` 전면 재작성(등불 글로우 히어로·둥근 카드·한밤 포장마차 출시기념 섹션, 데모 링크를 실가게 `/goodmorning-china`로). 토큰만 바꿔도 손님화면·로그인 자동 일관화, **대시보드는 Shadcn 유지**. `0001a19`까지 `master` ff·push로 prod 라이브 확인. **앞선 배포(같은 날)**: `refactor` 누적분(가게등록·옵션·RLS2·주문SMS)을 최초 배포 + env 3개(`SUPABASE_SERVICE_ROLE_KEY`·`N8N_WEBHOOK_URL`·`N8N_WEBHOOK_URL_STORE`) Vercel production 주입. prod·로컬 동일 Supabase(`wkhgugajknrvpcobwlrv`), `VITE_APP_URL`=`https://www.pojang.one`.
- **다음 작업 (전부 사용자 확인/외부 계정 필요 — 진행 전 문의)**:
  1. **카카오 OAuth prod 수동검증** — `www.pojang.one`에서 카카오 로그인 1회 실행해 redirect(`/auth/callback`) 정상 확인(도메인 불변이라 기존 등록 유효 추정).
  2. **✅ 카카오 알림톡 실발송 전환 — 완료·라이브 (2026-06-28)**: provider=**Aligo**, 고객 워크플로 `kakao_order_customer_sms`(n8n `3OdyLnA9plF1gBRv`, webhook `/webhook/kakao_customer`)를 **SMS→알림톡(tpl `UI_8730`)으로 전환·publish 완료**. 구조(9노드): Webhook→Build(6변수 치환·옵션·콤마·픽업ISO→KST 한글)→Send Alimtalk(Code, mid 추출)→IF code=0→Wait60s→Verify History(`history/detail` `rslt`)→IF rslt=0→완료 / **실패 양쪽→SMS 폴백(LMS)**. 외부값(받음): tpl_code `UI_8730`·senderkey `e4aab44c…`·apikey `7mqso1…`(SMS키와 동일)·userid `woomin914`·sender `01096643237`. 검증: 로컬 3단계(template/list APR·send mid·history `rslt:'0'`) + n8n 경로(운영 webhook POST→서버 실행→알리고 `history` AT 전송완료, KST/콤마/옵션 정상) + 앱 payload 키 일치(`owner.orders.tsx:159`). 상세 progress.md 2026-06-28 · 일반레슨 `~/project/lessons/ref-aligo-alimtalk.md`. **🔲 남은 검증 1개**: 실손님 1건 운영 회귀(점주 실제 수락→손님 카톡 도착) 관찰. ⚠️ 알리고 키가 n8n Code 3노드에 평문(기존 SMS도 동일) — 시크릿 관리 강화는 추후.
  3. **커스텀 SMTP 연결** — 가입 이메일 인증·비번 재설정 메일 실발송 (Supabase 기본 SMTP는 시간당 수통 제한·스팸함行 → 운영 부적합). 제공자 미정. `SUPABASE_ACCESS_TOKEN`이 있으면 Management API로 주입 가능하나, **현재 `.env`의 PAT은 만료/손상(JWT decode 실패)** → 재발급 필요.
  4. `N8N_WEBHOOK_STORE_SECRET` 생성 → `.env` + n8n 동기화 (`$name.tsx:343`)
  5. `.env` 정리 — `DATABASE_URL` host 가 타 프로젝트(`szmdt…`), 운영 ref(`wkhgugajknrvpcobwlrv`)로 교체 + `SUPABASE_ACCESS_TOKEN` 재발급
  6. (제품 결정) 1계정 다점포
  7. **[active·P1] 🔒 n8n webhook 인증 부재 (2026-06-28 알림톡 라이브 전환 중 사용자 지적)** — 고객 알림톡 webhook `/webhook/kakao_customer`(n8n `3OdyLnA9plF1gBRv`)가 `authentication:none` → **URL만 알면 누구나 임의 번호로 알림톡/SMS 실발송 트리거 가능**(건당 과금·스팸·가게 사칭/위변조 메시지). 점주 알림 store webhook도 동일(코드 `$name.tsx`엔 `x-webhook-secret` 전송 분기 있으나 위 4번대로 env·n8n 미동기 = 사실상 무인증). **해결**: n8n 두 webhook 노드에 header auth 추가 + 앱(`owner.orders.tsx`의 `N8N_WEBHOOK_URL` fetch, `$name.tsx`의 store fetch)이 시크릿 헤더 전송 → 4번 `N8N_WEBHOOK_STORE_SECRET` 작업과 통합. (바운드: URL 비공개라 즉각 악용 가능성은 낮지만 무인증 아웃바운드 발송은 명백한 구멍.) · 갱신 2026-06-28
  8. **[active·P2] 점주 알림도 알림톡 전환 (2026-06-28 사용자 요청)** — 손님 주문 시 점주 알림이 현재 SMS(n8n `kakao_order_store_sms` `vgbsEofC9kLMJQ7i`, path `kakao_store`, `$name.tsx:359` 트리거). 손님용처럼 알림톡 전환 필요. **템플릿 초안 작성 완료** → `알림톡_템플릿/사장님주문알림.md`(변수 5: 가게명·주문번호·주문내역·결제금액·고객연락처 + 웹링크버튼 `/owner/orders`). **✅ 선결조건 해결 — 점주 휴대폰 `owner_phone` 필드 분리 구현 완료(코드, 미배포)**: migration `004_owner_phone.sql`(비공개 컬럼) + `database.types.ts` + 가게설정 폼 2곳 + `$name.tsx`가 서비스롤(`makeAdminClient`, supa_clients.ts 신규)로 owner_phone 조회→웹훅 `notify.phone`(미설정시 storenumber 폴백). typecheck 통과. **🔲 남은 일**: ⓐ ✅ **migration 004 운영 DB 적용 완료**(Management API, owner_phone text·public_stores 미노출 확인) → 코드 배포만 하면 됨(컬럼 선존재로 안전) ⓑ 기존 점주 owner_phone 재입력 안내 ⓒ 카카오 콘솔 템플릿 등록·승인 → tpl_code 받으면 n8n `kakao_order_store_sms`를 손님 9노드 패턴(+버튼JSON)으로 전환. (참고: `.env` `SUPABASE_ACCESS_TOKEN`에 ` PAT` 라벨 접미사 있음 — Management API용 추출 시 공백앞만.) · 갱신 2026-06-28
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
