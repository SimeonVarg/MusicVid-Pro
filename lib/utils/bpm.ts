export function clampBpmValue(value: number, min = 20, max = 400) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

export function calculateBpmMultiplier(originalBpm: number, targetBpm: number) {
  if (!Number.isFinite(originalBpm) || !Number.isFinite(targetBpm) || originalBpm <= 0 || targetBpm <= 0) {
    return 1;
  }

  return targetBpm / originalBpm;
}

export function calculateTapTempoBpm(tapTimes: number[]) {
  if (tapTimes.length < 4) {
    return null;
  }

  const recentTaps = tapTimes.slice(-8);

  if (recentTaps.length < 4) {
    return null;
  }

  const intervals: number[] = [];

  for (let index = 1; index < recentTaps.length; index += 1) {
    const interval = recentTaps[index] - recentTaps[index - 1];

    if (!Number.isFinite(interval) || interval <= 0) {
      continue;
    }

    intervals.push(interval);
  }

  if (intervals.length < 3) {
    return null;
  }

  const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

  if (!Number.isFinite(averageInterval) || averageInterval <= 0) {
    return null;
  }

  return 60000 / averageInterval;
}