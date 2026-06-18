/**
 * Hide & Speak brand mark for web — the same concept as the mobile app: a
 * speech bubble ("speak") with a keyhole punched through it ("hide"), drawn
 * as inline SVG so it's crisp at any size and needs no asset file.
 */
export function LogoMark({ size = 72, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hsLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9B7FD4" />
          <stop offset="1" stopColor="#7C5CBF" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="28" fill="url(#hsLogoGrad)" />
      {/* speech bubble */}
      <rect x="22" y="26" width="56" height="38" rx="12" fill="rgba(255,255,255,0.96)" />
      <path d="M34 60 L34 74 L48 61 Z" fill="rgba(255,255,255,0.96)" />
      {/* keyhole */}
      <circle cx="50" cy="42" r="8" fill="#5A3F9A" />
      <rect x="46.5" y="46" width="7" height="13" rx="2" fill="#5A3F9A" />
    </svg>
  );
}

/** "Hide & Speak" wordmark with the ampersand in the accent colour. */
export function Wordmark({ className = 'text-2xl' }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-wide text-[#F5F5F5] ${className}`}>
      Hide <span className="text-[#FF6B8A]">&amp;</span> Speak
    </span>
  );
}
