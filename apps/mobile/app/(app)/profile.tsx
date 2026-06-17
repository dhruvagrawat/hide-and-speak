import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { pickAndUploadAvatar } from '@/lib/avatar';
import { IS_DEMO, DEMO_PROFILE } from '@/lib/demo';
import { Profile } from '@/lib/types';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(IS_DEMO ? DEMO_PROFILE : null);
  const [uploading, setUploading] = useState(false);

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

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.avatarArea}>
        <Avatar username={profile.username} avatarUrl={profile.avatar_url} size={120} />
        <TouchableOpacity style={styles.changeBtn} onPress={changePhoto} disabled={uploading} activeOpacity={0.85}>
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.changeBtnText}>📷 Change photo</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.username}>{profile.username}</Text>
      <Text style={styles.email}>{profile.email}</Text>

      <TouchableOpacity style={styles.vaultRow} onPress={() => router.push('/(app)/gallery')} activeOpacity={0.8}>
        <Text style={styles.vaultIcon}>🗝️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.vaultTitle}>Image vault</Text>
          <Text style={styles.vaultHint}>Private in-app gallery — kept off your device gallery</Text>
        </View>
        <Text style={styles.vaultChevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  backBtn: { paddingTop: 16, paddingBottom: 8 },
  backText: { color: Colors.textSecondary, fontSize: 15 },
  avatarArea: { alignItems: 'center', marginTop: 24, gap: 16 },
  changeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  changeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  username: { color: Colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 24 },
  email: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 },

  vaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    marginTop: 36,
  },
  vaultIcon: { fontSize: 26 },
  vaultTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  vaultHint: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  vaultChevron: { color: Colors.textMuted, fontSize: 26, fontWeight: '300' },
});
