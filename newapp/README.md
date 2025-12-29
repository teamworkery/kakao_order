# 새 앱 - Supabase 인증 기능

이 프로젝트는 Supabase 로그인 및 사용자 ID 관리 기능을 포함한 최소 구성의 React Router 앱입니다.

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`env.example.txt` 파일을 참고하여 `.env` 파일을 생성하고 Supabase 프로젝트 정보를 입력하세요:

```bash
cp env.example.txt .env
```

그리고 `.env` 파일을 열어 실제 Supabase 프로젝트 정보로 수정하세요:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

**중요**: 
- 클라이언트용 환경 변수는 `VITE_` 접두사가 필요합니다.
- 서버용 환경 변수는 `VITE_` 접두사가 없습니다.
- 두 변수 모두 같은 Supabase 프로젝트의 URL과 키를 사용합니다.

### 3. Supabase 타입 생성 (선택사항)

Supabase 프로젝트의 타입을 생성하려면:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > database.types.ts
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`을 열어 확인하세요.

## 📁 프로젝트 구조

```
newapp/
├── app/
│   ├── common/
│   │   └── components/
│   │       ├── ui/              # UI 컴포넌트 (Button, Input, Label 등)
│   │       └── input-pair.tsx   # Input과 Label을 함께 사용하는 컴포넌트
│   ├── lib/
│   │   └── utils.ts             # 유틸리티 함수 (cn 함수)
│   ├── routes/
│   │   ├── index.tsx            # 홈 페이지
│   │   ├── login.tsx            # 로그인 페이지
│   │   └── join.tsx             # 회원가입 페이지
│   ├── root.tsx                 # 루트 레이아웃 (전역 인증 상태 체크)
│   ├── routes.ts                # 라우트 설정
│   └── supa_clients.ts          # Supabase 클라이언트 설정
├── .env.example                 # 환경 변수 예시
├── database.types.ts            # Supabase 타입 정의
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🔐 사용자 ID 사용 방법

### Loader에서 사용자 ID 가져오기

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const { client } = makeSSRClient(request);
  const { data: userData, error: authError } = await client.auth.getUser();

  if (authError || !userData?.user?.id) {
    throw redirect("/login");
  }

  const userId = userData.user.id; // 개별 사용자 ID
  
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

## 📝 주요 기능

- ✅ 이메일/비밀번호 로그인
- ✅ 회원가입 (이메일 인증 포함)
- ✅ 인증 상태 체크
- ✅ 사용자 ID 자동 할당 (Supabase에서 제공)
- ✅ SSR 지원 (서버 사이드 렌더링)

## 🔧 필요한 Supabase 설정

1. **Authentication 활성화**
   - Supabase 대시보드에서 Authentication > Providers > Email 활성화

2. **이메일 인증 설정** (선택사항)
   - Authentication > Email Templates에서 이메일 템플릿 설정
   - 이메일 인증을 비활성화하려면: Authentication > Settings > Email Auth > Enable email confirmations 비활성화

## 📚 추가 리소스

- [Supabase 문서](https://supabase.com/docs)
- [React Router 문서](https://reactrouter.com/)
- [복사 가이드 문서](../COPY_GUIDE.md)

## ⚠️ 주의사항

1. `database.types.ts` 파일은 실제 Supabase 프로젝트의 타입으로 교체해야 합니다.
2. 환경 변수는 절대 Git에 커밋하지 마세요.
3. 프로덕션 환경에서는 환경 변수를 안전하게 관리하세요.

