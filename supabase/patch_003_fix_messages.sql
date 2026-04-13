-- ============================================================
-- PATCH 003 — Fix messages RLS + enable realtime
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Enable realtime for the messages table.
--    Without this, the postgres_changes subscription in the app never fires.
alter publication supabase_realtime add table public.messages;

-- 2. Simplify messages SELECT policy to reuse my_conversation_ids()
--    so it's consistent with the conversation_members policy fix.
drop policy if exists "Members can read messages in their conversations"
  on public.messages;

create policy "Members can read messages in their conversations"
  on public.messages for select
  using (
    conversation_id in (select public.my_conversation_ids())
  );

-- 3. Simplify messages INSERT policy the same way
drop policy if exists "Members can send messages" on public.messages;

create policy "Members can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and conversation_id in (select public.my_conversation_ids())
  );
