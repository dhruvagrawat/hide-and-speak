import Link from 'next/link';

const FEATURES = [
  {
    icon: '🙈',
    title: 'Hidden image messages',
    body: 'Send a photo locked behind a blur, pixelate, or noir filter. The receiver taps to reveal it — never auto-saved to the gallery.',
  },
  {
    icon: '⚡',
    title: 'Real-time messaging',
    body: 'Messages appear instantly on both sides, powered by Supabase Realtime — no polling, no delay.',
  },
  {
    icon: '🔒',
    title: 'Self-hosted, end to end',
    body: 'Runs entirely on your own Supabase project. No third-party servers, no telemetry, your data stays yours.',
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-12">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C5CBF] text-sm text-white">
            ✦
          </span>
          <span className="text-base font-semibold tracking-wide text-[#F5F5F5]">
            Hide &amp; Speak
          </span>
        </div>
        <Link
          href="/login"
          className="rounded-full border border-[#2A2A2A] px-4 py-2 text-sm font-medium text-[#F5F5F5] transition-colors hover:border-[#7C5CBF] hover:text-[#9B7FD4]"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center px-6 pt-20 pb-24 text-center sm:pt-28">
        <span className="mb-5 rounded-full border border-[#2A2A2A] bg-[#181818] px-4 py-1.5 text-xs font-medium text-[#9E9E9E]">
          Privacy-first · Self-hostable · Open source
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-[#F5F5F5] sm:text-6xl">
          Chat that keeps your photos
          <span className="text-[#9B7FD4]"> hidden</span> until you choose.
        </h1>
        <p className="mt-6 max-w-xl text-base text-[#9E9E9E] sm:text-lg">
          Hide &amp; Speak is a privacy-first chat app with a signature feature:
          hidden image messages, revealed only on tap. Runs on your own
          Supabase backend — same auth, same conversations, on web and mobile.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-full bg-[#7C5CBF] px-7 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,92,191,0.35)] transition-colors hover:bg-[#5A3F9A]"
          >
            Get started
          </Link>
          <a
            href="#features"
            className="rounded-full border border-[#2A2A2A] px-7 py-3 text-sm font-semibold text-[#F5F5F5] transition-colors hover:border-[#7C5CBF]"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 pb-24 sm:px-12">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-[#2A2A2A] bg-[#181818] p-6 transition-colors hover:border-[#7C5CBF]/50"
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="mt-4 text-lg font-semibold text-[#F5F5F5]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#9E9E9E]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#2A2A2A] px-6 py-8 text-center text-xs text-[#555555] sm:px-12">
        MIT licensed — fork it, self-host it, make it yours.
      </footer>
    </main>
  );
}
