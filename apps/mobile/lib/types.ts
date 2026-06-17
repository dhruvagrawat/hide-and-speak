export type ImageFilter = 'blur' | 'pixelate' | 'noir';

export type MessageType = 'text' | 'image' | 'voice_note';

export interface Profile {
  id: string;
  username: string;
  email: string;
  phone?: string | null;
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
  unread_count?: number;
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

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  from_user: string;
  to_user: string;
  status: FriendRequestStatus;
  created_at: string;
  // The "other" person relative to the current user (sender for incoming,
  // recipient for outgoing).
  profile?: Profile;
}

export interface Story {
  id: string;
  user_id: string;
  image_url: string;
  caption?: string | null;
  created_at: string;
  // Filled when listing other people's stories.
  author?: Profile;
}

// A person's stories grouped together, as shown on the Status tab.
export interface StoryGroup {
  author: Profile;
  stories: Story[];
  // Whether the current user has viewed all of them (local-only flag).
  seen: boolean;
}

// Shape of what ImageMessage picker returns before upload
export interface PendingImage {
  uri: string;
  hidden: boolean;
  filter: ImageFilter | null;
  // "Private" peer-to-peer send — see lib/p2p.ts. Only actually goes P2P if
  // the recipient is online at send time; otherwise falls back to the
  // normal server-stored upload automatically.
  p2p?: boolean;
}
