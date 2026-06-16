'use client';

import { PresenceProvider } from '@/lib/presence';

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  return <PresenceProvider>{children}</PresenceProvider>;
}
