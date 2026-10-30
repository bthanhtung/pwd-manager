import { Secret, TOTP, URI } from 'otpauth';

/** Accepts a raw base32 secret or an otpauth:// URI (what most sites show under the QR code). */
export function parseTotp(input: string): TOTP | null {
  const s = input.trim();
  if (!s) return null;
  try {
    if (s.startsWith('otpauth://')) {
      const o = URI.parse(s);
      return o instanceof TOTP ? o : null;
    }
    return new TOTP({ secret: Secret.fromBase32(s.replace(/\s+/g, '').toUpperCase()), digits: 6, period: 30 });
  } catch {
    return null;
  }
}

export function totpNow(input: string): { code: string; remaining: number; period: number } | null {
  const t = parseTotp(input);
  if (!t) return null;
  const period = t.period;
  return { code: t.generate(), remaining: period - (Math.floor(Date.now() / 1000) % period), period };
}
