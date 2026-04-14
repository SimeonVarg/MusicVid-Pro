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

const features = [
  {
    icon: Music,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    title: 'BPM Detection & Sync',
    description:
      'Auto-detect tempo from any audio file. Snap clips to the beat grid and keep everything locked to the groove.',
  },
  {
    icon: Zap,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    title: 'Time-Stretch & Pitch-Shift',
    description:
      'Change tempo without affecting pitch — or shift pitch without changing speed. Powered by FFmpeg WASM and Rubber Band.',
  },
  {
    icon: Video,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    title: 'Multi-Cam Sync',
    description:
      'Align multiple camera angles automatically using audio cross-correlation. No timecode required.',
  },
  {
    icon: Layers,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    title: 'Multi-Track Timeline',
    description:
      'Video, audio, and text tracks on a single canvas. Trim, split, fade, and layer with frame-accurate precision.',
  },
  {
    icon: AudioWaveform,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    title: 'Waveform Visualization',
    description:
      'See transients and peaks directly on the timeline. Make frame-accurate cuts without guessing.',
  },
  {
    icon: Timer,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
    title: 'Metronome Overlay',
    description:
      'Visual beat indicator synced to project BPM. Bake it into the export or use it as a guide while editing.',
  },
  {
    icon: Mic,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
    title: 'In-Browser Recording',
    description:
      'Capture audio directly into a new track without leaving the editor. No plugins, no installs.',
  },
  {
    icon: Download,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/20',
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
              <Music className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">MusicVid Pro</span>
          </div>
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
          >
            Open Editor
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20">
        {/* Subtle radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-start justify-center"
        >
          <div className="h-[600px] w-[900px] rounded-full bg-purple-600/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm text-purple-300">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            Runs entirely in your browser — nothing leaves your device
          </div>

          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Music video editing{' '}
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              built for musicians
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400">
            Sync video clips to audio with musical precision. Detect BPM, time-stretch tracks,
            align multi-cam footage, and export directly to social media — all without leaving
            your browser.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/editor"
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-purple-900/40 transition-all hover:bg-purple-500 hover:shadow-purple-800/50"
            >
              <Zap className="h-5 w-5" />
              Launch Editor — it&apos;s free
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-8 py-3.5 text-base font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              <Github className="h-5 w-5" />
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold">Everything you need to edit music videos</h2>
            <p className="text-zinc-400">
              Professional tools that run entirely client-side — no uploads, no subscriptions.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`rounded-xl border p-5 transition-colors hover:border-zinc-600 ${feature.bg}`}
              >
                <div className={`mb-3 ${feature.color}`}>
                  <feature.icon className="h-6 w-6" />
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
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-10 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
            <Layers className="h-6 w-6 text-green-400" />
          </div>
          <h2 className="mb-3 text-2xl font-bold">Your files never leave your device</h2>
          <p className="mx-auto max-w-xl text-zinc-400">
            All processing — FFmpeg encoding, BPM detection, waveform generation — happens in
            your browser using WebAssembly and the Web Audio API. Projects are saved to
            IndexedDB locally. Zero server uploads.
          </p>
        </div>
      </section>

      {/* Tech stack */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-6 text-sm uppercase tracking-widest text-zinc-500">Built with</p>
          <div className="flex flex-wrap justify-center gap-3">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-zinc-700 bg-zinc-800/60 px-4 py-1.5 text-sm text-zinc-300"
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
            <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-600/80">
              <Music className="h-3 w-3 text-white" />
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
