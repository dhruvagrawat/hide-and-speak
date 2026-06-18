'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IS_DEMO } from '@/lib/demo';
import { LogoMark, Wordmark } from '@/components/Logo';
import { Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (IS_DEMO) {
      router.push('/chats');
      return;
    }

    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.push('/chats');
      router.refresh();
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark size={64} className="mb-3" />
          <Wordmark className="text-2xl" />
          <p className="mt-1 text-sm text-[#9E9E9E]">Private. Secure. Just for you.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#2A2A2A] bg-[#181818] p-6"
        >
          {IS_DEMO && (
            <p className="mb-4 flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-xs text-[#9E9E9E]">
              <Sparkles size={14} className="shrink-0 text-[#9B7FD4]" />
              Demo mode — any email/password will drop you straight into the demo chats.
            </p>
          )}

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mb-4 w-full rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-[#F5F5F5] placeholder-[#555555] outline-none focus:border-[#7C5CBF]"
          />

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mb-5 w-full rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-[#F5F5F5] placeholder-[#555555] outline-none focus:border-[#7C5CBF]"
          />

          {error && <p className="mb-4 text-sm text-[#F44336]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#7C5CBF] py-3 text-sm font-bold text-white transition-colors hover:bg-[#5A3F9A] disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="mt-5 text-center text-sm text-[#9E9E9E]">
            No account?{' '}
            <Link href="/register" className="font-semibold text-[#9B7FD4]">
              Register
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
