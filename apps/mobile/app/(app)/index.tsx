import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { Conversation, Profile } from '@/lib/types';
import { IS_DEMO, DEMO_USER_ID, DEMO_PROFILE, DEMO_CONVERSATIONS } from '@/lib/demo';
import { useIsOnline } from '@/lib/presence';
import { Avatar } from '@/components/Avatar';
import { ScalePressable } from '@/components/AnimatedPressable';
import { ChatListSkeleton } from '@/components/Skeleton';

function ConversationRow({
  item,
  formatTime,
  index,
}: {
  item: Conversation;
  formatTime: (iso: string) => string;
  index: number;
}) {
  const online = useIsOnline(item.other_user?.id);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(280)}>
      <TouchableOpacity
        style={styles.convItem}
        onPress={() =>
          router.push({
            pathname: '/(app)/chat/[id]',
            params: { id: item.id, username: item.other_user?.username ?? 'Unknown' },
          })
        }
        activeOpacity={0.6}
      >
        {/* Avatar */}
        <View style={styles.avatarRing}>
          <Avatar username={item.other_user?.username} avatarUrl={item.other_user?.avatar_url} size={50} />
          {online && <View style={styles.onlineDot} />}
        </View>
        {/* Info */}
        <View style={styles.convInfo}>
          <Text style={styles.convName}>{item.other_user?.username ?? 'Unknown'}</Text>
          <Text style={styles.convLast} numberOfLines={1}>{item.last_message}</Text>
        </View>
        {/* Time */}
        <Text style={styles.convTime}>
          {item.last_message_at ? formatTime(item.last_message_at) : ''}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ChatList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ownProfile, setOwnProfile] = useState<Profile | null>(IS_DEMO ? DEMO_PROFILE : null);

  // New chat modal
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchMode, setSearchMode] = useState<'email' | 'phone'>('email');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchConversations = useCallback(async (userId: string) => {
    // Step 1: get every conversation_id this user belongs to
    const { data: myMemberships, error: memberErr } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId);

    if (memberErr) {
      console.error('fetchConversations membership error:', memberErr.message);
      return;
    }

    const myConvIds = (myMemberships ?? []).map((r: any) => r.conversation_id);
    if (myConvIds.length === 0) {
      setConversations([]);
      return;
    }

    // Step 2: for each conversation, fetch the OTHER member's profile
    const { data: otherMembers, error: othersErr } = await supabase
      .from('conversation_members')
      .select('conversation_id, profiles!inner(id, username, email, avatar_url)')
      .in('conversation_id', myConvIds)
      .neq('user_id', userId);

    if (othersErr) {
      console.error('fetchConversations others error:', othersErr.message);
      return;
    }

    // Step 3: fetch the last message per conversation
    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('conversation_id, content, message_type, created_at')
      .in('conversation_id', myConvIds)
      .order('created_at', { ascending: false });

    // Map: convId → last message
    const lastMsgMap: Record<string, any> = {};
    for (const msg of lastMsgs ?? []) {
      const cid = (msg as any).conversation_id;
      if (!(cid in lastMsgMap)) {
        lastMsgMap[cid] = msg;
      }
    }

    const convs: Conversation[] = (otherMembers ?? []).map((row: any) => {
      const last = lastMsgMap[row.conversation_id];
      return {
        id: row.conversation_id,
        created_at: '',
        updated_at: '',
        other_user: row.profiles as Profile,
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
      (a, b) =>
        new Date(b.last_message_at ?? 0).getTime() -
        new Date(a.last_message_at ?? 0).getTime(),
    );

    setConversations(convs);
  }, []);

  const init = useCallback(async () => {
    if (IS_DEMO) {
      setCurrentUserId(DEMO_USER_ID);
      setConversations(DEMO_CONVERSATIONS);
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) setOwnProfile(profile as Profile);
    await fetchConversations(user.id);
    setLoading(false);
  }, [fetchConversations]);

  useFocusEffect(
    useCallback(() => {
      init();
    }, [init]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (currentUserId) await fetchConversations(currentUserId);
    setRefreshing(false);
  };

  const startNewChat = async () => {
    if (IS_DEMO) {
      Alert.alert('Demo mode', 'Connect Supabase and turn off demo mode to start real conversations.');
      setShowNewChat(false);
      return;
    }
    const query = searchMode === 'email' ? searchEmail.trim().toLowerCase() : searchPhone.trim();
    if (!query) return;
    setSearchLoading(true);

    try {
      // Exact match only, by design — no contact upload, no browsing the
      // user directory. You can only start a chat with someone whose exact
      // email or phone number you already have.
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, username, email')
        .eq(searchMode, query)
        .single();

      if (profileErr || !profile) {
        Alert.alert(
          'User not found',
          `No account found with that ${searchMode === 'email' ? 'email address' : 'phone number'}.`,
        );
        return;
      }

      // 2. Call the RPC — it handles duplicate-checking, creation, and
      //    inserting both members atomically with security definer.
      const { data: convId, error: rpcErr } = await supabase
        .rpc('create_conversation', { other_user_id: profile.id });

      if (rpcErr || !convId) {
        Alert.alert('Error', rpcErr?.message ?? 'Could not create conversation.');
        return;
      }

      setShowNewChat(false);
      setSearchEmail('');
      setSearchPhone('');
      if (currentUserId) fetchConversations(currentUserId);
      router.push({
        pathname: '/(app)/chat/[id]',
        params: { id: convId, username: profile.username },
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSignOut = () => {
    if (IS_DEMO) {
      Alert.alert('Demo mode', 'Sign-out is disabled in demo mode — set EXPO_PUBLIC_DEMO_MODE=false once Supabase is connected.');
      return;
    }
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return 'now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <ScalePressable onPress={() => router.push('/(app)/profile')}>
            <Avatar username={ownProfile?.username} avatarUrl={ownProfile?.avatar_url} size={36} />
          </ScalePressable>
          <Text style={styles.headerTitle}>Chats</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>{IS_DEMO ? '🧪 Demo' : 'Sign out'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ChatListSkeleton />
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptySubtitle}>Tap the button below to start a conversation</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item, index }) => <ConversationRow item={item} formatTime={formatTime} index={index} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Floating "new chat" button */}
      <ScalePressable style={styles.fab} onPress={() => setShowNewChat(true)}>
        <LinearGradient colors={Colors.fabGradient} style={styles.fabGradient}>
          <Text style={styles.fabIcon}>✎</Text>
        </LinearGradient>
      </ScalePressable>

      {/* New chat modal */}
      <Modal visible={showNewChat} transparent animationType="slide" onRequestClose={() => setShowNewChat(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowNewChat(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New conversation</Text>
          <Text style={styles.modalSubtitle}>
            Exact email or phone only — no contacts are uploaded, you can&apos;t browse other users.
          </Text>

          <View style={styles.modalTabRow}>
            <TouchableOpacity
              style={[styles.modalTab, searchMode === 'email' && styles.modalTabActive]}
              onPress={() => setSearchMode('email')}
            >
              <Text style={[styles.modalTabText, searchMode === 'email' && styles.modalTabTextActive]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalTab, searchMode === 'phone' && styles.modalTabActive]}
              onPress={() => setSearchMode('phone')}
            >
              <Text style={[styles.modalTabText, searchMode === 'phone' && styles.modalTabTextActive]}>Phone</Text>
            </TouchableOpacity>
          </View>

          {searchMode === 'email' ? (
            <TextInput
              style={styles.modalInput}
              placeholder="friend@example.com"
              placeholderTextColor={Colors.textMuted}
              value={searchEmail}
              onChangeText={setSearchEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
          ) : (
            <TextInput
              style={styles.modalInput}
              placeholder="+919876543210"
              placeholderTextColor={Colors.textMuted}
              value={searchPhone}
              onChangeText={setSearchPhone}
              keyboardType="phone-pad"
              autoFocus
            />
          )}

          <TouchableOpacity
            style={[styles.modalBtn, searchLoading && styles.buttonDisabled]}
            onPress={startNewChat}
            disabled={searchLoading}
          >
            {searchLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.modalBtnText}>Start chat</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: 0.2 },
  signOutBtn: { padding: 6 },
  signOutText: { color: Colors.textSecondary, fontSize: 14 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyIcon: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },

  listContent: { paddingBottom: 100 },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 13,
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 29,
    padding: 2,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  convInfo: { flex: 1 },
  convName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  convLast: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  convTime: { fontSize: 12, color: Colors.textMuted },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 79 },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    borderRadius: 30,
    shadowColor: Colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: { fontSize: 24, color: '#fff' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: Colors.overlay },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  modalTabRow: {
    flexDirection: 'row', marginBottom: 14,
    backgroundColor: Colors.inputBg, borderRadius: 12, padding: 4,
  },
  modalTab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  modalTabActive: { backgroundColor: Colors.primary },
  modalTabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  modalTabTextActive: { color: '#fff' },
  modalInput: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  modalBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
