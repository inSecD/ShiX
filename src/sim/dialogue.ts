import type { SimState } from './types';
import type { EncounterChoice, EncounterDef } from './encounter';

/**
 * VN dialog (Phase 14 — V3.5): sistem dialog visual novel.
 * - `lines`: deretan narasi NPC (per-sentence dari scene / greeting + rumor).
 * - `choices`: opsi jawab (kalo ada; biasanya dari encounter).
 * - advance → next line / close; choose → terapkan efek pilihan.
 */

export type VNTone = 'plain' | 'joy' | 'sad' | 'think';

export interface VNLine {
  npcId: string;
  text: string;
  tone: VNTone;
}

export interface DialogueState {
  open: boolean;
  npcId: string;
  lines: VNLine[];
  idx: number;
  choices: EncounterChoice[];
  src: 'chat' | 'encounter';
  encounterId?: string;
  /** speaker sintetis (staff venue) — kalo kosong, nama diambil dari bot */
  speakerName?: string;
  speakerEmoji?: string;
}

export function createDialogue(): DialogueState {
  return { open: false, npcId: '', lines: [], idx: 0, choices: [], src: 'chat' };
}

export function normalizeDialogue(x: unknown): DialogueState {
  const d = x as Partial<DialogueState> | null | undefined;
  if (!d || typeof d !== 'object') return createDialogue();
  const lines = Array.isArray(d.lines)
    ? d.lines.filter((l) => !!l && typeof l.text === 'string' && typeof l.npcId === 'string')
    : [];
  const idx = Math.max(0, Math.floor(Number(d.idx) || 0));
  const choices = Array.isArray(d.choices) ? d.choices.filter((c) => !!c && typeof c.label === 'string') : [];
  const src = d.src === 'encounter' ? 'encounter' : 'chat';
  const encounterId = typeof d.encounterId === 'string' ? d.encounterId : undefined;
  const speakerName = typeof d.speakerName === 'string' ? d.speakerName : undefined;
  const speakerEmoji = typeof d.speakerEmoji === 'string' ? d.speakerEmoji : undefined;
  const lastIdx = lines.length > 0 ? Math.min(idx, lines.length - 1) : 0;
  return {
    open: !!d.open,
    npcId: typeof d.npcId === 'string' ? d.npcId : '',
    lines,
    idx: lastIdx,
    choices,
    src,
    encounterId,
    speakerName,
    speakerEmoji
  };
}

/** buka dialog dengan deretan baris; kalo choices ada, dialog tampilkan pilihan (mis. encounter) */
export function startDialogue(
  state: SimState,
  npcId: string,
  lines: VNLine[],
  opts?: {
    choices?: EncounterChoice[];
    src?: 'chat' | 'encounter';
    encounterId?: string;
    speaker?: { name: string; emoji: string };
  }
): DialogueState {
  const clean = (lines ?? []).filter((l) => l && typeof l.text === 'string');
  const picked = clean.slice(0, 5);
  const withChoices = (opts?.choices?.length ?? 0) > 0;
  const d: DialogueState = {
    open: true,
    npcId,
    lines: picked,
    idx: withChoices ? Math.max(0, picked.length - 1) : 0,
    choices: opts?.choices ?? [],
    src: opts?.src ?? 'chat',
    encounterId: opts?.encounterId,
    speakerName: opts?.speaker?.name,
    speakerEmoji: opts?.speaker?.emoji
  };
  state.dialogue = d;
  return d;
}

export function closeDialogue(state: SimState): void {
  state.dialogue.open = false;
  state.dialogue.idx = 0;
}

/** mundur/advance: next line; pas akhir → tutup dialog. Kalo ada pilihan, tunggu pilihan. */
export function advanceDialogue(state: SimState): boolean {
  const d = state.dialogue;
  if (!d.open) return false;
  if (d.choices.length > 0) return false;
  if (d.lines.length === 0) {
    d.open = false;
    d.idx = 0;
    return false;
  }
  if (d.idx < d.lines.length - 1) {
    d.idx += 1;
    return true;
  }
  d.open = false;
  d.idx = 0;
  return false;
}

/** baris aktif buat ditampilkan di dialog */
export function currentLine(state: SimState): VNLine | null {
  const d = state.dialogue;
  if (!d.open || d.lines.length === 0) return null;
  const i = Math.min(Math.max(0, d.idx), d.lines.length - 1);
  return d.lines[i];
}

export function availableChoices(state: SimState): EncounterChoice[] {
  const d = state.dialogue;
  if (!d.open) return [];
  return d.choices ?? [];
}

/** pilihan ke-`idx` dari dialog yang open (kalau ada) */
export function pickChoice(state: SimState, idx: number): EncounterChoice | null {
  const d = state.dialogue;
  if (!d.open) return null;
  const ch = d.choices[idx];
  return ch ?? null;
}

/** deretan VN baris dari scene encounter — split per kalimat, 4 baris terakhir jadi tone joy */
export function linesForEncounter(def: EncounterDef, botId: string): VNLine[] {
  const sentences = def.scene.split('. ').map((s) => s.trim()).filter((s) => s.length > 1);
  const picked = sentences.slice(-4);
  return picked.map((s, i) => ({
    npcId: botId,
    text: s.replace(/^["']|["']$/g, '').trim(),
    tone: i === picked.length - 1 ? ('joy' as const) : ('plain' as const)
  }));
}
