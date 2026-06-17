-- ============================================================
-- PATCH 008 — Stories / Status (24-hour disappearing updates)
-- ============================================================
--
-- Backs the Status tab. A story is one image (+ optional caption) that's
-- visible to the author's friends for 24 hours. Requires patch_007
-- (defines public.are_friends).
--
-- Run this AFTER creating the "stories" storage bucket in
-- Storage → New bucket (mark it Public — see SUPABASE_SETUP.md).

-- ── stories ─────────────────────────────────────────────────
create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  image_url   text not null,
  caption     text,
  created_at  timestamptz not null default now()
);

create index if not exists stories_user_id_idx on public.stories (user_id);
create index if not exists stories_created_at_idx on public.stories (created_at desc);

alter table public.stories enable row level security;

-- You can read your own stories, plus those of anyone you're friends with,
-- and only ones from the last 24 hours.
create policy "Friends can read recent stories"
  on public.stories for select
  using (
    created_at > now() - interval '24 hours'
    and (user_id = auth.uid() or public.are_friends(auth.uid(), user_id))
  );

-- You can only post stories as yourself.
create policy "You can post your own stories"
  on public.stories for insert
  with check (user_id = auth.uid());

-- You can delete your own stories.
create policy "You can delete your own stories"
  on public.stories for delete
  using (user_id = auth.uid());

-- ── Storage policies for the "stories" bucket ───────────────
-- App uploads to "<user_id>/<timestamp>.<ext>".
create policy "Stories are viewable by authenticated users"
  on storage.objects for select
  using (bucket_id = 'stories' and auth.role() = 'authenticated');

create policy "Users can upload their own stories"
  on storage.objects for insert
  with check (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own stories"
  on storage.objects for delete
  using (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Optional cleanup ────────────────────────────────────────
-- Stories are hidden after 24h by the SELECT policy above, but the rows
-- (and storage objects) still linger. If you have pg_cron enabled you can
-- hard-delete expired rows nightly:
--
--   select cron.schedule(
--     'purge-expired-stories', '0 3 * * *',
--     $$delete from public.stories where created_at < now() - interval '24 hours'$$
--   );
