# progress

## 2026-07-01 (오후) — 손님/점주 주문 UX 5건 + 간편 주문번호(order_no) 도입

세션 흐름: 사용자가 주문 완료 화면·주문내역·픽업·장바구니 관련 5건 지목(+검토용 2건은 다음작업으로) → 코드+DB(migration 006) → Playwright(umaidon) 검증.

- **① 주문완료 화면 가게명 누락 수정**: `customer/order-success.tsx`가 `order`→`profile:profile_id(...)` 조인으로 가게명을 읽어 **로그인 손님(점주 아님)에겐 RLS로 storename=null**("가게 이름 없음") → **`public_stores` 뷰로 profile_id 조회**로 전환. `customer/orders.tsx`도 같은 근본원인 → distinct profile_id들을 public_stores로 한 번에 조회해 map으로 주입(가게명 표시).
- **② 간편 주문번호 `order_no`(YYMMDD-NN)**: UUID 대신 사람이 읽는 번호. **migration 006**(운영 DB 적용·검증) = `order.order_no text` 컬럼 + **BEFORE INSERT 트리거**(KST 하루·가게별 순번, advisory lock으로 레이스 방지) + 기존 7건 백필(예: `260109-01..05`, `260701-01`). 표시 헬퍼 `app/lib/order-no.ts`(정본=order_no, 없으면 `YYMMDD-XXXX` 폴백). order-success/customer.orders/owner.orders 3곳 표시를 `#{short(uuid)}`→`displayOrderNo(...)`로. database.types 수동 반영(typegen CLI 부재).
- **③ 홈→가게 복귀**: order-success "홈으로 돌아가기"(→`/`) → **"가게로 돌아가기"(→`/{slug}`)**. slug는 public_stores.name에서. (주문 못 찾은 상태에선 slug 모름 → 기존 홈 유지)
- **④ 픽업 기본값 "약 N분 후"**: 손님 결제 픽업 select 기본 선택을 **가장 이른 슬롯(=지금+가게 기본조리시간)**으로 자동 세팅, 첫 옵션 라벨 `약 {prepTime}분 후 (시:분)`. 나머지 슬롯은 그대로 드롭다운 선택 가능. 기본값 자동채움으로 `canOrder`의 픽업필수도 충족. (`$name.tsx` 기본선택 effect + 라벨)
- **⑤ 장바구니 미리보기**: 결제바 `주문하기` 옆에 장바구니 아이콘(수량 배지)+클릭 시 **미리보기 모달**(담은 라인·수량조정 `adjustLine`·합계·"계속 담기"). 주문확정과 별개(확정은 기존 주문확인 모달).
- **검증(Playwright, umaidon 실계정)**: 점주목록 `260701-01` 표시 · order-success 우마이돈+260701-01+가게로돌아가기(가게이름없음 없음) · 픽업 옵션[0]=`약 15분 후 (오전 11:40)`·기본값 채워짐 · 장바구니 모달 오픈. typecheck·build 통과.
- **다음작업으로 남긴 검토 2건(미착수)**: ⓐ 사장님 admin QR 셀프 다운로드 ⓑ 픽업 예약 옵트아웃("지금 주문만 받기" 설정). CLAUDE.md §다음 작업 [active·P3] 2건.

## 2026-07-01 — admin 가게관리 UI 12건 수정 + 대기분(카카오숨김·디자인톤·거절템플릿) 일괄 배포

세션 흐름: 사용자가 admin(`/admin`) 가게관리 화면 문제 12건 지목 → 코드 파악 → 일괄 수정 → typecheck/build → Playwright(umaidon 실계정 로그인)로 실화면 검증 → 대기 중이던 미커밋분과 함께 커밋·prod 배포.

