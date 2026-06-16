# Supabase schema — how it works

Run these in the SQL Editor, **in order**:

```
schema.sql
patch_001_fix_rls.sql
patch_002_fix_recursion.sql
patch_003_fix_messages.sql
```

Each patch fixes a specific bug found after the initial schema — they're
kept separate (rather than folded into `schema.sql`) so the history of
*why* each policy looks the way it does isn't lost. See
`SUPABASE_SETUP.md` for everything else (auth providers, email, storage
buckets).

`patch_003_fix_messages.sql` also runs
`alter publication supabase_realtime add table public.messages;` — without
it, every `postgres_changes` subscription in both apps (new messages,
the global new-message banner) silently never fires. Easy to miss since
nothing errors, it just looks like realtime is "broken".

## Tables

```
profiles
  Extends auth.users (1:1, same id). Auto-created by the
  handle_new_user() trigger on signup — username defaults to the part of
  the email before the @. phone is copied from auth.users.phone when
  someone signs up via phone OTP (patch_005_add_phone.sql); it's how the
  "new chat by phone" lookup works — same exact-match pattern as email,
  no contact upload.

conversations
  Just an id + timestamps. The actual "who's in it" lives in
  conversation_members. updated_at is bumped automatically by the
  update_conversation_timestamp() trigger whenever a message is inserted
  — that's what conversation lists sort by.

conversation_members
  Join table: (conversation_id, user_id). A conversation always has
  exactly 2 rows here today (1:1 chat) — nothing in the schema enforces
  that limit, so this is also the table groups would extend.

messages
  message_type: 'text' | 'image' | 'voice_note'
  image_hidden: whether the receiver sees it locked behind a tap-to-reveal
  image_filter: 'blur' | 'pixelate' | 'noir' — only meaningful when hidden
```

## Row Level Security

Every table has RLS enabled. The short version of each policy:

- **profiles** — any authenticated user can read any profile (needed to
  look people up by email to start a chat); you can only update your own.
- **conversations** / **conversation_members** — you can only see rows
  for conversations you're a member of. `patch_002_fix_recursion.sql`
  introduced `my_conversation_ids()` as a `security definer` helper
  function specifically to avoid the policy querying the same table it's
  protecting (which Postgres treats as infinite recursion otherwise).
- **messages** — you can read/insert messages only in conversations
  you're a member of, and only as yourself (`sender_id = auth.uid()`).

This is also why the mobile/web "new message" realtime listeners can
subscribe to the *entire* `messages` table with no filter and still only
ever receive rows they're allowed to see — Realtime enforces the same
`SELECT` policy on `postgres_changes` events.

## RPC: `create_conversation`

Defined in `patch_001_fix_rls.sql`. Given another user's id, it:
1. Checks if a conversation between you two already exists (returns its
   id if so, instead of creating a duplicate).
2. Otherwise creates a new conversation + inserts both members, atomically,
   as `security definer` (so the insert isn't blocked by the
   "users can join conversations" policy needing `auth.uid() = user_id`
   for *both* rows being inserted in one transaction).

Both `apps/mobile` and `apps/web` call this via `supabase.rpc('create_conversation', { other_user_id })`.
