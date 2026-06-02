# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⏭️ 다음 작업
- **현재 상태**: `refactor` 브랜치 (commit `d03af4f` + 미커밋). RLS baseline 운영 적용 완료. **굿모닝차이나(부천 상동) 실가게 등록 완료** (`/goodmorning-china`, 메뉴 129·사진 self-host `public/menu-images/`, 시드 `scripts/seed_goodmorning_china.mjs`·`scripts/update_goodmorning_images.mjs`). **셀프서비스 온보딩+인증 보완 완료** (점주 가입→가게 개설 마법사→`role=owner` 승격, slug 검증, 비번 재설정 `/forgot-password`·`/reset-password`, 약관 동의, 카카오 버튼 동작, 사이드바 실 영업상태). typecheck 통과.
- **다음 작업 (대부분 사용자 확인/외부 계정/배포 필요 — 진행 전 문의)**:
  1. **카카오 알림톡 실 발송 검증** (최우선) — n8n 이 실제 카카오 비즈니스 API 호출하는지 + 템플릿 승인 상태
  2. **커스텀 SMTP 연결** — 가입 이메일 인증·비번 재설정 메일 실발송 (Supabase 기본 SMTP는 운영 부적합)
  3. **도메인 배포** — `pojang.one` DNS+SSL + 카카오 OAuth redirect 등록 + `VITE_APP_URL` prod 전환 (현재 localhost)
  4. `N8N_WEBHOOK_STORE_SECRET` 생성 → `.env` + n8n 동기화 (`$name.tsx:343`)
  5. `.env` 정리 — `DATABASE_URL` host 를 운영 ref(`wkhgugajknrvpcobwlrv`)로 교체
  6. RLS Phase 2 — `profiles` email/customernumber 보호 → `public_stores` VIEW 분리 + `/$name` lookup 변경 (운영 보안 변경, 사인오프 필요)
  7. (제품 결정) 메뉴 옵션/사이즈 modifier 시스템, 1계정 다점포
- **시작 명령어**: `npm run dev` / 회귀 검증 `curl localhost:5173/goodmorning-china -o /dev/null -w "%{http_code}\n"`

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
