// components/editor/MetronomeOverlay.tsx PASTED
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MetronomeOverlayProps {
  currentTime: number;
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  isPlaying: boolean;
}

export function MetronomeOverlay({ 
  currentTime, 
  bpm, 
  timeSignature, 
  isPlaying 
}: MetronomeOverlayProps) {
  const [currentBeat, setCurrentBeat] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;

    const beatsPerSecond = bpm / 60;
    const beatDuration = 1 / beatsPerSecond;
    
    const beat = Math.floor(currentTime * beatsPerSecond) % timeSignature.numerator;
    setCurrentBeat(beat);

    // Trigger flash on beat
    const timeIntoBeat = (currentTime * beatsPerSecond) % 1;
    if (timeIntoBeat < 0.1) {
      setFlash(true);
      setTimeout(() => setFlash(false), 100);
    }
  }, [currentTime, bpm, timeSignature, isPlaying]);

  return (
    <div data-tutorial="metronome-overlay" className="absolute top-4 right-4 flex flex-col items-end gap-2">
      {/* Beat Indicator */}
      <div className="flex gap-1">
        {Array.from({ length: timeSignature.numerator }).map((_, i) => (
          <motion.div
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-100 ${
              i === currentBeat
                ? i === 0
                  ? 'bg-red-500 scale-125'
                  : 'bg-signal-400 scale-125'
                : 'bg-zinc-700'
            }`}
            animate={{
              scale: i === currentBeat ? 1.25 : 1,
              opacity: i === currentBeat ? 1 : 0.5,
            }}
          />
        ))}
      </div>

      {/* Flash Effect */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.8, scale: 0.8 }}
            animate={{ opacity: 0, scale: 2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`absolute top-0 right-0 w-16 h-16 rounded-full ${
              currentBeat === 0 ? 'bg-red-500' : 'bg-signal-400'
            } blur-xl`}
          />
        )}
      </AnimatePresence>
    </div>
  );
}