import Link from 'next/link';
import { Music, Video, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100">
      <div className="container mx-auto px-4 py-16">
        <div className="mb-16 text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Music className="h-12 w-12 text-purple-500" />
            <h1 className="text-5xl font-bold">MusicVid Pro</h1>
          </div>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-zinc-400">
            Professional video editor built for musicians, composers, and content creators.
            Time-stretch, pitch-shift, and sync multiple camera angles with ease.
          </p>
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-purple-700"
          >
            <Zap className="h-5 w-5" />
            Launch Editor
          </Link>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6 transition-colors duration-200">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-600/20">
              <Music className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">BPM Adjustor</h3>
            <p className="text-sm text-zinc-400">
              Change tempo without affecting pitch. Video automatically syncs to match your audio speed.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6 transition-colors duration-200">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-600/20">
              <Video className="h-6 w-6 text-cyan-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Multi-Cam Sync</h3>
            <p className="text-sm text-zinc-400">
              Automatically align multiple camera angles using audio transient detection.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6 transition-colors duration-200">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-600/20">
              <Zap className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Smart Export</h3>
            <p className="text-sm text-zinc-400">
              One-click export presets for YouTube, Instagram, TikTok with optimized settings.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-zinc-500">
            Built with Next.js, React, Tone.js, FFmpeg.wasm, and Web Audio API
          </p>
        </div>
      </div>
    </div>
  );
}
