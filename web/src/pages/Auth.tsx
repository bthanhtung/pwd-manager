import { ArrowLeft, KeyRound, Lock, LogOut, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo, PasswordInput, Spinner, StrengthMeter } from '../components/ui';
import { DecryptError } from '../crypto';
import { useT } from '../i18n';
import { api, ApiError } from '../lib/api';
import { strength } from '../lib/strength';
import { useVault } from '../state/vault';

function errorText(e: unknown, t: ReturnType<typeof useT>): string {
  if (e instanceof DecryptError) return t('err.badMaster', 'Wrong master password');
  if (e instanceof ApiError) {
    const map: Record<string, string> = {
      BAD_CREDENTIALS: t('err.badCreds', 'Email or master password is incorrect'),
      EMAIL_TAKEN: t('err.emailTaken', 'An account with this email already exists'),
      SIGNUPS_CLOSED: t('err.signupsClosed', 'This server is not accepting new accounts'),
      TOTP_INVALID: t('err.totp', 'That code is not valid'),
      RATE_LIMITED: t('err.rate', 'Too many attempts — wait a minute and try again'),
      OFFLINE: t('err.offline', 'You are offline'),
    };
    return map[e.code] || e.message;
  }
  return (e as Error)?.message || String(e);
}

function Shell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-full grid place-items-center px-4 py-10 relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-accent/20 blur-[120px]" />
      <div className="relative w-full max-w-[400px] animate-up">
        <Link to="/" className="flex justify-center mb-8"><Logo size={34} /></Link>
        <div className="card p-6 sm:p-7 shadow-pop">{children}</div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}

const Busy = ({ label }: { label: string }) => <><Spinner />{label}</>;

export function Login() {
  const t = useT();
  const nav = useNavigate();
  const login = useVault(s => s.login);
  const [email, setEmail] = useState(localStorage.getItem('op_last_email') || '');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await login(email.trim(), password, needTotp ? totp : undefined);
      localStorage.setItem('op_last_email', email.trim());
      nav('/app');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'TOTP_REQUIRED') setNeedTotp(true);
      else setErr(errorText(e, t));
    } finally { setBusy(false); }
  }

  return (
    <Shell footer={<>{t('auth.noAccount', 'New here?')} <Link to="/signup" className="text-accent font-medium hover:underline">{t('auth.create', 'Create an account')}</Link></>}>
      <h1 className="text-xl font-semibold">{t('auth.welcome', 'Welcome back')}</h1>
      <p className="text-sm text-muted mt-1">{t('auth.loginSub', 'Sign in to unlock your vault.')}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        {!needTotp ? <>
          <div><label className="label" htmlFor="email">{t('f.email', 'Email')}</label>
            <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} autoFocus={!email} /></div>
          <div><label className="label" htmlFor="pw">{t('f.master', 'Master password')}</label>
            <PasswordInput id="pw" value={password} onChange={setPassword} autoFocus={!!email} /></div>
        </> : <div>
          <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-accent" />{t('auth.totpTitle', 'Two-step login')}</div>
          <p className="text-sm text-muted mt-1 mb-3">{t('auth.totpBody', 'Enter the 6-digit code from your authenticator app.')}</p>
          <input className="input text-center font-mono text-lg tracking-[.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
            value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, ''))} />
        </div>}
        {err && <p className="text-sm text-bad">{err}</p>}
        <button className="btn-primary w-full h-11" disabled={busy || !email || !password || (needTotp && totp.length !== 6)}>
          {busy ? <Busy label={t('auth.unlocking', 'Deriving keys…')} /> : t('auth.signIn', 'Sign in')}
        </button>
        {needTotp && <button type="button" className="btn-ghost w-full" onClick={() => { setNeedTotp(false); setTotp(''); }}><ArrowLeft className="size-4" />{t('common.back', 'Back')}</button>}
      </form>
    </Shell>
  );
}

