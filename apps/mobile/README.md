# Hide & Speak — Mobile

Expo Router app. This doc explains what each piece does and how the
moving parts (demo mode, presence, app lock, P2P) fit together — see the
root [README.md](../../README.md) for setup/run instructions.

## Folder structure

```
app/
├── _layout.tsx              Root layout — session check, demo-mode bypass,
│                             wraps the authenticated app in AppLockProvider
├── index.tsx                 Brief loading splash
├── (auth)/
│   ├── login.tsx              Email + phone OTP + Google sign-in
│   ├── register.tsx
│   └── otp.tsx                 Phone OTP verification step
└── (app)/
    ├── _layout.tsx              Wraps PresenceProvider + ActiveConversationProvider,
    │                             mounts the NewMessageBanner
    ├── index.tsx                 Chat list — online dots, new-chat-by-email modal
    └── chat/[id].tsx               Realtime thread — text, hidden images, P2P toggle

components/
├── ImageMessage.tsx           Hidden/reveal image bubble + the send-options sheet
│                               (visibility, filter, peer-to-peer toggle)
└── NewMessageBanner.tsx        Global "new message from X" banner (no content shown)

lib/
├── supabase.ts                  Supabase client (AsyncStorage session)
├── auth.ts                       Google OAuth + phone OTP helpers
├── types.ts                       Shared TypeScript shapes
├── demo.ts                        EXPO_PUBLIC_DEMO_MODE canned data
├── presence.tsx                   Online/offline via Supabase Realtime Presence
├── activeConversation.tsx          Tracks which chat screen is open (for the banner)
├── applock.tsx                     Biometric/passcode lock on backgrounding
└── p2p.ts                          Peer-to-peer send — STUBBED, see below
```

## Demo mode

`EXPO_PUBLIC_DEMO_MODE=true` (set in `.env.local`) skips Supabase auth
entirely and renders the app against canned data in `lib/demo.ts` — two
conversations, one with a hidden/blur image you can tap to reveal. Every
screen checks `IS_DEMO` and short-circuits its Supabase calls. Turn it off
once your Supabase project (schema + storage buckets + auth providers) is
ready — see `supabase/SUPABASE_SETUP.md`.

## Presence (online/offline)

`lib/presence.tsx` tracks every signed-in client on one shared Supabase
Realtime Presence channel (`presence:online`). Each client calls
`channel.track()` once subscribed; everyone else sees the live set of
online user ids via the `sync` event. `useIsOnline(userId)` reads that
set — used for the green dot in the chat list and the "Online"/"Offline"
line in a chat's header. The exact same channel name is used by the web
app, so presence is shared across both.

## App lock

`lib/applock.tsx`'s `AppLockProvider` wraps the authenticated app shell
(mounted in `app/_layout.tsx`, only once there's a session or demo mode).
It listens to `AppState` — any transition away from `'active'` sets
`locked = true` and renders a blurred full-screen overlay. Coming back to
the foreground doesn't auto-unlock; the user has to pass
`expo-local-authentication`'s `authenticateAsync()` (biometrics, falling
back to device PIN/pattern automatically). If the device has no
biometrics or passcode enrolled at all, the lock can't be enforced, so the
overlay shows a "Continue" button instead of trapping the user.

## New-message banner (notification privacy stub)

`components/NewMessageBanner.tsx` subscribes to `postgres_changes` INSERTs
on the whole `messages` table with no filter — Supabase Realtime applies
the same RLS policy used for `SELECT`, so a given client only ever
receives events for conversations it's actually a member of. On a new
message from someone else, it shows **"New message from {username}"**
only — never the content, same idea as a WhatsApp locked-chat preview. It
suppresses itself for whichever conversation is currently open, tracked
via `lib/activeConversation.tsx`.

This is *not* a real push notification — it only fires while the app is
open in the foreground. Expo Go dropped remote push on Android a while
back, so real push needs a custom dev-client/EAS build plus a Supabase
Edge Function triggered on message insert. Worth doing once you're ready
to do that build; this banner is the placeholder until then.

## Peer-to-peer image send

The "📡 Send peer-to-peer" toggle in the image-send sheet only actually
attempts device-to-device transfer if the recipient is online right now
(`useIsOnline`). If they're not, it automatically falls back to the
normal server-stored upload — never silently fails.

**`lib/p2p.ts` is a stub.** Real peer-to-peer needs `react-native-webrtc`,
a native module unavailable in Expo Go (same constraint as push). Until
someone wires that up with a dev-client build, `sendImageP2P()` always
returns `{ delivered: false }`, so every send just falls through to the
existing server upload. The file has the implementation plan in its
comments — signaling can reuse the same per-conversation Realtime channel
already used for message inserts, no extra server needed.

## Known platform limits

| Feature | Works in Expo Go? | Needs |
|---|---|---|
| Demo mode, presence, app lock | ✅ | nothing extra |
| In-app new-message banner | ✅ (foreground only) | nothing extra |
| Real push notifications | ❌ | dev-client/EAS build + Edge Function |
| Peer-to-peer transfer | ❌ | dev-client/EAS build + `react-native-webrtc` |
| Voice/video calling | ❌ | dev-client/EAS build + WebRTC + a TURN server |
