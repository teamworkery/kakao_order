# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
