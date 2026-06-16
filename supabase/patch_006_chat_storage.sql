-- ============================================================
-- PATCH 006 — RLS policies for chat-images & voice-notes + signed URLs
-- ============================================================
--
-- Neither bucket had ANY storage.objects policies before this patch —
-- with RLS enabled (the Supabase default), that means zero access,
-- public or not. The app already uploads to "<conversation_id>/<file>",
-- so these policies scope read/write to members of that conversation,
-- using the same my_conversation_ids() helper from patch_002.
--
-- Both apps were also calling getPublicUrl() on buckets marked Private
-- in the setup docs — that combination doesn't actually work (a private
-- bucket has no public URL access regardless of RLS). Both apps now call
-- createSignedUrl() instead, which these policies make function
-- correctly. Signed URLs are generated with a long expiry (1 year) and
-- stored as-is in messages.image_url / voice_note_url — there's no
-- refresh mechanism yet, so a URL generated today stops working in a
-- year. Fine for now; revisit if that's ever a real problem.

create policy "Conversation members can read chat images"
  on storage.objects for select
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1]::uuid in (select public.my_conversation_ids())
  );

create policy "Conversation members can upload chat images"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1]::uuid in (select public.my_conversation_ids())
  );

create policy "Conversation members can read voice notes"
  on storage.objects for select
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1]::uuid in (select public.my_conversation_ids())
  );

create policy "Conversation members can upload voice notes"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1]::uuid in (select public.my_conversation_ids())
  );
