-- ============================================================
-- PATCH 007 — Friend requests + friendship-gated conversations
-- ============================================================
--
-- New social model: you must be friends before you can chat. A user sends
-- a request, the other accepts, and only then can either start a
-- conversation. Backs lib/friends.tsx and the Requests tab.
--
-- Run this AFTER patch_001 (which defines create_conversation) — the tail
-- of this file redefines create_conversation to add a friendship guard.

-- ── friend_requests ─────────────────────────────────────────
create table if not exists public.friend_requests (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null references public.profiles(id) on delete cascade,
  to_user     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending'
              check (status in ('pending', 'accepted', 'declined')),
  created_at  timestamptz not null default now(),
  -- Can't friend-request yourself.
  constraint no_self_request check (from_user <> to_user)
);

-- Only one request per pair, regardless of who sent it (so A→B blocks a
-- later B→A duplicate). Enforced on the unordered pair.
create unique index if not exists friend_requests_unique_pair
  on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user));

create index if not exists friend_requests_to_user_idx on public.friend_requests (to_user);
create index if not exists friend_requests_from_user_idx on public.friend_requests (from_user);

alter table public.friend_requests enable row level security;

-- Either party in the request can read it.
create policy "Either party can read a friend request"
  on public.friend_requests for select
  using (from_user = auth.uid() or to_user = auth.uid());

-- You can only create requests as yourself.
create policy "You can send a friend request as yourself"
  on public.friend_requests for insert
  with check (from_user = auth.uid());

-- Only the recipient can accept/decline (update status).
create policy "Recipient can respond to a friend request"
  on public.friend_requests for update
  using (to_user = auth.uid())
  with check (to_user = auth.uid());

-- Only the sender can cancel (delete) a pending request they sent.
create policy "Sender can cancel their own request"
  on public.friend_requests for delete
  using (from_user = auth.uid());

-- ── Friendship helper ───────────────────────────────────────
-- security definer so it can read friend_requests regardless of the
-- caller's RLS view (it only ever answers a yes/no about the caller).
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted'
      and (
        (from_user = a and to_user = b) or
        (from_user = b and to_user = a)
      )
  );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ── Gate create_conversation on friendship ──────────────────
-- Same body as patch_001, plus a guard that both users are accepted
-- friends before any conversation row is created.
create or replace function public.create_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  existing_conv_id uuid;
begin
  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'User not found';
  end if;

  if other_user_id = auth.uid() then
    raise exception 'Cannot start a conversation with yourself';
  end if;

  -- NEW: must be friends first.
  if not public.are_friends(auth.uid(), other_user_id) then
    raise exception 'You must be friends before starting a conversation';
  end if;

  select cm1.conversation_id into existing_conv_id
  from public.conversation_members cm1
  join public.conversation_members cm2
    on cm1.conversation_id = cm2.conversation_id
  where cm1.user_id = auth.uid()
    and cm2.user_id = other_user_id
  limit 1;

  if existing_conv_id is not null then
    return existing_conv_id;
  end if;

  insert into public.conversations default values returning id into conv_id;

  insert into public.conversation_members (conversation_id, user_id) values
    (conv_id, auth.uid()),
    (conv_id, other_user_id);

  return conv_id;
end;
$$;

grant execute on function public.create_conversation(uuid) to authenticated;
