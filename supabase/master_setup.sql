-- ============================================================
-- HIDE & SPEAK — MASTER SETUP
-- ============================================================
-- One script that builds the entire database from an empty Supabase
-- project. It is the consolidated final state of schema.sql + patch_001
-- through patch_008 (you do NOT need to run those individually if you run
-- this). Safe to run more than once — every statement is guarded with
-- "if not exists" / "or replace" / "drop ... if exists".
--
-- HOW TO RUN
--   1. Open your project at supabase.com → SQL Editor → New query.
--   2. Paste this whole file and click "Run".
--   3. That's it — tables, policies, functions, storage buckets and
--      realtime are all set up. (Storage buckets are created below too,
--      so you don't need to make them by hand.)
--
-- WHAT IT SETS UP
--   • profiles (with phone), conversations, conversation_members, messages
--   • friend_requests  (you must be friends before you can chat)
--   • stories           (24-hour disappearing status updates)
--   • Row Level Security policies for every table
--   • Helper functions + the create_conversation() RPC (friendship-gated)
--   • Storage buckets: avatars, chat-images, voice-notes, stories (+ RLS)
--   • Realtime on the messages table
-- ============================================================

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ============================================================
-- 1. TABLES
-- ============================================================

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  email text not null,
  phone text unique,
  avatar_url text,
  created_at timestamptz default now()
);

-- Safety net for projects whose `profiles` table predates these columns:
-- `create table if not exists` above won't alter an existing table, so add
-- any missing columns explicitly (idempotent — safe to re-run).
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_phone_key'
  ) then
    alter table public.profiles add constraint profiles_phone_key unique (phone);
  end if;
end $$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  content text,
  message_type text not null default 'text' check (message_type in ('text', 'image', 'voice_note')),
  image_url text,
  image_hidden boolean not null default false,
  image_filter text check (image_filter in ('blur', 'pixelate', 'noir')),
  voice_note_url text,
  created_at timestamptz default now()
);

create table if not exists public.friend_requests (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null references public.profiles(id) on delete cascade,
  to_user     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending'
              check (status in ('pending', 'accepted', 'declined')),
  created_at  timestamptz not null default now(),
  constraint no_self_request check (from_user <> to_user)
);
create unique index if not exists friend_requests_unique_pair
  on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user));
create index if not exists friend_requests_to_user_idx   on public.friend_requests (to_user);
create index if not exists friend_requests_from_user_idx on public.friend_requests (from_user);

create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  image_url   text not null,
  caption     text,
  created_at  timestamptz not null default now()
);
create index if not exists stories_user_id_idx    on public.stories (user_id);
create index if not exists stories_created_at_idx  on public.stories (created_at desc);

-- ============================================================
-- 2. FUNCTIONS
-- ============================================================

-- Auto-create a profile row when someone signs up (email or phone OTP).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Single-auth design: the user verifies EITHER email OR phone, and supplies
  -- the *other* identifier as plain signup metadata (no second verification).
  -- So pull email/phone/username from the verified auth columns first, then
  -- fall back to whatever was passed in raw_user_meta_data at signup.
  insert into public.profiles (id, email, phone, username)
  values (
    new.id,
    coalesce(new.email, nullif(new.raw_user_meta_data->>'email', '')),
    coalesce(new.phone, nullif(new.raw_user_meta_data->>'phone', '')),
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      split_part(new.email, '@', 1),
      'user_' || substr(new.id::text, 1, 8)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- security definer so it bypasses RLS internally → no recursion when used
-- inside conversation_members / messages policies.
create or replace function public.my_conversation_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select conversation_id from public.conversation_members where user_id = auth.uid();
$$;
grant execute on function public.my_conversation_ids() to authenticated;

-- Bump conversations.updated_at on every new message.
create or replace function public.update_conversation_timestamp()
returns trigger language plpgsql as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

-- Are two users accepted friends? (security definer: answers yes/no about
-- the caller regardless of their RLS view of friend_requests.)
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted'
      and ((from_user = a and to_user = b) or (from_user = b and to_user = a))
  );
