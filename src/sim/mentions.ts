import type { AssetClass, SimState } from './types';

export type MentionMatch =
  | { kind: 'exact'; instId: string; via: 'ticker' | 'name' | 'tag' }
  | { kind: 'fuzzy'; instId: string; via: 'ticker-prefix' | 'name-prefix' | 'abbrev' }
  | { kind: 'class'; cls: AssetClass; instId: string; via: 'class' };

export interface Mention {
  /** instrumen yang dimaksud (selalu ada kalau match) */
  instId: string;
  via: MentionMatch['via'];
  /** kata asli dari post yang bikin match */
  word: string;
}

/** kata kelas aset — dipakai kalo teks nyebut kelas (mis. "memecoin") tanpa nama spesifik */
const CLASS_WORDS: [string[], AssetClass][] = [
  [['memecoin', 'meme', 'shitcoin'], 'meme'],
  [['kripto', 'crypto', 'bitcoin'], 'crypto'],
  [['saham', 'stock'], 'stock'],
  [['forex', 'valas', 'fx'], 'forex'],
  [['emas', 'gold', 'komoditas'], 'commodity'],
  [['index', 'indeks'], 'index']
];

function tokensOf(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 2);
}

/** instrumen yang lagi dipegang pemain (posisi margin atau spot) — jadi konteks resolve */
function heldSet(state: SimState): Set<string> {
  const s = new Set<string>();
  for (const p of Object.values(state.positions)) if (p.qty > 0) s.add(p.instId);
  for (const h of Object.values(state.spotHoldings)) if (h.qty > 0) s.add(h.instId);
  return s;
}

/**
 * Pahami maksud post pemain:
 * - "$WKND" / "wknd" / "weekend" → instrumen Weekend (ticker/name match, prefix & abbrev)
 * - "memecoin" → kelas meme → prefer instrumen yang lagi dipegang pemain
 * - posisi lo selalu jadi tie-breaker (sistem "tau" lo lagi nyangkut di apa)
 */
export function parseMention(state: SimState, text: string): Mention | null {
  const tokens = tokensOf(text);
  if (!tokens.length) return null;
  const held = heldSet(state);

  const exact: Mention[] = [];
  const fuzzy: Mention[] = [];

  for (const word of tokens) {
    for (const id of state.order) {
      const inst = state.instruments[id];
      if (!inst) continue;
      const ticker = inst.id.toLowerCase();

      if (word === ticker) exact.push({ instId: id, via: 'ticker', word });
      else if (word === inst.name.toLowerCase()) exact.push({ instId: id, via: 'name', word });
      else if (word === inst.tag.toLowerCase()) continue; // tag terlalu umum, buat exact
      else if (word.length >= 3 && ticker.startsWith(word)) {
        fuzzy.push({ instId: id, via: 'ticker-prefix', word });
      } else if (word.length >= 4 && inst.name.toLowerCase().startsWith(word)) {
        fuzzy.push({ instId: id, via: 'name-prefix', word });
      }
    }
  }

  const pickHeld = (list: Mention[]): Mention | null => {
    const inHand = list.find((m) => held.has(m.instId));
    return inHand ?? list[0] ?? null;
  };

  const e = pickHeld(exact);
  if (e) return e;

  const f = pickHeld(fuzzy);
  if (f) return f;

  // fallback: kata kelas ("memecoin lagi rame") → instrumen kelas itu,
  // prioritas yang dipegang pemain, lalu yang hype-nya paling tinggi
  for (const [words, cls] of CLASS_WORDS) {
    if (!tokens.some((t) => words.includes(t))) continue;
    let best: { id: string; hype: number } | null = null;
    for (const id of state.order) {
      const inst = state.instruments[id];
      if (!inst || inst.cls !== cls) continue;
      if (held.has(id)) return { instId: id, via: 'class', word: tokens.find((t) => words.includes(t)) ?? words[0] };
      if (!best || inst.hype > best.hype) best = { id, hype: inst.hype };
    }
    if (best) return { instId: best.id, via: 'class', word: words[0] };
  }

  return null;
}

/** apakah teks nyebut porto pemain (buat reaksi "lo nyangkut di X" dari AI) */
export function mentionsHeldCoin(state: SimState, text: string): string | null {
  const m = parseMention(state, text);
  if (!m) return null;
  return heldSet(state).has(m.instId) ? m.instId : null;
}
