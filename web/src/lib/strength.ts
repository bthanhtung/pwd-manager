import { zxcvbnAsync, zxcvbnOptions } from '@zxcvbn-ts/core';

let ready: Promise<void> | null = null;
/** Loads the dictionaries lazily so the main bundle stays small. */
function init() {
  ready ??= (async () => {
    const [common, en] = await Promise.all([import('@zxcvbn-ts/language-common'), import('@zxcvbn-ts/language-en')]);
    zxcvbnOptions.setOptions({
      dictionary: { ...common.dictionary, ...en.dictionary },
      graphs: common.adjacencyGraphs,
      translations: en.translations,
    });
  })();
  return ready;
}

export interface Strength { score: 0 | 1 | 2 | 3 | 4; crackTime: string; warning: string; suggestions: string[] }

export async function strength(password: string, userInputs: string[] = []): Promise<Strength> {
  await init();
  const r = await zxcvbnAsync(password, userInputs);
  return {
    score: r.score as Strength['score'],
    crackTime: String(r.crackTimesDisplay.offlineSlowHashing1e4PerSecond),
    warning: r.feedback.warning || '',
    suggestions: r.feedback.suggestions,
  };
}

/**
 * Have I Been Pwned range query (k-anonymity): only the first 5 hex chars of the SHA-1 leave the device.
 * Returns how many times the password appears in known breaches.
 */
export async function pwnedCount(password: string): Promise<number> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password)));
  const hex = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' } });
  if (!res.ok) throw new Error('Breach check unavailable');
  const line = (await res.text()).split('\n').find(l => l.startsWith(hex.slice(5)));
  return line ? Number(line.split(':')[1]) : 0;
}
