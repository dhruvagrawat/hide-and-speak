import { createClient } from './supabase/client';

/**
 * Uploads a File to the public "avatars" bucket at "<userId>/avatar.<ext>"
 * (storage RLS only allows writing to your own folder — see
 * supabase/patch_004_avatars.sql) and updates profiles.avatar_url.
 * Returns the new public URL.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache-bust

  const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
  if (updateError) throw updateError;

  return publicUrl;
}
