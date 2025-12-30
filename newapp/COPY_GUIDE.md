# Supabase 인증 기능 복사 가이드

이 문서는 현재 앱의 Supabase 로그인 및 사용자 ID 관리 기능을 다른 앱으로 복사하는 방법을 설명합니다.

## 📋 복사해야 할 파일 목록

### 1. 핵심 인증 파일 (필수)

#### `app/supa_clients.ts`
- **역할**: Supabase 클라이언트 설정 (브라우저 및 SSR)
- **기능**: 
  - 브라우저용 클라이언트 생성
  - 서버 사이드 렌더링용 클라이언트 생성
  - 쿠키 기반 세션 관리

#### `app/routes/login.tsx`
- **역할**: 로그인 페이지
- **기능**:
  - 이메일/비밀번호 로그인
  - 인증 상태 체크 (이미 로그인된 경우 리다이렉트)
  - 폼 검증 (Zod 사용)

#### `app/routes/join.tsx`
- **역할**: 회원가입 페이지
- **기능**:
  - 신규 사용자 등록
  - 비밀번호 확인 검증
  - 이메일 인증 안내

#### `app/root.tsx` (loader 부분)
- **역할**: 전역 인증 상태 체크
- **기능**: 모든 페이지에서 사용자 정보 접근 가능

### 2. UI 컴포넌트 (필수)

#### `app/common/components/ui/button.tsx`
- Button 컴포넌트 (Shadcn UI 기반)

#### `app/common/components/ui/input.tsx`
- Input 컴포넌트 (Shadcn UI 기반)

#### `app/common/components/ui/label.tsx`
- Label 컴포넌트 (Radix UI 기반)

#### `app/common/components/input-pair.tsx`
- Input과 Label을 함께 사용하는 컴포넌트

### 3. 유틸리티 파일 (필수)

#### `app/lib/utils.ts`
- `cn` 함수 (Tailwind CSS 클래스 병합)

### 4. 설정 파일

#### `app/routes.ts`
- 라우트 설정 (login, join 경로 추가 필요)

## 📦 필요한 의존성

`package.json`에 다음 패키지가 필요합니다:

```json
{
  "dependencies": {
    "@supabase/ssr": "^0.6.1",
    "@supabase/supabase-js": "^2.51.0",
    "zod": "^4.0.5",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-slot": "^1.2.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.1",
    "lucide-react": "^0.525.0"
  }
}
```

## 🔐 환경 변수 설정

다음 환경 변수를 설정해야 합니다:

### 클라이언트용 (`.env` 또는 `.env.local`)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 서버용 (환경 변수 또는 `.env`)
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

**참고**: 클라이언트와 서버 모두 같은 Supabase 프로젝트를 사용하지만, 환경 변수 이름이 다릅니다.
- 클라이언트: `VITE_` 접두사 필요
- 서버: `VITE_` 접두사 없음

## 🚀 사용자 ID 사용 방법

### Loader에서 사용자 ID 가져오기

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const { client } = makeSSRClient(request);
  const { data: userData, error: authError } = await client.auth.getUser();

  if (authError || !userData?.user?.id) {
    throw redirect("/login");
  }

  const userId = userData.user.id; // 이것이 개별 사용자 ID입니다
  
  return {
    userId,
    // ... 기타 데이터
  };
}
```

### Action에서 사용자 ID 가져오기

```typescript
export async function action({ request }: Route.ActionArgs) {
  const { client } = makeSSRClient(request);
  const { data: userData } = await client.auth.getUser();

  if (!userData?.user?.id) {
    return Response.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const userId = userData.user.id;
  
  // userId를 사용한 로직...
}
```

### 컴포넌트에서 사용자 정보 사용

```typescript
export default function MyPage({ loaderData }: Route.ComponentProps) {
  const { userId } = loaderData;
  
  // userId 사용...
}
```

## 📝 라우트 설정

`app/routes.ts`에 다음 라우트를 추가해야 합니다:

```typescript
import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  // ... 기존 라우트들
  route("/login", "routes/login.tsx"),
  route("/join", "routes/join.tsx"),
] satisfies RouteConfig;
```

## ✅ 체크리스트

복사 후 확인할 사항:

- [ ] `app/supa_clients.ts` 파일 복사 완료
- [ ] `app/routes/login.tsx` 파일 복사 완료
- [ ] `app/routes/join.tsx` 파일 복사 완료
- [ ] `app/root.tsx`에 loader 추가 완료
- [ ] UI 컴포넌트 파일들 복사 완료
- [ ] `app/lib/utils.ts` 파일 복사 완료
- [ ] `app/routes.ts`에 라우트 추가 완료
- [ ] `package.json`에 의존성 추가 완료
- [ ] 환경 변수 설정 완료
- [ ] Supabase 프로젝트 설정 확인 (Authentication 활성화)
- [ ] 로그인/회원가입 페이지 접근 테스트

## 🔍 문제 해결

### 로그인이 안 될 때
1. 환경 변수가 올바르게 설정되었는지 확인
2. Supabase 프로젝트의 Authentication이 활성화되어 있는지 확인
3. 이메일 인증이 필요한 경우, Supabase 대시보드에서 확인

### 사용자 ID를 가져올 수 없을 때
1. `makeSSRClient`가 올바르게 호출되었는지 확인
2. 쿠키가 올바르게 설정되어 있는지 확인
3. `client.auth.getUser()`의 에러를 확인

## 📚 추가 리소스

- [Supabase SSR 문서](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [React Router 문서](https://reactrouter.com/)
- [Zod 문서](https://zod.dev/)




