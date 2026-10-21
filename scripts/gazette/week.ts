/* Weeks run Monday 00:00 UTC to the next Monday. An edition is named after its Monday. */
const DAY = 86_400_000;

export interface Week { id: string; from: Date; to: Date }

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function weekStarting(id: string): Week {
  const from = new Date(`${id}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || from.getUTCDay() !== 1) throw new Error(`${id} is not a Monday (YYYY-MM-DD)`);
  return { id, from, to: new Date(from.getTime() + 7 * DAY) };
}

export function lastFullWeek(now = new Date()): Week {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const thisMonday = today - ((now.getUTCDay() + 6) % 7) * DAY;
  return weekStarting(isoDate(new Date(thisMonday - 7 * DAY)));
}

export const inWeek = (date: Date, w: Week) => date >= w.from && date < w.to;
