export function multiplierFor(rate: number): number {
  if (rate <= 0.05) return 8;
  if (rate >= 0.4) return 2.5;
  return 8 - ((rate - 0.05) / 0.35) * 5.5;
}
