import type { Metadata } from "next";
import { Archivo, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";

const sans = Archivo({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://music-vid-pro.vercel.app"),
  title: "MusicVid Pro — Browser-Based Music Video Editor",
  description: "Cut video like you play music. BPM detection, beat-grid snapping, time-stretch without pitch drift, color grading, and social export — an entire video editor in your browser, 100% client-side.",
  keywords: ["video editor", "music video", "BPM detection", "FFmpeg WASM", "browser video editor", "beat sync"],
  authors: [{ name: "Simeon Varghese" }],
  openGraph: {
    title: "MusicVid Pro — Cut video like you play music",
    description: "An entire music-video editor running in your browser. BPM sync, beat-grid cuts, color grading, titles, and social export — nothing leaves your device.",
    url: "https://music-vid-pro.vercel.app",
    siteName: "MusicVid Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MusicVid Pro — Cut video like you play music",
    description: "An entire music-video editor in your browser. BPM sync, beat-grid cuts, color grading, titles, social export.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
