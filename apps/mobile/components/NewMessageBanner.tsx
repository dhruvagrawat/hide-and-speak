import { useEffect, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { IS_DEMO } from '@/lib/demo';
import { useActiveConversationRef } from '@/lib/activeConversation';
import { onDemoBanner } from '@/lib/notify';
import { Colors } from '@/constants/colors';
import { Message } from '@/lib/types';

interface Banner {
  conversationId: string;
  username: string;
}

/**
 * Global "new message from X" banner — content is never shown, just the
 * sender's name (same idea as WhatsApp's locked-chat notification
 * preview). Listens across every conversation at once: Supabase Realtime
 * already applies the same RLS policy used for SELECT to postgres_changes,
 * so this only ever receives INSERTs for conversations you're a member of.
 *
 * This is the in-app stand-in for real push notifications — actual push
 * needs a custom dev-client build (Expo Go dropped remote push on
 * Android), so it only fires while the app is open and in the foreground.
 */
export function NewMessageBanner() {
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState<Banner | null>(null);
  const activeConversationRef = useActiveConversationRef();
  const currentUserIdRef = useRef<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  // Demo-mode manual trigger (Settings → Demo & testing) reuses the same UI.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onDemoBanner((p) => show(p)), []);

  useEffect(() => {
    if (IS_DEMO) return; // no live second device to demo this against

    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUserIdRef.current = user?.id ?? null;
    });

    const channel = supabase
      .channel('global:new-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id === currentUserIdRef.current) return;
          if (msg.conversation_id === activeConversationRef.current) return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', msg.sender_id)
            .single();

          show({ conversationId: msg.conversation_id, username: profile?.username ?? 'Someone' });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationRef]);

  const show = (b: Banner) => {
    setBanner(b);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 16 }).start();
    setTimeout(dismiss, 4000);
  };

  const dismiss = () => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setBanner(null);
    });
  };

  if (!banner) return null;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          top: insets.top + 8,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.9}
        onPress={() => {
          const id = banner.conversationId;
          dismiss();
          router.push({ pathname: '/(app)/chat/[id]', params: { id, username: banner.username } });
        }}
      >
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.text}>New message from {banner.username}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 12, right: 12, zIndex: 1000 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 8,
  },
  icon: { fontSize: 15 },
  text: { color: Colors.text, fontSize: 14, fontWeight: '600' },
});
