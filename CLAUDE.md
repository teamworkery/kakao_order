# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⏭️ 다음 작업
- **현재 상태**: `refactor` 브랜치. **prod 배포 완료(2026-06-03)** — `refactor`→`master` ff 병합·push, Vercel `kakao-order` 프로젝트가 `master` 자동배포 → `www.pojang.one` 최신화. 배포 전 prod에 없던 env 3개(`SUPABASE_SERVICE_ROLE_KEY`·`N8N_WEBHOOK_URL`·`N8N_WEBHOOK_URL_STORE`)를 Vercel production에 주입. 검증: `/`·`/join`·`/login`·`/forgot-password`·`/goodmorning-china` 200(이전 404), `/admin` 302. prod·로컬 동일 Supabase(`wkhgugajknrvpcobwlrv`), `VITE_APP_URL`은 기존부터 `https://www.pojang.one`. 앞선 작업: 주문SMS(알리고)·메뉴옵션·RLS2·굿모닝차이나 등록.
- **다음 작업 (전부 사용자 확인/외부 계정 필요 — 진행 전 문의)**:
  1. **카카오 OAuth prod 수동검증** — `www.pojang.one`에서 카카오 로그인 1회 실행해 redirect(`/auth/callback`) 정상 확인(도메인 불변이라 기존 등록 유효 추정).
  2. **카카오 알림톡 전환** — 비즈채널·발신프로필·템플릿 승인 후 n8n HTTP 노드를 알림톡 엔드포인트로 교체(SMS는 폴백 유지). 현재는 SMS 실발송 가동 중.
  3. **커스텀 SMTP 연결** — 가입 이메일 인증·비번 재설정 메일 실발송 (Supabase 기본 SMTP는 시간당 수통 제한·스팸함行 → 운영 부적합). 제공자 미정. `SUPABASE_ACCESS_TOKEN`이 있으면 Management API로 주입 가능하나, **현재 `.env`의 PAT은 만료/손상(JWT decode 실패)** → 재발급 필요.
  4. `N8N_WEBHOOK_STORE_SECRET` 생성 → `.env` + n8n 동기화 (`$name.tsx:343`)
  5. `.env` 정리 — `DATABASE_URL` host 가 타 프로젝트(`szmdt…`), 운영 ref(`wkhgugajknrvpcobwlrv`)로 교체 + `SUPABASE_ACCESS_TOKEN` 재발급
  6. (제품 결정) 1계정 다점포
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
