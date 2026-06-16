# Supabase dashboard setup

Everything in `schema.sql` / the patches is code you run once. Everything
below is dashboard configuration — there's no SQL for it, so it has to be
done by hand, once, per Supabase project. Project ref currently in use:
`etnxrimhdgchcowkptqk` (from the `.env.local` files already in this repo).

## 1. Database schema

SQL Editor → run, in order: `schema.sql`, `patch_001_fix_rls.sql`,
`patch_002_fix_recursion.sql`, `patch_003_fix_messages.sql`,
`patch_004_avatars.sql`, `patch_005_add_phone.sql`. See `supabase/README.md` for what each one
actually does.

## 2. Storage buckets

Storage → New bucket:

| Bucket | Public? |
|---|---|
| `chat-images` | No |
| `voice-notes` | No |
| `avatars` | **Yes** |

`chat-images`/`voice-notes` stay private — access goes through the anon
key + RLS, same as every other table. `avatars` is public (profile
pictures are meant to be visible to anyone, like every other chat app) —
`patch_004_avatars.sql` still restricts who can *upload/replace/delete*
to "only your own", it just doesn't gate reads.

Nothing in the schema creates buckets for you (Supabase doesn't let you
create storage buckets via plain SQL the way you create tables), so this
step is dashboard-only — run the SQL patch *after* creating the bucket.

## 3. Email auth (signup/login)

Already works out of the box once the schema is run — Supabase's email
provider is on by default. Two things worth doing before going live:

- **Authentication → Email Templates** — customize the confirmation /
  magic-link / password-reset emails. The defaults are plain
  "Supabase"-branded templates; replace with your own copy/branding.
- **Authentication → Settings → SMTP** — by default Supabase sends auth
  emails from its own shared SMTP (rate-limited, fine for development,
  not for real users). Plug in your own SMTP (Resend, Postmark, SES,
  whatever) before launch so emails are reliable and not rate-limited.

## 4. Google OAuth (mobile "Continue with Google")

Code already calls this — see [apps/mobile/lib/auth.ts](../apps/mobile/lib/auth.ts).
To make it work:

1. **Google Cloud Console** → APIs & Services → Credentials → Create an
   OAuth 2.0 Client ID, type **Web application** (yes, web — Supabase
   handles the redirect, the mobile app never sees the Google client
   secret).
2. Add this **Authorized redirect URI**:
   `https://etnxrimhdgchcowkptqk.supabase.co/auth/v1/callback`
3. Supabase dashboard → **Authentication → Providers → Google** → enable,
   paste the Client ID + Client Secret from step 1.

## 5. Phone OTP via Vonage

Code already calls this — see `sendPhoneOtp`/`verifyPhoneOtp` in
[apps/mobile/lib/auth.ts](../apps/mobile/lib/auth.ts). To make it work:

1. **Authentication → Providers → Phone** → enable.
2. **SMS Provider → Vonage**.
3. Enter your Vonage **API Key** and **API Secret** (the secret you sent
   me earlier is in the root `.env.local` as `VONAGE_API_SECRET` — that
   file is gitignored, paste the value from there into this field, never
   into source).
4. Set **From** to your Vonage virtual number.

Note: this is SMS only. Supabase's phone-auth providers (Vonage, Twilio,
MessageBird, TextLocal) don't support sending the OTP over WhatsApp —
there's no dashboard toggle for that. A WhatsApp-delivered OTP would need
a custom flow outside Supabase Auth (a Edge Function calling Vonage's
separate Messages API with `channel: whatsapp`, your own OTP table) —
doable, but it's a separate project from anything here.

## 6. Realtime

Already enabled for `messages` by `patch_003_fix_messages.sql`. If you
ever add new tables that need live updates (e.g. a future `stories` or
`group_members` table), remember each one needs its own
`alter publication supabase_realtime add table public.<table>;` —
nothing else triggers it automatically.

## What's intentionally *not* here

- **Push notifications** — needs an Edge Function + a mobile dev-client
  build, not dashboard config. See `apps/mobile/README.md`.
- **Voice/video calling** — needs WebRTC + a TURN server, not Supabase at
  all (Supabase would only carry call signaling, same as the P2P image
  send idea).
