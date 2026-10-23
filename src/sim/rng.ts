export class RNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }

  get state(): number {
    return this.s;
  }

  set state(v: number) {
    this.s = v >>> 0 || 1;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min = 0, max = 1): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  shuffle<T>(arr: T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  private gaussSpare: number | null = null;

  gauss(): number {
    if (this.gaussSpare !== null) {
      const v = this.gaussSpare;
      this.gaussSpare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    this.gaussSpare = v * mul;
    return u * mul;
  }

  fatTail(): number {
    // mixture of normals -> occasional fat tails
    const g = this.gauss();
    return g * (this.chance(0.05) ? this.float(1.6, 3.2) : 1);
  }

  fork(salt: number): RNG {
    return new RNG((Math.imul(this.s ^ salt, 0x9e3779b1) ^ (salt << 7)) >>> 0);
  }
}

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

export function formatSeed(seed: number): string {
  return seed.toString(36).toUpperCase().padStart(7, '0');
}

export function parseSeed(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const asBase36 = parseInt(trimmed.toLowerCase(), 36);
  if (!Number.isNaN(asBase36) && /^[0-9a-z]+$/i.test(trimmed)) return asBase36 >>> 0;
  const asNum = Number(trimmed);
  if (!Number.isNaN(asNum)) return asNum >>> 0;
  return null;
}
