# 주문 알림 SMS (Aligo) — n8n 워크플로우 계획

> 1차는 **SMS(LMS)** 발송. 카카오 알림톡은 비즈채널·발신프로필·템플릿 승인 후 전환(운영하며).
> 발송 대행사: **알리고(Aligo)**, `https://apis.aligo.in/send/`.
> 레퍼런스: `~/MoatAI/koreainvest_PoC_03/n8n/workflow_v14.ts` 의 `Send SMS (ALIGO)` 노드.

## n8n 인스턴스
- `https://primary-production-628d.up.railway.app` (Rental_service·koreainvest 와 공용)
- MCP: 이 repo `.mcp.json` 의 `n8n-mcp` (gitignore됨). Claude Code 재시작 후 승인하면 연결.

## 웹훅 (앱 → n8n)
앱 `.env`:
- `N8N_WEBHOOK_URL_STORE` = `…/webhook-test/kakao_store`  ← **가게 알림** (주문 생성 시, `$name.tsx`)
- `N8N_WEBHOOK_URL` = `…/webhook-test/kakao_customer`  ← **고객 알림** (점주 수락 시, `owner.orders.tsx`)

> ⚠️ 현재 `/webhook-test/` = n8n **테스트 URL**(에디터에서 Listen 눌렀을 때만 1회). 실운영은
> 워크플로우 Webhook 노드 path를 `kakao_store`/`kakao_customer`로 두고 **active** 시킨 뒤,
> 앱 `.env`를 `/webhook/kakao_store`·`/webhook/kakao_customer` 로 교체.

## 워크플로우 2개 (각각)
`Webhook (POST)` → `Code (SMS 문구 조립)` → `HTTP Request (Aligo /send/)`

### Aligo 발송 노드 (httpRequest v4.2, form-urlencoded)
| param | 값 |
|---|---|
| key | Aligo API key (woomin914 계정) |
| user_id | `woomin914` |
| sender | `01096643237` (등록 발신번호) |
| receiver | 수신번호 (가게=`notify.phone` / 고객=`order.phoneNumber`) |
| msg | 조립된 문구 |
| title | LMS 제목 |
| msg_type | `LMS` |

> 인증정보는 커밋 금지 — n8n 인스턴스 env(`ALIGO_API_KEY` 등) 또는 Set 노드에 직접 입력.
> 실제 값은 `koreainvest_PoC_03/n8n/workflow_v14.ts` Set Config 노드 참고.

## SMS 문구 초안

### 가게 알림 (order.created → 가게 사장님)
```
[포장주문] {storeName}
새 주문이 들어왔습니다.

{각 항목}- {name} x {quantity}

합계 {totalAmount}원
고객 {customerPhone}

확인/수락 ▶ pojang.one/owner/orders
```

### 고객 알림 (order.accepted → 손님)
```
[{storename}] 주문이 수락되었어요!
지금부터 음식 준비를 시작합니다.

{각 항목}- {menuName}{(옵션)} x {quantity}

합계 {totalAmount}원

준비되면 다시 안내드릴게요. 매장에서 수령해 주세요.
```

> 픽업 예정시간을 고객 문자에 넣으려면, `owner.orders.tsx` 수락 payload 에
> `order.estimated_pickup_time` 추가 필요(현재 미포함) — 후속 개선.

## 페이로드 매핑 메모
- **가게**(order.created): `site.storeName`, `order.items[].{name,price,quantity}`, `order.totalAmount`, `order.customerPhone`, `notify.phone`
- **고객**(order.accepted): `store.storename`, `items[].{menuName,options[],quantity}`, `order.totalAmount`, `order.phoneNumber`

## 다음 (MCP 연결 후)
1. n8n MCP로 인스턴스의 기존 `kakao_store`/`kakao_customer` 워크플로우 확인
2. 위 구조로 2개 생성/패치 + Aligo 노드 검증
3. 테스트 발송(testmode 또는 본인 번호) → 정상 확인
4. `/webhook/` 전환 + active + 앱 `.env` 갱신
