import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { Message } from '@/lib/types';
import { ImageMessage, ImagePickerButton } from '@/components/ImageMessage';
import type { PendingImage } from '@/lib/types';
import { IS_DEMO, DEMO_USER_ID, DEMO_MESSAGES, DEMO_CONVERSATIONS } from '@/lib/demo';
import { useIsOnline } from '@/lib/presence';
import { useActiveConversationRef } from '@/lib/activeConversation';
import { sendImageP2P } from '@/lib/p2p';
import { Avatar } from '@/components/Avatar';
import { VoiceRecorderButton, VoiceNoteBubble } from '@/components/VoiceNote';

export default function ChatScreen() {
  const { id: conversationId, username } = useLocalSearchParams<{ id: string; username: string }>();
  const navigation = useNavigation();
  const activeConversationRef = useActiveConversationRef();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const flatRef = useRef<FlatList>(null);
  const recipientOnline = useIsOnline(recipientId);

  // Mark this conversation as "currently open" so the global new-message
  // banner stays quiet about it while you're already looking at it.
  useEffect(() => {
    activeConversationRef.current = conversationId;
    return () => {
      if (activeConversationRef.current === conversationId) activeConversationRef.current = null;
    };
  }, [conversationId, activeConversationRef]);

  useEffect(() => {
    navigation.setOptions({
      title: username ?? 'Chat',
      headerTitle: () => (
        <View>
          <Text style={styles.headerTitle}>{username ?? 'Chat'}</Text>
          <Text style={styles.headerSubtitle}>{recipientOnline ? '🟢 Online' : 'Offline'}</Text>
        </View>
      ),
    });
  }, [navigation, username, recipientOnline]);

  useEffect(() => {
    if (IS_DEMO) {
      setCurrentUserId(DEMO_USER_ID);
      currentUserIdRef.current = DEMO_USER_ID;
      setRecipientId(DEMO_CONVERSATIONS.find((c) => c.id === conversationId)?.other_user?.id ?? null);
      return;
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      currentUserIdRef.current = user.id;

      const { data } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .single();
      if (data) setRecipientId(data.user_id);
    });
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    if (IS_DEMO) {
      setMessages(DEMO_MESSAGES[conversationId] ?? []);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id, username, email, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchMessages error:', error.message);
    } else {
      setMessages((data as Message[]) ?? []);
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
    if (IS_DEMO) return; // no realtime channel needed against canned data

    // Realtime: listen for new messages from the other person.
    // Your own messages are added optimistically in sendText/sendImage,
    // so we skip them here to avoid duplicates.
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;

          // Skip our own messages — already shown via optimistic update
          if (newMsg.sender_id === currentUserIdRef.current) return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, email, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          const enriched: Message = { ...newMsg, sender: profile ?? undefined };
          setMessages((prev) => {
            // Guard against duplicates just in case
            if (prev.some((m) => m.id === enriched.id)) return prev;
            return [enriched, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchMessages]);

  // ── Send text message ──────────────────────
  const sendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || !currentUserId) return;

    setText('');
    setSending(true);

    // Optimistic update — show the message immediately
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
    setMessages((prev) => [optimistic, ...prev]);

    if (IS_DEMO) {
      // No backend round trip — the optimistic bubble above is the final state.
      setSending(false);
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: trimmed,
        message_type: 'text',
      })
      .select()
      .single();

    setSending(false);

    if (error) {
      // Roll back optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      Alert.alert('Send failed', error.message);
      setText(trimmed);
    } else if (data) {
      // Replace optimistic placeholder with the real message from DB
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? (data as Message) : m)),
      );
    }
  };

  // ── Send image message ─────────────────────
  const sendImage = async (pending: PendingImage) => {
    if (!currentUserId) return;
    setSending(true);

    // "Private" peer-to-peer mode: only actually skips the server if the
    // recipient is online right now to receive it directly. Otherwise we
    // silently fall back to the normal server-stored send below.
    if (pending.p2p && recipientId && recipientOnline) {
      const { delivered } = await sendImageP2P({ conversationId, recipientId, uri: pending.uri });
      if (delivered) {
        setSending(false);
        return;
      }
      // Stubbed for now (needs a dev-client build — see lib/p2p.ts) — falls
      // through to the normal upload path below instead of failing silently.
    } else if (pending.p2p && (!recipientId || !recipientOnline)) {
      Alert.alert(
        `${username ?? 'They'} is offline`,
        'Peer-to-peer needs them online right now, so this was sent as a regular image instead.',
      );
    }

    if (IS_DEMO) {
      // Show the picked image straight from its local URI — no upload.
      setMessages((prev) => [
        {
          id: `demo_img_${Date.now()}`,
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: null,
          message_type: 'image',
          image_url: pending.uri,
          image_hidden: pending.hidden,
          image_filter: pending.filter ?? null,
          voice_note_url: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setSending(false);
      return;
    }

    try {
      const ext = pending.uri.split('.').pop() ?? 'jpg';
      const fileName = `${conversationId}/${Date.now()}.${ext}`;

      const formData = new FormData();
      formData.append('file', {
        uri: pending.uri,
        name: fileName,
        type: `image/${ext}`,
      } as unknown as Blob);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, formData, { upsert: false });

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
          image_filter: pending.filter ?? null,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      // Show image immediately (no realtime wait)
      if (data) {
        setMessages((prev) => [data as Message, ...prev]);
      }
    } catch (err: unknown) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  // ── Send voice note ────────────────────────
  const sendVoiceNote = async (uri: string) => {
    if (!currentUserId) return;
    setSending(true);

    if (IS_DEMO) {
      // Plays straight from the local recording — no upload.
      setMessages((prev) => [
        {
          id: `demo_voice_${Date.now()}`,
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: null,
          message_type: 'voice_note',
          image_url: null,
          image_hidden: false,
          image_filter: null,
          voice_note_url: uri,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setSending(false);
      return;
    }

    try {
      const fileName = `${conversationId}/${Date.now()}.m4a`;
      const formData = new FormData();
      formData.append('file', { uri, name: fileName, type: 'audio/m4a' } as unknown as Blob);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, formData, { upsert: false });
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

      if (data) setMessages((prev) => [data as Message, ...prev]);
    } catch (err: unknown) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  // ── Bubble inner content ───────────────────
  // The text/image/voice body + the timestamp footer. Pulled out so both
  // the gradient (mine) and flat (theirs) bubble shells can share it.
  const BubbleContent = ({
    item,
    isMine,
    time,
    isOptimistic,
  }: {
    item: Message;
    isMine: boolean;
    time: string;
    isOptimistic: boolean;
  }) => {
    const tintTime = isMine ? styles.timestampMine : styles.timestamp;
    return (
      <>
        {item.message_type === 'image' && item.image_url ? (
          <ImageMessage
            imageUrl={item.image_url}
            hidden={!!item.image_hidden}
            filter={item.image_filter ?? null}
            isMine={isMine}
          />
        ) : item.message_type === 'voice_note' && item.voice_note_url ? (
          <VoiceNoteBubble uri={item.voice_note_url} isMine={isMine} />
        ) : (
          <Text style={styles.messageText}>{item.content}</Text>
        )}

        <View style={styles.timestampRow}>
          <Text style={tintTime}>{time}</Text>
          {isOptimistic && <Text style={styles.sendingDot}>  ·  sending…</Text>}
        </View>
      </>
    );
  };

  // ── Render a single message bubble ─────────
  // List is inverted (index 0 = newest, drawn at the bottom), so the
  // chronologically-previous message is at index+1 and the next one at
  // index-1. Grouping consecutive same-sender messages closer together
  // (and only showing the avatar once per cluster) reads much less noisy
  // than a full bubble treatment on every single message.
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.sender_id === currentUserId;
    const isOptimistic = item.id.startsWith('opt_');
    const prev = messages[index + 1];
    const next = messages[index - 1];
    const isLastInGroup = !next || next.sender_id !== item.sender_id;
    const isFirstInGroup = !prev || prev.sender_id !== item.sender_id;
    const time = new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <Animated.View
        entering={isOptimistic ? undefined : FadeInUp.duration(220)}
        style={[
          styles.bubbleRow,
          isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
          { marginTop: isFirstInGroup ? 10 : 2 },
        ]}
      >
        {!isMine && (
          <View style={styles.bubbleAvatarSlot}>
            {isLastInGroup && (
              <Avatar username={item.sender?.username} avatarUrl={item.sender?.avatar_url} size={28} />
            )}
          </View>
        )}

        {isMine ? (
          <LinearGradient
            colors={Colors.sentBubbleGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.bubble,
              styles.bubbleMine,
              isFirstInGroup && styles.bubbleMineFirst,
              isLastInGroup && styles.bubbleMineLast,
              isOptimistic && styles.bubbleOptimistic,
            ]}
          >
            <BubbleContent item={item} isMine time={time} isOptimistic={isOptimistic} />
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.bubble,
              styles.bubbleTheirs,
              isFirstInGroup && styles.bubbleTheirsFirst,
              isLastInGroup && styles.bubbleTheirsLast,
            ]}
          >
            <BubbleContent item={item} isMine={false} time={time} isOptimistic={false} />
          </View>
        )}
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.inputBar}>
        <ImagePickerButton onImageReady={sendImage} recipientOnline={recipientOnline} />
        <VoiceRecorderButton onRecorded={sendVoiceNote} />

        <TextInput
          style={styles.input}
          placeholder="Message…"
          placeholderTextColor={Colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendText}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.sendIcon}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  headerSubtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  listContent: { padding: 16, paddingBottom: 8 },

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  bubbleAvatarSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  bubble: {
    maxWidth: '78%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    paddingBottom: 6,
  },
  bubbleMine: {
    borderBottomRightRadius: 20,
    shadowColor: Colors.primaryDark,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  // Tighter inner corners between grouped bubbles so a run of messages
  // reads as one cluster instead of separate balloons.
  bubbleMineFirst: { borderTopRightRadius: 20 },
  bubbleMineLast: { borderBottomRightRadius: 6 },
  bubbleTheirs: {
    backgroundColor: Colors.messageReceived,
    borderBottomLeftRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleTheirsFirst: { borderTopLeftRadius: 20 },
  bubbleTheirsLast: { borderBottomLeftRadius: 6 },
  bubbleOptimistic: {
    opacity: 0.75,
  },

  messageText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
  },

  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  timestampMine: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
  },
  sendingDot: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    gap: 6,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    color: Colors.text,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  sendBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  sendIcon: { color: '#fff', fontSize: 16, marginLeft: 2 },
});
