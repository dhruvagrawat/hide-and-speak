import { Conversation, Message, Profile } from './types';

/**
 * Demo mode — mirrors apps/mobile/lib/demo.ts. Set
 * NEXT_PUBLIC_DEMO_MODE=true to skip Supabase auth entirely and explore
 * the UI with canned data while your Supabase project isn't fully wired
 * up yet (schema / storage buckets / auth providers).
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const DEMO_USER_ID = 'demo-user';

export const DEMO_PROFILE: Profile = {
  id: DEMO_USER_ID,
  username: 'you',
  email: 'you@demo.local',
  avatar_url: 'https://i.pravatar.cc/300?u=hidespeak-demo-you',
};

const FRIEND: Profile = {
  id: 'demo-friend-1',
  username: 'Maya',
  email: 'maya@demo.local',
  avatar_url: 'https://i.pravatar.cc/300?u=hidespeak-demo-maya',
};

const OLD_FRIEND: Profile = {
  id: 'demo-friend-2',
  username: 'Theo',
  email: 'theo@demo.local',
  avatar_url: null, // demos the initials fallback too
};

// Maya is "online" so you can see the presence dot; Theo is "offline".
export const DEMO_ONLINE_IDS = new Set<string>([FRIEND.id]);

export const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: 'demo-conv-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    other_user: FRIEND,
    last_message: '📷 Image',
    last_message_at: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: 'demo-conv-2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    other_user: OLD_FRIEND,
    last_message: 'See you Friday!',
    last_message_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

export const DEMO_MESSAGES: Record<string, Message[]> = {
  'demo-conv-1': [
    {
      id: 'demo-msg-1',
      conversation_id: 'demo-conv-1',
      sender_id: DEMO_USER_ID,
      content: 'Hey! How was the trip?',
      message_type: 'text',
      image_url: null,
      image_hidden: false,
      image_filter: null,
      voice_note_url: null,
      created_at: new Date(Date.now() - 6 * 60_000).toISOString(),
    },
    {
      id: 'demo-msg-2',
      conversation_id: 'demo-conv-1',
      sender_id: FRIEND.id,
      content: 'Tap to see what I mean 👀',
      message_type: 'text',
      image_url: null,
      image_hidden: false,
      image_filter: null,
      voice_note_url: null,
      created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      sender: FRIEND,
    },
    {
      id: 'demo-msg-3',
      conversation_id: 'demo-conv-1',
      sender_id: FRIEND.id,
      content: null,
      message_type: 'image',
      image_url: 'https://picsum.photos/seed/hidespeak-demo/600/450',
      image_hidden: true,
      image_filter: 'blur',
      voice_note_url: null,
      created_at: new Date(Date.now() - 4 * 60_000).toISOString(),
      sender: FRIEND,
    },
    {
      id: 'demo-msg-4',
      conversation_id: 'demo-conv-1',
      sender_id: DEMO_USER_ID,
      content: 'Haha perfect, talk soon',
      message_type: 'text',
      image_url: null,
      image_hidden: false,
      image_filter: null,
      voice_note_url: null,
      created_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    },
  ],
  'demo-conv-2': [
    {
      id: 'demo-msg-5',
      conversation_id: 'demo-conv-2',
      sender_id: OLD_FRIEND.id,
      content: 'See you Friday!',
      message_type: 'text',
      image_url: null,
      image_hidden: false,
      image_filter: null,
      voice_note_url: null,
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
      sender: OLD_FRIEND,
    },
  ],
};
