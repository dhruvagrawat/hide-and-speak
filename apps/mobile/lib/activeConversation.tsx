import { createContext, useContext, useRef, ReactNode } from 'react';

/**
 * Tracks which conversation screen is currently open, so the global
 * "new message" banner (lib/notifications) knows to stay quiet for
 * messages belonging to the chat you're already looking at.
 */
const ActiveConversationContext = createContext<{ current: string | null }>({ current: null });

export function ActiveConversationProvider({ children }: { children: ReactNode }) {
  const ref = useRef<string | null>(null);
  return <ActiveConversationContext.Provider value={ref}>{children}</ActiveConversationContext.Provider>;
}

export function useActiveConversationRef() {
  return useContext(ActiveConversationContext);
}
