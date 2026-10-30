import { Check, Copy, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useT } from '../i18n';
import { strength, Strength } from '../lib/strength';
import { usePrefs } from '../state/prefs';

// ---------- brand ----------
export function Logo({ size = 28, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-semibold tracking-tight">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b6bff" /><stop offset="1" stopColor="#4f8bff" /></linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#lg)" />
        <circle cx="16" cy="13.5" r="5" fill="none" stroke="#fff" strokeWidth="2.6" />
        <path d="M16 18.5v6.5M16 22.5h3.2" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      {withText && <span style={{ fontSize: size * 0.62 }}>OpenPass</span>}
    </span>
  );
}

export const Spinner = ({ className = 'size-4' }: { className?: string }) => <Loader2 className={`${className} animate-spin`} />;

// ---------- toasts ----------
interface Toast { id: number; text: string; tone: 'ok' | 'bad' | 'info' }
const useToasts = create<{ list: Toast[]; push(t: Omit<Toast, 'id'>): void; drop(id: number): void }>(set => ({
  list: [],
  push: t => { const id = Date.now() + Math.random(); set(s => ({ list: [...s.list, { ...t, id }] })); setTimeout(() => set(s => ({ list: s.list.filter(x => x.id !== id) })), 3200); },
  drop: id => set(s => ({ list: s.list.filter(x => x.id !== id) })),
}));
export const toast = {
  ok: (text: string) => useToasts.getState().push({ text, tone: 'ok' }),
  bad: (text: string) => useToasts.getState().push({ text, tone: 'bad' }),
  info: (text: string) => useToasts.getState().push({ text, tone: 'info' }),
};
export function Toaster() {
  const list = useToasts(s => s.list);
  return (
    <div className="fixed z-[100] bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center pointer-events-none" role="status" aria-live="polite">
      {list.map(t => (
        <div key={t.id} className="animate-up pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fg text-bg text-sm font-medium shadow-pop">
          {t.tone === 'ok' && <Check className="size-4 text-ok" />}
          {t.tone === 'bad' && <X className="size-4 text-bad" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ---------- clipboard with auto-clear ----------
let clearTimer: ReturnType<typeof setTimeout> | undefined;
export async function copyText(value: string, label: string, t: ReturnType<typeof useT>) {
  try {
    await navigator.clipboard.writeText(value);
    const secs = usePrefs.getState().clipboardClearSeconds;
    toast.ok(secs ? t('copy.okClear', '{label} copied · clears in {s}s', { label, s: secs }) : t('copy.ok', '{label} copied', { label }));
    clearTimeout(clearTimer);
    if (secs) clearTimer = setTimeout(() => { if (document.hasFocus()) navigator.clipboard.writeText('').catch(() => {}); }, secs * 1000);
  } catch { toast.bad(t('copy.fail', 'Could not copy')); }
}

// ---------- modal ----------
export function Modal({ open, onClose, title, children, wide, footer }: {
  open: boolean; onClose(): void; title?: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,textarea,select,button[data-autofocus]')?.focus(), 30);
    return () => { removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/45 backdrop-blur-[2px] p-0 sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true"
        className={`animate-in w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92dvh] flex flex-col bg-surface rounded-t-2xl sm:rounded-2xl shadow-pop`}>
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button className="btn-icon -mr-2" onClick={onClose} aria-label="Close"><X className="size-4" /></button>
          </div>
        )}
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, title, body, confirm, danger, onConfirm, onClose }: {
  open: boolean; title: string; body: ReactNode; confirm: string; danger?: boolean; onConfirm(): Promise<void> | void; onClose(): void;
}) {
  const [busy, setBusy] = useState(false);
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<>
      <button className="btn-ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
      <button className={danger ? 'btn-danger' : 'btn-primary'} disabled={busy} data-autofocus
        onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>
        {busy && <Spinner />}{confirm}
      </button>
    </>}>
      <div className="text-sm text-muted leading-relaxed">{body}</div>
    </Modal>
  );
}

// ---------- inputs ----------
export function PasswordInput({ value, onChange, placeholder, autoComplete = 'current-password', autoFocus, id, mono = true }: {
  value: string; onChange(v: string): void; placeholder?: string; autoComplete?: string; autoFocus?: boolean; id?: string; mono?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} className={`input pr-10 ${mono && value ? 'font-mono' : ''}`} type={show ? 'text' : 'password'} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} spellCheck={false} autoCapitalize="off" />
      <button type="button" className="btn-icon absolute right-0.5 top-0.5 size-9" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide' : 'Show'} tabIndex={-1}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-surface-2 border border-line'}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

const SCORE_COLORS = ['bg-bad', 'bg-bad', 'bg-warn', 'bg-ok', 'bg-ok'];
export function StrengthMeter({ password, inputs = [], showText = true }: { password: string; inputs?: string[]; showText?: boolean }) {
  const [s, setS] = useState<Strength | null>(null);
  const t = useT();
  useEffect(() => {
    let live = true;
    if (!password) { setS(null); return; }
    strength(password, inputs).then(r => live && setS(r));
    return () => { live = false; };
  }, [password, inputs.join('|')]);
  const labels = [t('str.0', 'Very weak'), t('str.1', 'Weak'), t('str.2', 'Fair'), t('str.3', 'Strong'), t('str.4', 'Very strong')];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => <div key={i} className={`h-1 flex-1 rounded-full transition ${s && s.score > i ? SCORE_COLORS[s.score] : 'bg-surface-2'}`} />)}
      </div>
      {showText && s && (
        <p className="mt-1.5 text-xs text-muted">
          <span className="font-medium text-fg">{labels[s.score]}</span>
          {' · '}{t('str.crack', 'cracked in {time}', { time: s.crackTime })}
          {s.warning && <span className="block text-warn mt-0.5">{s.warning}</span>}
        </p>
      )}
    </div>
  );
}