export function Signup() {
  const t = useT();
  const nav = useNavigate();
  const register = useVault(s => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [ack, setAck] = useState(false);
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [closed, setClosed] = useState(false);

  useEffect(() => { api.config().then(c => setClosed(!c.signupsAllowed)).catch(() => {}); }, []);
  useEffect(() => { let live = true; if (pw) strength(pw, [email, name]).then(s => live && setScore(s.score)); else setScore(0); return () => { live = false; }; }, [pw, email, name]);

  const tooWeak = pw.length < 10 || score < 3;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setErr(t('err.mismatch', 'Passwords do not match'));
    setBusy(true); setErr('');
    try { await register(name.trim(), email.trim(), pw); localStorage.setItem('op_last_email', email.trim()); nav('/app'); }
    catch (e) { setErr(errorText(e, t)); } finally { setBusy(false); }
  }

  if (closed) return <Shell footer={<Link to="/login" className="text-accent font-medium">{t('auth.signIn', 'Sign in')}</Link>}>
    <h1 className="text-xl font-semibold">{t('auth.closedTitle', 'Registration is closed')}</h1>
    <p className="text-sm text-muted mt-2">{t('auth.closedBody', 'The owner of this server has turned off new sign-ups. Ask them for an account, or host your own OpenPass.')}</p>
  </Shell>;

  return (
    <Shell footer={<>{t('auth.haveAccount', 'Already have an account?')} <Link to="/login" className="text-accent font-medium hover:underline">{t('auth.signIn', 'Sign in')}</Link></>}>
      <h1 className="text-xl font-semibold">{t('auth.createTitle', 'Create your vault')}</h1>
      <p className="text-sm text-muted mt-1">{t('auth.createSub', 'Your master password encrypts everything on this device. We never see it.')}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div><label className="label" htmlFor="name">{t('f.name', 'Your name')}</label>
          <input id="name" className="input" required autoFocus value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></div>
        <div><label className="label" htmlFor="email">{t('f.email', 'Email')}</label>
          <input id="email" className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" /></div>
        <div><label className="label" htmlFor="pw">{t('f.master', 'Master password')}</label>
          <PasswordInput id="pw" value={pw} onChange={setPw} autoComplete="new-password" />
          {pw && <StrengthMeter password={pw} inputs={[email, name]} />}
          <p className="text-xs text-faint mt-1.5">{t('auth.pwTip', 'Tip: 4–5 random words make a strong password that is easy to remember.')}</p></div>
        <div><label className="label" htmlFor="pw2">{t('f.confirm', 'Confirm master password')}</label>
          <PasswordInput id="pw2" value={pw2} onChange={setPw2} autoComplete="new-password" /></div>
        <label className="flex gap-3 items-start p-3 rounded-xl bg-warn/10 text-sm cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-[var(--accent)] size-4" checked={ack} onChange={e => setAck(e.target.checked)} />
          <span>{t('auth.ack', 'I understand that nobody — not even the server owner — can recover my vault if I forget my master password.')}</span>
        </label>
        {err && <p className="text-sm text-bad">{err}</p>}
        <button className="btn-primary w-full h-11" disabled={busy || !ack || tooWeak || !pw2 || !name || !email}>
          {busy ? <Busy label={t('auth.creating', 'Generating your keys…')} /> : t('auth.create', 'Create an account')}
        </button>
        {pw && tooWeak && <p className="text-xs text-muted text-center">{t('auth.needStrong', 'Use at least 10 characters with a "Strong" rating.')}</p>}
      </form>
    </Shell>
  );
}

export function Unlock() {
  const t = useT();
  const nav = useNavigate();
  const { profile, unlock, logout, offline } = useVault();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await unlock(pw); nav('/app'); } catch (e) { setErr(errorText(e, t)); setPw(''); } finally { setBusy(false); }
  }
  return (
    <Shell footer={<button className="inline-flex items-center gap-1.5 hover:text-fg" onClick={async () => { await logout(); nav('/login'); }}>
      <LogOut className="size-3.5" />{t('auth.otherAccount', 'Sign out / use another account')}</button>}>
      <div className="flex flex-col items-center text-center">
        <div className="size-14 grid place-items-center rounded-2xl bg-accent-soft text-accent mb-4"><Lock className="size-6" /></div>
        <h1 className="text-xl font-semibold">{t('auth.locked', 'Your vault is locked')}</h1>
        <p className="text-sm text-muted mt-1">{profile?.email}</p>
        {offline && <p className="chip mt-3">{t('auth.offlineMode', 'Offline — read-only copy')}</p>}
      </div>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <PasswordInput value={pw} onChange={setPw} placeholder={t('f.master', 'Master password')} autoFocus />
        {err && <p className="text-sm text-bad">{err}</p>}
        <button className="btn-primary w-full h-11" disabled={busy || !pw}>
          {busy ? <Busy label={t('auth.unlocking', 'Deriving keys…')} /> : <><KeyRound className="size-4" />{t('auth.unlock', 'Unlock')}</>}
        </button>
      </form>
    </Shell>
  );
}

export { errorText };
