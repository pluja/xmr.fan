/* The ring signature game: rounds of "which coin is the real one?" under the decoy rules of different eras. */

export const ERAS = ["2015", "today", "fcmp"] as const;
export type Era = (typeof ERAS)[number];

export const RING_SIZE: Record<Exclude<Era, "fcmp">, number> = { "2015": 3, today: 16 };
export const ROUNDS = 5;

const DAY = 86_400;
/** Coins must wait 10 blocks before they can be spent. */
const MIN_AGE = 20 * 60;

export interface Round {
  /** Age of each coin in seconds, oldest first, the way a ring lists its members. */
  ages: number[];
  real: number;
}

type Random = () => number;

/** Marsaglia and Tsang's gamma sampler (shape >= 1). */
function gamma(shape: number, scale: number, random: Random): number {
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      const u1 = random() || 1e-12, u2 = random();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = random();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}

/** Today's wallets pick decoy ages from the same curve real spending follows: a gamma over log seconds. */
export function spendAge(random: Random): number {
  for (;;) {
    const age = Math.exp(gamma(19.28, 1 / 1.61, random));
    if (age >= MIN_AGE && age < 8 * 365 * DAY) return age;
  }
}

export function makeRound(era: Exclude<Era, "fcmp">, random: Random = Math.random): Round {
  const size = RING_SIZE[era];
  let real: number, decoys: number[];
  if (era === "2015") {
    // Decoys came from anywhere in the chain's first year, while people mostly spent coins they had just received.
    real = MIN_AGE - Math.log(1 - random()) * 20 * DAY;
    decoys = Array.from({ length: size - 1 }, () => MIN_AGE + random() * 365 * DAY);
  } else {
    real = spendAge(random);
    decoys = Array.from({ length: size - 1 }, () => spendAge(random));
  }
  const ages = [real, ...decoys].sort((a, b) => b - a);
  return { ages, real: ages.indexOf(real) };
}

/** Correct picks you'd expect from guessing blindly. */
export const luck = (era: Exclude<Era, "fcmp">, rounds: number) => rounds / RING_SIZE[era];
