-- ============================================================
-- PATCH 001 — Fix conversation creation + member visibility
-- Run this in your Supabase SQL editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Allow authenticated users to create conversations
create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (auth.role() = 'authenticated');

-- 2. Replace the too-restrictive conversation_members SELECT policy.
--    Old policy only let you see YOUR OWN row.
--    New policy lets you see ALL members of conversations you belong to.
drop policy if exists "Members can see conversation membership" on public.conversation_members;

create policy "Members can see all members of shared conversations"
  on public.conversation_members for select
  using (
    conversation_id in (
      select conversation_id
      from public.conversation_members
      where user_id = auth.uid()
    )
  );

-- 3. RPC function that creates a conversation + adds both members atomically.
--    security definer = runs as the function owner, bypassing the RLS
--    restriction that prevents adding another user as a member.
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
  -- Guard: other user must exist
  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'User not found';
  end if;

  -- Guard: don't chat with yourself
  if other_user_id = auth.uid() then
    raise exception 'Cannot start a conversation with yourself';
  end if;

  -- Check if a conversation between these two users already exists
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

  -- Create the conversation
  insert into public.conversations default values returning id into conv_id;

  -- Add both members
  insert into public.conversation_members (conversation_id, user_id) values
    (conv_id, auth.uid()),
    (conv_id, other_user_id);

  return conv_id;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.create_conversation(uuid) to authenticated;