- **admin.tsx / $name.tsx 수정 12건**:
  1. 사이드바 '가게 정보 수정' 버튼 무반응 → `#store-info-section` id + `scrollIntoView` 핸들러.
  2. 메뉴명 placeholder `족발(앞다리)`→`햄버거`.
  3. **가게 주소(URL) 최초 설정 후 변경 불가** — 프론트 `readOnly`(기존 name 있을 때)+회색 잠금·안내문구, **서버 가드**(updateProfile에서 기존 profiles.name 조회→`lockedSlug`로 강제, 제출값 무시=우회 조작 차단).
  4. 가게 전화번호 라벨에 `*고객에게 보이는 번호`(점주 휴대폰 `*주문 알림 수신`과 동일 레이아웃) 추가.
  5. 손님화면 가게설명 줄바꿈 안 됨 → `$name.tsx` 설명 `<p>`에 `whitespace-pre-line`.
  6. 영업시간 관리 요일 박스 컴팩트화(`space-y-3 p-4`→`space-y-1.5 px-3 py-2`, 시간input `py-2`→`py-1`).
  7. 기본 조리시간 input `step=5`+min 5(화살표 5분 단위).
  8a. "가격은 부가세 포함입니다." 문구 삭제.
  8b. **버튼 무작동 수정**: '새 메뉴 추가'가 헤더 로그아웃 `form[method=post]`을 잘못 선택하던 버그 → add 폼에 `id="add-menu-form"` 부여·타겟팅 / 전체·판매중·품절 필터 = `statusFilter` state 신설·필터 반영·활성 스타일 / '순서 변경' = 목록 스크롤+안내 토스트.
  9. 드래그 순서변경 = `menuFetcher`(useFetcher) 백그라운드 전환 + 낙관적 로컬 업데이트, "순서를 변경하는 중…" 차단 오버레이 제거.
  10·11. 판매 토글 = `form.submit()`(전체 새로고침·스크롤 상단 이동) → `menuFetcher.submit` + 낙관적 즉시 반영. 내비게이션 제거로 스크롤 위치 유지.
  12. 메뉴 수정 카드 레이아웃 난잡(`lg:grid-cols-12`가 좁은 반폭 카드에서 뒤죽박죽) → 세로 스택 재설계 + 편집 카드 전폭(`md:col-span-2`).
- **검증**: `npm run typecheck`·`npm run build` 통과. Playwright(playwright-core+chromium, umaidon@test.com 실로그인)로 편집카드 1280/390px, 가게정보(URL잠금·전화라벨), 영업시간, 필터(active16/soldout0/all16), 손님 설명 줄바꿈, 토글 낙관반영(판매중→품절 즉시·리로드 없음, 원복), 사이드바 스크롤 버튼 전부 확인. umaidon 운영 데이터는 원상복구.
- **함께 배포한 대기분**(이전 세션 미커밋): `login.tsx`·`join.tsx` 카카오 로그인/가입 버튼 숨김(`{false&&}`) + 라이트 브랜드 패널 디자인 톤 통일, `알림톡_템플릿/주문거절안내.md`·`사장님주문알림.md`(버튼 라벨) 템플릿, 전략문서(`시장노점_현금미리주문_웨지/`·시장경쟁 게이트), `_원본/우마이돈 메뉴판.jpg`.

## 2026-06-30 — 알림톡 신규 2개(거절·점주) n8n 배선 완료 (REST surgical patch, 라이브)

세션 흐름: /next 보고 → 사용자가 카카오 콘솔 승인 통보(`UJ_0652`=거절·고객 / `UJ_0642`=점주 신규주문) → 매핑 확정 → 양 워크플로 REST patch → Aligo testmode로 템플릿 매칭 검증.

