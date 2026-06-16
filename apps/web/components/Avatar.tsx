'use client';

interface AvatarProps {
  username: string | null | undefined;
  avatarUrl?: string | null;
  size?: number;
}

/** Mirrors apps/mobile/components/Avatar.tsx — photo if set, initials otherwise. */
export function Avatar({ username, avatarUrl, size = 48 }: AvatarProps) {
  const style = { width: size, height: size, fontSize: size * 0.42 };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username ?? 'Avatar'}
        style={style}
        className="rounded-full bg-[#222222] object-cover"
      />
    );
  }

  return (
    <span
      style={style}
      className="flex items-center justify-center rounded-full bg-[#7C5CBF] font-bold text-white"
    >
      {(username ?? '?')[0]?.toUpperCase() ?? '?'}
    </span>
  );
}
