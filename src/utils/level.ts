export const LEVEL_THRESHOLDS = [
  { level: 1, minPoints: 0 },
  { level: 2, minPoints: 200 },
  { level: 3, minPoints: 1500 },
  { level: 4, minPoints: 4500 },
  { level: 5, minPoints: 10800 },
  { level: 6, minPoints: 28800 },
] as const;

export function getLevelInfo(points: number) {
  let current: (typeof LEVEL_THRESHOLDS)[number] = LEVEL_THRESHOLDS[0];
  let next: (typeof LEVEL_THRESHOLDS)[number] | null = LEVEL_THRESHOLDS[1];

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (points >= LEVEL_THRESHOLDS[i].minPoints) {
      current = LEVEL_THRESHOLDS[i];
      next = LEVEL_THRESHOLDS[i + 1] ?? null;
    }
  }

  if (!next) {
    return {
      level: current.level,
      progressPercent: 100,
      progressLabel: `已达最高等级（累计 ${points.toLocaleString()} 源点）`,
    };
  }

  const span = next.minPoints - current.minPoints;
  const gained = points - current.minPoints;
  const progressPercent = Math.min(100, Math.max(0, (gained / span) * 100));

  return {
    level: current.level,
    progressPercent,
    progressLabel: `${points.toLocaleString()} / ${next.minPoints.toLocaleString()} 源点升级 Lv.${next.level}`,
  };
}
