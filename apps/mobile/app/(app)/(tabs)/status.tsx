import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useTheme, type Palette } from '@/lib/theme';
import { Avatar } from '@/components/Avatar';
import { ScalePressable } from '@/components/AnimatedPressable';
import { Icon } from '@/components/Icon';
import { uploadFileToStorage, imageContentType } from '@/lib/upload';
import { IS_DEMO, DEMO_USER_ID, DEMO_PROFILE, DEMO_STORY_GROUPS } from '@/lib/demo';
import { Story, StoryGroup, Profile } from '@/lib/types';

const STORY_MS = 5000;
const { width: SCREEN_W } = Dimensions.get('window');

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function StatusScreen() {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [groups, setGroups] = useState<StoryGroup[]>(IS_DEMO ? DEMO_STORY_GROUPS : []);
  const [myStory, setMyStory] = useState<StoryGroup | null>(null);
  const [me, setMe] = useState<Profile>(DEMO_PROFILE);
  const [loading, setLoading] = useState(!IS_DEMO);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<StoryGroup | null>(null);

  const load = useCallback(async () => {
    if (IS_DEMO) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, email, avatar_url')
      .eq('id', user.id)
      .single();
    if (profile) setMe(profile as Profile);

    try {
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const { data: rows } = await supabase
        .from('stories')
        .select('id, user_id, image_url, caption, created_at, author:profiles!stories_user_id_fkey(id, username, email, avatar_url)')
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      const byUser = new Map<string, Story[]>();
      for (const r of (rows ?? []) as unknown as Story[]) {
        const list = byUser.get(r.user_id) ?? [];
        list.push(r);
        byUser.set(r.user_id, list);
      }

      const mine = byUser.get(user.id);
      setMyStory(
        mine && mine.length
          ? { author: (profile as Profile) ?? DEMO_PROFILE, stories: mine, seen: true }
          : null,
      );

      const others: StoryGroup[] = [];
      byUser.forEach((stories, uid) => {
        if (uid === user.id) return;
        others.push({ author: stories[0].author ?? (DEMO_PROFILE as Profile), stories, seen: false });
      });
      setGroups(others);
    } catch {
      // 'stories' table not provisioned yet — show an empty state, not a crash.
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const addStory = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to post a status.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;

    if (IS_DEMO) {
      // No backend — keep it local so you can immediately view your own status.
      const story: Story = {
        id: `local-${Date.now()}`,
        user_id: DEMO_USER_ID,
        image_url: uri,
        caption: null,
        created_at: new Date().toISOString(),
        author: DEMO_PROFILE,
      };
      setMyStory((prev) => ({
        author: DEMO_PROFILE,
        seen: true,
        stories: prev ? [...prev.stories, story] : [story],
      }));
      return;
    }

    setBusy(true);
    try {
      const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${me.id}/${Date.now()}.${ext}`;
      await uploadFileToStorage('stories', path, uri, imageContentType(ext), { upsert: true });
      const { data: urlData } = supabase.storage.from('stories').getPublicUrl(path);
      const { error: insErr } = await supabase
        .from('stories')
        .insert({ user_id: me.id, image_url: urlData.publicUrl });
      if (insErr) throw insErr;
      await load();
    } catch (err) {
      Alert.alert('Could not post status', err instanceof Error ? err.message : 'Stories backend not set up yet.');
    } finally {
      setBusy(false);
    }
  };

  const openMine = () => {
    if (myStory) setViewing(myStory);
    else addStory();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Status</Text>

      {/* My status */}
      <Animated.View entering={FadeInDown.duration(280)}>
        <ScalePressable style={styles.myRow} onPress={openMine} accessibilityLabel="My status">
          <View style={styles.myAvatarWrap}>
            <View style={[styles.ring, myStory ? styles.ringActive : styles.ringMine]}>
              <Avatar username={me.username} avatarUrl={me.avatar_url} size={56} />
            </View>
            {!myStory && (
              <View style={styles.plusBadge}>
                {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.plusIcon}>+</Text>}
              </View>
            )}
          </View>
          <View style={styles.myInfo}>
            <Text style={styles.myName}>My status</Text>
            <Text style={styles.mySub}>
              {myStory ? `${myStory.stories.length} update${myStory.stories.length > 1 ? 's' : ''} · tap to view` : 'Tap to add an update'}
            </Text>
          </View>
          {myStory && (
            <TouchableOpacity onPress={addStory} hitSlop={10} accessibilityLabel="Add to my status">
              <Text style={styles.addMore}>＋</Text>
            </TouchableOpacity>
          )}
        </ScalePressable>
      </Animated.View>

      {/* Recent updates */}
      <Text style={styles.sectionLabel}>Recent updates</Text>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>◉</Text>
          <Text style={styles.emptyTitle}>No updates right now</Text>
          <Text style={styles.emptySub}>Statuses from your friends disappear after 24 hours.</Text>
        </View>
      ) : (
        groups.map((g, i) => (
          <Animated.View key={g.author.id} entering={FadeInDown.delay(Math.min(i, 6) * 45).duration(260)}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setViewing(g)}
              accessibilityRole="button"
              accessibilityLabel={`View ${g.author.username}'s status`}
            >
              <View style={[styles.ring, g.seen ? styles.ringSeen : styles.ringActive]}>
                <Avatar username={g.author.username} avatarUrl={g.author.avatar_url} size={52} />
              </View>
              <View style={styles.myInfo}>
                <Text style={styles.myName}>{g.author.username}</Text>
                <Text style={styles.mySub}>{timeAgo(g.stories[g.stories.length - 1].created_at)}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))
      )}

      {viewing && (
        <StoryViewer
          group={viewing}
          onClose={() => {
            // Mark the group seen locally once viewed.
            setGroups((gs) => gs.map((g) => (g.author.id === viewing.author.id ? { ...g, seen: true } : g)));
            setViewing(null);
          }}
        />
      )}
    </ScrollView>
  );
}