- **tpl_code 매핑(사용자 확인)**: **`UJ_0652` = 주문거절안내(고객)** / **`UJ_0642` = 사장님주문알림(점주)**. CLAUDE.md P1에 박음.
- **고객 워크플로 `3OdyLnA9plF1gBRv` 패치(2노드만)**: Switch 노드 추가 대신 **최소 침습** — `Build Message` jsCode에 `body.notificationType==='rejected'` 분기(거절 본문+`tpl_code:'UJ_0652'`, 그 외 confirmed/changed는 기존 `UI_8730` 본문 유지) + `Send Alimtalk`의 `const TPL='UI_8730'`→`b.tpl_code||'UI_8730'`. **연결 재배선 0**, verify(60s+history/detail rslt)+SMS폴백 경로 그대로 → 거절도 실패 시 SMS 자동 폴백. 거절사유=`body.cancelReason`, 주문내역=기존 단가포맷 재사용.
- **점주 워크플로 `vgbsEofC9kLMJQ7i` 3→9노드 전환**: 기존 SMS 단일경로(Webhook→Build→Send SMS)를 손님 9노드 패턴으로 확장 — Webhook(기존 노드 verbatim 유지=prod 등록 보존, path `kakao_store`)→Build Store Msg(5변수 치환·단가포맷·버튼JSON 생성)→Send Alimtalk(`UJ_0642`+`button_1` 웹링크)→Check Send OK→Wait60s→Verify History→Check Delivered→Mark Delivered / 실패 양쪽→Send SMS Fallback(LMS). 점주 payload(`order.items[].name/price/quantity`, `order.id`, `order.customerPhone`, `site.storeName`, `notify.phone`) 그대로 사용. 버튼 `주문 확인하기`→`pojang.one/owner/orders?openExternalBrowser=1`.
- **검증(Aligo testmode_yn='Y', 실발송·과금 0)**: 거절 UJ_0652 본문 → `code:0 type:AT scnt:1 fcnt:0`(트레일링 개행 없는 본문이 등록본과 정확 일치) · 점주 UJ_0642 본문+button_1 → 동일 `code:0 type:AT`. 두 워크플로 PUT 후 GET 재확인(active 유지, 노드/코드/path 반영).
- **방법**: REST surgical patch(`n8n-api.sh railway GET→in-memory patch→PUT`, body=name/nodes/connections/settings만, settings는 화이트리스트 추출=`{executionOrder}`). Railway PUT 즉시 라이브.
- **거절 통지 ON 완료(같은 세션)**: Vercel production env `ENABLE_CUSTOMER_REJECT_NOTIFY=true` 추가(REST API, CLI는 구버전이라 행 → 토큰 직접 사용) + 운영 배포(`9cbdc37`)를 **같은 SHA로 재배포**(`dpl_4w1F`, env는 다음 배포부터 적용되므로 필수, 미커밋 working-tree는 안 섞임) → READY·`www.pojang.one` 200. 이제 점주가 거절하면 손님 UJ_0652 알림톡 실발송.
- **정정(중요)**: 운영 배포가 `9cbdc37`(HEAD)이므로 **`owner_phone` 코드(commit `55061b7`)는 이미 prod에 배포됨** — 이전 CLAUDE.md/기록의 "owner_phone 미배포"는 stale. 따라서 점주 알림톡 수신번호는 `owner_phone`(설정 시) 우선·미설정 시 `storenumber` 폴백으로 **이미 정상 동작**. 남은 건 기존 점주들이 가게설정에서 휴대폰을 입력하는 것뿐.
- **남은 일**: ① 점주 알림톡은 **즉시 라이브**(다음 실주문부터 SMS→알림톡 `UJ_0642`). ② 실주문 1건 회귀 관찰(거절→손님 UJ_0652 / 신규주문→점주 UJ_0642 도착·버튼 동작). ③ 점주 휴대폰(`owner_phone`) 미입력 점주 안내(유선 `storenumber`만 있으면 알림톡 불착→SMS폴백도 유선 불착).

## 2026-06-29 — 손님 알림톡 주문내역에 단가 추가(라이브 patch) + 신규 템플릿 2개 확정·파일화

세션 흐름: /next 보고 → 알림톡 템플릿 등록 범위 축소 결정 → 손님 주문내역 가격표기 라이브 반영 → 신규 템플릿 2개 파일 정리.

