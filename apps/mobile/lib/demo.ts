import { Conversation, FriendRequest, Message, Profile, StoryGroup } from './types';

/**
 * Demo mode — set EXPO_PUBLIC_DEMO_MODE=true to skip Supabase auth
 * entirely and explore the UI with canned data. Useful while your
 * Supabase project (schema / storage buckets / auth providers) isn't
 * fully wired up yet. Flip it off once you're ready to go live.
 */
export const IS_DEMO = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

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

// People who've sent you a request / you've sent one to / aren't friends yet.
const REQUESTER: Profile = {
  id: 'demo-req-1',
  username: 'Priya',
  email: 'priya@demo.local',
  avatar_url: 'https://i.pravatar.cc/300?u=hidespeak-demo-priya',
};

const PENDING_PERSON: Profile = {
  id: 'demo-req-2',
  username: 'Sam',
  email: 'sam@demo.local',
  avatar_url: 'https://i.pravatar.cc/300?u=hidespeak-demo-sam',
};

export const DEMO_FRIENDS: Profile[] = [FRIEND, OLD_FRIEND];

export const DEMO_INCOMING_REQUESTS: FriendRequest[] = [
  {
    id: 'demo-fr-in-1',
    from_user: REQUESTER.id,
    to_user: DEMO_USER_ID,
    status: 'pending',
    created_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    profile: REQUESTER,
  },
];

export const DEMO_OUTGOING_REQUESTS: FriendRequest[] = [
  {
    id: 'demo-fr-out-1',
    from_user: DEMO_USER_ID,
    to_user: PENDING_PERSON.id,
    status: 'pending',
    created_at: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    profile: PENDING_PERSON,
  },
];

export const DEMO_STORY_GROUPS: StoryGroup[] = [
  {
    author: FRIEND,
    seen: false,
    stories: [
      {
        id: 'demo-story-1',
        user_id: FRIEND.id,
        image_url: 'https://picsum.photos/seed/hidespeak-story-maya/720/1280',
        caption: 'Sunset on the trip 🌅',
        created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        author: FRIEND,
      },
    ],
  },
  {
    author: OLD_FRIEND,
    seen: true,
    stories: [
      {
        id: 'demo-story-2',
        user_id: OLD_FRIEND.id,
        image_url: 'https://picsum.photos/seed/hidespeak-story-theo/720/1280',
        caption: null,
        created_at: new Date(Date.now() - 9 * 3_600_000).toISOString(),
        author: OLD_FRIEND,
      },
    ],
  },
];

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

// Maya is "online" so you can see the presence dot + P2P-eligible state;
// Theo is "offline" so you can see the fallback-to-server behaviour.
export const DEMO_ONLINE_IDS = new Set<string>([FRIEND.id]);

export const DEMO_MESSAGES: Record<string, Message[]> = {
  'demo-conv-1': [
    // Newest first — matches the inverted FlatList used by the chat screen.
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
  ],
  'demo-conv-2': [
    {
      id: 'demo-msg-6',
      conversation_id: 'demo-conv-2',
      sender_id: OLD_FRIEND.id,
      content: null,
      message_type: 'voice_note',
      image_url: null,
      image_hidden: false,
      image_filter: null,
      voice_note_url: 'https://www.w3schools.com/html/horse.mp3',
      created_at: new Date(Date.now() - 87_000_000).toISOString(),
      sender: OLD_FRIEND,
    },
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
