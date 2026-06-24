# progress

## 2026-06-24 — login/join 톤 통일 + orange 토큰 스윕 + 알림톡 앱 측 준비(픽업시간 통합)

세션 흐름: ① 셀러 셀프가입 구조 검토 ② 디자인 일관성 수정 ③ 알림톡 실발송 스코핑.

- **셀러 가입 검토**: `/join`은 누구나 가입→가게 등록 폼 제출 시 `role:owner` 자동 승격(승인·검증 없음). 결론 = 셀프서비스 SaaS 표준이라 **보안 구멍 아님**, 검증 단계엔 게이트 추가 보류. 잠재 리스크는 URL 스쿼팅·사업자 미검증 2건뿐. **A안만 적용**: `/join` 카피를 "사장님(점주) 회원가입"으로 + 손님용 안내박스("손님은 가입 없이 가게 주소에서 바로 주문")로 명확화. (B=이메일 인증 완료자만 가게 생성 가드는 SMTP 선결이라 펜딩 기록.)
- **디자인 톤 통일**: 사용자 직감대로 login/join 좌측 패널의 **다크 Unsplash 스톡사진+검정 60% 오버레이**가 앱 유일 다크 영역이라 라이트 브랜드와 충돌 → **라이트 브랜드 패널**(웜 글로우 `radial-gradient rgba(238,124,43,0.10)` + `p.` 마크 + primary-tint 아이콘칩)로 교체. material-symbols·forgot/reset은 일관 확인. 부차로 `admin.tsx`·`owner.orders.tsx`·`$name.tsx`의 Tailwind `orange-*`/하드코딩 hex(`#f4f2f0`)를 토큰(`primary`/`primary-light`/`border`/`shadow-glow`)으로 스윕(카카오 `#FEE500`은 보존). 잔존 0·typecheck·build·전페이지 200 검증.
- **알림톡 실발송 스코핑 + 앱 측 구현**: provider=**Aligo**, 고객 워크플로 `kakao_order_customer_sms`(n8n `3OdyLnA9plF1gBRv`, ACCEPT 시 호출). **확인된 갭**: 승인 템플릿 `주문접수안내`는 #{픽업시간}을 쓰는데 ACCEPT 버튼이 픽업시간 입력과 분리돼 수락 시점에 비어있고 payload에도 없었음. **해결(사용자 선택 A=수락+조리시간 통합)**: `owner.orders.tsx` updateStatus 액션이 `pickupMinutes` 받아 `estimated_pickup_time` 계산·저장, ACCEPT 버튼에 조리시간 입력 결합, payload.order에 `estimatedPickupTime` 추가 → 템플릿 변수 6개 전부 payload 충족. **남은 일=n8n 1패스**(Build 변수 포맷 + Send를 Aligo 알림톡 `kakaoapi.aligo.in/akv10/alimtalk/send/`로 교체, SMS failover 유지), **외부값 3개 대기**: senderkey·tpl_code·알림톡 apikey → CRM 등록.
- 커밋·배포: 위 변경분 `master` 커밋 후 push로 Vercel prod 자동 배포.

## 2026-06-23 — 디자인 재통일 커밋 prod 배포

`/next`로 미배포 항목 확인 후 사용자 요청("배포 전 사항들 배포")으로 디자인 재통일 커밋 `14ef62d`(2026-06-22 작업분, 그동안 `refactor`에만 있고 prod 미반영)을 운영 배포. 절차: `typecheck` ✓·`build` ✓ → `master`로 fast-forward 머지(master에만 있는 커밋 없어 충돌 0) → `git push origin master`로 Vercel git 연동 prod 자동 배포. 검증: `www.pojang.one` 홈·실가게 `/goodmorning-china`·신규 `favicon.svg`·`apple-touch-icon.png` 전부 HTTP 200(배포 전엔 favicon.svg 404였음). CLAUDE.md §다음 작업의 "prod 미배포" → "2026-06-23 prod 배포 완료"로 갱신. **나머지 펜딩(카카오 OAuth 수동검증·알림톡 템플릿 심사 대기·커스텀 SMTP)은 외부 계정/사용자 확인 필요라 미진행.**