/** Full-screen, auto-advancing story viewer (tap right = next, left = back). */
function StoryViewer({ group, onClose }: { group: StoryGroup; onClose: () => void }) {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const story = group.stories[index];

  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= group.stories.length) {
        onClose();
        return i;
      }
      return i + 1;
    });
  }, [group.stories.length, onClose]);

  const prev = () => setIndex((i) => Math.max(0, i - 1));

  // Restart the progress bar + auto-advance timer whenever the story changes.
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: STORY_MS });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(next, STORY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [index, next, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        <Image source={{ uri: story.image_url }} style={styles.viewerImage} contentFit="contain" />

        {/* Progress bars */}
        <View style={styles.progressRow}>
          {group.stories.map((s, i) => (
            <View key={s.id} style={styles.progressTrack}>
              {i < index && <View style={[styles.progressFill, { width: '100%' }]} />}
              {i === index && <Animated.View style={[styles.progressFill, fillStyle]} />}
            </View>
          ))}
        </View>

        {/* Author header */}
        <View style={styles.viewerHeader}>
          <Avatar username={group.author.username} avatarUrl={group.author.avatar_url} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.viewerName}>{group.author.username}</Text>
            <Text style={styles.viewerTime}>{timeAgo(story.created_at)}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close status">
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tap zones */}
        <Pressable style={styles.tapLeft} onPress={prev} accessibilityLabel="Previous" />
        <Pressable style={styles.tapRight} onPress={next} accessibilityLabel="Next" />

        {story.caption ? (
          <View style={styles.captionWrap}>
            <Text style={styles.caption}>{story.caption}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 48 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 18, marginTop: 6 },

  myRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  myAvatarWrap: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' },
  myInfo: { flex: 1 },
  myName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  mySub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  addMore: { color: Colors.primaryLight, fontSize: 26, fontWeight: '400' },

  ring: { borderRadius: 32, padding: 3, borderWidth: 2 },
  ringActive: { borderColor: Colors.accent },
  ringSeen: { borderColor: Colors.border },
  ringMine: { borderColor: 'transparent' },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  plusIcon: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: -1 },

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
    gap: 14,
    paddingVertical: 9,
  },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 44, color: Colors.textMuted },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  emptySub: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

  // Viewer
  viewer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  viewerImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: SCREEN_W },
  progressRow: { flexDirection: 'row', gap: 4, position: 'absolute', top: 50, left: 12, right: 12 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  viewerHeader: {
    position: 'absolute',
    top: 64,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewerName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  viewerTime: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
  tapLeft: { position: 'absolute', left: 0, top: 100, bottom: 0, width: '35%' },
  tapRight: { position: 'absolute', right: 0, top: 100, bottom: 0, width: '65%' },
  captionWrap: {
    position: 'absolute',
    bottom: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    padding: 14,
  },
  caption: { color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 22 },
});
