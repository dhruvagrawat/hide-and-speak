'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { createClient } from './supabase/client';
import { IS_DEMO, DEMO_ONLINE_IDS } from './demo';

const PRESENCE_CHANNEL = 'presence:online';

const PresenceContext = createContext<Set<string>>(new Set());

/**
 * Mirrors apps/mobile/lib/presence.tsx — same Supabase Realtime Presence
 * channel, so a user's online status is shared live between mobile and web.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(IS_DEMO ? new Set(DEMO_ONLINE_IDS) : new Set());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  useEffect(() => {
    if (IS_DEMO) return;

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      channel = supabase.channel(PRESENCE_CHANNEL, { config: { presence: { key: user.id } } });
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

export function useOnlineIds(): Set<string> {
  return useContext(PresenceContext);
}

export function useIsOnline(userId: string | null | undefined): boolean {
  const onlineIds = useOnlineIds();
  if (!userId) return false;
  return onlineIds.has(userId);
}
