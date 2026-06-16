'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/Avatar';
import { uploadAvatar } from '@/lib/avatar';
import { IS_DEMO, DEMO_PROFILE } from '@/lib/demo';
import { Profile } from '@/lib/types';

export default function ProfilePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(IS_DEMO ? DEMO_PROFILE : null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (IS_DEMO) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data as Profile);
    });
  }, [router]);

  const handleFile = async (file: File | undefined) => {
    if (!file || !profile) return;
    if (IS_DEMO) {
      alert('Demo mode — connect Supabase and turn off demo mode to upload a real photo.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAvatar(profile.id, file);
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  if (!profile) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2A2A2A] border-t-[#7C5CBF]" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <button
        onClick={() => router.push('/chats')}
        className="self-start text-sm text-[#9E9E9E] hover:text-[#F5F5F5]"
      >
        ← Back
      </button>

      <div className="mt-8 flex flex-col items-center gap-4">
        <Avatar username={profile.username} avatarUrl={profile.avatar_url} size={120} />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full bg-[#7C5CBF] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5A3F9A] disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : '📷 Change photo'}
        </button>
      </div>

      <h1 className="mt-6 text-xl font-semibold text-[#F5F5F5]">{profile.username}</h1>
      <p className="mt-1 text-sm text-[#9E9E9E]">{profile.email}</p>
    </main>
  );
}
