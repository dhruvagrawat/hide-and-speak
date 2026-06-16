# Hide & Speak — Web

Next.js 16 (App Router) + Tailwind CSS, sharing the same Supabase backend
as the mobile app — same auth, same conversations, same storage buckets.

## Setup

```bash
cp .env.example .env.local   # fill in your Supabase project values
npm install --legacy-peer-deps   # from repo root, or just `npm run web` at the root
npm run dev
```

`.env.local` needs:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-only, never expose to the client
NEXT_PUBLIC_DEMO_MODE=false   # true = explore the UI with canned data, no Supabase needed
```

## Structure

```
app/
├── page.tsx                  Landing page
├── login/, register/          Email/password auth (Supabase)
├── chats/
│   ├── layout.tsx               Wraps PresenceProvider
│   ├── page.tsx                  Chat list — online dots, new-chat-by-email
│   └── [id]/page.tsx              Realtime thread — text + hidden images
├── icon.png, favicon.ico        Auto-detected by Next's metadata file convention
└── proxy.ts                     Keeps Supabase auth cookies fresh on every request
                                   (Next 16 renamed middleware.ts → proxy.ts)

components/
└── ImageMessage.tsx             Hidden/reveal image bubble + send-options sheet

lib/
├── supabase/
│   ├── client.ts                  Browser client (Client Components)
│   ├── server.ts                   Server client (Server Components / Route Handlers)
│   └── middleware.ts                Session-refresh helper used by proxy.ts
├── types.ts                       Shared TypeScript shapes (mirrors apps/mobile/lib/types.ts)
├── demo.ts                         NEXT_PUBLIC_DEMO_MODE canned data
└── presence.tsx                    Online/offline via Supabase Realtime Presence
```

Uses [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side/nextjs)
for cookie-based sessions, so logging in here shares the same session model
the mobile app uses (just over cookies instead of `AsyncStorage`).

## Notable behaviour

- **No `?username=` in the URL.** Chat links are just `/chats/<id>` — the
  page looks up who you're talking to itself via `conversation_members`
  (or the demo data), so the address bar and browser history never reveal
  who's in a conversation.
- **Presence** uses the exact same Supabase Realtime Presence channel name
  (`presence:online`) as the mobile app, so online/offline status is
  shared live between both — see `apps/mobile/README.md` for how it works.

## Not built here (yet)

Google OAuth and phone OTP exist on mobile but not here — both need a
separate web-specific redirect/provider configuration beyond just code.
Peer-to-peer image send, app-lock, and the new-message banner are
mobile-specific concepts (backgrounding, biometrics, push) and don't have
a web equivalent in this pass.
