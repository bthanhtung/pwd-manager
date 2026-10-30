import { Fingerprint, Laptop, LogOut, Monitor, Moon, Shield, Sun, Trash2, User } from 'lucide-react';
import QRCode from 'qrcode';
import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Confirm, Modal, PasswordInput, Spinner, StrengthMeter, Switch, toast } from '../components/ui';
import { fingerprint } from '../crypto';
import { LANGUAGES, useT } from '../i18n';
import { api, SessionInfo } from '../lib/api';
import { strength } from '../lib/strength';
import { usePrefs } from '../state/prefs';
import { useVault } from '../state/vault';
import { errorText } from './Auth';

type Tab = 'account' | 'security' | 'appearance';

export function SettingsModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('account');
  const tabs: [Tab, string, ReactNode][] = [
    ['account', t('set.account', 'Account'), <User className="size-4" />],
    ['security', t('set.security', 'Security'), <Shield className="size-4" />],
    ['appearance', t('set.appearance', 'Appearance'), <Sun className="size-4" />],
  ];
  return (
    <Modal open={open} onClose={onClose} wide title={t('nav.settings', 'Settings')}>
      <div className="flex gap-1 p-1 rounded-xl bg-surface-2 mb-5 text-sm font-medium">
        {tabs.map(([k, l, i]) => <button key={k} onClick={() => setTab(k)} className={`flex-1 h-8 rounded-lg inline-flex items-center justify-center gap-1.5 ${tab === k ? 'bg-surface shadow-sm' : 'text-muted'}`}>{i}<span className="hidden sm:inline">{l}</span></button>)}
      </div>
      {tab === 'account' && <AccountTab onClose={onClose} />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'appearance' && <AppearanceTab />}
    </Modal>
  );
}

