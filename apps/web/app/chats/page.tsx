'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Conversation, Profile } from '@/lib/types';
import { IS_DEMO, DEMO_USER_ID, DEMO_PROFILE, DEMO_CONVERSATIONS } from '@/lib/demo';
import { useIsOnline } from '@/lib/presence';
import { Avatar } from '@/components/Avatar';
import { PenSquare, Search, MessagesSquare, LogOut, Sparkles, X } from 'lucide-react';

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
        className="flex w-full items-center gap-3 rounded-2xl border border-[#2A2A2A] bg-[#181818] px-3 py-3 text-left transition-colors hover:border-[#7C5CBF]/50 hover:bg-[#1E1E1E]"
      >
        <span className="relative shrink-0">
          <Avatar username={conversation.other_user?.username} avatarUrl={conversation.other_user?.avatar_url} size={48} />
          {online && (
            <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#181818] bg-[#4CAF50]" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[#F5F5F5]">
            {conversation.other_user?.username ?? 'Unknown'}
          </span>
          <span className="block truncate text-sm text-[#9E9E9E]">{conversation.last_message}</span>
        </span>
        <span className="shrink-0 self-start text-xs text-[#555555]">{formatTime(conversation.last_message_at ?? '')}</span>
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
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'email' | 'phone'>('email');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
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
            ? 'Photo'
            : last.message_type === 'voice_note'
              ? 'Voice note'
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
    const query = searchMode === 'email' ? searchEmail.trim().toLowerCase() : searchPhone.trim();
    if (!query || !currentUserId) return;
    setSearchLoading(true);
    setSearchError(null);
    const supabase = createClient();

    // Exact match only, by design — no contact upload, no browsing the
    // user directory. You can only start a chat with someone whose exact
    // email or phone number you already have.
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, email')
      .eq(searchMode, query)
      .single();

    if (profileErr || !profile) {
      setSearchError(`No account found with that ${searchMode === 'email' ? 'email address' : 'phone number'}.`);
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
    setSearchPhone('');
    await fetchConversations(currentUserId);
    // No ?username= in the URL — the chat page looks up who you're talking
    // to itself, so the address bar / browser history never gives that away.
    router.push(`/chats/${convId}`);
  };

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.other_user?.username ?? '').toLowerCase().includes(q) ||
        (c.last_message ?? '').toLowerCase().includes(q),
    );
  })();

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
            className="flex items-center gap-2 rounded-full bg-[#7C5CBF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5A3F9A]"
          >
            <PenSquare size={16} /> New chat
          </button>
          {IS_DEMO ? (
            <span className="flex items-center gap-1.5 rounded-full border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1.5 text-xs font-bold text-[#9B7FD4]">
              <Sparkles size={13} /> Demo
            </span>
          ) : (
            <button onClick={handleSignOut} aria-label="Sign out" className="text-[#9E9E9E] hover:text-[#F5F5F5]">
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#181818]">
            <MessagesSquare size={36} className="text-[#9B7FD4]" />
          </span>
          <p className="text-lg font-semibold text-[#F5F5F5]">No chats yet</p>
          <p className="text-sm text-[#9E9E9E]">Click &quot;New chat&quot; to start a conversation</p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl px-3">
          {/* Search */}
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#181818] px-3 py-2.5">
            <Search size={18} className="text-[#555555]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="flex-1 bg-transparent text-sm text-[#F5F5F5] placeholder-[#555555] outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search">
                <X size={16} className="text-[#555555] hover:text-[#9E9E9E]" />
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#9E9E9E]">No chats match “{query.trim()}”</p>
          ) : (
            <ul className="mt-3 space-y-2 pb-6">
              {filtered.map((c) => (
                <ConversationRow key={c.id} conversation={c} formatTime={formatTime} />
              ))}
            </ul>
          )}
        </div>
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
            <p className="mb-4 text-sm text-[#9E9E9E]">
              Exact email or phone only — no contacts are uploaded, you can&apos;t browse other users.
            </p>

            <div className="mb-3.5 flex gap-1 rounded-xl bg-[#1A1A1A] p-1">
              <button
                onClick={() => setSearchMode('email')}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  searchMode === 'email' ? 'bg-[#7C5CBF] text-white' : 'text-[#9E9E9E]'
                }`}
              >
                Email
              </button>
              <button
                onClick={() => setSearchMode('phone')}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  searchMode === 'phone' ? 'bg-[#7C5CBF] text-white' : 'text-[#9E9E9E]'
                }`}
              >
                Phone
              </button>
            </div>

            {searchMode === 'email' ? (
              <input
                autoFocus
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="friend@example.com"
                className="mb-4 w-full rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-[#F5F5F5] placeholder-[#555555] outline-none focus:border-[#7C5CBF]"
              />
            ) : (
              <input
                autoFocus
                type="tel"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                placeholder="+919876543210"
                className="mb-4 w-full rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-[#F5F5F5] placeholder-[#555555] outline-none focus:border-[#7C5CBF]"
              />
            )}
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
