import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, RefreshControl, TextInput,
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
import { Icon } from '@/components/Icon';

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

  const previewIcon =
    item.last_message_type === 'image' ? 'image'
      : item.last_message_type === 'voice_note' ? 'voice'
        : null;

  const title = item.is_group ? (item.name ?? 'Group') : (item.other_user?.username ?? 'Unknown');

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(280)}>
      <TouchableOpacity
        style={styles.convCard}
        onPress={() =>
          router.push({
            pathname: '/(app)/chat/[id]',
            params: { id: item.id, username: title, isGroup: item.is_group ? '1' : '' },
          })
        }
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarRing}>
          {item.is_group ? (
            <View style={styles.groupAvatar}>
              <Icon name="people" size={26} color="#fff" />
            </View>
          ) : (
            <>
              <Avatar username={item.other_user?.username} avatarUrl={item.other_user?.avatar_url} size={50} />
              {online && <View style={styles.onlineDot} />}
            </>
          )}
        </View>
        {/* Info */}
        <View style={styles.convInfo}>
          <Text style={styles.convName} numberOfLines={1}>{title}</Text>
          <View style={styles.convLastRow}>
            {previewIcon && <Icon name={previewIcon} size={13} color={Colors.textSecondary} />}
            <Text style={styles.convLast} numberOfLines={1}>
              {item.last_message || (item.is_group ? `${item.member_count ?? 0} members` : '')}
            </Text>
          </View>
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
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.other_user?.username ?? '').toLowerCase().includes(q) ||
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.last_message ?? '').toLowerCase().includes(q),
    );
  }, [conversations, query]);

  // New chat modal — pick from people you're already friends with.
  const { friends } = useFriendRequests();
  const [showNewChat, setShowNewChat] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  // New group modal
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);

  const toggleGroupMember = (id: string) =>
    setGroupMembers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const createGroup = async () => {
    if (!groupName.trim() || groupMembers.size === 0) {
      Alert.alert('Add details', 'Enter a group name and pick at least one member.');
      return;
    }
    if (IS_DEMO) {
      Alert.alert('Demo mode', 'Turn off demo mode to create real groups.');
      return;
    }
    setCreatingGroup(true);
    try {
      const { data: convId, error } = await supabase.rpc('create_group_conversation', {
        group_name: groupName.trim(),
        member_ids: Array.from(groupMembers),
      });
      if (error || !convId) {
        Alert.alert('Error', error?.message ?? 'Could not create group.');
        return;
      }
      const name = groupName.trim();
      setShowNewGroup(false);
      setGroupName('');
      setGroupMembers(new Set());
      if (currentUserId) fetchConversations(currentUserId);
      router.push({ pathname: '/(app)/chat/[id]', params: { id: convId, username: name, isGroup: '1' } });
    } finally {
      setCreatingGroup(false);
    }
  };

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

    // Step 2: conversation rows (so we know which are groups + their name).
    const { data: convRows } = await supabase
      .from('conversations')
      .select('id, is_group, name')
      .in('id', myConvIds);
    const convMeta: Record<string, { is_group: boolean; name: string | null }> = {};
    for (const c of convRows ?? []) convMeta[(c as any).id] = { is_group: !!(c as any).is_group, name: (c as any).name };

    // Step 3: ALL members per conversation (other user for 1:1, count for groups).
    const { data: members, error: othersErr } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id, profiles!inner(id, username, email, avatar_url)')
      .in('conversation_id', myConvIds);

    if (othersErr) {
      console.error('fetchConversations members error:', othersErr.message);
      return;
    }

    const membersByConv: Record<string, any[]> = {};
    for (const row of members ?? []) {
      (membersByConv[(row as any).conversation_id] ??= []).push(row);
    }

    // Step 4: last message per conversation
    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('conversation_id, content, message_type, created_at')
      .in('conversation_id', myConvIds)
      .order('created_at', { ascending: false });

    const lastMsgMap: Record<string, any> = {};
    for (const msg of lastMsgs ?? []) {
      const cid = (msg as any).conversation_id;
      if (!(cid in lastMsgMap)) lastMsgMap[cid] = msg;
    }

    const convs: Conversation[] = myConvIds.map((cid: string) => {
      const meta = convMeta[cid] ?? { is_group: false, name: null };
      const roster = membersByConv[cid] ?? [];
      const last = lastMsgMap[cid];
      const type: Conversation['last_message_type'] =
        last?.message_type === 'image' ? 'image'
          : last?.message_type === 'voice_note' ? 'voice_note'
            : 'text';
      const lastText = last
        ? type === 'image' ? 'Photo'
          : type === 'voice_note' ? 'Voice note'
            : last.content ?? ''
        : meta.is_group ? '' : 'Say hello!';
      const other = roster.find((r) => r.user_id !== userId)?.profiles as Profile | undefined;
      return {
        id: cid,
        created_at: '',
        updated_at: '',
        is_group: meta.is_group,
        name: meta.name ?? undefined,
        member_count: roster.length,
        other_user: meta.is_group ? undefined : other,
        last_message_type: type,
        last_message: lastText,
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
        <TouchableOpacity onPress={handleSignOut} style={styles.headerAction}>
          {IS_DEMO ? (
            <View style={styles.demoChip}>
              <Icon name="sparkles" size={12} color={Colors.primaryLight} />
              <Text style={styles.demoChipText}>Demo</Text>
            </View>
          ) : (
            <Icon name="signout" size={22} color={Colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      {!loading && conversations.length > 0 && (
        <View style={styles.searchWrap}>
          <Icon name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chats"
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Icon name="close" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <ChatListSkeleton />
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Icon name="chatOutline" size={40} color={Colors.primaryLight} />
          </View>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptySubtitle}>Tap the button below to start a conversation</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Icon name="search" size={36} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptySubtitle}>No chats match “{query.trim()}”</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item, index }) => <ConversationRow item={item} formatTime={formatTime} index={index} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Floating "new chat" button */}
      <ScalePressable style={styles.fab} onPress={() => setShowNewChat(true)}>
        <LinearGradient colors={Colors.fabGradient} style={styles.fabGradient}>
          <Icon name="compose" size={24} color="#fff" />
        </LinearGradient>
      </ScalePressable>

      {/* New chat modal — pick a friend */}
      <Modal visible={showNewChat} transparent animationType="slide" onRequestClose={() => setShowNewChat(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowNewChat(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New chat</Text>
          <Text style={styles.modalSubtitle}>Start a conversation with one of your friends.</Text>

          {friends.length > 0 && (
            <TouchableOpacity
              style={styles.newGroupRow}
              onPress={() => { setShowNewChat(false); setShowNewGroup(true); }}
            >
              <View style={styles.newGroupIcon}>
                <Icon name="people" size={20} color="#fff" />
              </View>
              <Text style={styles.newGroupText}>New group</Text>
              <Icon name="forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

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
                    : <Icon name="forward" size={20} color={Colors.textMuted} />}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* New group modal — name + multi-select friends */}
      <Modal visible={showNewGroup} transparent animationType="slide" onRequestClose={() => setShowNewGroup(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowNewGroup(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New group</Text>
          <Text style={styles.modalSubtitle}>Name it and add friends.</Text>

          <TextInput
            style={styles.groupNameInput}
            placeholder="Group name"
            placeholderTextColor={Colors.textMuted}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={50}
          />

          <FlatList
            data={friends}
            keyExtractor={(f) => f.id}
            style={styles.friendList}
            renderItem={({ item }) => {
              const selected = groupMembers.has(item.id);
              return (
                <TouchableOpacity style={styles.friendRow} onPress={() => toggleGroupMember(item.id)}>
                  <Avatar username={item.username} avatarUrl={item.avatar_url} size={44} />
                  <Text style={styles.friendName}>{item.username}</Text>
                  <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                    {selected && <Icon name="check" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity
            style={[styles.modalBtn, (creatingGroup || groupMembers.size === 0 || !groupName.trim()) && { opacity: 0.5 }]}
            onPress={createGroup}
            disabled={creatingGroup || groupMembers.size === 0 || !groupName.trim()}
          >
            {creatingGroup
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.modalBtnText}>Create group{groupMembers.size > 0 ? ` (${groupMembers.size})` : ''}</Text>}
          </TouchableOpacity>
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
  headerAction: { padding: 6 },
  demoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  demoChipText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 4,
    height: 44,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 0 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingBottom: 40 },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },

  listContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 100 },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
    gap: 13,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarRing: {
    borderRadius: 29,
  },
  groupAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
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
  convLastRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  convLast: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  convTime: { fontSize: 12, color: Colors.textMuted, alignSelf: 'flex-start', marginTop: 2 },

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

  newGroupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  newGroupIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  newGroupText: { flex: 1, color: Colors.text, fontSize: 16, fontWeight: '700' },

  groupNameInput: {
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: Colors.text, fontSize: 16, marginBottom: 12,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});