const Block = ({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) => (
  <section className="py-5 border-b border-line last:border-0 first:pt-0">
    <h3 className="text-sm font-semibold">{title}</h3>{desc && <p className="text-sm text-muted mt-0.5">{desc}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

function AccountTab({ onClose }: { onClose(): void }) {
  const t = useT();
  const nav = useNavigate();
  const { profile, setProfile, changePassword, deleteAccount, logout } = useVault();
  const [name, setName] = useState(profile?.name || '');
  const [fp, setFp] = useState('');
  const [cur, setCur] = useState(''); const [n1, setN1] = useState(''); const [n2, setN2] = useState('');
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [del, setDel] = useState(false); const [delPw, setDelPw] = useState('');
  useEffect(() => { if (profile) fingerprint(profile.publicKey).then(setFp); }, [profile?.publicKey]);
  useEffect(() => { let l = true; if (n1) strength(n1, [profile?.email || '']).then(s => l && setScore(s.score)); return () => { l = false; }; }, [n1]);

  return <>
    <Block title={t('set.profile', 'Profile')}>
      <div className="flex gap-2">
        <input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={120} />
        <button className="btn-outline" disabled={!name.trim() || name === profile?.name} onClick={async () => { setProfile(await api.rename(name.trim())); toast.ok(t('item.saved', 'Saved')); }}>{t('common.save', 'Save')}</button>
      </div>
      <p className="text-sm text-muted mt-2">{profile?.email}</p>
      <p className="text-xs text-faint font-mono mt-1 flex items-center gap-1.5" title={t('set.fpHint', 'Teammates can compare this fingerprint to make sure they share with the real you.')}><Fingerprint className="size-3.5" />{fp}</p>
    </Block>
    <Block title={t('set.changePw', 'Change master password')} desc={t('set.changePwDesc', 'Your items are not re-encrypted; only the key that protects them changes. Other devices will be signed out.')}>
      <div className="space-y-2.5">
        <PasswordInput value={cur} onChange={setCur} placeholder={t('set.current', 'Current master password')} />
        <PasswordInput value={n1} onChange={setN1} placeholder={t('set.new', 'New master password')} autoComplete="new-password" />
        {n1 && <StrengthMeter password={n1} inputs={[profile?.email || '']} />}
        <PasswordInput value={n2} onChange={setN2} placeholder={t('f.confirm', 'Confirm master password')} autoComplete="new-password" />
        <button className="btn-primary" disabled={!cur || n1.length < 10 || score < 3 || n1 !== n2 || busy === 'pw'}
          onClick={async () => { setBusy('pw'); try { await changePassword(cur, n1); setCur(''); setN1(''); setN2(''); toast.ok(t('set.pwChanged', 'Master password changed')); } catch (e) { toast.bad(errorText(e, t)); } finally { setBusy(null); } }}>
          {busy === 'pw' && <Spinner />}{t('set.changePw', 'Change master password')}</button>
      </div>
    </Block>
    <Block title={t('set.signOut', 'Sign out')}>
      <button className="btn-outline" onClick={async () => { await logout(); onClose(); nav('/login'); }}><LogOut className="size-4" />{t('set.signOut', 'Sign out')}</button>
    </Block>
    <Block title={t('set.danger', 'Delete account')} desc={t('set.dangerDesc', 'Permanently deletes your account, personal items and teams you solely own.')}>
      <button className="btn-ghost text-bad" onClick={() => setDel(true)}><Trash2 className="size-4" />{t('set.deleteBtn', 'Delete my account')}</button>
    </Block>
    <Confirm open={del} onClose={() => setDel(false)} danger title={t('set.deleteTitle', 'Delete your account?')} confirm={t('set.deleteBtn', 'Delete my account')}
      body={<div className="space-y-3"><p>{t('set.deleteBody', 'This cannot be undone. Export your vault first if you want a copy.')}</p>
        <PasswordInput value={delPw} onChange={setDelPw} placeholder={t('f.master', 'Master password')} /></div>}
      onConfirm={async () => { try { await deleteAccount(delPw); onClose(); nav('/'); } catch (e) { toast.bad(errorText(e, t)); throw e; } }} />
  </>;
}

function SecurityTab() {
  const t = useT();
  const { profile, setProfile, verifyPassword } = useVault();
  const prefs = usePrefs();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [disablePw, setDisablePw] = useState('');
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const loadSessions = () => api.sessions().then(setSessions).catch(() => setSessions([]));
  useEffect(() => { loadSessions(); }, []);

  return <>
    <Block title={t('set.2fa', 'Two-step login')} desc={t('set.2faDesc', 'Ask for a code from an authenticator app (Google Authenticator, Authy, 1Password…) when signing in on a new device.')}>
      {profile?.twoFactor ? <div className="space-y-2.5">
        <p className="text-sm text-ok font-medium">✓ {t('set.2faOn', 'On')}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <PasswordInput value={disablePw} onChange={setDisablePw} placeholder={t('f.master', 'Master password')} />
          <input className="input sm:w-32 font-mono text-center" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
          <button className="btn-outline text-bad" disabled={!disablePw || code.length !== 6} onClick={async () => {
            try { setProfile(await api.totpDisable(await verifyPassword(disablePw), code)); setCode(''); setDisablePw(''); toast.ok(t('set.2faOff', 'Two-step login turned off')); } catch (e) { toast.bad(errorText(e, t)); }
          }}>{t('set.turnOff', 'Turn off')}</button>
        </div>
      </div> : setup ? <div className="flex flex-col sm:flex-row gap-5 items-start">
        <img src={setup.qr} alt="QR code" className="size-40 rounded-xl bg-white p-2 shrink-0" />
        <div className="space-y-2.5 flex-1 min-w-0">
          <p className="text-sm">{t('set.scan', 'Scan the QR code, or enter this key manually:')}</p>
          <code className="block text-xs font-mono p-2 rounded-lg bg-surface-2 break-all">{setup.secret.match(/.{1,4}/g)!.join(' ')}</code>
          <div className="flex gap-2">
            <input className="input font-mono text-center tracking-widest" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            <button className="btn-primary" disabled={code.length !== 6} onClick={async () => {
              try { setProfile(await api.totpEnable(code)); setSetup(null); setCode(''); toast.ok(t('set.2faEnabled', 'Two-step login is on')); } catch (e) { toast.bad(errorText(e, t)); }
            }}>{t('set.verify', 'Verify')}</button>
          </div>
        </div>
      </div> : <button className="btn-primary" onClick={async () => {
        const s = await api.totpSetup();
        setSetup({ secret: s.secret, qr: await QRCode.toDataURL(s.otpauthUrl, { margin: 1, width: 320 }) });
      }}>{t('set.turnOn', 'Turn on')}</button>}
    </Block>

    <Block title={t('set.lock', 'Auto-lock')} desc={t('set.lockDesc', 'Locking wipes your keys from memory. You will need your master password again.')}>
      <div className="flex flex-wrap gap-2">
        {[1, 5, 15, 30, 60, 0].map(m => <button key={m} onClick={() => prefs.set({ autoLockMinutes: m })}
          className={`h-8 px-3 rounded-lg text-sm ${prefs.autoLockMinutes === m ? 'bg-accent text-accent-fg' : 'bg-surface-2'}`}>
          {m ? t('set.minutes', '{n} min', { n: m }) : t('set.never', 'Never')}</button>)}
      </div>
      <label className="mt-4 flex items-center justify-between gap-4 text-sm">{t('set.lockHide', 'Lock when the tab is hidden or the app is in the background')}<Switch checked={prefs.lockOnHide} onChange={v => prefs.set({ lockOnHide: v })} /></label>
    </Block>

    <Block title={t('set.clipboard', 'Clear clipboard')} desc={t('set.clipboardDesc', 'Wipe copied passwords from the clipboard after a while.')}>
      <div className="flex flex-wrap gap-2">
        {[15, 30, 60, 0].map(s => <button key={s} onClick={() => prefs.set({ clipboardClearSeconds: s })}
          className={`h-8 px-3 rounded-lg text-sm ${prefs.clipboardClearSeconds === s ? 'bg-accent text-accent-fg' : 'bg-surface-2'}`}>
          {s ? t('set.seconds', '{n} s', { n: s }) : t('set.never', 'Never')}</button>)}
      </div>
    </Block>

    <Block title={t('set.sessions', 'Signed-in devices')}>
      {!sessions ? <Spinner /> : <div className="card overflow-hidden">
        {sessions.map(s => <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
          <Laptop className="size-4 text-muted shrink-0" />
          <div className="min-w-0 flex-1"><div className="text-sm truncate">{describeUA(s.userAgent)}{s.current && <span className="chip ml-2">{t('set.thisDevice', 'This device')}</span>}</div>
            <div className="text-xs text-muted">{t('set.lastSeen', 'Last active {d}', { d: new Date(s.lastSeenAt).toLocaleString(t.lang) })}</div></div>
          {!s.current && <button className="btn-ghost h-8 text-xs text-bad" onClick={async () => { await api.revokeSession(s.id); loadSessions(); }}>{t('set.revoke', 'Sign out')}</button>}
        </div>)}
      </div>}
      {sessions && sessions.length > 1 && <button className="btn-outline mt-3" onClick={async () => { await api.revokeOthers(); loadSessions(); toast.ok(t('set.revoked', 'Other devices signed out')); }}>{t('set.revokeAll', 'Sign out all other devices')}</button>}
    </Block>
  </>;
}

function AppearanceTab() {
  const t = useT();
  const prefs = usePrefs();
  const themes: [typeof prefs.theme, string, ReactNode][] = [
    ['system', t('set.system', 'System'), <Monitor className="size-4" />], ['light', t('set.light', 'Light'), <Sun className="size-4" />], ['dark', t('set.dark', 'Dark'), <Moon className="size-4" />],
  ];
  return <>
    <Block title={t('set.theme', 'Theme')}>
      <div className="grid grid-cols-3 gap-2">
        {themes.map(([k, l, i]) => <button key={k} onClick={() => prefs.set({ theme: k })}
          className={`h-20 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-sm ${prefs.theme === k ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-surface-2'}`}>{i}{l}</button>)}
      </div>
    </Block>
    <Block title={t('set.language', 'Language')}>
      <select className="input" value={prefs.lang} onChange={e => prefs.set({ lang: e.target.value as typeof prefs.lang })}>
        <option value="auto">{t('set.auto', 'Automatic')}</option>
        {Object.entries(LANGUAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <p className="text-xs text-faint mt-2">{t('set.translate', 'Want OpenPass in your language? Translations are a single file — contributions welcome on GitHub.')}</p>
    </Block>
  </>;
}

function describeUA(ua: string): string {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 40) || 'Unknown device';
}
