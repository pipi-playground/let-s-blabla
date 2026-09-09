-- 렛블블 초기 스키마
create extension if not exists pgcrypto;

-- ============================================================
-- profiles: auth.users 1:1 확장 (닉네임, 4자리 회원코드)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  member_code char(4) not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 친구 회원코드 검색을 위해 인증된 사용자는 서로의 프로필을 조회 가능 (지인 소규모 서비스 전제)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- 4자리 회원코드 랜덤 발급 (중복 시 재시도)
create or replace function public.generate_member_code()
returns char(4)
language plpgsql
as $$
declare
  new_code char(4);
  tries int := 0;
begin
  loop
    new_code := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where member_code = new_code);
    tries := tries + 1;
    if tries > 50 then
      raise exception 'member_code 생성 실패: 재시도 초과';
    end if;
  end loop;
  return new_code;
end;
$$;

-- 회원가입 시 profiles row 자동 생성 (기본 닉네임: 블블이+랜덤 2자리)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  default_nickname text;
begin
  default_nickname := coalesce(
    nullif(new.raw_user_meta_data->>'nickname', ''),
    '블블이' || lpad((floor(random() * 90 + 10))::int::text, 2, '0')
  );

  insert into public.profiles (id, nickname, member_code)
  values (new.id, default_nickname, public.generate_member_code());

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- friends: 회원코드로 추가한 상대 (단방향)
-- ============================================================
create table public.friends (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, friend_id),
  check (owner_id <> friend_id)
);

alter table public.friends enable row level security;

-- 내가 추가한 관계 + 나를 추가한 관계(누가 나를 친구로 등록했는지) 모두 조회 가능해야
-- 뮤트 대상 목록을 구성할 수 있음
create policy "friends_select_related"
  on public.friends for select
  to authenticated
  using (owner_id = auth.uid() or friend_id = auth.uid());

create policy "friends_insert_own"
  on public.friends for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "friends_delete_own"
  on public.friends for delete
  to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- shortcuts: 단축 버튼
-- ============================================================
create table public.shortcuts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  message_template text not null,
  cooldown_seconds int not null default 30,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shortcuts enable row level security;

create policy "shortcuts_all_own"
  on public.shortcuts for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 단축버튼 기본 전송 대상
create table public.shortcut_recipients (
  shortcut_id uuid not null references public.shortcuts(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  primary key (shortcut_id, friend_id)
);

alter table public.shortcut_recipients enable row level security;

create policy "shortcut_recipients_all_own"
  on public.shortcut_recipients for all
  to authenticated
  using (exists (
    select 1 from public.shortcuts s
    where s.id = shortcut_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.shortcuts s
    where s.id = shortcut_id and s.owner_id = auth.uid()
  ));

-- ============================================================
-- push_subscriptions: 브라우저별 웹푸시 구독 정보
-- ============================================================
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_all_own"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- mutes: 특정 상대의 알림을 받지 않기
-- ============================================================
create table public.mutes (
  muter_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id)
);

alter table public.mutes enable row level security;

create policy "mutes_all_own"
  on public.mutes for all
  to authenticated
  using (muter_id = auth.uid())
  with check (muter_id = auth.uid());

-- ============================================================
-- dnd_settings: 방해 금지 시간대
-- ============================================================
create table public.dnd_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  start_time time not null default '23:00',
  end_time time not null default '08:00',
  timezone text not null default 'Asia/Seoul'
);

alter table public.dnd_settings enable row level security;

create policy "dnd_settings_all_own"
  on public.dnd_settings for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- send_logs: 발송 이력 (디버깅 / 결과 표시용)
-- ============================================================
create table public.send_logs (
  id uuid primary key default gen_random_uuid(),
  shortcut_id uuid references public.shortcuts(id) on delete set null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status text not null check (status in ('sent', 'muted', 'dnd', 'failed', 'no_subscription')),
  created_at timestamptz not null default now()
);

alter table public.send_logs enable row level security;

create policy "send_logs_select_related"
  on public.send_logs for select
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- insert는 서버(service role)에서만 수행하므로 authenticated insert 정책 없음