// ---------- detail rows ----------
export function FieldRow({ label, value, secret, mono, href, extra }: {
  label: string; value: string; secret?: boolean; mono?: boolean; href?: string; extra?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const t = useT();
  if (!value) return null;
  return (
    <div className="group flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 hover:bg-surface-2/50 transition">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-muted uppercase tracking-wide">{label}</div>
        <div className={`mt-0.5 text-sm break-all ${mono || secret ? 'font-mono' : ''}`}>
          {href ? <a href={href} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">{value}</a>
            : secret && !show ? '•'.repeat(Math.min(16, Math.max(8, value.length))) : secret ? <Colorized value={value} /> : value}
        </div>
        {extra}
      </div>
      <div className="flex opacity-70 group-hover:opacity-100 transition">
        {secret && <button className="btn-icon" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide' : 'Show'}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}
        <button className="btn-icon" onClick={() => copyText(value, label, t)} aria-label={`Copy ${label}`}><Copy className="size-4" /></button>
      </div>
    </div>
  );
}

/** Digits and symbols in a different colour, like most password managers, so passwords are easy to read out. */
export function Colorized({ value }: { value: string }) {
  return <>{[...value].map((c, i) => <span key={i} className={/\d/.test(c) ? 'text-[#4f8bff]' : /[^A-Za-z0-9]/.test(c) ? 'text-[#e5484d] dark:text-[#ff8a8f]' : ''}>{c}</span>)}</>;
}

// ---------- avatars (no network: favicons would leak which sites you use) ----------
const HUES = [262, 222, 199, 160, 32, 340, 280, 12];
export function Avatar({ name, seed, size = 36, icon }: { name: string; seed?: string; size?: number; icon?: ReactNode }) {
  let h = 0; for (const c of seed || name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = HUES[h % HUES.length];
  return (
    <span className="shrink-0 grid place-items-center rounded-xl font-semibold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, hsl(${hue} 75% 62%), hsl(${(hue + 30) % 360} 70% 50%))` }}>
      {icon ?? (name.trim()[0] || '?').toUpperCase()}
    </span>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="h-full grid place-items-center p-8 text-center">
      <div className="max-w-xs animate-up">
        <div className="mx-auto mb-4 size-14 grid place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
        {body && <p className="mt-1.5 text-sm text-muted">{body}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
