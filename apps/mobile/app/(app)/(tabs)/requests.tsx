import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme, type Palette } from '@/lib/theme';
import { Avatar } from '@/components/Avatar';
import { useFriendRequests } from '@/lib/friends';
import { IS_DEMO } from '@/lib/demo';
import { FriendRequest, Profile } from '@/lib/types';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function RequestsScreen() {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { incoming, outgoing, friends, loading, refresh, sendRequest, accept, decline, cancel } =
    useFriendRequests();

  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const onSend = async () => {
    setSending(true);
    setFeedback(null);
    const res = await sendRequest(mode, query);
    setSending(false);
    if (res.ok) {
      setQuery('');
      setFeedback({ ok: true, msg: 'Request sent!' });
    } else {
      setFeedback({ ok: false, msg: res.error ?? 'Could not send request.' });
    }
  };

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Text style={styles.screenTitle}>Requests</Text>

      {/* Add a friend */}
      <Animated.View entering={FadeInDown.duration(280)} style={styles.addCard}>
        <Text style={styles.addTitle}>Add a friend</Text>
        <Text style={styles.addHint}>
          You must be friends before you can chat. Find someone by their exact{' '}
          {mode === 'email' ? 'email' : 'phone number'}.
        </Text>

        <View style={styles.segment}>
          {(['email', 'phone'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}
              onPress={() => setMode(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
            >
              <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                {m === 'email' ? 'Email' : 'Phone'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (feedback) setFeedback(null);
            }}
            placeholder={mode === 'email' ? 'name@example.com' : '+1 555 000 1234'}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            keyboardType={mode === 'email' ? 'email-address' : 'phone-pad'}
            accessibilityLabel={`Friend's ${mode}`}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!query.trim() || sending) && styles.disabled]}
            onPress={onSend}
            disabled={!query.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send friend request"
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
          </TouchableOpacity>
        </View>

        {feedback && (
          <Animated.Text
            entering={FadeIn.duration(180)}
            style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr]}
          >
            {feedback.msg}
          </Animated.Text>
        )}
        {IS_DEMO && (
          <Text style={styles.demoNote}>
            Demo mode shows canned requests below — sending a real one needs Supabase connected.
          </Text>
        )}
      </Animated.View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <>
          {/* Incoming */}
          {incoming.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Wants to connect</Text>
              {incoming.map((req, i) => (
                <RequestRow key={req.id} req={req} index={i}>
                  <TouchableOpacity
                    style={[styles.pill, styles.pillPrimary, busyId === req.id && styles.disabled]}
                    onPress={() => withBusy(req.id, () => accept(req))}
                    disabled={busyId === req.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Accept ${req.profile?.username}`}
                  >
                    <Text style={styles.pillPrimaryText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pill, styles.pillGhost]}
                    onPress={() => withBusy(req.id, () => decline(req))}
                    disabled={busyId === req.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Decline ${req.profile?.username}`}
                  >
                    <Text style={styles.pillGhostText}>Decline</Text>
                  </TouchableOpacity>
                </RequestRow>
              ))}
            </>
          )}

          {/* Outgoing */}
          {outgoing.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Sent</Text>
              {outgoing.map((req, i) => (
                <RequestRow key={req.id} req={req} index={i} subtitle={`Pending · ${timeAgo(req.created_at)}`}>
                  <TouchableOpacity
                    style={[styles.pill, styles.pillGhost]}
                    onPress={() => withBusy(req.id, () => cancel(req))}
                    disabled={busyId === req.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel request to ${req.profile?.username}`}
                  >
                    <Text style={styles.pillGhostText}>Cancel</Text>
                  </TouchableOpacity>
                </RequestRow>
              ))}
            </>
          )}

          {/* Friends */}
          <Text style={styles.sectionLabel}>Friends · {friends.length}</Text>
          {friends.length === 0 ? (
            <Text style={styles.emptyFriends}>No friends yet. Send a request above to get started.</Text>
          ) : (
            friends.map((f, i) => <FriendRow key={f.id} friend={f} index={i} />)
          )}
        </>
      )}
    </ScrollView>
  );
}

function RequestRow({
  req,
  index,
  subtitle,
  children,
}: {
  req: FriendRequest;
  index: number;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const p = req.profile;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 40).duration(260)} style={styles.row}>
      <Avatar username={p?.username} avatarUrl={p?.avatar_url} size={46} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{p?.username ?? 'Unknown'}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {subtitle ?? p?.email ?? ''}
        </Text>
      </View>
      <View style={styles.rowActions}>{children}</View>
    </Animated.View>
  );
}

function FriendRow({ friend, index }: { friend: Profile; index: number }) {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 40).duration(260)} style={styles.row}>
      <Avatar username={friend.username} avatarUrl={friend.avatar_url} size={46} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{friend.username}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {friend.email}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.pill, styles.pillPrimary]}
        onPress={() => router.push('/(app)/(tabs)')}
        accessibilityRole="button"
        accessibilityLabel={`Message ${friend.username}`}
      >
        <Text style={styles.pillPrimaryText}>Message</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 48 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 18, marginTop: 6 },

  addCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  addTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  addHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 14 },

  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: Colors.primary },
  segmentText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },

  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
  },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  feedback: { fontSize: 13, marginTop: 12, fontWeight: '600' },
  feedbackOk: { color: Colors.success },
  feedbackErr: { color: Colors.accent },
  demoNote: { color: Colors.textMuted, fontSize: 12, marginTop: 12, lineHeight: 17 },

  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 26,
    marginBottom: 10,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
  },
  rowInfo: { flex: 1 },
  rowName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  rowSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  pillPrimary: { backgroundColor: Colors.primary },
  pillPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pillGhost: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border },
  pillGhostText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  emptyFriends: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});
