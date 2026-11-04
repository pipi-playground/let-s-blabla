-- 렛블블 0002: 친구 요청(상호 친구), 알림 기록 조회 인덱스, 왕복 횟수를 줄이기 위한 RPC
-- Supabase SQL Editor에 그대로 붙여넣고 실행하세요. (0001 이후 1회)

-- ============================================================
-- friend_requests: 대기 중인 친구 요청만 보관 (수락/거절/취소 시 row 삭제)
-- ============================================================
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists friend_requests_addressee_idx on public.friend_requests (addressee_id);

alter table public.friend_requests enable row level security;

drop policy if exists "friend_requests_select_related" on public.friend_requests;
create policy "friend_requests_select_related"
  on public.friend_requests for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- 요청 생성/수락은 아래 security definer 함수로만 처리. 거절(받은 사람)/취소(보낸 사람)는 직접 삭제 허용
drop policy if exists "friend_requests_delete_related" on public.friend_requests;
create policy "friend_requests_delete_related"
  on public.friend_requests for delete
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ------------------------------------------------------------
-- send_friend_request: 회원코드로 친구 요청.
-- 상대가 이미 나에게 요청을 보낸 상태면 바로 서로 친구가 된다.
-- 반환: { result, target_id, target_nickname, my_nickname }
--   result = requested | accepted | already_friends | already_requested | not_found | self
-- ------------------------------------------------------------
create or replace function public.send_friend_request(p_member_code text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_my_nickname text;
  v_target public.profiles%rowtype;
  v_inserted uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_target from public.profiles where member_code = p_member_code;
  if not found then
    return json_build_object('result', 'not_found');
  end if;
  if v_target.id = v_me then
    return json_build_object('result', 'self');
  end if;

  select nickname into v_my_nickname from public.profiles where id = v_me;

  if exists (select 1 from public.friends where owner_id = v_me and friend_id = v_target.id)
     and exists (select 1 from public.friends where owner_id = v_target.id and friend_id = v_me) then
    return json_build_object('result', 'already_friends', 'target_id', v_target.id, 'target_nickname', v_target.nickname);
  end if;

  -- 상대가 먼저 나에게 요청했다면 즉시 상호 친구로 처리
  if exists (select 1 from public.friend_requests where requester_id = v_target.id and addressee_id = v_me) then
    delete from public.friend_requests
      where (requester_id = v_target.id and addressee_id = v_me)
         or (requester_id = v_me and addressee_id = v_target.id);
    insert into public.friends (owner_id, friend_id)
      values (v_me, v_target.id), (v_target.id, v_me)
      on conflict (owner_id, friend_id) do nothing;
    return json_build_object('result', 'accepted', 'target_id', v_target.id, 'target_nickname', v_target.nickname, 'my_nickname', v_my_nickname);
  end if;

  insert into public.friend_requests (requester_id, addressee_id)
    values (v_me, v_target.id)
    on conflict (requester_id, addressee_id) do nothing
    returning id into v_inserted;

  if v_inserted is null then
    return json_build_object('result', 'already_requested', 'target_id', v_target.id, 'target_nickname', v_target.nickname);
  end if;

  return json_build_object('result', 'requested', 'target_id', v_target.id, 'target_nickname', v_target.nickname, 'my_nickname', v_my_nickname);
end;
$$;

-- ------------------------------------------------------------
-- accept_friend_request: 받은 요청 수락 → 양방향 friends row 생성
-- 반환: 요청 보낸 사람 id (요청이 없으면 null)
-- ------------------------------------------------------------
create or replace function public.accept_friend_request(p_request_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_requester uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.friend_requests
    where id = p_request_id and addressee_id = v_me
    returning requester_id into v_requester;

  if v_requester is null then
    return null;
  end if;

  -- 반대 방향으로 대기 중인 요청이 있었다면 함께 정리
  delete from public.friend_requests where requester_id = v_me and addressee_id = v_requester;

  insert into public.friends (owner_id, friend_id)
    values (v_me, v_requester), (v_requester, v_me)
    on conflict (owner_id, friend_id) do nothing;

  return v_requester;
end;
$$;

revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;

-- ============================================================
-- save_shortcut: 단축버튼 생성/수정 + 기본 전송 대상 교체를 한 번의 왕복으로 처리
-- security invoker → 기존 RLS가 그대로 적용됨
-- 반환: 화면에 바로 쓸 수 있는 단축버튼 JSON (오류 시 { error })
-- ============================================================
create or replace function public.save_shortcut(
  p_id uuid,
  p_name text,
  p_message_template text,
  p_recipient_ids uuid[]
)
returns json
language plpgsql
security invoker set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_ids uuid[] := coalesce(p_recipient_ids, '{}');
  v_row public.shortcuts%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  if cardinality(v_ids) > 5 then
    return json_build_object('error', 'too_many_recipients');
  end if;

  if exists (
    select 1 from unnest(v_ids) as r(id)
    where not exists (select 1 from public.friends f where f.owner_id = v_me and f.friend_id = r.id)
  ) then
    return json_build_object('error', 'not_friend');
  end if;

  if p_id is null then
    insert into public.shortcuts (owner_id, name, message_template)
      values (v_me, p_name, p_message_template)
      returning * into v_row;
  else
    update public.shortcuts
      set name = p_name, message_template = p_message_template, updated_at = now()
      where id = p_id and owner_id = v_me
      returning * into v_row;
    if not found then
      return json_build_object('error', 'not_found');
    end if;
    delete from public.shortcut_recipients where shortcut_id = p_id;
  end if;

  insert into public.shortcut_recipients (shortcut_id, friend_id)
    select v_row.id, r.id from (select distinct unnest(v_ids) as id) r;

  return json_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'messageTemplate', v_row.message_template,
    'cooldownSeconds', v_row.cooldown_seconds,
    'lastSentAt', v_row.last_sent_at,
    'createdAt', v_row.created_at,
    'defaultRecipients', coalesce((
      select json_agg(json_build_object('friendId', p.id, 'nickname', p.nickname))
      from public.shortcut_recipients sr
      join public.profiles p on p.id = sr.friend_id
      where sr.shortcut_id = v_row.id
    ), '[]'::json)
  );
end;
$$;

revoke execute on function public.save_shortcut(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.save_shortcut(uuid, text, text, uuid[]) to authenticated;

-- ============================================================
-- 조회 성능용 인덱스 (알림 기록 정렬, 발송 시 조회)
-- ============================================================
create index if not exists send_logs_sender_created_idx on public.send_logs (sender_id, created_at desc);
create index if not exists send_logs_recipient_created_idx on public.send_logs (recipient_id, created_at desc);
create index if not exists friends_friend_id_idx on public.friends (friend_id);
create index if not exists shortcuts_owner_created_idx on public.shortcuts (owner_id, created_at desc);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists shortcut_recipients_friend_idx on public.shortcut_recipients (friend_id);
