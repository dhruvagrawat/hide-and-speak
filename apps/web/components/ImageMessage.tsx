'use client';

/**
 * ImageMessage — web counterpart of apps/mobile/components/ImageMessage.tsx.
 * Same feature: sender can mark an image Hidden (blur / pixelate / noir),
 * receiver clicks to reveal it.
 */

import { useRef, useState } from 'react';
import { ImageFilter, PendingImage } from '@/lib/types';

const FILTER_OVERLAY_CLASS: Record<ImageFilter, string> = {
  blur: 'backdrop-blur-xl bg-black/20',
  pixelate: 'backdrop-blur-2xl bg-[#3c64a8]/20',
  noir: 'bg-black/60',
};

const FILTER_LABEL: Record<ImageFilter, string> = {
  blur: 'BLUR',
  pixelate: 'PIXELATE',
  noir: 'NOIR',
};

interface ImageMessageProps {
  imageUrl: string;
  hidden: boolean;
  filter: ImageFilter | null;
}

export function ImageMessage({ imageUrl, hidden, filter }: ImageMessageProps) {
  const [revealed, setRevealed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const isHidden = hidden && !revealed;

  return (
    <>
      <button
        type="button"
        onClick={() => (isHidden ? setRevealed(true) : setFullscreen(true))}
        className="relative block h-[180px] w-[240px] overflow-hidden rounded-2xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />

        {isHidden && filter && (
          <div className={`absolute inset-0 ${FILTER_OVERLAY_CLASS[filter]}`} />
        )}

        {isHidden && (
          <>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/55 py-2 text-xs font-semibold text-white">
              🔒 Tap to reveal
            </div>
            {filter && (
              <span className="absolute top-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white">
                {FILTER_LABEL[filter]}
              </span>
            )}
          </>
        )}
      </button>

      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6"
          onClick={() => setFullscreen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}

const FILTERS: { id: ImageFilter; label: string; icon: string }[] = [
  { id: 'blur', label: 'Blur', icon: '🌫' },
  { id: 'pixelate', label: 'Pixelate', icon: '▦' },
  { id: 'noir', label: 'Noir', icon: '◑' },
];

interface ImagePickerButtonProps {
  onImageReady: (pending: PendingImage) => void;
}

export function ImagePickerButton({ onImageReady }: ImagePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: File; previewUrl: string } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [filter, setFilter] = useState<ImageFilter>('blur');

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setPending({ file, previewUrl: URL.createObjectURL(file) });
    setHidden(false);
    setFilter('blur');
  };

  const handleSend = () => {
    if (!pending) return;
    onImageReady({
      file: pending.file,
      previewUrl: pending.previewUrl,
      hidden,
      filter: hidden ? filter : null,
    });
    setPending(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-[#9E9E9E] transition-colors hover:text-[#F5F5F5]"
        aria-label="Attach image"
      >
        📎
      </button>

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border-t border-[#2A2A2A] bg-[#181818] p-6 sm:rounded-3xl sm:border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-[#F5F5F5]">Send image</h3>

            <div className="relative mb-5 h-40 w-full overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pending.previewUrl} alt="" className="h-full w-full object-cover" />
              {hidden && filter && (
                <div className={`absolute inset-0 ${FILTER_OVERLAY_CLASS[filter]}`} />
              )}
              {hidden && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/55 py-1.5 text-xs font-medium text-white">
                  🔒 Hidden
                </div>
              )}
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#9E9E9E]">
              Visibility
            </p>
            <div className="mb-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setHidden(false)}
                className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  !hidden
                    ? 'border-[#7C5CBF] bg-[#7C5CBF] text-white'
                    : 'border-[#2A2A2A] bg-[#1A1A1A] text-[#9E9E9E]'
                }`}
              >
                👁 Visible
              </button>
              <button
                type="button"
                onClick={() => setHidden(true)}
                className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  hidden
                    ? 'border-[#FF6B8A] bg-[#FF6B8A] text-white'
                    : 'border-[#2A2A2A] bg-[#1A1A1A] text-[#9E9E9E]'
                }`}
              >
                🔒 Hidden
              </button>
            </div>

            {hidden && (
              <>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#9E9E9E]">
                  Filter effect
                </p>
                <div className="mb-5 flex gap-2.5">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={`flex-1 rounded-xl border py-3 text-center transition-colors ${
                        filter === f.id
                          ? 'border-[#9B7FD4] bg-[#5A3F9A] text-white'
                          : 'border-[#2A2A2A] bg-[#1A1A1A] text-[#9E9E9E]'
                      }`}
                    >
                      <div className="text-lg">{f.icon}</div>
                      <div className="mt-1 text-xs font-semibold">{f.label}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={handleSend}
              className="w-full rounded-xl bg-[#7C5CBF] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#5A3F9A]"
            >
              {hidden ? '🔒 Send hidden' : '📤 Send image'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
