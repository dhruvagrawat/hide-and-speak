-- Run this in your Supabase SQL editor to set up the database schema.

-- Enable RLS helper
-- alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  email text not null,
  avatar_url text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select using (auth.role() = 'authenticated');

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, username)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.conversations enable row level security;

-- Conversation members (who is in each conversation)
create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(conversation_id, user_id)
);
alter table public.conversation_members enable row level security;

create policy "Members can see their conversations"
  on public.conversations for select
  using (
    auth.uid() in (
      select user_id from public.conversation_members
      where conversation_id = conversations.id
    )
  );

create policy "Members can see conversation membership"
  on public.conversation_members for select
  using (auth.uid() = user_id);

create policy "Users can join conversations"
  on public.conversation_members for insert
  with check (auth.uid() = user_id);

-- Messages
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
alter table public.messages enable row level security;

create policy "Members can read messages in their conversations"
  on public.messages for select
  using (
    auth.uid() in (
      select user_id from public.conversation_members
      where conversation_id = messages.conversation_id
    )
  );

create policy "Members can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id and
    auth.uid() in (
      select user_id from public.conversation_members
      where conversation_id = messages.conversation_id
    )
  );

-- Auto-update conversation updated_at when a message is sent
create or replace function public.update_conversation_timestamp()
returns trigger language plpgsql as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_inserted
  after insert on public.messages
  for each row execute procedure public.update_conversation_timestamp();

-- Storage bucket for images (run via Supabase dashboard or CLI)
-- insert into storage.buckets (id, name, public) values ('chat-images', 'chat-images', false);
-- insert into storage.buckets (id, name, public) values ('voice-notes', 'voice-notes', false);
