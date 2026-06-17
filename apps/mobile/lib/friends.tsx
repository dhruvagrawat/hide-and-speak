import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { supabase } from './supabase';
import {
  IS_DEMO,
  DEMO_USER_ID,
  DEMO_FRIENDS,
  DEMO_INCOMING_REQUESTS,
  DEMO_OUTGOING_REQUESTS,
} from './demo';
import { FriendRequest, Profile } from './types';

interface FriendsContextValue {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  friends: Profile[];
  incomingCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  sendRequest: (mode: 'email' | 'phone', query: string) => Promise<{ ok: boolean; error?: string }>;
  accept: (req: FriendRequest) => Promise<void>;
  decline: (req: FriendRequest) => Promise<void>;
  cancel: (req: FriendRequest) => Promise<void>;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

/**
 * Friend requests + friends list. You must be friends before you can start
 * a conversation — sending a request, the other person accepting, and only
 * then a chat. Mirrors the request model in supabase/patch_007_friends.sql.
 *
 * Demo mode runs entirely against canned data in lib/demo.ts so the whole
 * flow (incoming, outgoing, accept/decline) is explorable without a backend.
 */
export function FriendsProvider({ children }: { children: ReactNode }) {
  const [incoming, setIncoming] = useState<FriendRequest[]>(IS_DEMO ? DEMO_INCOMING_REQUESTS : []);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>(IS_DEMO ? DEMO_OUTGOING_REQUESTS : []);
  const [friends, setFriends] = useState<Profile[]>(IS_DEMO ? DEMO_FRIENDS : []);
  const [loading, setLoading] = useState(!IS_DEMO);

  const refresh = useCallback(async () => {
    if (IS_DEMO) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: rows } = await supabase
      .from('friend_requests')
      .select('*')
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`);

    const all = (rows ?? []) as FriendRequest[];

    // Collect the "other" user id for each row and fetch their profiles once.
    const otherIds = Array.from(
      new Set(all.map((r) => (r.from_user === user.id ? r.to_user : r.from_user))),
    );
    const profileMap: Record<string, Profile> = {};
    if (otherIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .in('id', otherIds);
      for (const p of (profiles ?? []) as Profile[]) profileMap[p.id] = p;
    }

    const withProfiles = all.map((r) => ({
      ...r,
      profile: profileMap[r.from_user === user.id ? r.to_user : r.from_user],
    }));

    setIncoming(withProfiles.filter((r) => r.to_user === user.id && r.status === 'pending'));
    setOutgoing(withProfiles.filter((r) => r.from_user === user.id && r.status === 'pending'));
    setFriends(
      withProfiles
        .filter((r) => r.status === 'accepted')
        .map((r) => r.profile)
        .filter((p): p is Profile => !!p),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sendRequest = useCallback<FriendsContextValue['sendRequest']>(
    async (mode, query) => {
      const clean = mode === 'email' ? query.trim().toLowerCase() : query.trim();
      if (!clean) return { ok: false, error: 'Enter an email or phone number.' };

      if (IS_DEMO) {
        return {
          ok: false,
          error: 'Demo mode — connect Supabase to send real friend requests.',
        };
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { ok: false, error: 'Not signed in.' };

      const { data: target, error: findErr } = await supabase
        .from('profiles')
        .select('id, username')
        .eq(mode, clean)
        .single();
      if (findErr || !target) {
        return { ok: false, error: `No account found with that ${mode}.` };
      }
      if (target.id === user.id) return { ok: false, error: "That's you!" };

      const { error: insertErr } = await supabase
        .from('friend_requests')
        .insert({ from_user: user.id, to_user: target.id, status: 'pending' });
      if (insertErr) {
        // Most likely the unique constraint — a request already exists.
        return { ok: false, error: 'A request between you two already exists.' };
      }
      await refresh();
      return { ok: true };
    },
    [refresh],
  );

  const accept = useCallback<FriendsContextValue['accept']>(
    async (req) => {
      if (IS_DEMO) {
        setIncoming((list) => list.filter((r) => r.id !== req.id));
        if (req.profile) setFriends((f) => [...f, req.profile!]);
        return;
      }
      await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', req.id);
      await refresh();
    },
    [refresh],
  );

  const decline = useCallback<FriendsContextValue['decline']>(
    async (req) => {
      if (IS_DEMO) {
        setIncoming((list) => list.filter((r) => r.id !== req.id));
        return;
      }
      await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', req.id);
      await refresh();
    },
    [refresh],
  );

  const cancel = useCallback<FriendsContextValue['cancel']>(
    async (req) => {
      if (IS_DEMO) {
        setOutgoing((list) => list.filter((r) => r.id !== req.id));
        return;
      }
      await supabase.from('friend_requests').delete().eq('id', req.id);
      await refresh();
    },
    [refresh],
  );

  return (
    <FriendsContext.Provider
      value={{
        incoming,
        outgoing,
        friends,
        incomingCount: incoming.length,
        loading,
        refresh,
        sendRequest,
        accept,
        decline,
        cancel,
      }}
    >
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriendRequests(): FriendsContextValue {
  const ctx = useContext(FriendsContext);
  // Tolerate being read outside the provider (e.g. during early route
  // type-gen) by returning a quiet empty state instead of throwing.
  if (!ctx) {
    return {
      incoming: [],
      outgoing: [],
      friends: [],
      incomingCount: 0,
      loading: false,
      refresh: async () => {},
      sendRequest: async () => ({ ok: false }),
      accept: async () => {},
      decline: async () => {},
      cancel: async () => {},
    };
  }
  return ctx;
}

export const DEMO_OWNER_ID = DEMO_USER_ID;