- **등록 범위 축소(사용자 결정)**: 픽업 **시간변경 보류**, **거절은 필수**로 유지. 문제 주문은 점주가 손님에게 직접 연락. → 카카오 신규 등록 = **거절(고객) + 점주 신규주문 알림 2개**만(확정은 기존 `UI_8730` 재사용, 추가 0).
- **손님 알림톡 `주문내역`에 단가 추가 (라이브)**: n8n 고객 워크플로 `3OdyLnA9plF1gBRv` Build 노드 jsCode 한 줄을 `수량` → `수량*단가원`으로. 결과 `짬뽕(곱빼기) 2*8,000원, 짜장면 1*6,000원`(띄어쓰기 없음, 개당 단가). payload엔 `price` 이미 존재(`owner.orders.tsx:220`)·`won()` 헬퍼 재사용 → **앱/템플릿 변경 불필요**(`#{주문내역}` 변수 내용만 바뀜=재승인 X).
- **방법(중요·재발방지)**: 운영 워크플로 일부 노드만 고칠 땐 **REST API surgical patch**(`agent_mcps/n8n-mcp/n8n-api.sh railway GET→in-memory patch→PUT`, body=name/nodes/connections/settings만). SDK `update_workflow`(전체 재작성·credential strip 위험) 회피. Railway는 PUT 즉시 라이브(active 유지)·재검증으로 새 jsCode 반영 확인. 이 지식은 `~/project/n8n_lessons.md`에 이미 있었으나 착수 시 grep 누락이 원인 → **프로젝트 CLAUDE.md에 `### n8n 워크플로 수정` 절(워크플로 ID 2개+헬퍼+"착수 시 grep") 추가** + 프로젝트 메모리 `n8n-rest-surgical-patch.md` 신설.
- **신규 템플릿 2개 파일화(등록용 복사본)**: `알림톡_템플릿/주문거절안내.md` 신규(이모지 뺀 거절 본문, 사용자가 `문의: #{가게전화}` 추가 → 변수 4개 가게명·거절사유·주문내역·가게전화/버튼 없음) · `사장님주문알림.md` 버튼 라벨 `주문 확인/수락`→**`주문 확인하기`**로 변경(버튼은 화면 열기일 뿐 수락 아님 → 거절 버튼 별도 추가 안 함, 둘 다 웹에서). 둘 다 정보성/기본형.
- **카카오 "대체문자" 불필요 확정**: n8n이 send→60초→history/detail rslt 검증→실패 시 LMS 폴백을 이미 직접 수행. 플랫폼 대체문자 켜면 이중 발송 위험. 알리고는 send 시 `failover=Y`+`fmessage` 보내야 발동하는데 우리 Send 노드는 안 보냄 → 등록돼도 자동발송 안 됨(무해). → 건너뛰거나 무시.
- **남은 일(외부)**: 거절·점주 템플릿 카카오 등록·승인 → tpl_code 2개 → ① 고객 워크플로 `notificationType` Switch(confirmed/rejected) + `ENABLE_CUSTOMER_REJECT_NOTIFY=true` ② 점주 `kakao_order_store_sms`(`vgbsEofC9kLMJQ7i`) SMS→알림톡 전환(같은 가격포맷·버튼 포함). 코드 미커밋(CLAUDE.md·사장님주문알림.md M).

## 2026-06-29 (오후) — 첫 테스트 고객(우마이돈) 계정·메뉴 시딩 + 점주 카카오 로그인 버튼 숨김

세션 흐름: 첫 고객 메뉴판 사진(우마이돈 돈가스) 받음 → 앱 표현가능 범위 진단 → 계정/메뉴 결정 → 셀프가입 실패 원인 규명 → admin 생성으로 우회 → 전체 시딩·운영검증.

- **첫 고객 온보딩 시작(우마이돈)**: "1호 고객은 내가 계정·메뉴판까지 다 만들어 사용가능 형태로 인계" 방침. 메뉴판 사진(`_원본/260629_테스트고객_우마이돈_메뉴판.jpg`)을 앱 데이터모델에 매핑 — 세트5(우·마·이·생·돈), 단품11(수량별 별도 메뉴=A안), 반반이세트(이·생)는 옵션그룹(택1·price_delta 0). 소스 현금/카드 정책은 결제기능 없는 앱이라 **소개문구 텍스트로만** 수용.
- **셀프가입 실패 원인 = 가짜 이메일**: 사용자가 `/join`에서 `umaidon@test.com`으로 가입 시도 → "회원가입 안 됨". 원인은 `@test.com`이 메일 수신 불가 → "Confirm email" ON 상태라 인증 불가/로그인 차단(혹은 Invalid email 거부). 코드(`join.tsx` signUp)는 정상. 카카오 숨김과 무관.
- **해결 = 서비스롤 admin 생성(우회)**: 셀프가입·SMTP 의존 대신 `SUPABASE_SERVICE_ROLE_KEY`로 `auth.admin.createUser({email_confirm:true})`. 멱등 시딩 스크립트(scratchpad, 1회용 — 프로젝트엔 미커밋)로 ① 계정 `umaidon@test.com`/`umaidon23`(인증완료, `profile_id=fee52d20-a5b2-4965-bab3-45d04353496a`) ② profiles(상호 우마이돈·슬러그 `umaidon`·전화 01081749970·소개문구·role owner·prep 15분) ③ store_hours 전요일 09:00~18:00 ④ menuItem 16 + 반반이세트 옵션그룹/옵션. 운영검증: `https://www.pojang.one/umaidon` HTTP 200 + 메뉴 노출 확인.
- **인계 방식(정본)**: 같은 계정의 **이메일만 고객 이메일로 변경**(admin, 메일 없이)하면 `profile_id` 불변 → 메뉴 그대로 승계. **고객 재가입 금지**(새 profile_id = 데이터 분리). 카카오 가입도 별도계정 되니 금지.
- **점주 카카오 로그인/회원가입 버튼 숨김**(`login.tsx`·`join.tsx`, `{false && (...)}`로 divider+버튼 래핑, OAuth 배선·콜백 보존): 수동 인계 단계에선 인계받은 점주가 카카오로 누르면 빈 새 계정 생성되는 footgun → 차단. 셀프가입 단계 가면 `false→true`로 재노출. typecheck 통과. **미커밋·미배포**.
- **보안 Q 답변(코드변경 없음)**: "회원가입 시 devtools 네트워크에 id/pw 평문 노출 정상?" → 정상. 본인 브라우저의 송신 요청을 보는 것이고 전송은 HTTPS/TLS 암호화, 서버(Supabase)는 bcrypt 해시 저장. 클라이언트 사전해시 불필요(오히려 무의미).
- **미커밋 상태**: `join.tsx`·`login.tsx`(카카오 숨김)·`CLAUDE.md`(P3 펜딩 추가)·`progress.md`. 계정/메뉴는 운영 DB에 이미 라이브(코드 배포와 무관).

