'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Conversation, Profile } from '@/lib/types';
import { IS_DEMO, DEMO_USER_ID, DEMO_PROFILE, DEMO_CONVERSATIONS } from '@/lib/demo';
import { useIsOnline } from '@/lib/presence';
import { Avatar } from '@/components/Avatar';

function ConversationRow({
  conversation,
  formatTime,
}: {
  conversation: Conversation;
  formatTime: (iso: string) => string;
}) {
  const router = useRouter();
  const online = useIsOnline(conversation.other_user?.id);

  return (
    <li>
      <button
        // No ?username= here either — keeps who you're talking to out of
        // the URL bar and browser history.
        onClick={() => router.push(`/chats/${conversation.id}`)}
        className="flex w-full items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-[#181818]"
      >
        <span className="relative shrink-0">
          <Avatar username={conversation.other_user?.username} avatarUrl={conversation.other_user?.avatar_url} size={48} />
          {online && (
            <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0D0D0D] bg-[#4CAF50]" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[#F5F5F5]">
            {conversation.other_user?.username ?? 'Unknown'}
          </span>
          <span className="block truncate text-sm text-[#9E9E9E]">{conversation.last_message}</span>
        </span>
        <span className="shrink-0 text-xs text-[#555555]">{formatTime(conversation.last_message_at ?? '')}</span>
      </button>
    </li>
  );
}

export default function ChatsPage() {
  const router = useRouter();
  // IS_DEMO never changes at runtime, so demo data is seeded as the initial
  // state itself rather than via a setState call inside an effect.
  const [conversations, setConversations] = useState<Conversation[]>(IS_DEMO ? DEMO_CONVERSATIONS : []);
  const [loading, setLoading] = useState(!IS_DEMO);
  const [currentUserId, setCurrentUserId] = useState<string | null>(IS_DEMO ? DEMO_USER_ID : null);
  const [ownProfile, setOwnProfile] = useState<Profile | null>(IS_DEMO ? DEMO_PROFILE : null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchConversations = useCallback(async (userId: string) => {
    const supabase = createClient();

    const { data: myMemberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId);

    const myConvIds = (myMemberships ?? []).map((r: { conversation_id: string }) => r.conversation_id);
    if (myConvIds.length === 0) {
      setConversations([]);
      return;
    }

    const { data: otherMembers } = await supabase
      .from('conversation_members')
      .select('conversation_id, profiles!inner(id, username, email, avatar_url)')
      .in('conversation_id', myConvIds)
      .neq('user_id', userId);

    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('conversation_id, content, message_type, created_at')
      .in('conversation_id', myConvIds)
      .order('created_at', { ascending: false });

    const lastMsgMap: Record<string, { content: string | null; message_type: string; created_at: string }> = {};
    for (const msg of lastMsgs ?? []) {
      if (!(msg.conversation_id in lastMsgMap)) lastMsgMap[msg.conversation_id] = msg;
    }

    const convs: Conversation[] = (otherMembers ?? []).map(
      (row: { conversation_id: string; profiles: Profile | Profile[] }) => {
      const last = lastMsgMap[row.conversation_id];
      const otherUser = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.conversation_id,
        created_at: '',
        updated_at: '',
        other_user: otherUser,
        last_message: last
          ? last.message_type === 'image'
            ? '📷 Image'
            : last.message_type === 'voice_note'
              ? '🎙 Voice note'
              : last.content ?? ''
          : 'Say hello!',
        last_message_at: last?.created_at ?? '',
      };
    });

    convs.sort(
      (a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime(),
    );
    setConversations(convs);
  }, []);

  useEffect(() => {
    if (IS_DEMO) return; // already seeded in initial state above

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/login');
        return;
      }
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) setOwnProfile(profile as Profile);
      await fetchConversations(user.id);
      setLoading(false);
    });
  }, [fetchConversations, router]);

  const handleSignOut = async () => {
    if (IS_DEMO) {
      alert('Demo mode — sign-out is disabled. Set NEXT_PUBLIC_DEMO_MODE=false once Supabase is connected.');
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  const startNewChat = async () => {
    if (IS_DEMO) {
      alert('Demo mode — connect Supabase and turn off demo mode to start real conversations.');
      setShowNewChat(false);
      return;
    }
    if (!searchEmail.trim() || !currentUserId) return;
    setSearchLoading(true);
    setSearchError(null);
    const supabase = createClient();

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, email')
      .eq('email', searchEmail.trim().toLowerCase())
      .single();

    if (profileErr || !profile) {
      setSearchError('No account found with that email address.');
      setSearchLoading(false);
      return;
    }

    const { data: convId, error: rpcErr } = await supabase.rpc('create_conversation', {
      other_user_id: profile.id,
    });

    setSearchLoading(false);

    if (rpcErr || !convId) {
      setSearchError(rpcErr?.message ?? 'Could not create conversation.');
      return;
    }

    setShowNewChat(false);
    setSearchEmail('');
    await fetchConversations(currentUserId);
    // No ?username= in the URL — the chat page looks up who you're talking
    // to itself, so the address bar / browser history never gives that away.
    router.push(`/chats/${convId}`);
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2A2A2A] border-t-[#7C5CBF]" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/profile')} aria-label="Your profile">
            <Avatar username={ownProfile?.username} avatarUrl={ownProfile?.avatar_url} size={32} />
          </button>
          <h1 className="text-lg font-semibold text-[#F5F5F5]">Chats</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewChat(true)}
            className="rounded-full bg-[#7C5CBF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5A3F9A]"
          >
            ✎ New chat
          </button>
          <button onClick={handleSignOut} className="text-sm text-[#9E9E9E] hover:text-[#F5F5F5]">
            {IS_DEMO ? '🧪 Demo' : 'Sign out'}
          </button>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-5xl">💬</span>
          <p className="text-lg font-semibold text-[#F5F5F5]">No chats yet</p>
          <p className="text-sm text-[#9E9E9E]">Click &quot;New chat&quot; to start a conversation</p>
        </div>
      ) : (
        <ul className="mx-auto w-full max-w-2xl divide-y divide-[#2A2A2A]">
          {conversations.map((c) => (
            <ConversationRow key={c.id} conversation={c} formatTime={formatTime} />
          ))}
        </ul>
      )}

      {showNewChat && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
          onClick={() => setShowNewChat(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border-t border-[#2A2A2A] bg-[#181818] p-6 sm:rounded-3xl sm:border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1.5 text-lg font-semibold text-[#F5F5F5]">New conversation</h3>
            <p className="mb-4 text-sm text-[#9E9E9E]">Enter the email of the person you want to chat with</p>
            <input
              autoFocus
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="friend@example.com"
              className="mb-4 w-full rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-[#F5F5F5] placeholder-[#555555] outline-none focus:border-[#7C5CBF]"
            />
            {searchError && <p className="mb-4 text-sm text-[#F44336]">{searchError}</p>}
            <button
              onClick={startNewChat}
              disabled={searchLoading}
              className="w-full rounded-xl bg-[#7C5CBF] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#5A3F9A] disabled:opacity-60"
            >
              {searchLoading ? 'Starting…' : 'Start chat'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
