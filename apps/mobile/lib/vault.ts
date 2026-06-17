import * as FileSystem from 'expo-file-system/legacy';

/**
 * In-app image vault.
 *
 * Saves images into the app's *private* document directory — sandboxed to
 * Hide & Speak, never written to the device's shared photo gallery and not
 * visible to other apps or the system gallery picker. This is the deliberate
 * privacy choice for this app: "save" keeps a copy inside the app only.
 *
 * Files are named `<timestamp>.<ext>` so the directory listing sorts
 * chronologically; no separate manifest is needed.
 */

const VAULT_DIR = `${FileSystem.documentDirectory}vault/`;

export interface VaultItem {
  /** file:// URI usable directly as an <Image> source */
  uri: string;
  /** file name (also encodes the saved-at timestamp) */
  name: string;
  /** ms epoch parsed from the file name */
  savedAt: number;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VAULT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
  }
}

/**
 * Copy an image into the vault. `sourceUri` may be a remote https URL
 * (downloaded first) or a local file:// URI (copied directly).
 * Returns the new in-vault file:// URI.
 */
export async function saveToVault(sourceUri: string, ext = 'jpg'): Promise<string> {
  await ensureDir();
  const cleanExt = (sourceUri.split('.').pop()?.split('?')[0] ?? ext).slice(0, 5) || ext;
  const dest = `${VAULT_DIR}${Date.now()}.${cleanExt}`;

  if (sourceUri.startsWith('http')) {
    await FileSystem.downloadAsync(sourceUri, dest);
  } else {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
  }
  return dest;
}

/** List everything in the vault, newest first. */
export async function listVault(): Promise<VaultItem[]> {
  await ensureDir();
  const names = await FileSystem.readDirectoryAsync(VAULT_DIR);
  return names
    .map((name) => ({
      name,
      uri: `${VAULT_DIR}${name}`,
      savedAt: Number(name.split('.')[0]) || 0,
    }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** Delete one item from the vault. */
export async function deleteFromVault(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
