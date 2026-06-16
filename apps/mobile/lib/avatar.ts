import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

/**
 * Opens the system image picker, uploads the result to the public
 * "avatars" bucket at "<userId>/avatar.<ext>" (storage RLS in
 * patch_004_avatars.sql only lets you write to your own folder), and
 * updates profiles.avatar_url. Returns the new public URL, or null if
 * the user cancelled / something failed.
 */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || !result.assets[0]) return null;

  const uri = result.assets[0].uri;
  const ext = uri.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const formData = new FormData();
  formData.append('file', { uri, name: path, type: `image/${ext}` } as unknown as Blob);

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, formData, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust so the new photo shows immediately instead of a stale CDN copy.
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);
  if (updateError) throw updateError;

  return publicUrl;
}
