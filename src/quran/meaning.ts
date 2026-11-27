// The Meaning sheet's commentary: English tafsir from quran.com, by the passage it explains. Each
// explanation covers one ayah or a run of them (Ibn Kathir often explains several together), and is
// kept on the device once read.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSurah } from '../data/surahs';

export interface MeaningSource {
  id: number;
  name: string;
}

export const MEANING_SOURCES: MeaningSource[] = [
  { id: 169, name: 'Ibn Kathir (abridged)' },
  { id: 168, name: "Ma'arif al-Qur'an" },
  { id: 817, name: 'Tazkirul Quran' },
];

export const DEFAULT_MEANING_SOURCE = 169;

export interface AyahRef {
  surah: number;
  ayah: number;
}

/** A run of text, Arabic or not (Arabic is set in a Quranic face). */
export interface Run {
  text: string;
  arabic: boolean;
}

export interface Block {
  kind: 'heading' | 'paragraph';
  runs: Run[];
}

export interface Meaning {
  source: number;
  /** The ayahs this explanation covers, in order (within one surah). */
  ayahs: AyahRef[];
  blocks: Block[];
}

const KEY = 'athannow.meaning.v1.';
const memory = new Map<string, Meaning>();

async function fetchWithTimeout(url: string, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: ', ', ndash: '-', hellip: '...' };

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

// Arabic letters and the marks that ride on them, with the spaces and brackets between words.
const ARABIC_RUN = /([؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿][؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿\s«»]*[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿»])/g;

function runs(text: string): Run[] {
  const out: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(ARABIC_RUN)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), arabic: false });
    out.push({ text: m[0], arabic: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), arabic: false });
  return out.filter((r) => r.text.length > 0);
}

/** The commentary's HTML (headings and paragraphs) as blocks of text. */
export function parseCommentary(html: string): Block[] {
  const blocks: Block[] = [];
  const re = /<(h\d|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let found = false;
  for (const m of html.matchAll(re)) {
    found = true;
    const text = decode(m[2].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').trim();
    if (text) blocks.push({ kind: m[1].toLowerCase().startsWith('h') ? 'heading' : 'paragraph', runs: runs(text) });
  }
  if (!found) {
    for (const part of decode(html.replace(/<[^>]+>/g, '\n')).split(/\n{2,}/)) {
      const text = part.replace(/\s+/g, ' ').trim();
      if (text) blocks.push({ kind: 'paragraph', runs: runs(text) });
    }
  }
  return blocks;
}

/** Plain text of the commentary, for sharing. */
export function commentaryText(blocks: Block[]): string {
  return blocks.map((b) => b.runs.map((r) => r.text).join('')).join('\n\n');
}

const keyOf = (r: AyahRef) => `${r.surah}:${r.ayah}`;

/** The explanation covering an ayah, from the device if it's been read before. */
export async function loadMeaning(source: number, ref: AyahRef): Promise<Meaning> {
  const id = `${source}:${keyOf(ref)}`;
  const hit = memory.get(id);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(KEY + id);
    if (raw) {
      const saved = JSON.parse(raw) as Meaning;
      memory.set(id, saved);
      return saved;
    }
  } catch {
    // fetch it instead
  }
  const res = await fetchWithTimeout(`https://api.quran.com/api/v4/tafsirs/${source}/by_ayah/${keyOf(ref)}`);
  if (!res.ok) throw new Error(`meaning ${res.status}`);
  const t = ((await res.json()) as { tafsir?: { text?: string; verses?: Record<string, unknown> } }).tafsir;
  const covered = Object.keys(t?.verses ?? {})
    .map((k) => k.split(':').map(Number))
    .filter(([s, a]) => s === ref.surah && a >= 1)
    .map(([s, a]) => ({ surah: s, ayah: a }))
    .sort((a, b) => a.ayah - b.ayah);
  const meaning: Meaning = { source, ayahs: covered.length ? covered : [ref], blocks: parseCommentary(t?.text ?? '') };
  // Saved under every ayah it covers, so holding any of them opens it without asking again.
  for (const a of meaning.ayahs) {
    const k = `${source}:${keyOf(a)}`;
    memory.set(k, meaning);
    AsyncStorage.setItem(KEY + k, JSON.stringify(meaning)).catch(() => {});
  }
  return meaning;
}

/** The ayah after a passage, into the next surah at the end of one. */
export function ayahAfter(last: AyahRef): AyahRef | null {
  const total = getSurah(last.surah)?.totalVerses ?? 0;
  if (last.ayah < total) return { surah: last.surah, ayah: last.ayah + 1 };
  return last.surah < 114 ? { surah: last.surah + 1, ayah: 1 } : null;
}

/** The ayah before a passage, into the end of the previous surah at the start of one. */
export function ayahBefore(first: AyahRef): AyahRef | null {
  if (first.ayah > 1) return { surah: first.surah, ayah: first.ayah - 1 };
  const prev = getSurah(first.surah - 1);
  return prev ? { surah: prev.id, ayah: prev.totalVerses } : null;
}
