-- 상단 메뉴 세 항목의 이름·노출 설정. 메뉴 추가와 주소 변경은 지원하지 않는다.
create table if not exists public.site_menus (
  key text primary key check (key in ('about', 'explore', 'faq')),
  name text not null check (char_length(btrim(name)) between 1 and 20),
  visible boolean not null default true
);

alter table public.site_menus enable row level security;
alter table public.site_menus force row level security;


