import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

/**
 * Upload a local file (file:// URI from the image picker / audio recorder) to
 * a Supabase Storage bucket.
 *
 * Why not FormData: on Android, `supabase.storage.upload(path, formData)` is
 * flaky — it frequently uploads 0 bytes or a malformed body, which surfaces as
 * "format" / upload errors. The reliable Expo pattern is to read the file as
 * base64, decode it to an ArrayBuffer, and upload that with an explicit
 * contentType. That's what this does.
 */
export async function uploadFileToStorage(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
  opts: { upsert?: boolean } = {},
): Promise<{ path: string }> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) throw new Error('Could not read the selected file.');

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, decode(base64), { contentType, upsert: opts.upsert ?? false });

  if (error) throw error;
  return { path: data.path };
}

/** Map a file extension to a sane image MIME type. */
export function imageContentType(ext: string): string {
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  if (e === 'heic' || e === 'heif') return 'image/heic';
  return 'image/jpeg';
}
