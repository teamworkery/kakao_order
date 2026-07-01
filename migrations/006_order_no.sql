-- 006_order_no.sql
-- 사람이 읽기 쉬운 주문번호(YYMMDD-NN)를 order 테이블에 부여.
-- 기존 UUID(order_id)는 그대로 두고, 표시용 order_no 컬럼을 추가한다.
-- - KST(Asia/Seoul) 기준 하루 단위로 가게(profile_id)별 01,02… 순번.
-- - BEFORE INSERT 트리거로 자동 부여(앱 코드 무관, RLS 무관).
-- - 동시 삽입 레이스는 가게+날짜 advisory lock으로 방지(저볼륨).

alter table "order" add column if not exists order_no text;

create or replace function set_order_no() returns trigger
language plpgsql
as $$
declare
  d date := (timezone('Asia/Seoul', now()))::date;
  n int;
begin
  if new.order_no is not null then
    return new;
  end if;
  -- 같은 가게 + 같은 날짜에 대한 순번 계산을 직렬화
  perform pg_advisory_xact_lock(hashtext(coalesce(new.profile_id::text, '') || d::text));
  select count(*) into n
    from "order"
    where profile_id is not distinct from new.profile_id
      and (timezone('Asia/Seoul', createdat))::date = d;
  new.order_no := to_char(timezone('Asia/Seoul', now()), 'YYMMDD') || '-' || lpad((n + 1)::text, 2, '0');
  return new;
end
$$;

drop trigger if exists trg_set_order_no on "order";
create trigger trg_set_order_no
  before insert on "order"
  for each row
  execute function set_order_no();

-- 기존 주문 백필 (KST 하루 단위, 가게별 순번)
with ranked as (
  select
    order_id,
    to_char(timezone('Asia/Seoul', createdat), 'YYMMDD') as ymd,
    row_number() over (
      partition by profile_id, (timezone('Asia/Seoul', createdat))::date
      order by createdat, order_id
    ) as seq
  from "order"
)
update "order" o
   set order_no = r.ymd || '-' || lpad(r.seq::text, 2, '0')
  from ranked r
 where o.order_id = r.order_id
   and o.order_no is null;
