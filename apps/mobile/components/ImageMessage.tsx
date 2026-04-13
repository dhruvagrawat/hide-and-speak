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
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors } from '@/constants/colors';
import { ImageFilter, PendingImage } from '@/lib/types';

const { width: SCREEN_W } = Dimensions.get('window');
const IMAGE_W = SCREEN_W * 0.62;
const IMAGE_H = IMAGE_W * 0.75;

// ─────────────────────────────────────────────
// Sub-component: filter overlay on a hidden image
// ─────────────────────────────────────────────
function FilterOverlay({ filter }: { filter: ImageFilter | null }) {
  if (filter === 'noir') {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.noirOverlay]}>
        <View style={styles.noirTint} />
      </View>
    );
  }
  if (filter === 'pixelate') {
    // Simulate pixelation with a grid of semi-transparent squares
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.pixelateOverlay]}>
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
      style={StyleSheet.absoluteFillObject}
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
    const options = ['View full-screen', 'Save to gallery'];
    if (revealed) options.push('Hide again');
    options.push('Cancel');

    Alert.alert('Image options', undefined, [
      {
        text: 'View full-screen',
        onPress: () => setFullscreen(true),
      },
      {
        text: 'Save to gallery',
        onPress: () => saveToGallery(),
      },
      ...(revealed ? [{ text: 'Hide again', onPress: () => setRevealedLocal(false) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const saveToGallery = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your gallery to save images.');
      return;
    }
    setSaving(true);
    try {
      // Download to a temp file first (imageUrl is a remote URL)
      const localUri = FileSystem.cacheDirectory + `img_${Date.now()}.jpg`;
      const { uri } = await FileSystem.downloadAsync(imageUrl, localUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved!', 'Image saved to your gallery.');
    } catch {
      Alert.alert('Error', 'Could not save image. Please try again.');
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
            <Text style={styles.lockIcon}>🔒</Text>
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
          <TouchableOpacity style={styles.fsSaveBtn} onPress={saveToGallery}>
            <Text style={styles.fsSaveBtnText}>⬇ Save to gallery</Text>
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
}

export function ImagePickerButton({ onImageReady }: ImagePickerButtonProps) {
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [filter, setFilter] = useState<ImageFilter>('blur');
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
      setSheetVisible(true);
    }
  };

  const handleSend = () => {
    if (!pickedUri) return;
    onImageReady({
      uri: pickedUri,
      hidden,
      filter: hidden ? filter : null,
    });
    setSheetVisible(false);
    setPickedUri(null);
  };

  const FILTERS: { id: ImageFilter; label: string; icon: string }[] = [
    { id: 'blur', label: 'Blur', icon: '🌫' },
    { id: 'pixelate', label: 'Pixelate', icon: '▦' },
    { id: 'noir', label: 'Noir', icon: '◑' },
  ];

  return (
    <>
      <TouchableOpacity style={styles.pickerBtn} onPress={openPicker} activeOpacity={0.7}>
        <Text style={styles.pickerBtnIcon}>📎</Text>
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
                  <Text style={styles.lockIcon}>🔒</Text>
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
              <Text style={[styles.toggleBtnText, !hidden && styles.toggleBtnTextActive]}>
                👁  Visible
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, hidden && styles.toggleBtnActiveRed]}
              onPress={() => setHidden(true)}
            >
              <Text style={[styles.toggleBtnText, hidden && styles.toggleBtnTextActive]}>
                🔒 Hidden
              </Text>
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
                    <Text style={styles.filterBtnIcon}>{f.icon}</Text>
                    <Text style={[styles.filterBtnLabel, filter === f.id && styles.filterBtnLabelActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Text style={styles.sendBtnText}>
              {hidden ? '🔒 Send hidden' : '📤 Send image'}
            </Text>
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
  lockIcon: { fontSize: 16 },
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Noir overlay
  noirOverlay: { overflow: 'hidden' },
  noirTint: {
    ...StyleSheet.absoluteFillObject,
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
  pickerBtnIcon: { fontSize: 22 },

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
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
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
  filterBtnIcon: { fontSize: 20 },
  filterBtnLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterBtnLabelActive: { color: '#fff' },
  sendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    elevation: 6,
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
