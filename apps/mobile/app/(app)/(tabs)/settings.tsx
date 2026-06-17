import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useTheme, useThemeControls, type Palette } from '@/lib/theme';
import { Avatar } from '@/components/Avatar';
import { ScalePressable } from '@/components/AnimatedPressable';
import { PixelIcon } from '@/components/PixelIcon';
import { pickAndUploadAvatar } from '@/lib/avatar';
import { useAppLock } from '@/lib/applock';
import { useCalls } from '@/lib/calls';
import { triggerDemoBanner } from '@/lib/notify';
import { IS_DEMO, DEMO_PROFILE, DEMO_CONVERSATIONS } from '@/lib/demo';
import { Profile } from '@/lib/types';

/** A single tappable settings row. */
function Row({
  icon,
  title,
  subtitle,
  onPress,
  danger,
  right,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.rowIcon}>
        <PixelIcon name={icon} size={20} color={danger ? Colors.error : Colors.primaryLight} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: Colors.error }]}>{title}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {right ?? (onPress && <Text style={styles.rowChevron}>›</Text>)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { themeKey, setTheme, themes } = useThemeControls();

  const [profile, setProfile] = useState<Profile | null>(IS_DEMO ? DEMO_PROFILE : null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const { lock, canAuthenticate } = useAppLock();
  const { simulateIncoming } = useCalls();

  useEffect(() => {
    if (IS_DEMO) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data as Profile);
    });
  }, []);

  const changePhoto = async () => {
    if (IS_DEMO) {
      Alert.alert('Demo mode', 'Connect Supabase and turn off demo mode to upload a real photo.');
      return;
    }
    if (!profile) return;
    setUploading(true);
    try {
      const url = await pickAndUploadAvatar(profile.id);
      if (url) setProfile((p) => (p ? { ...p, avatar_url: url } : p));
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  const openEditName = () => {
    setDraftName(profile?.username ?? '');
    setEditing(true);
  };

  const saveName = async () => {
    const name = draftName.trim();
    if (!name) return;
    if (IS_DEMO) {
      setProfile((p) => (p ? { ...p, username: name } : p));
      setEditing(false);
      return;
    }
    if (!profile) return;
    setSavingName(true);
    try {
      const { error } = await supabase.from('profiles').update({ username: name }).eq('id', profile.id);
      if (error) {
        Alert.alert('Could not update', error.message);
        return;
      }
      setProfile((p) => (p ? { ...p, username: name } : p));
      setEditing(false);
    } finally {
      setSavingName(false);
    }
  };

  const signOut = () => {
    if (IS_DEMO) {
      Alert.alert('Demo mode', 'Sign-out is disabled in demo mode.');
      return;
    }
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const lockNow = () => {
    if (!canAuthenticate) {
      Alert.alert(
        'No device lock set up',
        'Add a fingerprint, face unlock, or passcode in your device settings to use app lock.',
      );
      return;
    }
    lock();
  };

  // Demo-only notification/call test triggers.
  const demoConv = DEMO_CONVERSATIONS[0];
  const testBanner = () =>
    triggerDemoBanner({
      conversationId: demoConv?.id ?? 'demo-conv-1',
      username: demoConv?.other_user?.username ?? 'Maya',
    });
  const testVoiceCall = () =>
    simulateIncoming(
      { id: demoConv?.other_user?.id ?? 'demo', name: demoConv?.other_user?.username ?? 'Maya', avatar: demoConv?.other_user?.avatar_url },
      'voice',
    );
  const testVideoCall = () =>
    simulateIncoming(
      { id: demoConv?.other_user?.id ?? 'demo', name: demoConv?.other_user?.username ?? 'Maya', avatar: demoConv?.other_user?.avatar_url },
      'video',
    );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Settings</Text>

      {/* Profile header */}
      <Animated.View entering={FadeInDown.duration(280)} style={styles.profileCard}>
        <ScalePressable onPress={changePhoto} accessibilityLabel="Change profile photo">
          <View style={styles.avatarWrap}>
            <Avatar username={profile?.username} avatarUrl={profile?.avatar_url} size={76} />
            <View style={styles.cameraBadge}>
              {uploading ? <ActivityIndicator size="small" color="#fff" /> : <PixelIcon name="edit" size={13} color="#fff" />}
            </View>
          </View>
        </ScalePressable>
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{profile?.username ?? '…'}</Text>
          <Text style={styles.profileEmail}>{profile?.email ?? ''}</Text>
        </View>
      </Animated.View>

      {/* Account */}
      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.group}>
        <Row icon="edit" title="Username" subtitle={profile?.username} onPress={openEditName} />
        <Row icon="key" title="Image vault" subtitle="Private, off your device gallery" onPress={() => router.push('/(app)/gallery')} />
      </View>

      {/* Appearance — live theme switcher */}
      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.group}>
        <View style={styles.themeRow}>
          <View style={styles.rowIcon}>
            <PixelIcon name="paint" size={20} color={Colors.primaryLight} />
          </View>
          <Text style={styles.rowTitle}>Theme</Text>
        </View>
        <View style={styles.swatchRow}>
          {themes.map((t) => {
            const active = t.key === themeKey;
            return (
              <TouchableOpacity
                key={t.key}
                style={styles.swatchItem}
                onPress={() => setTheme(t.key)}
                accessibilityRole="button"
                accessibilityLabel={`${t.name} theme`}
                accessibilityState={{ selected: active }}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: t.palette.surface, borderColor: active ? t.palette.primaryLight : Colors.border },
                    active && styles.swatchActive,
                  ]}
                >
                  <View style={[styles.swatchDot, { backgroundColor: t.palette.primary }]} />
                  <View style={[styles.swatchDot, { backgroundColor: t.palette.accent }]} />
                  {active && (
                    <View style={styles.swatchCheck}>
                      <PixelIcon name="check" size={12} color={t.palette.primaryLight} />
                    </View>
                  )}
                </View>
                <Text style={[styles.swatchLabel, active && { color: Colors.text }]}>{t.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Privacy & security */}
      <Text style={styles.sectionLabel}>Privacy &amp; security</Text>
      <View style={styles.group}>
        <Row
          icon="lock"
          title="Lock now"
          subtitle={canAuthenticate ? 'Lock with fingerprint / passcode' : 'No device lock set up'}
          onPress={lockNow}
        />
        <Row icon="eye" title="App lock" subtitle="Auto-locks with your fingerprint when you leave the app" />
      </View>

      {/* Demo & testing — only in demo mode */}
      {IS_DEMO && (
        <>
          <Text style={styles.sectionLabel}>Demo &amp; testing</Text>
          <View style={styles.group}>
            <Row icon="bell" title="Test message banner" subtitle="Fire the “new message from…” notification" onPress={testBanner} />
            <Row icon="phone" title="Test incoming voice call" subtitle="Ring a fake incoming call" onPress={testVoiceCall} />
            <Row icon="video" title="Test incoming video call" subtitle="Ring a fake incoming video call" onPress={testVideoCall} />
          </View>
          <Text style={styles.hint}>These buttons only appear in demo mode.</Text>
        </>
      )}

      {/* About + sign out */}
      <Text style={styles.sectionLabel}>About</Text>
      <View style={styles.group}>
        <Row icon="heart" title="Hide & Speak" subtitle="Version 1.0.0 · Private. Hidden. Yours." />
        <Row icon="door" title="Sign out" danger onPress={signOut} />
      </View>

      {/* Edit username modal */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEditing(false)} />
        <View style={styles.modalCenter} pointerEvents="box-none">
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Edit username</Text>
            <TextInput
              style={styles.editInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              maxLength={32}
              accessibilityLabel="Username"
            />
            <View style={styles.editButtons}>
              <TouchableOpacity style={[styles.editBtn, styles.editCancel]} onPress={() => setEditing(false)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBtn, styles.editSave, (!draftName.trim() || savingName) && styles.disabled]}
                onPress={saveName}
                disabled={!draftName.trim() || savingName}
              >
                {savingName ? <ActivityIndicator color="#fff" /> : <Text style={styles.editSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 18, marginTop: 6 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 8,
  },
  avatarWrap: { width: 76, height: 76 },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  profileText: { flex: 1 },
  profileName: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  profileEmail: { color: Colors.textSecondary, fontSize: 13, marginTop: 3 },

  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  group: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowIcon: { width: 26, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowChevron: { color: Colors.textMuted, fontSize: 24, fontWeight: '300' },
  hint: { color: Colors.textMuted, fontSize: 12, marginTop: 8, marginLeft: 4 },

  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, padding: 16 },
  swatchItem: { alignItems: 'center', gap: 6, width: 56 },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swatchActive: { borderWidth: 2.5 },
  swatchDot: { width: 12, height: 12, borderRadius: 6 },
  swatchCheck: { position: 'absolute', bottom: 3, right: 3 },
  swatchLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },

  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay },
  modalCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  editCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
  },
  editTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 14 },
  editInput: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
  },
  editButtons: { flexDirection: 'row', gap: 12, marginTop: 18 },
  editBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  editCancel: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border },
  editCancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  editSave: { backgroundColor: Colors.primary },
  editSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
