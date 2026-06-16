# Hide & Speak

A privacy-first Android chat app built with Expo + React Native, fully self-hostable via Supabase.

The signature feature: **hidden image messages** — send a photo locked behind a blur, pixelate, or noir filter. The receiver taps to reveal it. Images never touch the phone gallery unless the user explicitly saves them.

---

## Features

- **Email sign-up / login** via Supabase Auth
- **Real-time messaging** — messages appear instantly on both sides
- **Hidden image messages** — three reveal filters:
  - `Blur` — heavy blur overlay (expo-blur)
  - `Pixelate` — mosaic grid overlay
  - `Noir` — dark desaturating tint
- **Tap to reveal** hidden images; long-press for full-screen view or save to gallery
- **Images stay private** — stored in Supabase Storage, never auto-saved to the phone gallery
- **Dark theme** throughout

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | [Expo](https://expo.dev) SDK 54 + React Native 0.81 |
| Navigation | [Expo Router](https://expo.github.io/router) v6 |
| Backend / Auth | [Supabase](https://supabase.com) (Postgres + Auth + Realtime + Storage) |
| Realtime | Supabase `postgres_changes` subscription |
| Image blur | `expo-blur` |
| Image picker | `expo-image-picker` |
| Gallery save | `expo-media-library` |
| Language | TypeScript (strict) |

---

## Self-hosting guide

Everything runs on your own Supabase project — no third-party servers, no telemetry.

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region close to you
3. Note your **Project URL** and **anon public key** from Settings → API

### 2. Set up the database

Open the **SQL Editor** in your Supabase dashboard and run the files in order:

```
supabase/schema.sql
supabase/patch_001_fix_rls.sql
supabase/patch_002_fix_recursion.sql
supabase/patch_003_fix_messages.sql
supabase/patch_004_avatars.sql
```

See `supabase/SUPABASE_SETUP.md` for everything else (storage buckets,
email, Google OAuth, Vonage) — full dashboard walkthrough.

### 3. Create storage buckets

In your Supabase dashboard → **Storage → New bucket**, before running
`patch_004_avatars.sql` (it adds policies for the `avatars` bucket):

| Bucket name | Public? |
|-------------|---------|
| `chat-images` | No (private) |
| `voice-notes` | No (private) |
| `avatars` | **Yes** (public) |

### 4. Configure the app

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

> **Never commit `.env.local`** — it is already in `.gitignore`.
> The service role key should never go in the app; keep it server-side only.

### 5. Install and run

```bash
npm install --legacy-peer-deps
npm run android          # connected device or emulator
# or
npm start                # scan QR with Expo Go
```

---

## App icon & splash

`assets/icon.png`, `assets/adaptive-icon.png`, and `assets/splash.png` are
already in place — a small pixel-art speech-bubble mark in the app's brand
colors. The web app uses the same mark (`apps/web/app/icon.png` and
`favicon.ico`). Replace these any time with your own art; the specs below
still apply if you do.

### `assets/icon.png`
- **Size:** 1024 × 1024 px
- **Format:** PNG, no transparency
- **Used for:** App icon fallback, Google Play Store listing icon
- **Design tip:** Keep the main graphic inside the central 768 × 768 px safe zone

### `assets/adaptive-icon.png`
- **Size:** 1024 × 1024 px
- **Format:** PNG, **transparent background** (the background color `#0D0D0D` is applied separately)
- **Used for:** Android adaptive icon foreground layer (Android 8+)
- **Design tip:** Keep the main graphic inside the central 66% (672 × 672 px) safe zone — Android masks the rest into a circle/squircle/teardrop depending on the launcher

### `assets/splash.png`
- **Size:** 1284 × 2778 px (or any tall portrait aspect ratio, min 1080 × 1920)
- **Format:** PNG
- **Used for:** Splash / launch screen
- **Design tip:** Put the logo in the exact center — `resizeMode: "contain"` will letterbox it on every screen size; the background fills with `#0D0D0D`

### Quick reference table

| File | Dimensions | Transparency | Notes |
|------|-----------|-------------|-------|
| `assets/icon.png` | 1024 × 1024 | No | Play Store icon |
| `assets/adaptive-icon.png` | 1024 × 1024 | **Yes** | Centered, 66% safe zone |
| `assets/splash.png` | 1284 × 2778 | No | Center-weighted design |

---

## Project structure

This is an npm-workspaces monorepo:

```
apps/
├── mobile/      Expo Router app — the main product. See apps/mobile/README.md
│                for how demo mode, presence, app lock, the new-message
│                banner, and the P2P stub all work.
└── web/         Next.js app — same Supabase backend, same auth, same
                 conversations. See apps/web/README.md.
supabase/
├── schema.sql, patch_*.sql     Run once in the SQL Editor, in order
├── README.md                    What each table/policy/RPC actually does
└── SUPABASE_SETUP.md             Dashboard config: storage buckets, email,
                                    Google OAuth, Vonage phone OTP
```

Each app folder's README is the source of truth for that app's internals;
this file stays high-level.

---

## What's built vs. stubbed vs. not started

| Feature | Status | Notes |
|---|---|---|
| Email auth, chat list, realtime text messages | ✅ Built | Mobile + web |
| Hidden images (blur/pixelate/noir, tap to reveal) | ✅ Built | Mobile + web |
| Demo mode (no Supabase needed) | ✅ Built | Mobile + web |
| Online/offline presence | ✅ Built | Shared between mobile + web via one Realtime Presence channel |
| Mobile app lock (biometric/passcode) | ✅ Built | Mobile only — see `apps/mobile/lib/applock.tsx` |
| In-app "new message from X" banner | ✅ Built | Mobile only, foreground-only — see "real push" below |
| Peer-to-peer image send (no server storage) | 🟡 Stubbed | UI + online-gating done; transport needs `react-native-webrtc` + a dev-client build — see `apps/mobile/lib/p2p.ts` |
| Real push notifications | 🟡 Stubbed | Needs a dev-client build + a Supabase Edge Function — see `apps/mobile/README.md` |
| Google OAuth / phone OTP on web | ⬜ Not started | Each needs separate web redirect/provider config |
| Profile pictures | ⬜ Not started | |
| Status / Stories (Instagram-style) | ⬜ Not started | |
| Stickers, GIFs | ⬜ Not started | |
| Voice notes / voice messages | ⬜ Not started | `voice_note` message type and storage bucket already exist in the schema, unused so far |
| Global search / in-chat search | ⬜ Not started | |
| Per-chat wallpapers / customization | ⬜ Not started | |
| Contact-based "find people" (not open lookup) | ⬜ Not started | Currently anyone can start a chat with anyone by email — a contacts-based model needs its own design pass |
| Voice / video calling | ⬜ Not started | Needs WebRTC + a TURN server + a dev-client build, same family as P2P |
| Groups | ⬜ Not started | `conversation_members` already supports >2 members; nothing else does yet |

This list is intentionally honest about what's real vs. placeholder —
check a given app's README before assuming a feature works end-to-end.

---

## Database schema overview

```
profiles          — extends auth.users (id, username, email, avatar_url)
conversations     — a chat session between two users
conversation_members — join table (conversation_id, user_id)
messages          — chat messages
    message_type  → 'text' | 'image' | 'voice_note'
    image_hidden  → bool — whether receiver sees it locked
    image_filter  → 'blur' | 'pixelate' | 'noir'
```

Row Level Security is enabled on every table — users can only read and
write data they're members of. See `supabase/README.md` for what each
table/policy/RPC actually does, and `supabase/SUPABASE_SETUP.md` for the
dashboard configuration (storage buckets, email, Google OAuth, Vonage)
that isn't covered by SQL.

---

## Contributing

Pull requests are welcome. To run the project locally:

```bash
git clone https://github.com/your-username/hide-speak
cd hide-speak
npm install --legacy-peer-deps
cp .env.example .env.local   # add your Supabase credentials
npm start
```

Please follow the existing code style (TypeScript strict, no inline `any` where avoidable).

---

## License

MIT — fork it, self-host it, make it yours.
