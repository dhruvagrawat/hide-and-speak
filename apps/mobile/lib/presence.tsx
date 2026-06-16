import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { IS_DEMO, DEMO_USER_ID, DEMO_ONLINE_IDS } from './demo';

const PRESENCE_CHANNEL = 'presence:online';

const PresenceContext = createContext<Set<string>>(new Set());

/**
 * Tracks who's currently online across the whole app using a single
 * Supabase Realtime Presence channel — every signed-in client "tracks"
 * itself on this channel, and everyone subscribed sees the live set of
 * online user ids. Mounted once around the authenticated app shell.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(
    IS_DEMO ? new Set(DEMO_ONLINE_IDS) : new Set(),
  );
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (IS_DEMO) return; // canned presence above is enough to demo the feature

    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      channel = supabase.channel(PRESENCE_CHANNEL, {
        config: { presence: { key: user.id } },
      });
      channelRef.current = channel;

      channel
        .on('presence', { event: 'sync' }, () => {
          setOnlineIds(new Set(Object.keys(channel!.presenceState())));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel!.track({ online_at: new Date().toISOString() });
          }
        });
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return <PresenceContext.Provider value={onlineIds}>{children}</PresenceContext.Provider>;
}

/** Returns the live set of currently-online user ids. */
export function useOnlineIds(): Set<string> {
  return useContext(PresenceContext);
}

/** Convenience: is this specific user currently online? */
export function useIsOnline(userId: string | null | undefined): boolean {
  const onlineIds = useOnlineIds();
  if (!userId) return false;
  if (IS_DEMO && userId === DEMO_USER_ID) return true; // "you" are always online to yourself
  return onlineIds.has(userId);
}
