-- ════════════════════════════════════════════════════════
-- 결제 링크 — 상담 뒤 정한 금액으로 어드민이 링크를 만들고,
-- 고객이 /pay/{token} 에서 페이업 표준결제창으로 결제한다.
-- Supabase SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- ════════════════════════════════════════════════════════

-- 흐름: 어드민이 행을 만든다 → 링크를 메일·문자·카톡으로 보낸다
--      → 고객이 결제창에서 카드 인증 → 페이업이 우리 서버(/api/payup/return)로 거래번호를 넘긴다
--      → 서버가 이 표의 amount 로 페이업에 승인을 요청해야 결제가 끝난다.
-- 결제창에 실린 금액은 브라우저에서 고칠 수 있으므로 믿지 않는다. 기준은 amount 다.

create table if not exists public.payment_links (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- 결제 페이지 주소(/pay/{token})의 끝 토막. 추측할 수 없는 난수다.
  token           text not null unique,
  -- 페이업 주문번호의 앞 토막. 결제를 시도할 때마다 뒤에 난수를 붙여 새 주문번호를 만든다
  -- (한 번 실패한 주문번호를 다시 쓸 수 있는지 페이업 문서에 없어서).
  order_no        text not null unique,

  -- 결제창 상품명(페이업 128자 — 화면 가독성 때문에 60자로 막는다)
  title           text not null,
  -- 결제 페이지에 보이는 상세 설명(선택)
  description     text,
  amount          integer not null,

  -- 어드민이 미리 적어 두는 고객 정보(선택). 결제 페이지 입력칸에 미리 채워진다.
  customer_name   text,
  customer_email  text,
  customer_tel    text,

  -- pending: 결제 대기 / paid: 결제 완료 / cancelled: 결제 후 환불 / void: 결제 전 링크 취소
  status          text not null default 'pending',
  expires_at      timestamptz not null,

  -- 결제한 사람이 결제 페이지에 적은 값
  buyer_name      text,
  buyer_email     text,
  buyer_tel       text,

  -- 페이업 승인 결과
  order_number    text,
  transaction_id  text unique,
  auth_number     text,
  card_name       text,
  card_no         text,
  quota           text,
  paid_at         timestamptz,
  cancelled_at    timestamptz,
  -- 마지막 실패 사유 — 고객이 결제하다 막혔을 때 어드민이 볼 수 있게
  last_error      text,

  -- 링크 발송 메일(고객에게)
  link_mailed_at  timestamptz,
  -- 결제 완료 알림 메일(관리자·고객에게). 실패해도 결제는 유효하다.
  paid_mailed_at  timestamptz,
  mail_error      text,

  created_by      text
);

alter table public.payment_links drop constraint if exists payment_links_status_chk;
alter table public.payment_links add constraint payment_links_status_chk
  check (status in ('pending', 'paid', 'cancelled', 'void'));

alter table public.payment_links drop constraint if exists payment_links_amount_chk;
alter table public.payment_links add constraint payment_links_amount_chk
  check (amount between 100 and 100000000);

alter table public.payment_links drop constraint if exists payment_links_title_len;
alter table public.payment_links add constraint payment_links_title_len
  check (char_length(title) between 1 and 60);

alter table public.payment_links drop constraint if exists payment_links_desc_len;
alter table public.payment_links add constraint payment_links_desc_len
  check (description is null or char_length(description) <= 2000);

comment on table  public.payment_links is '어드민이 만든 결제 링크와 그 결제 결과(페이업 표준결제)';
comment on column public.payment_links.amount is '결제 금액(원). 페이업 승인 요청은 항상 이 값으로 한다.';
comment on column public.payment_links.order_no is '페이업 주문번호 앞 토막. 실제 주문번호는 order_no-난수';

create index if not exists payment_links_created_idx on public.payment_links (created_at desc);

drop trigger if exists payment_links_touch_updated_at on public.payment_links;
create trigger payment_links_touch_updated_at
  before update on public.payment_links
  for each row execute function public.touch_updated_at();

-- RLS — 켜 두고 정책을 두지 않는다. 서버의 service_role 만 읽고 쓴다.
alter table public.payment_links enable row level security;
alter table public.payment_links force  row level security;
