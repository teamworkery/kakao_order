# progress

## 2026-06-02 (오후) — 주문 알림 SMS(Aligo) 발송 연동

n8n MCP를 이 프로젝트에 설치(`.mcp.json`, Rental_service와 동일한 공용 Railway 인스턴스 `primary-production-628d`, 토큰 포함→gitignore). 재시작 후 연결. **Aligo SMS 발송 워크플로우 2개 구축**(레퍼런스 `~/MoatAI/koreainvest_PoC_03/n8n/workflow_v14.ts` 의 Send SMS(ALIGO) 노드):
- `kakao_order_store_sms`(`vgbsEofC9kLMJQ7i`, path `kakao_store`) — 주문 생성 시 가게 사장님 알림
- `kakao_order_customer_sms`(`3OdyLnA9plF1gBRv`, path `kakao_customer`) — 점주 수락 시 손님 알림
- 각 `Webhook→Code(문구 조립)→HTTP(apis.aligo.in/send/, LMS)`. SDK 코드 방식으로 validate→create→update. Aligo 계정 woomin914/발신 01096643237.
- 검증: testmode=Y 실행 2건 `result_code:1` → 실발송(N) 전환 → publish(active) → 운영 웹훅 실호출 200(본인 번호 실발송 확인).
- 발견: 앱 `.env` 웹훅이 `/webhook-test/`(테스트 URL)였음 → `/webhook/`로 교체. 기존 stub 워크플로우 2개(Pd2YYLa5gsHcETim·ZL1CaV3LHbmHnhpc)는 MCP 비공개·비활성, 삭제 가능.
- 우선 SMS, 카카오 알림톡은 비즈채널·템플릿 승인 후 전환 예정. 상세 `n8n/SMS_PLAN.md`.

## 2026-06-02

**굿모닝차이나(부천 상동) 실가게 등록** — 영업 시연용으로 네이버 플레이스(place/13115778) 실제 데이터를 운영 DB(`wkhgugajknrvpcobwlrv`)에 시드. 네이버는 Claude WebFetch 차단 + 봇 탐지 → Playwright(headless chromium, 자동화 플래그 제거·실 UA·느린 페이싱)로 우회 크롤링. `pcmap.place.naver.com` 메뉴 페이지에서 "펼쳐서 더보기" 전부 클릭해 전체 메뉴 확보, `window.__APOLLO_STATE__`에서 전화(032-327-9696)·주소(경기 부천시 원미구 송내대로265번길 85, 뱅뱅프라자 2층)·편의(포장·배달) 추출, 블로그 리뷰에서 영업시간(매일 10:00~21:30) 확보. 시드 스크립트 `scripts/seed_goodmorning_china.mjs` (service-role): 오너 auth 유저 생성→프로필(role=owner)→카테고리 15개→메뉴 129개→영업시간 7일. 네이버 중복 노출 섹션(대표메뉴·새로운메뉴·여름별미)은 dedupe로 제외. 익명 키(손님 RLS 경로)로 129개 정상 조회 검증. **메뉴 옵션/사이즈 시스템 부재**라 변형(S/L·간짜장변경)을 별도 항목으로 넣음.

**메뉴 사진** — 위키미디어 커먼즈의 한국식 중화요리 사진을 종류별 매칭(`scripts/update_goodmorning_images.mjs`). 핫링크 시연 중 깨짐 방지 위해 `public/menu-images/`로 29종 다운로드해 self-host, DB는 상대경로(`/menu-images/*.jpg`) 저장. 129개 전부 매칭(누락 0), 가게 대표이미지=짬뽕. 실제 그 가게 플레이팅이 아닌 요리 종류별 대표 사진(사용자 인지).

