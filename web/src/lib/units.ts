// Bulk unit labels for SCR-24 "Many": pattern "Room {n}", start, step, pad digits.
export function unitLabels(pattern: string, count: number, start: number, step = 1, pad = 0) {
  const p = pattern.includes("{n}") ? pattern : `${pattern} {n}`;
  return Array.from({ length: Math.max(0, Math.min(count, 500)) }, (_, i) =>
    p.replace("{n}", String(start + i * step).padStart(pad, "0")).trim(),
  );
}
