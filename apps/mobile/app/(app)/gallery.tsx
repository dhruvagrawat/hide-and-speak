import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { Icon } from '@/components/Icon';
import { listVault, deleteFromVault, VaultItem } from '@/lib/vault';

const { width: SCREEN_W } = Dimensions.get('window');
const COLS = 3;
const GAP = 3;
const TILE = (SCREEN_W - GAP * (COLS + 1)) / COLS;

/**
 * In-app gallery ("Vault") — shows images the user has saved *inside* the
 * app (lib/vault.ts), kept out of the device's shared photo gallery.
 */
export default function GalleryScreen() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<VaultItem | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listVault());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = (item: VaultItem) => {
    Alert.alert('Delete image', 'Remove this image from your in-app vault?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFromVault(item.uri);
          setViewer(null);
          load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="back" size={18} color={Colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Vault</Text>
        <View style={styles.backBtn} />
      </View>

      {!loading && items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Icon name="key" size={38} color={Colors.primaryLight} />
          </View>
          <Text style={styles.emptyTitle}>Your vault is empty</Text>
          <Text style={styles.emptySubtitle}>
            Long-press any image in a chat and choose “Save to vault” to keep a
            private copy here — never in your device gallery.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.name}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: GAP }}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 12) * 25).duration(250)}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setViewer(item)} onLongPress={() => confirmDelete(item)}>
                <Image source={{ uri: item.uri }} style={styles.tile} contentFit="cover" transition={200} />
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      )}

      {/* Fullscreen viewer */}
      <Modal visible={!!viewer} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.fsBackdrop} onPress={() => setViewer(null)}>
          {viewer && (
            <Animated.View entering={FadeIn.duration(180)} style={styles.fsWrap}>
              <Image source={{ uri: viewer.uri }} style={styles.fsImage} contentFit="contain" />
              <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(viewer)}>
                <Icon name="trash" size={16} color="#fff" />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 72, flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: Colors.textSecondary, fontSize: 15 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '800' },

  grid: { padding: GAP, gap: GAP },
  tile: { width: TILE, height: TILE, borderRadius: 6, backgroundColor: Colors.surface },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  fsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fsWrap: { width: '100%', alignItems: 'center' },
  fsImage: { width: SCREEN_W, height: SCREEN_W },
  deleteBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
