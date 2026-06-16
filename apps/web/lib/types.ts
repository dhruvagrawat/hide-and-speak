// Mirrors apps/mobile/lib/types.ts — same Supabase schema, same shapes.

export type ImageFilter = 'blur' | 'pixelate' | 'noir';

export type MessageType = 'text' | 'image' | 'voice_note';

export interface Profile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  created_at?: string;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  other_user?: Profile;
  last_message?: string;
  last_message_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: MessageType;
  image_url: string | null;
  image_hidden: boolean;
  image_filter: ImageFilter | null;
  voice_note_url: string | null;
  created_at: string;
  sender?: Profile;
}

export interface PendingImage {
  file: File;
  previewUrl: string;
  hidden: boolean;
  filter: ImageFilter | null;
}
