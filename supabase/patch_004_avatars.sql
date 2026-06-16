-- ============================================================
-- PATCH 004 — Profile picture storage policies
-- Run this AFTER creating the "avatars" bucket in
-- Storage → New bucket (mark it Public — see SUPABASE_SETUP.md)
-- ============================================================

-- Anyone signed in can view any avatar (it's a public bucket, but RLS
-- on storage.objects still gates direct table access / listing).
create policy "Avatars are viewable by authenticated users"
  on storage.objects for select
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- You can only upload/replace/delete your own avatar — enforced by
-- requiring the object path to start with your own user id, e.g.
-- "<user_id>/avatar.jpg". The app uploads to exactly that path.
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