## 2026-06-22 — pojang.one 브랜드 마크 도입 + 전 페이지 디자인 토큰 통일 (커밋 `14ef62d`)

사용자 불만 2건에서 출발: ① 메인 🏮 이모지 싫음(SVG+파비콘 교체 요청) ② 메인페이지 vs `/join` 톤 불일치(사용자는 **join 쪽이 더 마음에 듦**, 이 기준으로 통일 원함). **핵심 진단**: "join 스타일(Partner Portal·흰 카드·깔끔 폼·주황 포인트)"은 login·forgot/reset·privacy·terms·admin·owner·customer/*·`$name`까지 **앱 거의 전 페이지가 이미 쓰는 톤**이고, 최근 "따뜻한 포장마차"로 단독 리디자인된 **메인(index.tsx) 하나만 튀는** 상태였음 → "join 기준 통일" = 메인을 나머지에 맞추는 작업. 사용자 결정(AskUserQuestion): **로고=소문자 `p.` 마크 / 톤=join처럼 깔끔 / 범위=전 페이지 토큰 정리**. (로고는 10종 옵션을 self-contained HTML 갤러리로 만들어 사용자가 6번 선택; 갤러리는 선택 후 삭제.)

- **새 마크**: `app/common/components/brand-logo.tsx`(`BrandMark`/`BrandLogo`, currentColor) 단일 소스 → 헤더·푸터·login·join·admin 공용. 🏮 앱 전체 0개.
- **파비콘 재생성**: 의존성 없는 순수 Node 래스터라이저 `scripts/gen-favicons.mjs`(마크 지오메트리 슈퍼샘플링 → PNG/ICO 직접 인코딩, 시스템에 magick/rsvg/sharp 전무라 자작). 산출 `favicon.svg`(우선)+`favicon.ico`+`favicon-32/16.png`+`apple-touch-icon.png`(iOS 흰 라운드 bg). `root.tsx` 링크 3종 연결.
- **토큰(app.css `:root`)**: 크림 `#fbf6ef`→웜뉴트럴 `#fbfaf8`, 베이지 보더→부드러운 뉴트럴, muted-fg 가독성↑, radius 0.875→0.75, 중립 `shadow-card/-lg` 토큰 추가(버튼 글로우는 join 톤). 토큰만으로 Shadcn 대시보드까지 자동 일관화.
- **메인 재스킨**: 로고 교체, 주황 글로우 완화(0.20→0.08), 다크 "한밤 포장마차" 섹션→라이트 primary-tint, 카드 셰도우 중립화.
- **전 페이지 스윕(13파일·하드코딩 400+곳)**: `gray-*`/`red-*`/`green-*`/`bg-white` → 시맨틱 토큰(`muted-foreground`/`border`/`card`/`destructive`/`success`). 5개 병렬 서브에이전트에 정확한 매핑표로 분배(파일 비중첩). login/join/admin 스파클 "Partner Portal" 로고 → `pojang.one 파트너` 마크, 옛 `© 2024 Partner Portal` 푸터 갱신. **의도적 보존**: 카카오색(#FEE500), 히어로 사진 위 글래스 오버레이(`bg-white/15`), 상태 accent(영업중 emerald·현장결제 yellow·정보 blue).
- **검증**: typecheck ✓ · build ✓ · 전 페이지 HTTP 200 ✓ · 🏮 0 ✓. **미커밋**: progress.md/CLAUDE.md(이 기록). **다음**: 사용자 시각 리뷰 후 prod 배포(master ff·push)는 기존 절차대로 별도 진행.

## 2026-06-22 — 알림톡 템플릿 1순위 테스트 등록(첫 제출)

사용자가 카카오 채널에 `주문접수안내` 템플릿을 테스트 등록(첫 심사 제출). 등록 시 초안에서 **`#{고객명}` 변수 제거 → "고객님" 고정**, 안내 2줄(준비완료/취소불가) 삭제로 단순화. → **의미: 이 템플릿은 닉네임 의존이 사라져 닉네임 없이 바로 발송 가능**(닉네임 컬럼·코드는 향후 친구톡/개인화용으로 유지, 손해 없음). 발송 변수 6개(`가게명·주문번호·주문내역·결제금액·픽업시간·가게전화`) 전부 기존 웹훅 payload에 존재 → n8n 매핑에 추가 조회 불필요. `알림톡_템플릿/주문접수안내.md`를 실제 등록본과 일치하도록 갱신(미커밋). **다음: 심사 결과 대기 → 승인 시 템플릿코드로 n8n SMS→알림톡 교체.**

## 2026-06-21 — 카카오 로그인 수집정보 점검 + 알림톡 준비(닉네임 컬럼·템플릿)

알림톡 전환 사전작업. 사용자 질문("카카오 로그인 시 뭘 수집하나/회원가입하면 알림톡 보낼 수 있나")에서 출발해 OAuth 수집범위와 메시지 채널 구조를 코드로 확인하고, 알림톡 첫 단계(템플릿 등록)에 필요한 코드를 준비.
- **카카오 OAuth 실태 확인**: 3개 진입점(`login`/`join`/`$name`) 모두 `signInWithOAuth({provider:"kakao"})`만 호출, `scopes` 미지정. 콜백(`auth/callback.tsx`)이 실제 저장하는 건 **이메일·UUID·role뿐**, 닉네임·사진은 와도 버려짐, **전화번호는 기본 스코프로 안 옴**. → 결론: "카카오 가입"만으론 알림톡/문자 불가(전화번호 필요), 알림톡 발송 키는 **주문 폼에서 받는 `order.phoneNumber`**. 카카오 전화번호 수신은 비즈앱 검수 필요한 *옵션*이지 병목 아님(이미 주문 시 번호 수집 중).
- **메시지 채널 정리**(사용자 학습): 알림톡=전화번호 기반·정보성·템플릿심사 / 친구톡=채널친구 기반·광고성 가능·API로 개인 1명 타겟 가능 / 둘 다 결국 전화번호로 발송. 카카오 로그인에 "채널추가 동의" 붙이면 로그인=친구확보 가능(향후 옵션).
- **디버그 로그 추가**(`auth/callback.tsx`): `exchangeCodeForSession` 직후 `user_metadata`/`identities`/`app_metadata`/email·phone 콘솔 출력 — 카카오 실제 수신필드 확인용(**확인 후 제거 필요**, 개인정보 로그 잔존).
- **닉네임 저장 구현**: `profiles.name`은 가게 도메인 슬러그라 재사용 불가 → 전용 컬럼 신설. `migrations/003_profile_nickname.sql`(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT`), 콜백에서 메타데이터 닉네임 추출(`nickname→name→full_name→user_name→preferred_username` 폴백) + 신규 insert·기존 null이면 백필, `database.types.ts` 3블록 반영. typecheck 통과.
- **알림톡 템플릿 4종 초안 제공**(등록 대기): 주문접수안내·픽업준비완료·주문접수불가·사장님신규주문알림. `#{변수}` 형식·정보성·고정문 우위(반려방지). `#{주문내역}`은 변수 1개에 여러 메뉴 합쳐 발송 가능 확인.
- **migration 003 운영 적용 완료**: CLI 직접실행은 막힘(`.env` `SUPABASE_ACCESS_TOKEN` 레거시·무효 `LegacyInvalidAccessTokenError`, `DATABASE_URL`은 타 프로젝트 `szmdt…`라 사용금지, 운영 DB비번 부재) → **사용자가 Dashboard SQL Editor에서 `ALTER TABLE` 직접 실행**. service role 키로 `profiles?select=nickname` REST 조회 HTTP 200 확인(컬럼 존재 검증). 이제 코드·타입·DB 3자 일치, 닉네임 저장 실동작 가능.
- **알림톡 발신프로필 검수용 사업자정보 표기 + 배포**: 카카오 채널명(예약알림)↔사업자명(워커리) 연관성 요구 대응. 홈 푸터(`index.tsx`)에 운영사 워커리 사업자정보 추가 — 상호 워커리(Workery)/대표 심우민/사업자등록번호 227-08-52996/주소(부천 상동 뱅뱅프라자 696호)/연락처(010-7990-3237·woomin@workery.org), "pojang.one은 워커리가 운영하는 포장·예약주문 알림 서비스" 문구로 채널↔서비스↔사업자 연결 노출. 통신판매업은 미신고라 제외. 커밋 `cc36183`→`master` ff·push, prod(`www.pojang.one`) 푸터 라이브 검증(`227-08-52996` 노출). **검수 제출 사이트 URL = `https://www.pojang.one`**.
- **디버그 로그 제거 + 닉네임코드 prod 반영**: `[KAKAO DEBUG]` 4줄 제거(개인정보 prod 런타임로그 잔존 방지), 닉네임 추출 코드는 그대로 prod 배포(applied migration 003과 일치). 커밋 `9f8338c`→`master` ff·push, prod 재검증. (실수신 필드명은 미확인이나 폴백 체인으로 기능 동작)
- **남은 펜딩**: 알림톡 템플릿 등록·심사(`알림톡_템플릿/주문접수안내.md` 1순위 작성됨) → 승인 시 템플릿코드로 n8n HTTP 노드를 SMS→알림톡 교체. (토큰 재발급은 여전히 필요 — CLAUDE.md 다음작업 참조)

## 2026-06-07 — 시장·경쟁 게이트 점검 (포장주문 → 현금/노점 웨지 재포지셔닝)

automation의 폐차장/FSM 니치 게이트와 동일 방식으로 pojang.one을 점검. 코드 변경 없음, **전략 분석만**.
- **최초 판정 = 보류**: "수수료 없는 카카오채널 포장주문"은 카카오톡 주문하기·네이버 주문·무료 QR솔루션(QRO·테이블로, 결제수수료 모델)이 점유한 레드오션. 차별점(재방문 쿠폰)도 카카오 '프로젝트 단골'이 이미 제공.
- **점주 지적으로 재판정 = 조건부 GO**: 점주가 직접 확인 — **카카오 픽업/포장은 톡체크아웃 온라인 선결제 필수, 현장 현금결제 불가**(내 최초 점검의 "만나서 결제"는 배달=요기요 라이더 결제 오인이었음, 정정). + 타겟이 **시장상인·노점** → 영업신고증 없어 카카오/네이버 입점 원천 배제. 즉 **현장현금+영업신고증 무관**은 점유자가 정책·수익모델상 못 오는 *구조적 공백*. "결제 안 받음"이 약점이 아니라 경쟁자가 이 층을 비우는 이유.
- **폐차장식 분석 패키지 작성**: `시장노점_현금미리주문_웨지/`(README+00~06+인터뷰가이드, 병렬 3축 리서치+직접 3축). 최초 점검 원본 `시장경쟁_게이트_점검_2026-06-06.md`은 루트 audit용.
- **리서치가 밝힌 3대 재정렬**(왜): ① 타겟 노점→**시장 단골 미리주문 적합업종**(반찬·떡·정육·족발·김밥; 노점은 충동구매라 부적합) ② 수익 월15,000 단독→**스마트상점 SaaS 바우처**(간이 국비80%, 자부담 0~3천) ③ 카피 탈세→**현금OK·가입간편** + 합법 가드레일(주문 정상기록·현금영수증 안내·탈세소구 금지).
- **남은 게이트(미검증)**: 고객 미리주문 행동 / 상인 WTP / 합법 카피 매력. → 다음=거점 시장 1곳 + 상인 5~7곳 인터뷰(가이드 준비됨).

## 2026-06-03 (오후) — 홈페이지 "따뜻한 포장마차" 리디자인 + 배포

사용자 피드백("내가 만든 것/네가 만든 것 디자인이 뒤죽박죽, 홈이 못생겼고 Shadcn이 안 어울린다") 대응. 진단 결과 홈(`index.tsx`)이 **전형적 미니멀 SaaS 템플릿**(흑·회색 일색, 자기 주황 브랜드 미사용, border-t 칸막이, 이모지 플레이스홀더)이었고, 정작 Shadcn 컴포넌트는 거의 안 쓰고 손으로 짠 상태 → "Shadcn 문제"가 아니라 **톤 부재**가 원인. 미감 방향을 **포장마차(이름 pojang과 직결: 등불 주황·차콜·크림)**로 commit하고 홈부터 재작업.

- **전역 토큰(`app.css`)**: 차가운 흰색 → 크림 베이스(`--background:#fbf6ef`), 웜 베이지 보더(`#ece1d3`)·secondary/muted(`#f3ebe0`), `--radius` 0.625→0.875. 포장마차 웜 그림자 3종(`--shadow-warm`/`-lg`/`--shadow-glow`, 검정 대신 주황빛) `@theme`에 추가.
- **폰트(`root.tsx`)**: Pretendard(동적 서브셋 CDN) 추가 + `--font-sans`·body 우선 적용 → 기존 한글=시스템폰트/라틴=Jakarta로 따로 놀던 문제 해소(Plus Jakarta는 라틴 보조로 강등).
- **`index.tsx` 전면 재작성**: 등불 radial-glow 히어로, "포장 주문" 주황 마커 하이라이트, rounded-full+shadow-glow CTA, 둥근 카드+웜 그림자, 주황 아이콘 원, 섹션 리듬(크림↔웜베이지)+ **한밤 포장마차 출시기념 섹션**(차콜 `#241a13`+주황 글로우+🏮). 깨져있던 `/sample` 링크를 실가게 `/goodmorning-china`로 교체. 공용 `<Eyebrow>` 컴포넌트로 라벨 통일.
- **검증**: build·typecheck 통과. Playwright로 데스크탑/모바일/`/goodmorning-china`/`/login` 스크린샷 확인 — 토큰만 바꿔도 손님화면·로그인이 자동 일관화됨(대시보드 Shadcn은 그대로 유지가 정답). 사용자 요청으로 히어로 하단 "샘플 치킨집" 미리보기 카드 제거(폰 목업 데모의 동명 카드는 유지).
- **배포**: `refactor`→`master` ff·push(`0001a19`) → Vercel 자동배포 → `www.pojang.one` 새 홈 라이브 확인.

## 2026-06-03 — refactor 브랜치 운영 배포 (Vercel / www.pojang.one)

`refactor`의 누적 작업(17커밋: 가게등록·메뉴옵션·RLS2·주문SMS·온보딩)을 운영에 반영. 배포 전 현황 점검에서 **이미 `pojang.one`이 Vercel(`kakao-order` 프로젝트)에 연결·SSL 정상**이지만 마지막 prod 배포가 15일 전 `master`라 `/goodmorning-china` 404였음(DNS는 추가작업 불필요, "배포 최신화"가 실제 과제였음). prod·로컬이 **동일 Supabase**(`wkhgugajknrvpcobwlrv`)·`VITE_APP_URL=https://www.pojang.one`(기존부터 올바름) 확인.

- **빠진 env 주입**: prod에 `SUPABASE_SERVICE_ROLE_KEY`·`N8N_WEBHOOK_URL`·`N8N_WEBHOOK_URL_STORE`가 없어 로컬 `.env` 값으로 Vercel production에 추가(`vercel env add`). 기존 5개 외 신규 코드가 쓰는 변수 보강.
- **배포 방식**: `master`가 `refactor`에 0커밋 뒤져 **fast-forward 병합** → `git push origin master` → GitHub 연동 자동배포(빌드 34s, Ready). 사전 `npm run build` exit 0 확인.
- **검증**: `/`·`/join`·`/login`·`/forgot-password`·`/goodmorning-china` 모두 200(이전 404 해소), goodmorning 페이지에 실제 메뉴 렌더, `/admin` 302(인증 게이트 정상).
- **미완/주의**: 카카오 OAuth는 도메인 불변이라 기존 등록 유효 추정 → **실로그인 1회 수동검증 권장**. `SUPABASE_ACCESS_TOKEN`(Management API용 PAT)이 만료/손상("JWT could not be decoded")이라 auth config를 코드로 확인 못함 → 재발급 필요. SMTP는 사용자 결정으로 **보류**(제공자 미정).

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