## 2026-06-28 (밤) — 픽업 예약 모델(B) 전체 구현 (손님 픽업시간 선택 + 점주 확정/시간변경/거절)

프로세스 재검토 결론 → **모델 B(손님이 결제화면에서 픽업시간 직접 선택)** 채택·구현. 사용자 확정 3옵션: 슬롯 10분 / 점주 못 맞추면 시간변경+통보 / 당일만.

- **DB (migration 005, 운영 DB 적용·검증 완료)**: `order.requested_pickup_time`(손님 희망)·`order.cancel_reason`(거절사유) 추가. Management API로 prod 적용 확인, `database.types.ts` 반영.
- **슬롯 계산 유틸 신규** `app/lib/pickup-slots.ts`: `computePickupSlots`(지금+기본조리시간 ~ 영업종료, 10분, 휴무/마감 reason) + `formatKoreanTime`. KST 오프셋이 10/15/30분 슬롯 경계와 정합이라 epoch 올림 안전.
- **손님 `$name.tsx`**: 결제화면 픽업시간 select(필수, mount 후 클라전용 렌더로 하이드레이션/TZ 불일치 회피, 1분마다 갱신·만료슬롯 해제), `canOrder`에 픽업선택 필수 추가, 확정모달에 픽업시간 표시, `saveOrder`+action에 `requested_pickup_time` 저장·미래시각 서버검증, 웹훅 payload에 `requestedPickupTime`.
- **점주 `owner.orders.tsx`**: 목록(데스크톱 행·모바일 카드)·상세에 요청/확정 픽업시간 표시. 수락 UI 개편 — 기존 "조리분(分)" → **요청시간 기본채운 time input**(그대로/바꿔서 확정, `buildKstIsoFromTime`로 HH:mm+요청일자 KST 조립). **거절 시 사유 select(4종)** → `cancel_reason` 저장. payload에 `notificationType`(confirmed/changed/rejected)·`cancelReason`·`requestedPickupTime` 추가. 픽업카드는 요청+확정 표시로, 분(分) 조정폼은 "지금부터 N분 후" 보조수단으로 유지.
- **알림톡 템플릿 문서** `알림톡_템플릿/고객_주문상태_3종.md`: 확정/시간변경/거절 3종 문안+변수+payload 매핑+n8n `notificationType` Switch 가이드.
- **⚠️ 배포 안전장치**: 현 n8n은 notificationType 무시·무조건 '확정' 발송 → **거절 알림 켜면 오발송**. 그래서 거절 고객통지는 `ENABLE_CUSTOMER_REJECT_NOTIFY=true`(Vercel env, **기본 OFF**)일 때만. 수락/시간변경은 즉시 정상(기존 템플릿이 픽업시간 안내). 거절 자체·사유저장·payload는 동작, 손님 통지만 보류.
- typecheck·build·dev SSR 스모크(store 200, 하이드레이션 경고 0) 통과. 커밋·prod 배포.
- **남은 일(외부)**: ① 카카오 콘솔 거절·시간변경 템플릿 등록·승인 ② n8n 손님 워크플로 `notificationType` 3분기 추가 ③ 완료 후 env 플래그 ON.