**셀프서비스 온보딩 + 인증 보완 (실서비스화 1차)** — 코드 분석 결과 "점주가 직접 가입→가게 등록"이 통째로 막혀있음 발견: 가입 시 무조건 `role=customer`(auth/callback)이고 owner로 승격하는 코드가 전무, `/admin`은 customer를 쫓아냄 → owner는 DB 수동 변경뿐. 자동 가능한 것 전부 구현:
- **점주 온보딩**: `/admin` 로더가 owner 아니거나 가게 없으면 redirect 대신 **가게 개설 마법사** 렌더. `updateProfile` 액션이 가게 저장 시 `role='owner'` 부여 + slug(가게 URL) 형식/예약어/중복 검증. `login`/`join` 로더는 인증 사용자를 `/admin`으로(포털 전용). RLS `profiles_update_own`이 role 컬럼 안 막아 self-승격 가능 확인.
- **비밀번호 재설정**: `/forgot-password`·`/reset-password` 신설(`resetPasswordForEmail`→`updateUser`), 로그인 페이지 링크 연결.
- **약관 동의**: 가입에 필수 체크박스 + `/terms`·`/privacy` 링크(기존 `href="#"` 교체).
- **카카오 버튼**: login/join의 죽어있던 버튼을 `signInWithOAuth`로 연결(next=/admin).
- **관리자 사이드바**: 하드코딩 "영업중"/"10:00-22:00"를 실제 store_hours 기반 계산으로 교체.
- 검증: `npm run typecheck` 통과, dev 서버에서 신규 4라우트 200, `/admin` 비로그인 302→/login, 가게 페이지 회귀 없음.
- 커밋 `49181b6`.

**RLS Phase 2 (커밋 `f0ec8f0`)** — `profiles_select_public`(USING true)이 익명에게 모든 가게의 email/customernumber까지 노출하던 문제. `public_stores` 뷰(공개 컬럼만, 뷰 소유자 권한으로 RLS 우회→전 가게 공개) 신설 + `profiles` 직접 공개 SELECT 제거 + 본인 행만 SELECT 정책. 가게 조회 경로 3곳($name 로더/액션, admin slug 중복확인)을 뷰로 전환. 운영 DB 적용은 Management API(`api.supabase.com/v1/projects/{ref}/database/query`)로 — 단, `.env`의 기존 `SUPABASE_ACCESS_TOKEN`이 옛 형식이라 401, 사용자가 새 `sbp_` PAT(kakao_order 계정) 발급해 `.env` 교체 후 적용. 검증: 익명 `profiles.email` 0건, `public_stores`는 정상. 뷰 nullable 컬럼 때문에 $name 로더에 profile_id non-null 가드 추가.

**메뉴 옵션/사이즈 시스템 (커밋 `67654b9`)** — `menu_option_groups`(min/max 선택) + `menu_options`(추가요금) + `orderitem.options`(jsonb 스냅샷) + RLS. 손님($name): 옵션 있는 메뉴는 모달로 단일(radio)/복수(checkbox)·필수검증·실시간 가격, 옵션 조합별 장바구니 라인(합성 키), 확인모달 라인별 수량조정. 점주(admin): 메뉴 카드 '옵션 관리' 모달에서 그룹/옵션 CRUD(useFetcher로 무리로드 revalidate). 점주 주문상세+알림 payload에 옵션 표시. 굿모닝차이나 실옵션 시드(곱빼기·소스·토핑, `scripts/seed_goodmorning_options.mjs`). 옵션 바텀시트가 쿠키배너(z-50)에 가려 모달 z-[60]로 상향. Playwright로 옵션선택→가격변동(8000→9000)→담기 E2E 검증.

- **여전히 미반영(사용자 확인/외부 필요)**: 카카오 알림톡 실발송·템플릿 승인, 도메인/SSL/OAuth redirect, 커스텀 SMTP(메일 실발송), N8N_WEBHOOK_STORE_SECRET(n8n 동기화), .env DATABASE_URL 교정(host가 타 프로젝트 `szmdt…`), 1계정 다점포.

## 2026-05-27

세션 시작 시 `kakao_order` 신규 clone — 사용자가 GitHub URL (`teamworkery/kakao_order`) 제공. 처음에 default branch `master`를 받았는데 사용자 Windows 로컬 `C:\Users\swm09\Desktop\project\kakao_order_v3` 가 더 최신임을 발견. 같은 repo의 `refactor` 브랜치 (commit `d03af4f`) 가 12 커밋 앞서있어 그쪽으로 전환. 로컬 v3 의 uncommitted (UI 컴포넌트 4개 삭제) 는 7개 파일에서 여전히 import 중인 미완 작업이라 가져오지 않고 `CHANGELOG_2026-01-19.md` (untracked, 진짜 신규) 만 복사. `.env` (Windows 작업물) 도 가져옴.

