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
  title: "MusicVid Pro — Browser-Based Music Video Editor",
  description: "Sync video clips to audio with musical precision. BPM detection, time-stretching, multi-cam sync, and social media export — all in your browser.",
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