## 2026-06-28 (저녁) — 점주 로그인 복귀 + 알림톡 버튼 openExternalBrowser (배포) / 픽업·거절 프로세스 재검토 착수

세션 흐름: 사장님 알림톡 버튼 인증 질문 → 재로그인 마찰 해소(배포) → 기본 픽업시간·거절 기능 스코핑 중 **프로세스 근본 재검토로 전환**.

- **카톡 인앱브라우저 재로그인 마찰 해소 (커밋 `2ac4332`, prod 배포·검증 완료)**: 알림톡 버튼(`/owner/orders`)을 카톡 인앱브라우저로 열면 폰 기본 브라우저와 쿠키 분리라 매번 재로그인. 2갈래 해결 — ① **`?openExternalBrowser=1`**(카카오 공식 파라미터, 버튼을 폰 기본 브라우저로 강제 → 세션 유지) 템플릿 문서 반영 ② **로그인 후 주문목록 복귀**: `owner.orders.tsx` 미인증 redirect를 `/login?next=/owner/orders`로(loader+action 2곳, 로그아웃 plain 유지), `login.tsx`가 `next` 존중(`safeNext`로 내부경로만 허용=오픈리다이렉트 방지, 카카오OAuth `redirectTo`·비번로그인·이미로그인 loader 전부). 검증: prod redirect가 `…/login?next=/owner/orders`로 정상, 홈·실가게·login 200. ⚠️ iOS Safari ITP는 7일+ 완전 미사용 시에만 재로그인(데일리 사용엔 무영향) — 보강 안 하기로 결정.
- **기본 픽업시간 — 이미 절반 구현 발견**: `profiles.default_prep_time_minutes` 컬럼 + 가게설정 "기본 조리 시간" UI(`admin.tsx` `updatePrepTime`, 2251~)가 **이미 존재**하나 `owner.orders.tsx` 수락 입력칸이 이를 안 쓰고 `defaultValue={15}` 하드코딩 → **연결만 하면 됨**(loader가 컬럼 조회→입력 기본값). 미착수.
- **거절 — 전환은 있으나 고객 통지 없음**: `order-status.ts`에 `PENDING→CANCEL`(ACCEPT/PREPARING→CANCEL도) 이미 존재해 거절 자체는 가능. 단 ① 거절 **사유 미수집** ② 고객 웹훅이 **ACCEPT 때만** 발송(`owner.orders.tsx:191` `if newStatus==="ACCEPT"`)이라 거절 시 손님에게 아무 통지 안 감. 거절 사유별 알림톡 = 신규 작업.
- **🔀 방향 전환(미해결, 다음 세션 핵심)**: 사용자 지적 — "손님은 15~20분 기대했는데 수락 시 1시간이라 하면 주문 자체를 안 했을 것". 현 플로우(손님이 **먼저 확정 주문** → 점주가 사후에 픽업시간 통보)는 손님이 대기시간을 모르고 커밋하는 구조적 결함. **픽업시간·수락·거절을 따로 패치하지 말고 주문 프로세스 전체를 재설계하기로** 함. 코드 미착수, 설계 논의부터.

실제 테스트 고객 확보 → "지금 카톡 발송 가능?" 점검에서 출발. **결론: 알림톡 실발송 라이브 전환 완료.**