$$;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Create (or reuse) a 1:1 conversation — only allowed between friends.
create or replace function public.create_conversation(other_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public
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
  if not public.are_friends(auth.uid(), other_user_id) then
    raise exception 'You must be friends before starting a conversation';
  end if;

  select cm1.conversation_id into existing_conv_id
  from public.conversation_members cm1
  join public.conversation_members cm2 on cm1.conversation_id = cm2.conversation_id
  where cm1.user_id = auth.uid() and cm2.user_id = other_user_id
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

-- ============================================================
-- 3. TRIGGERS
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row execute procedure public.update_conversation_timestamp();

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles            enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.friend_requests      enable row level security;
alter table public.stories              enable row level security;

-- profiles
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select using (auth.role() = 'authenticated');
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- conversations
drop policy if exists "Members can see their conversations" on public.conversations;
create policy "Members can see their conversations"
  on public.conversations for select
  using (id in (select public.my_conversation_ids()));
drop policy if exists "Authenticated users can create conversations" on public.conversations;
create policy "Authenticated users can create conversations"
  on public.conversations for insert with check (auth.role() = 'authenticated');

-- conversation_members
drop policy if exists "Members can see all members of shared conversations" on public.conversation_members;
create policy "Members can see all members of shared conversations"
  on public.conversation_members for select
  using (conversation_id in (select public.my_conversation_ids()));
drop policy if exists "Users can join conversations" on public.conversation_members;
create policy "Users can join conversations"
  on public.conversation_members for insert with check (auth.uid() = user_id);

-- messages
drop policy if exists "Members can read messages in their conversations" on public.messages;
create policy "Members can read messages in their conversations"
  on public.messages for select
  using (conversation_id in (select public.my_conversation_ids()));
drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id and conversation_id in (select public.my_conversation_ids()));

-- friend_requests
drop policy if exists "Either party can read a friend request" on public.friend_requests;
create policy "Either party can read a friend request"
  on public.friend_requests for select
  using (from_user = auth.uid() or to_user = auth.uid());
drop policy if exists "You can send a friend request as yourself" on public.friend_requests;
create policy "You can send a friend request as yourself"
  on public.friend_requests for insert with check (from_user = auth.uid());
drop policy if exists "Recipient can respond to a friend request" on public.friend_requests;
create policy "Recipient can respond to a friend request"
  on public.friend_requests for update
  using (to_user = auth.uid()) with check (to_user = auth.uid());
drop policy if exists "Sender can cancel their own request" on public.friend_requests;
create policy "Sender can cancel their own request"
  on public.friend_requests for delete using (from_user = auth.uid());

-- stories
drop policy if exists "Friends can read recent stories" on public.stories;
create policy "Friends can read recent stories"
  on public.stories for select
  using (
    created_at > now() - interval '24 hours'
    and (user_id = auth.uid() or public.are_friends(auth.uid(), user_id))
  );
drop policy if exists "You can post your own stories" on public.stories;
create policy "You can post your own stories"
  on public.stories for insert with check (user_id = auth.uid());
drop policy if exists "You can delete your own stories" on public.stories;
create policy "You can delete your own stories"
  on public.stories for delete using (user_id = auth.uid());

-- ============================================================
-- 5. STORAGE BUCKETS  (created here so you don't have to click around)
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('avatars',     'avatars',     true),
  ('stories',     'stories',     true),
  ('chat-images', 'chat-images', false),
  ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

-- avatars (public bucket, but storage.objects still gated by RLS)
drop policy if exists "Avatars are viewable by authenticated users" on storage.objects;
create policy "Avatars are viewable by authenticated users"
  on storage.objects for select
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- chat-images (private; scoped to conversation members; signed URLs)
drop policy if exists "Conversation members can read chat images" on storage.objects;
create policy "Conversation members can read chat images"
  on storage.objects for select
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1]::uuid in (select public.my_conversation_ids()));
drop policy if exists "Conversation members can upload chat images" on storage.objects;
create policy "Conversation members can upload chat images"
  on storage.objects for insert
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1]::uuid in (select public.my_conversation_ids()));

-- voice-notes (private; scoped to conversation members; signed URLs)
drop policy if exists "Conversation members can read voice notes" on storage.objects;
create policy "Conversation members can read voice notes"
  on storage.objects for select
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1]::uuid in (select public.my_conversation_ids()));
drop policy if exists "Conversation members can upload voice notes" on storage.objects;
create policy "Conversation members can upload voice notes"
  on storage.objects for insert
  with check (bucket_id = 'voice-notes' and (storage.foldername(name))[1]::uuid in (select public.my_conversation_ids()));

-- stories (public read for signed-in users; write to your own folder)
drop policy if exists "Stories are viewable by authenticated users" on storage.objects;
create policy "Stories are viewable by authenticated users"
  on storage.objects for select
  using (bucket_id = 'stories' and auth.role() = 'authenticated');
drop policy if exists "Users can upload their own stories" on storage.objects;
create policy "Users can upload their own stories"
  on storage.objects for insert
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can delete their own stories" on storage.objects;
create policy "Users can delete their own stories"
  on storage.objects for delete
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 6. REALTIME  (so the message subscription actually fires)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ============================================================
-- Done. Backfill phone for any pre-existing phone-signup users:
-- ============================================================
update public.profiles p
set phone = u.phone
from auth.users u
where p.id = u.id and p.phone is null and u.phone is not null;
