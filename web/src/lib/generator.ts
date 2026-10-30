import { wordlist } from '@scure/bip39/wordlists/english';

export interface GenOptions {
  mode: 'random' | 'passphrase';
  length: number;            // random
  upper: boolean; lower: boolean; digits: boolean; symbols: boolean;
  avoidAmbiguous: boolean;
  words: number;             // passphrase
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
}

export const DEFAULT_GEN: GenOptions = {
  mode: 'random', length: 20, upper: true, lower: true, digits: true, symbols: true, avoidAmbiguous: true,
  words: 5, separator: '-', capitalize: true, includeNumber: true,
};

/** Unbiased random integer in [0, max) using rejection sampling. */
export function randInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= limit);
  return a[0] % max;
}

const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
};
const AMBIGUOUS = /[Il1O0o|`'"]/g;

export function generate(o: GenOptions): string {
  if (o.mode === 'passphrase') {
    const words = Array.from({ length: Math.max(3, Math.min(12, o.words)) }, () => {
      const w = wordlist[randInt(wordlist.length)];
      return o.capitalize ? w[0].toUpperCase() + w.slice(1) : w;
    });
    if (o.includeNumber) { const i = randInt(words.length); words[i] += String(randInt(10)); }
    return words.join(o.separator);
  }
  const pools = (['upper', 'lower', 'digits', 'symbols'] as const).filter(k => o[k]).map(k => (o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
  if (!pools.length) pools.push(SETS.lower);
  const all = pools.join('');
  const len = Math.max(8, Math.min(128, o.length));
  // Guarantee at least one character from every chosen set, then shuffle (Fisher–Yates).
  const out = pools.map(p => p[randInt(p.length)]);
  while (out.length < len) out.push(all[randInt(all.length)]);
  for (let i = out.length - 1; i > 0; i--) { const j = randInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}

/** Entropy in bits of what the generator can produce with these options. */
export function entropyBits(o: GenOptions): number {
  if (o.mode === 'passphrase') return Math.round(o.words * Math.log2(wordlist.length) + (o.includeNumber ? Math.log2(10 * o.words) : 0));
  let pool = 0;
  for (const k of ['upper', 'lower', 'digits', 'symbols'] as const) if (o[k]) pool += o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '').length : SETS[k].length;
  return Math.round(o.length * Math.log2(pool || 26));
}
