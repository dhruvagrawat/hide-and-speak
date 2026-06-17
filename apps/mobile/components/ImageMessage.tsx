/**
 * ImageMessage — the unique feature of this app.
 *
 * Sender chooses:
 *   • Visible  — image shows normally
 *   • Hidden   — image is obscured until the receiver taps to reveal
 *       └─ Filter options: Blur | Pixelate | Noir
 *
 * Receiver side:
 *   • Hidden image shows an overlay with a lock badge + "Tap to reveal"
 *   • Tapping removes the overlay and shows the image in full
 *   • Long-pressing shows options: "View full-screen", "Save to gallery", "Hide again"
 *
 * Sender pick flow (used inside the chat input area):
 *   • <ImagePickerButton onImageReady={fn} /> opens the system picker,
 *     then shows a bottom-sheet to configure hidden/filter before sending.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Icon, type IconName } from '@/components/Icon';
import { ImageFilter, PendingImage } from '@/lib/types';
import { saveToVault } from '@/lib/vault';

// Images "save" into the app's own private vault (lib/vault.ts) — a
// sandboxed folder inside the app, deliberately NOT the device's shared
// photo gallery. This keeps sensitive images out of the system gallery,
// other apps, and the photo picker. Works in plain Expo Go (no native
// module needed) since it's just the app's document directory.

const { width: SCREEN_W } = Dimensions.get('window');
const IMAGE_W = SCREEN_W * 0.62;
const IMAGE_H = IMAGE_W * 0.75;

// ─────────────────────────────────────────────
// Sub-component: filter overlay on a hidden image
// ─────────────────────────────────────────────
function FilterOverlay({ filter }: { filter: ImageFilter | null }) {
  if (filter === 'noir') {
    return (
      <View style={[StyleSheet.absoluteFill, styles.noirOverlay]}>
        <View style={styles.noirTint} />
      </View>
    );
  }
  if (filter === 'pixelate') {
    // Simulate pixelation with a grid of semi-transparent squares
    return (
      <View style={[StyleSheet.absoluteFill, styles.pixelateOverlay]}>
        {Array.from({ length: 6 }).map((_, row) => (
          <View key={row} style={styles.pixelRow}>
            {Array.from({ length: 8 }).map((_, col) => (
              <View
                key={col}
                style={[
                  styles.pixel,
                  { opacity: (row + col) % 2 === 0 ? 0.7 : 0.4 },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    );
  }
  // Default: blur (also used when filter === 'blur')
  return (
    <BlurView
      style={StyleSheet.absoluteFill}
      intensity={90}
      tint="dark"
    />
  );
}

// ─────────────────────────────────────────────
// Main component: renders an image message bubble
// ─────────────────────────────────────────────
interface ImageMessageProps {
  imageUrl: string;
  hidden: boolean;
  filter: ImageFilter | null;
  isMine: boolean;
}

export function ImageMessage({ imageUrl, hidden, filter, isMine }: ImageMessageProps) {
  const [revealed, setRevealedLocal] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isHidden = hidden && !revealed;

  const handleTap = () => {
    if (isHidden) {
      setRevealedLocal(true);
    } else {
      setFullscreen(true);
    }
  };

  const handleLongPress = () => {
    Alert.alert('Image options', undefined, [
      {
        text: 'View full-screen',
        onPress: () => setFullscreen(true),
      },
      {
        text: 'Save to vault',
        onPress: () => saveToVaultLocal(),
      },
      ...(revealed ? [{ text: 'Hide again', onPress: () => setRevealedLocal(false) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const saveToVaultLocal = async () => {
    setSaving(true);
    try {
      await saveToVault(imageUrl);
      Alert.alert('Saved to vault', 'A private copy is in your in-app vault — not your device gallery.');
    } catch {
      Alert.alert('Save failed', 'Could not save this image to your vault. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filterLabel: Record<ImageFilter, string> = {
    blur: 'BLUR',
    pixelate: 'PIXELATE',
    noir: 'NOIR',
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleTap}
        onLongPress={handleLongPress}
        activeOpacity={0.9}
        style={styles.wrapper}
      >
        {/* The actual image */}
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />

        {/* Hidden overlay */}
        {isHidden && <FilterOverlay filter={filter} />}

        {/* Hidden badge */}
        {isHidden && (
          <View style={styles.revealBadge}>
            <Icon name="eyeOff" size={15} color="#fff" />
            <Text style={styles.revealText}>Tap to reveal</Text>
          </View>
        )}

        {/* Filter label when hidden */}
        {isHidden && filter && (
          <View style={[styles.filterTag, styles[`filter_${filter}`]]}>
            <Text style={styles.filterTagText}>{filterLabel[filter]}</Text>
          </View>
        )}

        {/* Saving spinner */}
        {saving && (
          <View style={styles.savingOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      {/* Fullscreen viewer */}
      <Modal visible={fullscreen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFullscreen(false)}>
        <Pressable style={styles.fsBackdrop} onPress={() => setFullscreen(false)}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.fsImage}
            contentFit="contain"
          />
          <TouchableOpacity style={styles.fsSaveBtn} onPress={saveToVaultLocal}>
            <Icon name="key" size={16} color="#fff" />
            <Text style={styles.fsSaveBtnText}>Save to vault</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────
// Picker button + send-options sheet
// ─────────────────────────────────────────────
interface ImagePickerButtonProps {
  onImageReady: (pending: PendingImage) => void;
  // Whether the person you're chatting with is online right now —
  // peer-to-peer send is only actually possible while that's true.
  recipientOnline?: boolean;
}

export function ImagePickerButton({ onImageReady, recipientOnline }: ImagePickerButtonProps) {
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [filter, setFilter] = useState<ImageFilter>('blur');
  const [p2p, setP2p] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const openPicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to share images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedUri(result.assets[0].uri);
      setHidden(false);
      setFilter('blur');
      setP2p(false);
      setSheetVisible(true);
    }
  };

  const handleSend = () => {
    if (!pickedUri) return;
    onImageReady({
      uri: pickedUri,
      hidden,
      filter: hidden ? filter : null,
      p2p,
    });
    setSheetVisible(false);
    setPickedUri(null);
  };

  const FILTERS: { id: ImageFilter; label: string; icon: IconName }[] = [
    { id: 'blur', label: 'Blur', icon: 'blur' },
    { id: 'pixelate', label: 'Pixelate', icon: 'grid' },
    { id: 'noir', label: 'Noir', icon: 'moon' },
  ];

  return (
    <>
      <TouchableOpacity style={styles.pickerBtn} onPress={openPicker} activeOpacity={0.7} accessibilityLabel="Attach image">
        <Icon name="attach" size={26} color={Colors.primaryLight} />
      </TouchableOpacity>

      {/* Options sheet */}
      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={() => setSheetVisible(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setSheetVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Send image</Text>

          {/* Preview */}
          {pickedUri && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: pickedUri }} style={styles.preview} contentFit="cover" />
              {hidden && <FilterOverlay filter={filter} />}
              {hidden && (
                <View style={styles.previewBadge}>
                  <Icon name="lock" size={13} color="#fff" />
                  <Text style={styles.previewBadgeText}>Hidden</Text>
                </View>
              )}
            </View>
          )}

          {/* Visible / Hidden toggle */}
          <Text style={styles.sectionLabel}>Visibility</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, !hidden && styles.toggleBtnActive]}
              onPress={() => setHidden(false)}
            >
              <Icon name="eye" size={17} color={!hidden ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.toggleBtnText, !hidden && styles.toggleBtnTextActive]}>Visible</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, hidden && styles.toggleBtnActiveRed]}
              onPress={() => setHidden(true)}
            >
              <Icon name="lock" size={16} color={hidden ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.toggleBtnText, hidden && styles.toggleBtnTextActive]}>Hidden</Text>
            </TouchableOpacity>
          </View>

          {/* Filter picker (only when hidden) */}
          {hidden && (
            <>
              <Text style={styles.sectionLabel}>Filter effect</Text>
              <View style={styles.filterRow}>
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]}
                    onPress={() => setFilter(f.id)}
                  >
                    <Icon name={f.icon} size={20} color={filter === f.id ? Colors.text : Colors.textSecondary} />
                    <Text style={[styles.filterBtnLabel, filter === f.id && styles.filterBtnLabelActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Peer-to-peer toggle */}
          <TouchableOpacity
            style={styles.p2pRow}
            onPress={() => setP2p((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.p2pCheckbox, p2p && styles.p2pCheckboxActive]}>
              {p2p && <Icon name="check" size={13} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.p2pLabelRow}>
                <Icon name="p2p" size={15} color={Colors.text} />
                <Text style={styles.p2pLabel}>Send peer-to-peer</Text>
              </View>
              <Text style={styles.p2pHint}>
                {recipientOnline
                  ? 'They’re online — this can skip the server entirely.'
                  : 'They’re offline right now — this will send as a normal image instead.'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Icon name={hidden ? 'lock' : 'send'} size={17} color="#fff" />
            <Text style={styles.sendBtnText}>{hidden ? 'Send hidden' : 'Send image'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  // Image message
  wrapper: {
    width: IMAGE_W,
    height: IMAGE_H,
    borderRadius: 14,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  revealBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  revealText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filterTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  filter_blur: { backgroundColor: 'rgba(80, 60, 160, 0.8)' },
  filter_pixelate: { backgroundColor: 'rgba(60, 100, 200, 0.8)' },
  filter_noir: { backgroundColor: 'rgba(30, 30, 30, 0.9)' },
  filterTagText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  savingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Noir overlay
  noirOverlay: { overflow: 'hidden' },
  noirTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  // Pixelate overlay
  pixelateOverlay: { overflow: 'hidden' },
  pixelRow: { flexDirection: 'row', flex: 1 },
  pixel: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },

  // Fullscreen viewer
  fsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fsImage: {
    width: SCREEN_W,
    height: SCREEN_W,
  },
  fsSaveBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  fsSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Picker button
  pickerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Options sheet
  sheetBackdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  previewContainer: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  preview: { width: '100%', height: '100%' },
  previewBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  previewBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
  },
  toggleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleBtnActiveRed: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  toggleBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  toggleBtnTextActive: { color: '#fff' },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  filterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
    gap: 4,
  },
  filterBtnActive: { borderColor: Colors.primaryLight, backgroundColor: Colors.primaryDark },
  filterBtnLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterBtnLabelActive: { color: '#fff' },
  p2pRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 20,
  },
  p2pCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  p2pCheckboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  p2pLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  p2pLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  p2pHint: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  sendBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    gap: 8,
    elevation: 6,
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
