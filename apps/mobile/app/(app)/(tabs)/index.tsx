import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useTheme, type Palette } from '@/lib/theme';
import { Conversation, Profile } from '@/lib/types';
import { IS_DEMO, DEMO_USER_ID, DEMO_PROFILE, DEMO_CONVERSATIONS } from '@/lib/demo';
import { useIsOnline } from '@/lib/presence';
import { useFriendRequests } from '@/lib/friends';
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
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

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
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ownProfile, setOwnProfile] = useState<Profile | null>(IS_DEMO ? DEMO_PROFILE : null);

  // New chat modal — pick from people you're already friends with.
  const { friends } = useFriendRequests();
  const [showNewChat, setShowNewChat] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

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

  // Start (or open) a chat with a friend. Friendship is required first —
  // adding people happens on the Requests tab.
  const startChatWith = async (friend: Profile) => {
    if (IS_DEMO) {
      setShowNewChat(false);
      const existing = DEMO_CONVERSATIONS.find((c) => c.other_user?.id === friend.id);
      if (existing) {
        router.push({ pathname: '/(app)/chat/[id]', params: { id: existing.id, username: friend.username } });
      } else {
        Alert.alert('Demo mode', 'Connect Supabase and turn off demo mode to start real conversations.');
      }
      return;
    }
    setStartingId(friend.id);
    try {
      // RPC handles duplicate-checking, creation, and inserting both members
      // atomically with security definer.
      const { data: convId, error: rpcErr } = await supabase
        .rpc('create_conversation', { other_user_id: friend.id });
      if (rpcErr || !convId) {
        Alert.alert('Error', rpcErr?.message ?? 'Could not create conversation.');
        return;
      }
      setShowNewChat(false);
      if (currentUserId) fetchConversations(currentUserId);
      router.push({ pathname: '/(app)/chat/[id]', params: { id: convId, username: friend.username } });
    } finally {
      setStartingId(null);
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
          <ScalePressable onPress={() => router.push('/(app)/(tabs)/settings')}>
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

      {/* New chat modal — pick a friend */}
      <Modal visible={showNewChat} transparent animationType="slide" onRequestClose={() => setShowNewChat(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowNewChat(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New chat</Text>
          <Text style={styles.modalSubtitle}>Start a conversation with one of your friends.</Text>

          {friends.length === 0 ? (
            <View style={styles.noFriends}>
              <Text style={styles.noFriendsText}>
                You don&apos;t have any friends yet. Add someone from the Requests tab first.
              </Text>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => {
                  setShowNewChat(false);
                  router.push('/(app)/(tabs)/requests');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.modalBtnText}>Go to Requests</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.id}
              style={styles.friendList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.friendRow}
                  onPress={() => startChatWith(item)}
                  disabled={!!startingId}
                  accessibilityRole="button"
                  accessibilityLabel={`Start chat with ${item.username}`}
                >
                  <Avatar username={item.username} avatarUrl={item.avatar_url} size={44} />
                  <Text style={styles.friendName}>{item.username}</Text>
                  {startingId === item.id
                    ? <ActivityIndicator color={Colors.primaryLight} />
                    : <Text style={styles.friendChevron}>›</Text>}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  modalBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    elevation: 6,
    marginTop: 16,
  },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  noFriends: { paddingVertical: 8 },
  noFriendsText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  friendList: { maxHeight: 360 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
  },
  friendName: { flex: 1, color: Colors.text, fontSize: 16, fontWeight: '600' },
  friendChevron: { color: Colors.textMuted, fontSize: 26, fontWeight: '300' },
});
