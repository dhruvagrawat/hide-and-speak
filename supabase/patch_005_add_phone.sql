-- ============================================================
-- PATCH 005 — Add phone number to profiles (for the contact finder)
-- Run this AFTER patch_004_avatars.sql
-- ============================================================

alter table public.profiles add column if not exists phone text unique;

-- Re-create handle_new_user() to also copy phone from auth.users (set
-- when someone signs up via phone OTP) and to stop NULL-email phone
-- signups from failing the username NOT NULL constraint — this was a
-- latent bug in the original trigger, now fixed as part of this patch.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, phone, username)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(split_part(new.email, '@', 1), 'user_' || substr(new.id::text, 1, 8))
  );
  return new;
end;
$$;

-- Existing users who signed up by phone before this patch won't have
-- auth.users.phone backfilled automatically by the trigger above (it
-- only runs on INSERT) — this catches them up once.
update public.profiles p
set phone = u.phone
from auth.users u
where p.id = u.id and p.phone is null and u.phone is not null;
