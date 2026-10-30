import type { SimState } from './types';

/**
 * Cerita & Chaos (Phase 11).
 * - `chaos`: tingkat badai (0..1) dari kondisi makro + kesulitan — mempengaruhi event.
 * - `story`: arc cerita yang maju seiring badai; event besar = beat cerita.
 */

export interface StoryState {
  /** nama arc aktif */
  arc: string;
  /** progres cerita (0..~1000) — naik tiap beat signifikan */
  progress: number;
  /** beat terakhir yang dihitung (untuk nggak double-count) */
  lastBeatT: number;
}

export function createStory(): StoryState {
  return { arc: 'Awal', progress: 0, lastBeatT: 0 };
}

export function normalizeStory(x: unknown): StoryState {
  const s = x as Partial<StoryState> | null | undefined;
  const arc = typeof s?.arc === 'string' ? s.arc : 'Awal';
  return {
    arc,
    progress: Math.max(0, Math.round(Number(s?.progress) || 0)),
    lastBeatT: Number(s?.lastBeatT) || 0
  };
}

export function chaosOf(state: SimState, difficulty: string = 'normal'): number {
  const r = state.macro?.risk;
  const risk = Number.isFinite(Number(r)) ? Number(r) : 0.05;
  const factor = difficulty === 'easy' ? 0.7 : difficulty === 'brutal' ? 1.6 : 1;
  const c = (risk / 0.2) * factor;
  return Math.max(0, Math.min(1, c));
}

/** naikkan story progress lewat beat cerita — event besar |impact| > 0.3 */
export function applyStoryBeat(state: SimState, impact: number, t: number): StoryState {
  const st = state.story;
  const newProgress = st.progress + Math.max(0, Math.abs(impact));
  let arc = st.arc;
  if (Math.abs(impact) > 0.3) {
    arc = newProgress > 900 ? 'Pemulihan' : newProgress > 500 ? 'Bear Market' : newProgress > 150 ? 'Bull Market' : 'Krisis';
  }
  const next: StoryState = { arc, progress: newProgress, lastBeatT: t };
  state.story = next;
  return next;
}
