type T = (key: string, vars?: Record<string, string | number>) => string;

/** "about how long" in the largest sensible unit; needs the dur_* strings from the live module. */
export function formatDuration(seconds: number, t: T, lang: string): string {
  const n = (v: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v);
  if (seconds < 90) return t("dur_s", { n: n(seconds) });
  if (seconds < 90 * 60) return t("dur_min", { n: n(seconds / 60) });
  if (seconds < 48 * 3600) return t("dur_h", { n: n(seconds / 3600) });
  if (seconds < 730 * 86_400) return t("dur_d", { n: n(seconds / 86_400) });
  return t("dur_y", { n: n(seconds / (365.25 * 86_400)) });
}