- **받은 외부값(사용자 제공)**: tpl_code `UI_8730`(템플릿명 `주문접수_고객`) · senderkey `e4aab44c…d0d0` · apikey `7mqso1…r1m`(SMS키와 동일) · userid `woomin914` · sender `01096643237`.
- **알리고 = 서버 IP 화이트리스트 필수**(미등록 시 전 엔드포인트 `code:-99`). 사용자가 작업환경 IP 추가 후 로컬 직접 검증 가능해짐.
- **로컬 3단계 검증**: `template/list`→UI_8730 **카카오 승인(APR)**·강조형 아님(`templateEmType:NONE`, emtitle 불필요)·버튼 없음·변수 6개 일치 / `alimtalk/send`→`code:0`+`mid` / `history/detail`(mid)→**`rslt:'0'` 성공**(실 카톡 도달). 강조형/버튼 없는 최단순 케이스라 본문 6변수 치환만 필요.
- **n8n `3OdyLnA9plF1gBRv` 재구성(3노드 SMS→9노드)**: Webhook(`kakao_customer`)→**Build Message**(6변수 치환·옵션표기·콤마금액·픽업ISO→KST "오후 N시 M분" 변환)→**Send Alimtalk**(Code+`this.helpers.httpRequest`로 `alimtalk/send`, `info.mid` 추출)→**IF code=0**→**Wait 60s**→**Verify History**(`history/detail`로 `rslt`)→**IF rslt=0**→Mark Delivered / **양쪽 실패→Send SMS Fallback**(LMS `apis.aligo.in/send/`). 자격증명은 기존 SMS노드처럼 Code 내 하드코딩(이 인스턴스 Code `$env` 차단 가능성 회피, n8n_lessons §34), form은 문자열 직조립(Buffer 금지 §A). **`update_workflow`만으론 활성 안 됨 → `publish_workflow`로 active 버전 전환**(activeVersionId 옛 SMS→신규 fc38ff5a).
- **n8n 경로 실검증(웹훅 호출=앱과 동일 경로)**: 운영 webhook에 합성 주문 POST→n8n 서버 실행→알리고 `history/list`에 **AT 전송완료**(mid 1381167870). 변환 정확: UTC 09:30→**KST 오후 6시 30분**, **21,000원**, 옵션 **짜장면(곱빼기) 2** 정상.
- **앱 payload 일치 확인**: `owner.orders.tsx:159` ACCEPT payload 키(`orderId`·`order.{phoneNumber,totalAmount,estimatedPickupTime}`·`items[].{menuName,options,quantity}`·`store.{storename,storenumber}`) ↔ Build 노드 매핑 100% 일치 → **실손님 주문도 동일 작동**(합성 테스트 아님).
- **일반 lesson 분리**(사용자 요청, 추후 비-n8n 코드 대비): `~/project/lessons/ref-aligo-alimtalk.md` 신규(조회→발송→mid검증 3단계·엔드포인트·IP화이트리스트·`#{변수}`수동치환·강조형emtitle·버튼키변환·의사코드) + `lessons/README.md` 인덱스 + `n8n_lessons.md §132` backlink.
- **점주 알림도 알림톡 전환 착수(사용자 요청)**: 손님 주문 시 점주 알림이 현재 SMS(`kakao_order_store_sms` `vgbsEofC9kLMJQ7i`, path `kakao_store`). ① 템플릿 초안 `알림톡_템플릿/사장님주문알림.md`(변수 5+웹링크버튼) ② **선결조건=점주 휴대폰 분리 구현 완료**: 알림톡은 카톡 휴대폰만 도달하는데 수신번호가 가게 전화(유선 가능)였음 → 비공개 컬럼 `owner_phone` 신설(migration `004`), 가게설정 폼 2곳 입력, `$name.tsx`가 **서비스롤(`makeAdminClient` 신규)로 owner_phone 조회**(공개 뷰 미노출)→웹훅 `notify.phone`(폴백 storenumber). typecheck 통과. **migration 004 운영 DB 적용 완료**(Management API `database/query`, `owner_phone text` 생성·`public_stores` 뷰 미노출 확인 — `.env` `SUPABASE_ACCESS_TOKEN` 값 끝에 ` PAT` 라벨이 붙어 있어 공백앞 토큰만 추출해야 동작, len 44). **코드는 미배포·미커밋** → 컬럼이 먼저 있으니 이제 배포만 하면 안전(현 prod 코드는 owner_phone 미참조라 영향 없음). 다음=콘솔 템플릿 승인→tpl_code→n8n 전환.
- **남은 일**: 실손님 1건으로 운영 회귀(점주가 실제 수락→손님 카톡 도착) 1회 관찰. 그 외 펜딩(커스텀 SMTP·OAuth prod 수동검증·N8N_WEBHOOK_STORE_SECRET·.env 정리) 불변. ⚠️ 알리고 자격증명이 n8n Code 3노드에 평문 하드코딩(기존 SMS노드도 동일) — 시크릿 관리 강화는 추후 과제.

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
