'use client';

interface LevelMeterProps {
  level: number; // 0–1
  active: boolean;
}

export function LevelMeter({ level, active }: LevelMeterProps) {
  const clampedLevel = Math.min(1, Math.max(0, level));

  const fillColor =
    clampedLevel >= 0.8
      ? 'bg-red-500'
      : clampedLevel >= 0.4
        ? 'bg-yellow-400'
        : 'bg-green-500';

  return (
    <div className="w-full h-1.5 rounded bg-zinc-700 overflow-hidden">
      <div
        className={`h-full rounded transition-all ${fillColor}`}
        style={{ width: `${active ? clampedLevel * 100 : 0}%` }}
      />
    </div>
  );
}
