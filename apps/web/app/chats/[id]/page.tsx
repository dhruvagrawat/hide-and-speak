'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Message, PendingImage, Profile } from '@/lib/types';
import { ImageMessage, ImagePickerButton } from '@/components/ImageMessage';
import { IS_DEMO, DEMO_USER_ID, DEMO_MESSAGES, DEMO_CONVERSATIONS } from '@/lib/demo';
import { useIsOnline } from '@/lib/presence';
import { Avatar } from '@/components/Avatar';
import { VoiceRecorderButton, VoiceNoteBubble } from '@/components/VoiceNote';

export default function ChatThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conversationId = params.id;

  // IS_DEMO never changes at runtime, so demo data is seeded as the
  // initial state itself rather than via a setState call inside an effect.
  const [messages, setMessages] = useState<Message[]>(
    IS_DEMO ? DEMO_MESSAGES[conversationId] ?? [] : [],
  );
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(!IS_DEMO);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(IS_DEMO ? DEMO_USER_ID : null);
  const currentUserIdRef = useRef<string | null>(IS_DEMO ? DEMO_USER_ID : null);
  // Looked up server-side by conversation id — never carried in the URL,
  // so the address bar / browser history never reveals who you're chatting with.
  const [otherUser, setOtherUser] = useState<Profile | null>(
    IS_DEMO ? DEMO_CONVERSATIONS.find((c) => c.id === conversationId)?.other_user ?? null : null,
  );
  const otherUserOnline = useIsOnline(otherUser?.id);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (IS_DEMO) return; // already seeded in initial state above
    const supabase = createClient();
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id, username, email, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error) setMessages((data as Message[]) ?? []);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    if (IS_DEMO) return; // already seeded in initial state above
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/login');
        return;
      }
      setCurrentUserId(user.id);
      currentUserIdRef.current = user.id;

      const { data } = await supabase
        .from('conversation_members')
        .select('profiles!inner(id, username, email, avatar_url)')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .single();
      if (data) {
        const profile = data.profiles as unknown as Profile | Profile[];
        setOtherUser(Array.isArray(profile) ? profile[0] : profile);
      }
    });
  }, [router, conversationId]);

  useEffect(() => {
    if (IS_DEMO) return; // already seeded in initial state above
    // Standard fetch-on-mount: fetchMessages is async and only calls
    // setState after its awaited Supabase round trip, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMessages();

    const supabase = createClient();
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === currentUserIdRef.current) return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, email, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          const enriched: Message = { ...newMsg, sender: profile ?? undefined };
          setMessages((prev) => (prev.some((m) => m.id === enriched.id) ? prev : [...prev, enriched]));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const sendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || !currentUserId) return;

    setText('');
    setSending(true);

    const optimisticId = `opt_${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: trimmed,
      message_type: 'text',
      image_url: null,
      image_hidden: false,
      image_filter: null,
      voice_note_url: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    if (IS_DEMO) {
      setSending(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: currentUserId, content: trimmed, message_type: 'text' })
      .select()
      .single();

    setSending(false);

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      alert(`Send failed: ${error.message}`);
      setText(trimmed);
    } else if (data) {
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? (data as Message) : m)));
    }
  };

  const sendImage = async (pending: PendingImage) => {
    if (!currentUserId) return;
    setSending(true);

    if (IS_DEMO) {
      setMessages((prev) => [
        ...prev,
        {
          id: `demo_img_${Date.now()}`,
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: null,
          message_type: 'image',
          image_url: pending.previewUrl,
          image_hidden: pending.hidden,
          image_filter: pending.filter,
          voice_note_url: null,
          created_at: new Date().toISOString(),
        },
      ]);
      setSending(false);
      return;
    }

    try {
      const supabase = createClient();
      const ext = pending.file.name.split('.').pop() ?? 'jpg';
      const fileName = `${conversationId}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, pending.file, { upsert: false });
      if (uploadError) throw uploadError;

      // chat-images is a private bucket — a signed URL (not getPublicUrl,
      // which only works on public buckets) is what actually lets the
      // image load. See supabase/patch_006_chat_storage.sql.
      const { data: urlData, error: signError } = await supabase.storage
        .from('chat-images')
        .createSignedUrl(uploadData.path, 60 * 60 * 24 * 365);
      if (signError || !urlData) throw signError ?? new Error('Could not sign image URL');

      const { data, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: null,
          message_type: 'image',
          image_url: urlData.signedUrl,
          image_hidden: pending.hidden,
          image_filter: pending.filter,
        })
        .select()
        .single();
      if (msgError) throw msgError;

      if (data) setMessages((prev) => [...prev, data as Message]);
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const sendVoiceNote = async (blob: Blob, mimeType: string) => {
    if (!currentUserId) return;
    setSending(true);

    if (IS_DEMO) {
      setMessages((prev) => [
        ...prev,
        {
          id: `demo_voice_${Date.now()}`,
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: null,
          message_type: 'voice_note',
          image_url: null,
          image_hidden: false,
          image_filter: null,
          voice_note_url: URL.createObjectURL(blob),
          created_at: new Date().toISOString(),
        },
      ]);
      setSending(false);
      return;
    }

    try {
      const supabase = createClient();
      const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'm4a' : 'ogg';
      const fileName = `${conversationId}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, blob, { upsert: false, contentType: mimeType });
      if (uploadError) throw uploadError;

      const { data: urlData, error: signError } = await supabase.storage
        .from('voice-notes')
        .createSignedUrl(uploadData.path, 60 * 60 * 24 * 365);
      if (signError || !urlData) throw signError ?? new Error('Could not sign voice note URL');

      const { data, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: null,
          message_type: 'voice_note',
          voice_note_url: urlData.signedUrl,
        })
        .select()
        .single();
      if (msgError) throw msgError;

      if (data) setMessages((prev) => [...prev, data as Message]);
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
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
      <div className="flex items-center gap-3 border-b border-[#2A2A2A] px-6 py-4">
        <button onClick={() => router.push('/chats')} className="text-[#9E9E9E] hover:text-[#F5F5F5]">
          ←
        </button>
        <div>
          <h1 className="text-base font-semibold text-[#F5F5F5]">{otherUser?.username ?? 'Chat'}</h1>
          <p className="text-xs text-[#9E9E9E]">{otherUserOnline ? '🟢 Online' : 'Offline'}</p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId;
          const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && (
                <Avatar username={m.sender?.username ?? otherUser?.username} avatarUrl={m.sender?.avatar_url ?? otherUser?.avatar_url} size={28} />
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                  isMine
                    ? 'rounded-br-md bg-[#4A3580]'
                    : 'rounded-bl-md border border-[#2A2A2A] bg-[#1E1E1E]'
                }`}
              >
                {m.message_type === 'text' && (
                  <p className="text-[15px] leading-relaxed text-[#F5F5F5]">{m.content}</p>
                )}
                {m.message_type === 'image' && m.image_url && (
                  <ImageMessage imageUrl={m.image_url} hidden={m.image_hidden} filter={m.image_filter} />
                )}
                {m.message_type === 'voice_note' && m.voice_note_url && (
                  <VoiceNoteBubble uri={m.voice_note_url} />
                )}
                <p className="mt-1 text-right text-[10px] text-[#555555]">{time}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mx-auto flex w-full max-w-2xl items-end gap-2 border-t border-[#2A2A2A] bg-[#181818] px-3 py-3">
        <ImagePickerButton onImageReady={sendImage} />
        <VoiceRecorderButton onRecorded={sendVoiceNote} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendText();
            }
          }}
          placeholder="Message…"
          rows={1}
          className="flex-1 resize-none rounded-[22px] border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2.5 text-[15px] text-[#F5F5F5] placeholder-[#555555] outline-none focus:border-[#7C5CBF]"
        />
        <button
          onClick={sendText}
          disabled={!text.trim() || sending}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#7C5CBF] text-white transition-colors hover:bg-[#5A3F9A] disabled:opacity-40"
        >
          ➤
        </button>
      </div>
    </main>
  );
}
