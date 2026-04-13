-- ============================================================
-- PATCH 002 — Fix infinite recursion in conversation_members RLS
-- Run this in your Supabase SQL editor AFTER patch_001
-- ============================================================

-- 1. Drop the recursive policy from patch_001
drop policy if exists "Members can see all members of shared conversations"
  on public.conversation_members;

-- 2. Create a security definer helper function.
--    Because it is security definer it bypasses RLS when it runs,
--    so querying conversation_members inside it does NOT trigger the
--    policy again → no recursion.
create or replace function public.my_conversation_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select conversation_id
  from public.conversation_members
  where user_id = auth.uid();
$$;

grant execute on function public.my_conversation_ids() to authenticated;

-- 3. Re-create the policy using the helper instead of a direct subquery
create policy "Members can see all members of shared conversations"
  on public.conversation_members for select
  using (
    conversation_id in (select public.my_conversation_ids())
  );