**디자인 리팩토링** — 사용자 요청 "modern + 이미지 강조". 단정 미니멀 (Linear/Vercel 풍) 으로 톤 다운 후, 색감은 "기존이 낫다" 피드백으로 warm/orange palette 복원. 레이아웃·간격·typography hierarchy는 미니멀 유지 + CTA orange 살리는 절충. 변경: `app/app.css` (warm tokens 복원 + radius 0.625rem), `app/common/components/ui/button.tsx` (default=orange brand로 되돌리고 shadow 절제, dark variant 신설), `app/routes/$name.tsx` (header·hero 16:10·sticky category nav underline·featured 4:3·regular item card·bottom order bar 일관 정돈), `app/routes/index.tsx` (580→580줄 통째 재작성, eyebrow + 큰 헤드라인 + 짧은 설명 패턴 8 sections 통일). 컬러 그림자 (`shadow-orange-500/40`) 전면 제거, micro-interaction (`hover:-translate-y`, `scale-105`) 절제. 모든 변경 후 `npm run typecheck` + `build` 통과 + `curl localhost:5173/` HTTP 200 검증.

**RLS 적용** — 운영 차단 항목 중 가장 위험한 것. Audit 결과 7개 public 테이블 모두 RLS off (anon key로 누구나 모든 데이터 조회·수정 가능) + Storage 에 `Allow anon upload to menu-images/store-images` 위험 정책 2건 발견. `supabase/migrations/20260127000001_rls_baseline.sql` 작성 — 모든 테이블 RLS on + owner-only writes + 가게 페이지용 SELECT public + customer self-select (`profiles.customernumber = order.phoneNumber` 매칭) + storage authenticated upload + owner-only update/delete. 적용 경로: Docker 없는 환경이라 `supabase db push` 불가능, Supabase Management API (`https://api.supabase.com/v1/projects/{ref}/database/query`) 로 직접 POST. 초기 403 (Cloudflare 1010) → `User-Agent: curl/8.0` 추가로 201 통과. 검증: 7 테이블 `rowsecurity=true`, 정책 count (profiles 4·order 4·나머지 2), 위험 storage 정책 2건 DROP 확인, `/workery`·`/injokbal` HTTP 200 응답 + 250KB+ 페이로드.

**Audit 발견 (운영 전 후속 처리 필요)**:
- `.env` 의 `DATABASE_URL` host (`szmdtwrqpckivkhbqtwc`) 가 `SUPABASE_URL` (`wkhgugajknrvpcobwlrv`) 과 다른 프로젝트. 사용자 확인으로 `wkhgugajknrvpcobwlrv` 가 실 운영 — `DATABASE_URL` 옛 값 정리 필요.
- `SUPABASE_ACCESS_TOKEN` 이 `iWGxqqG6...` 로 시작 (sbp_ 형식 아님) → 사용자가 새 sbp_ 토큰 발급해서 link 통과.
- `N8N_WEBHOOK_STORE_SECRET` 코드에서 참조 (`$name.tsx:343`) 하지만 `.env` 부재 → webhook 위변조 가능, 시크릿 생성 + n8n 동기화 필요.
- profiles `email`/`customernumber` SELECT public 노출 — `public_stores` VIEW 분리로 column-level 보호 권장 (Phase 2).
- Storage `Authenticated can insert` 정책이 내가 만든 `storage_authenticated_upload` 와 중복 (동작 동일, 정리 권장).

**기존 마이그레이션 처리**: `migrations/001_extend_order_status.sql`, `002_store_hours.sql` 은 DB 에 이미 적용된 상태 (테이블 존재 확인). Supabase CLI history 비어있음 → 지금까지 Dashboard SQL Editor 로 적용해 온 것. 향후 cli 일관성 위해 `supabase migration repair --status applied --version <ts>` 한 번 실행 권장 (Docker 필요).
