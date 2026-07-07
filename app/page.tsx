import Link from 'next/link';
import {
  Music,
  Video,
  Zap,
  AudioWaveform,
  Timer,
  Layers,
  Mic,
  Download,
  ArrowRight,
  Github,
} from 'lucide-react';
import { TimelineHero } from '@/components/landing/TimelineHero';

const features = [
  {
    icon: Music,
    title: 'BPM Detection & Sync',
    description:
      'Auto-detect tempo from any audio file. Snap clips to the beat grid and keep everything locked to the groove.',
  },
  {
    icon: Zap,
    title: 'Time-Stretch & Pitch-Shift',
    description:
      'Change tempo without affecting pitch — or shift pitch without changing speed. Powered by FFmpeg WASM and Rubber Band.',
  },
  {
    icon: Video,
    title: 'Multi-Cam Sync',
    description:
      'Align multiple camera angles automatically using audio cross-correlation. No timecode required.',
  },
  {
    icon: Layers,
    title: 'Multi-Track Timeline',
    description:
      'Video, audio, and text tracks on a single canvas. Trim, split, fade, and layer with frame-accurate precision.',
  },
  {
    icon: AudioWaveform,
    title: 'Waveform Visualization',
    description:
      'See transients and peaks directly on the timeline. Make frame-accurate cuts without guessing.',
  },
  {
    icon: Timer,
    title: 'Metronome Overlay',
    description:
      'Visual beat indicator synced to project BPM. Bake it into the export or use it as a guide while editing.',
  },
  {
    icon: Mic,
    title: 'In-Browser Recording',
    description:
      'Capture audio directly into a new track without leaving the editor. No plugins, no installs.',
  },
  {
    icon: Download,
    title: 'Smart Export',
    description:
      'One-click presets for YouTube, Instagram, and TikTok. Export video or audio-only in MP4, MP3, or WAV.',
  },
];

const techStack = [
  'Next.js 14',
  'React 18',
  'TypeScript',
  'FFmpeg WASM',
  'Web Audio API',
  'Tone.js',
  'Konva',
  'Zustand',
  'Tailwind CSS',
  'Dexie / IndexedDB',
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-signal-400">
              <Music className="h-4 w-4 text-zinc-950" />
            </div>
            <span className="font-display text-base font-bold tracking-tight">MusicVid Pro</span>
          </div>
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 rounded-md bg-signal-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-signal-300"
          >
            Open Editor
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-24">
        {/* Faint signal wash, top-left biased — not a centered halo */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-[10%] h-[420px] w-[680px] rounded-full bg-signal-500/[0.07] blur-[110px]" />
        </div>

        <div className="relative mx-auto max-w-4xl">
          <div className="mb-8 inline-flex items-center gap-2.5 border border-signal-400/25 bg-signal-400/[0.06] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-signal-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal-400" />
            100% client-side — nothing leaves your device
          </div>

          <h1 className="mb-7 font-display text-5xl font-extrabold leading-[1.04] tracking-tight md:text-7xl">
            Cut video like
            <br />
            you play music<span className="text-signal-400">.</span>
          </h1>

          <p className="mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400">
            MusicVid Pro locks your edit to the beat grid: detect BPM, snap cuts to the groove,
            time-stretch without pitch drift, and export straight to social — an entire video
            editor running in the browser.
          </p>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              href="/editor"
              className="inline-flex items-center gap-2 rounded-md bg-signal-400 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-signal-300"
            >
              <Zap className="h-5 w-5" />
              Launch Editor — it&apos;s free
            </Link>
            <a
              href="https://github.com/SimeonVarg/MusicVid-Pro"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-8 py-3.5 text-base font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              <Github className="h-5 w-5" />
              View Source
            </a>
          </div>

          <div className="mt-16">
            <TimelineHero />
          </div>
        </div>
      </section>

      {/* Features — ruled spec-sheet grid, not cards */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between border-b border-zinc-800 pb-5">
            <h2 className="font-display text-3xl font-bold">
              Everything you need<span className="text-signal-400">.</span>
            </h2>
            <p className="hidden font-mono text-xs uppercase tracking-[0.18em] text-zinc-500 sm:block">
              No uploads · No subscriptions
            </p>
          </div>

          <div className="grid border-l border-t border-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group border-b border-r border-zinc-800 p-6 transition-colors hover:bg-zinc-900/60"
              >
                <div className="mb-5 flex items-center justify-between">
                  <feature.icon className="h-5 w-5 text-signal-400" />
                  <span className="font-mono text-[11px] text-zinc-600 transition-colors group-hover:text-signal-400/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy callout */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl border border-zinc-800 p-10 sm:p-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-signal-400/30 bg-signal-400/[0.06]">
              <Layers className="h-6 w-6 text-signal-400" />
            </div>
            <div>
              <h2 className="mb-3 font-display text-2xl font-bold">
                Your files never leave your device
              </h2>
              <p className="max-w-2xl text-zinc-400">
                All processing — FFmpeg encoding, BPM detection, waveform generation — happens in
                your browser using WebAssembly and the Web Audio API. Projects are saved to
                IndexedDB locally. Zero server uploads.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">
            Built with
          </p>
          <div className="flex flex-wrap gap-2.5">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="border border-zinc-800 px-3.5 py-1.5 font-mono text-xs text-zinc-400"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-signal-400">
              <Music className="h-3 w-3 text-zinc-950" />
            </div>
            <span className="font-medium text-zinc-400">MusicVid Pro</span>
          </div>
          <p>
            Designed &amp; built by{' '}
            <span className="font-semibold text-zinc-300">Simeon Varghese</span>
          </p>
          <p>Open source · MIT License</p>
        </div>
      </footer>
    </div>
  );
}
