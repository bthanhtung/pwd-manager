import {
  ArrowRight, Building2, Check, Copy, Download, Globe, KeyRound, Laptop, Lock, ScanLine, ServerCog, ShieldCheck, Sparkles, Star, Upload,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Logo } from '../components/ui';
import { LANGUAGES, useT } from '../i18n';
import { usePrefs } from '../state/prefs';
import { useVault } from '../state/vault';

const REPO = 'https://github.com/bthanhtung/pwd-manager';
// lucide dropped brand icons; a tiny inline GitHub mark instead
function Github({ className = 'size-4' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>;
}

export default function Landing() {
  const t = useT();
  const status = useVault(s => s.status);
  const prefs = usePrefs();
  const signedIn = status === 'locked' || status === 'unlocked';

  const features: [ReactNode, string, string][] = [
    [<Lock />, t('l.f1', 'Zero-knowledge'), t('l.f1d', 'Encrypted with AES-256-GCM on your device. The server stores ciphertext it cannot read — not even the item names.')],
    [<Building2 />, t('l.f2', 'Built for teams'), t('l.f2d', 'Share vaults with owner, admin, editor and viewer roles. Team keys are sealed to each member with public-key crypto.')],
    [<Upload />, t('l.f3', 'Move in, in a minute'), t('l.f3d', 'Import from Bitwarden, 1Password, LastPass, Chrome, Safari and Firefox. Export an encrypted backup any time.')],
    [<ScanLine />, t('l.f4', 'Authenticator built in'), t('l.f4d', 'Store TOTP keys and get live 6-digit codes. Protect your own login with two-step verification.')],
    [<ShieldCheck />, t('l.f5', 'Security report'), t('l.f5d', 'Spot weak, reused and old passwords. Check for breaches privately with k-anonymity.')],
    [<Laptop />, t('l.f6', 'Every device'), t('l.f6d', 'Install it as an app on desktop and phone. Works offline with your last synced vault.')],
    [<Sparkles />, t('l.f7', 'Generator'), t('l.f7d', 'Random passwords or memorable passphrases with real entropy estimates.')],
    [<Globe />, t('l.f8', 'Speaks your language'), t('l.f8d', 'English and Tiếng Việt today; adding a language is a single file.')],
  ];

  return (
    <div className="min-h-full overflow-x-hidden">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-bg/70 border-b border-line">
        <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center gap-3">
          <Link to="/"><Logo size={28} /></Link>
          <nav className="hidden md:flex items-center gap-6 ml-8 text-sm text-muted">
            <a href="#features" className="hover:text-fg">{t('l.nav.features', 'Features')}</a>
            <a href="#security" className="hover:text-fg">{t('l.nav.security', 'Security')}</a>
            <a href="#selfhost" className="hover:text-fg">{t('l.nav.selfhost', 'Self-host')}</a>
            <a href="#faq" className="hover:text-fg">FAQ</a>
          </nav>
          <div className="flex-1" />
          <label className="relative inline-flex items-center h-9 px-2 rounded-lg text-sm text-muted hover:text-fg hover:bg-surface-2 cursor-pointer">
            <Globe className="size-4" /><span className="ml-1.5 uppercase text-xs font-medium">{t.lang}</span>
            <select aria-label="Language" className="absolute inset-0 opacity-0 cursor-pointer" value={prefs.lang} onChange={e => prefs.set({ lang: e.target.value as typeof prefs.lang })}>
              <option value="auto">Auto</option>{Object.entries(LANGUAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <a href={REPO} className="btn-icon hidden sm:inline-grid" aria-label="GitHub"><Github className="size-4" /></a>
          {signedIn ? <Link to="/app" className="btn-primary h-9">{t('l.open', 'Open vault')}</Link> : <>
            <Link to="/login" className="btn-ghost h-9 hidden sm:inline-flex">{t('auth.signIn', 'Sign in')}</Link>
            <Link to="/signup" className="btn-primary h-9">{t('l.start', 'Get started')}</Link>
          </>}
        </div>
      </header>

      {/* hero */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 h-[620px] bg-[radial-gradient(60%_50%_at_50%_0%,var(--accent-soft),transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.35] dark:opacity-25 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-10 text-center">
          <a href={REPO} className="inline-flex items-center gap-2 h-8 pl-1.5 pr-3 rounded-full border border-line bg-surface/70 text-xs text-muted hover:text-fg animate-up">
            <span className="chip bg-accent-soft text-accent">v2</span>{t('l.badge', 'Open source · MIT · self-hostable')}<ArrowRight className="size-3" />
          </a>
          <h1 className="mt-6 text-4xl sm:text-6xl font-semibold tracking-[-0.035em] leading-[1.05] animate-up [animation-delay:60ms] [animation-fill-mode:both]">
            {t('l.h1a', 'Your passwords,')}<br className="hidden sm:block" />{' '}
            <span className="bg-gradient-to-r from-[#8b6bff] via-[#6d8bff] to-[#3dd6c6] bg-clip-text text-transparent">{t('l.h1b', 'encrypted before they leave your device.')}</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-muted animate-up [animation-delay:120ms] [animation-fill-mode:both]">
            {t('l.sub', 'OpenPass is a modern, zero-knowledge password manager for you and your team. Host it yourself in one command, or use any server you trust — it never sees your secrets.')}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center animate-up [animation-delay:180ms] [animation-fill-mode:both]">
            <Link to={signedIn ? '/app' : '/signup'} className="btn-primary h-12 px-6 text-base">{signedIn ? t('l.open', 'Open vault') : t('l.cta', 'Create your free vault')}<ArrowRight className="size-4" /></Link>
            <a href="#selfhost" className="btn-outline h-12 px-6 text-base"><ServerCog className="size-4" />{t('l.cta2', 'Self-host in 1 minute')}</a>
          </div>
          <p className="mt-4 text-xs text-faint">{t('l.trust', 'No tracking · No ads · Your data, your server')}</p>
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-20 animate-up [animation-delay:240ms] [animation-fill-mode:both]"><AppMock /></div>
      </section>

      {/* features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <SectionTitle kicker={t('l.nav.features', 'Features')} title={t('l.fTitle', 'Everything you expect. Nothing you have to trust.')} />
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(([icon, title, body], i) => (
            <div key={i} className="card p-5 hover:shadow-pop hover:-translate-y-0.5 transition">
              <div className="size-10 rounded-xl grid place-items-center bg-accent-soft text-accent [&>svg]:size-5">{icon}</div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* security */}
      <section id="security" className="border-y border-line bg-surface/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <SectionTitle kicker={t('l.nav.security', 'Security')} title={t('l.sTitle', 'How your vault stays private')} sub={t('l.sSub', 'Open, standard cryptography — the same model used by the best commercial password managers.')} />
          <div className="mt-12 grid md:grid-cols-3 gap-4">
            <Step n={1} title={t('l.s1', 'Your master password stays home')} body={t('l.s1d', 'Argon2id (64 MiB, 3 passes) turns it into a master key in your browser. Only a derived login proof is sent; the encryption key never is.')} code="argon2id(password, salt) → HKDF → auth key + enc key" />
            <Step n={2} title={t('l.s2', 'Everything is encrypted locally')} body={t('l.s2d', 'Each item — name, username, password, notes — is sealed with AES-256-GCM and bound to its id, so items cannot be swapped or tampered with.')} code="AES-256-GCM(user key, item, aad = item id)" />
            <Step n={3} title={t('l.s3', 'Sharing without trusting the server')} body={t('l.s3d', 'Team keys are wrapped for each member with ECDH P-256. Fingerprints let you confirm you are sharing with the right person.')} code="seal(member public key, team key)" />
          </div>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            {[t('l.c1', 'httpOnly, SameSite=Strict sessions'), t('l.c2', 'Rate-limited sign-in & 2FA'), t('l.c3', 'Strict Content-Security-Policy'), t('l.c4', 'No third-party scripts or trackers')].map(c =>
              <div key={c} className="flex items-center gap-2 p-3 rounded-xl border border-line bg-surface"><Check className="size-4 text-ok shrink-0" />{c}</div>)}
          </div>
        </div>
      </section>

      {/* self-host */}
      <section id="selfhost" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <SectionTitle left kicker={t('l.nav.selfhost', 'Self-host')} title={t('l.hTitle', 'One container. Your server.')} sub={t('l.hSub', 'SQLite out of the box, PostgreSQL when you grow. Runs on a $5 VPS, a Raspberry Pi or your NAS.')} />
          <ul className="mt-6 space-y-2.5 text-sm">
            {[t('l.h1', 'Single Docker image with API + web app'), t('l.h2', 'Automatic database migrations'), t('l.h3', 'Close sign-ups once your team is in'), t('l.h4', 'Put it behind any HTTPS reverse proxy')].map(x =>
              <li key={x} className="flex gap-2"><Check className="size-4 text-ok mt-0.5 shrink-0" />{x}</li>)}
          </ul>
          <a href={`${REPO}#self-hosting`} className="btn-outline mt-7"><Github className="size-4" />{t('l.guide', 'Read the self-hosting guide')}</a>
        </div>
        <CodeBlock code={`git clone https://github.com/bthanhtung/pwd-manager.git
  cd pwd-manager
  docker compose up -d --build`} />
      </section>

      {/* faq */}
      <section id="faq" className="border-t border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <SectionTitle kicker="FAQ" title={t('l.qTitle', 'Questions, answered')} />
          <div className="mt-10 space-y-3">
            {[
              [t('l.q1', 'What if I forget my master password?'), t('l.a1', 'Nobody can recover it — that is the price of zero-knowledge. Keep an encrypted export somewhere safe and consider writing your master password down and storing it securely.')],
              [t('l.q2', 'Can the server owner read my passwords?'), t('l.a2', 'No. The server only stores ciphertext and a hash of a derived login proof. Without your master password the data is noise.')],
              [t('l.q3', 'Is it free?'), t('l.a3', 'Yes. OpenPass is MIT-licensed open source. Host it for yourself, your family or your company.')],
              [t('l.q4', 'Is there a browser extension?'), t('l.a4', 'Not yet — it is on the roadmap. Today you can install the web app on any device and copy with one click.')],
            ].map(([q, a]) => (
              <details key={q} className="group card px-5 py-4 open:shadow-pop">
                <summary className="cursor-pointer list-none flex justify-between items-center gap-4 font-medium">{q}<span className="text-muted group-open:rotate-45 transition text-xl leading-none">+</span></summary>
                <p className="mt-3 text-sm text-muted leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl p-10 sm:p-14 text-center bg-gradient-to-br from-[#6d4aff] to-[#3b6cff] text-white">
          <div aria-hidden className="absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative text-3xl sm:text-4xl font-semibold tracking-tight">{t('l.endTitle', 'Take your passwords back.')}</h2>
          <p className="relative mt-3 text-white/80">{t('l.endSub', 'Free, open source, and private by design.')}</p>
          <div className="relative mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={signedIn ? '/app' : '/signup'} className="btn h-12 px-6 bg-white text-[#3b2a99] hover:bg-white/90">{signedIn ? t('l.open', 'Open vault') : t('l.cta', 'Create your free vault')}</Link>
            <a href={REPO} className="btn h-12 px-6 bg-white/10 hover:bg-white/20 text-white"><Star className="size-4" />{t('l.star', 'Star on GitHub')}</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center gap-3 justify-between text-sm text-muted">
          <Logo size={22} />
          <p>MIT License · {t('l.made', 'Made with care by')} <a className="text-fg hover:underline" href="https://www.tungdadev.com/">TungDaDev</a> & <a className="text-fg hover:underline" href="https://davintek.com/">Davintek</a></p>
          <div className="flex gap-4"><a href={REPO} className="hover:text-fg">GitHub</a><a href="/api/docs" className="hover:text-fg">API</a><a href={`${REPO}/blob/main/SECURITY.md`} className="hover:text-fg">{t('l.nav.security', 'Security')}</a></div>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ kicker, title, sub, left }: { kicker: string; title: string; sub?: string; left?: boolean }) {
  return <div className={left ? '' : 'text-center max-w-2xl mx-auto'}>
    <div className="text-xs font-semibold uppercase tracking-[.2em] text-accent">{kicker}</div>
    <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
    {sub && <p className="mt-3 text-muted">{sub}</p>}
  </div>;
}

function Step({ n, title, body, code }: { n: number; title: string; body: string; code: string }) {
  return <div className="card p-6 flex flex-col">
    <div className="size-8 rounded-full grid place-items-center bg-accent text-accent-fg text-sm font-semibold">{n}</div>
    <h3 className="mt-4 font-semibold">{title}</h3>
    <p className="mt-2 text-sm text-muted leading-relaxed flex-1">{body}</p>
    <code className="mt-4 block text-[11px] font-mono p-3 rounded-lg bg-surface-2 text-muted break-words">{code}</code>
  </div>;
}

function CodeBlock({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  return <div className="rounded-2xl overflow-hidden border border-line bg-[#0e0e14] shadow-pop">
    <div className="flex items-center gap-1.5 px-4 h-10 border-b border-white/10">
      {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} className="size-3 rounded-full" style={{ background: c }} />)}
      <span className="ml-3 text-xs text-white/40 font-mono">terminal</span>
      <button className="ml-auto text-white/50 hover:text-white" aria-label="Copy" onClick={() => { navigator.clipboard.writeText(code.split('\n').map(l => l.trim()).join(' && ')); setOk(true); setTimeout(() => setOk(false), 1500); }}>
        {ok ? <Check className="size-4 text-[#3dd68c]" /> : <Copy className="size-4" />}</button>
    </div>
    <pre className="p-5 text-[13px] leading-6 font-mono text-[#d6d6e7] overflow-x-auto"><span className="text-[#3dd68c]">$ </span>{code}</pre>
  </div>;
}

/** A static, faithful miniature of the app for the hero (no screenshots to keep in sync). */
function AppMock() {
  const rows = [['github.com', 'GitHub', 'octocat'], ['figma.com', 'Figma', 'design@acme.co'], ['aws.amazon.com', 'AWS Console', 'root-ops'], ['notion.so', 'Notion', 'team@acme.co'], ['stripe.com', 'Stripe', 'billing@acme.co']];
  return (
    <div className="rounded-2xl border border-line bg-surface shadow-[0_40px_120px_-30px_rgb(0_0_0/.45)] overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 h-10 border-b border-line bg-surface-2/60">
        {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} className="size-3 rounded-full" style={{ background: c }} />)}
        <span className="mx-auto text-[11px] text-faint font-mono flex items-center gap-1.5"><Lock className="size-3" />pass.acme.co/app</span>
      </div>
      <div className="flex h-[380px] text-left">
        <div className="hidden md:block w-52 border-r border-line p-3 space-y-1 text-[13px]">
          <div className="mb-3"><Logo size={20} /></div>
          {[[<KeyRound className="size-3.5" />, 'All items', true], [<Star className="size-3.5" />, 'Favorites'], [<Building2 className="size-3.5" />, 'Acme Engineering'], [<ShieldCheck className="size-3.5" />, 'Security report'], [<Download className="size-3.5" />, 'Import & export']].map(([i, l, a], k) => (
            <div key={k} className={`flex items-center gap-2 h-8 px-2 rounded-lg ${a ? 'bg-accent-soft text-accent font-medium' : 'text-muted'}`}>{i}{l}</div>))}
        </div>
        <div className="w-full sm:w-72 border-r border-line p-2 space-y-1">
          {rows.map(([host, name, user], k) => (
            <div key={host} className={`flex items-center gap-2.5 p-2 rounded-xl ${k === 0 ? 'bg-bg shadow-[0_0_0_1px_var(--line)]' : ''}`}>
              <Avatar name={host} size={30} /><div className="min-w-0"><div className="text-[13px] font-medium">{name}</div><div className="text-[11px] text-muted truncate">{user}</div></div>
            </div>))}
        </div>
        <div className="hidden sm:block flex-1 p-6">
          <div className="flex items-center gap-3"><Avatar name="github.com" size={44} /><div><div className="font-semibold">GitHub</div><div className="flex gap-1 mt-1"><span className="chip">Login</span><span className="chip">Acme Engineering</span></div></div></div>
          <div className="mt-5 card overflow-hidden text-[13px]">
            {[['Username', 'octocat', false], ['Password', '••••••••••••••••', true], ['One-time code', '284 913', false], ['Website', 'https://github.com', false]].map(([l, v, m]) => (
              <div key={l as string} className="px-4 py-2.5 border-b border-line last:border-0"><div className="text-[10px] uppercase tracking-wide text-muted">{l}</div><div className={`mt-0.5 ${m ? 'font-mono' : ''} ${l === 'Website' ? 'text-accent' : ''}`}>{v}</div></div>))}
          </div>
        </div>
      </div>
    </div>
  );
}
