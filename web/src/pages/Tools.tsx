import { AlertTriangle, CheckCircle2, Copy, Download, FileUp, RefreshCw, ShieldAlert, ShieldCheck, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Colorized, copyText, Modal, PasswordInput, Spinner, Switch, toast } from '../components/ui';
import { useT } from '../i18n';
import { DEFAULT_GEN, entropyBits, generate, GenOptions } from '../lib/generator';
import { exportCsv, exportEncrypted, FORMATS, ImportFormat, parseImport } from '../lib/importers';
import { pwnedCount, strength } from '../lib/strength';
import { hostOf, ItemData } from '../lib/types';
import { useVault } from '../state/vault';

// ---------- generator ----------
const GEN_KEY = 'op_gen';
export function GeneratorModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT();
  const [o, setO] = useState<GenOptions>(() => { try { return { ...DEFAULT_GEN, ...JSON.parse(localStorage.getItem(GEN_KEY) || '{}') }; } catch { return DEFAULT_GEN; } });
  const [pw, setPw] = useState('');
  useEffect(() => { if (open) setPw(generate(o)); }, [open]);
  const update = (p: Partial<GenOptions>) => { const n = { ...o, ...p }; setO(n); setPw(generate(n)); localStorage.setItem(GEN_KEY, JSON.stringify(n)); };
  const bits = entropyBits(o);
  const level = bits >= 100 ? ['bg-ok', t('gen.excellent', 'Excellent')] : bits >= 70 ? ['bg-ok', t('str.4', 'Very strong')] : bits >= 50 ? ['bg-warn', t('str.2', 'Fair')] : ['bg-bad', t('str.1', 'Weak')];

  return (
    <Modal open={open} onClose={onClose} title={t('nav.generator', 'Password generator')}>
      <div className="rounded-2xl bg-surface-2 p-5 text-center">
        <div className="font-mono text-lg sm:text-xl break-all leading-relaxed min-h-[3.5rem] grid place-items-center"><span><Colorized value={pw} /></span></div>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted"><span className={`size-2 rounded-full ${level[0]}`} />{level[1]} · {bits} bits</div>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-outline h-9" onClick={() => setPw(generate(o))}><RefreshCw className="size-4" />{t('gen.again', 'Regenerate')}</button>
          <button className="btn-primary h-9" data-autofocus onClick={() => copyText(pw, t('f.password', 'Password'), t)}><Copy className="size-4" />{t('common.copy', 'Copy')}</button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 p-1 rounded-xl bg-surface-2 text-sm font-medium">
        {(['random', 'passphrase'] as const).map(m => (
          <button key={m} onClick={() => update({ mode: m })} className={`h-8 rounded-lg transition ${o.mode === m ? 'bg-surface shadow-sm' : 'text-muted'}`}>
            {m === 'random' ? t('gen.random', 'Random') : t('gen.passphrase', 'Passphrase')}
          </button>
        ))}
      </div>

      {o.mode === 'random' ? <div className="mt-5 space-y-4">
        <Slider label={t('gen.length', 'Length')} value={o.length} min={8} max={64} onChange={v => update({ length: v })} />
        {([['upper', 'A–Z'], ['lower', 'a–z'], ['digits', '0–9'], ['symbols', '!@#$']] as const).map(([k, l]) => (
          <Row key={k} label={l}><Switch checked={o[k]} onChange={v => update({ [k]: v } as Partial<GenOptions>)} label={l} /></Row>
        ))}
        <Row label={t('gen.ambiguous', 'Avoid look-alikes (l, 1, O, 0)')}><Switch checked={o.avoidAmbiguous} onChange={v => update({ avoidAmbiguous: v })} /></Row>
      </div> : <div className="mt-5 space-y-4">
        <Slider label={t('gen.words', 'Words')} value={o.words} min={3} max={10} onChange={v => update({ words: v })} />
        <Row label={t('gen.separator', 'Separator')}>
          <div className="flex gap-1">{['-', '.', '_', ' ', '+'].map(s => (
            <button key={s} onClick={() => update({ separator: s })} className={`size-8 rounded-lg font-mono text-sm ${o.separator === s ? 'bg-accent text-accent-fg' : 'bg-surface-2'}`}>{s === ' ' ? '␣' : s}</button>
          ))}</div>
        </Row>
        <Row label={t('gen.capitalize', 'Capitalize words')}><Switch checked={o.capitalize} onChange={v => update({ capitalize: v })} /></Row>
        <Row label={t('gen.number', 'Include a number')}><Switch checked={o.includeNumber} onChange={v => update({ includeNumber: v })} /></Row>
      </div>}
    </Modal>
  );
}
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="flex items-center justify-between gap-4 text-sm">{label}{children}</div>;
function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(v: number): void }) {
  return <div><div className="flex justify-between text-sm mb-2"><span>{label}</span><span className="font-mono text-muted">{value}</span></div>
    <input type="range" className="w-full accent-[var(--accent)]" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} /></div>;
}

// ---------- security report ----------
export function SecurityReportModal({ open, onClose, onOpen }: { open: boolean; onClose(): void; onOpen(id: string): void }) {
  const t = useT();
  const items = useVault(s => s.items);
  const logins = useMemo(() => items.filter(i => !i.deletedAt && i.type === 'login' && i.login?.password), [items]);
  const [weak, setWeak] = useState<Set<string> | null>(null);
  const [pwned, setPwned] = useState<Map<string, number> | null>(null);
  const [checking, setChecking] = useState(false);

  const reused = useMemo(() => {
    const by = new Map<string, string[]>();
    for (const i of logins) by.set(i.login!.password, [...(by.get(i.login!.password) || []), i.id]);
    return new Set([...by.values()].filter(v => v.length > 1).flat());
  }, [logins]);
  const old = useMemo(() => new Set(logins.filter(i => Date.now() - Date.parse(i.updatedAt) > 365 * 864e5).map(i => i.id)), [logins]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      const w = new Set<string>();
      for (const i of logins) if ((await strength(i.login!.password, [i.login!.username, i.name])).score < 3) w.add(i.id);
      if (live) setWeak(w);
    })();
    return () => { live = false; };
  }, [open, logins]);

  async function checkBreaches() {
    setChecking(true);
    const m = new Map<string, number>();
    const unique = [...new Set(logins.map(i => i.login!.password))];
    try {
      for (const p of unique) { const n = await pwnedCount(p); if (n) for (const i of logins) if (i.login!.password === p) m.set(i.id, n); }
      setPwned(m);
    } catch { toast.bad(t('report.hibpFail', 'Breach check is unavailable right now')); } finally { setChecking(false); }
  }

  const issues = new Set([...(weak || []), ...reused, ...(pwned?.keys() || [])]);
  const score = logins.length ? Math.round(100 * (1 - issues.size / logins.length)) : 100;
  const Group = ({ title, ids, tone, note }: { title: string; ids: Set<string> | string[]; tone: string; note: (id: string) => string }) => {
    const list = logins.filter(i => (ids instanceof Set ? ids.has(i.id) : ids.includes(i.id)));
    if (!list.length) return null;
    return <div className="mt-5">
      <div className="flex items-center gap-2 text-sm font-semibold mb-2"><span className={`size-2 rounded-full ${tone}`} />{title}<span className="text-muted font-normal">{list.length}</span></div>
      <div className="card overflow-hidden">{list.map(i => (
        <button key={i.id} onClick={() => onOpen(i.id)} className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-line last:border-0 text-left hover:bg-surface-2">
          <Avatar name={i.name} seed={hostOf(i.login?.uris?.[0]) || i.name} size={30} />
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium truncate">{i.name}</span><span className="block text-xs text-muted truncate">{note(i.id)}</span></span>
        </button>
      ))}</div>
    </div>;
  };

  return (
    <Modal open={open} onClose={onClose} wide title={t('nav.report', 'Security report')}>
      <div className="flex items-center gap-5 p-5 rounded-2xl bg-surface-2">
        <div className="relative size-20 shrink-0">
          <svg viewBox="0 0 36 36" className="size-20 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke={score >= 80 ? 'var(--ok)' : score >= 50 ? 'var(--warn)' : 'var(--bad)'} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${score * 0.974} 100`} /></svg>
          <span className="absolute inset-0 grid place-items-center text-xl font-semibold">{weak ? score : <Spinner />}</span>
        </div>
        <div>
          <div className="font-semibold flex items-center gap-2">{issues.size ? <ShieldAlert className="size-4 text-warn" /> : <ShieldCheck className="size-4 text-ok" />}
            {issues.size ? t('report.issues', '{n} passwords need attention', { n: issues.size }) : t('report.clean', 'Looking good')}</div>
          <p className="text-sm text-muted mt-1">{t('report.analyzed', 'Analyzed {n} logins on this device. Nothing was sent anywhere.', { n: logins.length })}</p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 p-4 rounded-xl border border-line">
        <ShieldAlert className="size-5 text-accent shrink-0 mt-0.5" />
        <div className="text-sm flex-1">
          <div className="font-medium">{t('report.hibpTitle', 'Check for breached passwords')}</div>
          <p className="text-muted mt-0.5">{t('report.hibpBody', 'Uses Have I Been Pwned with k-anonymity: only the first 5 characters of each password’s SHA-1 hash leave your device.')}</p>
          <button className="btn-outline h-9 mt-3" onClick={checkBreaches} disabled={checking || !logins.length}>{checking && <Spinner />}{pwned ? t('report.recheck', 'Check again') : t('report.check', 'Run check')}</button>
          {pwned && pwned.size === 0 && <p className="mt-2 text-ok text-sm flex items-center gap-1.5"><CheckCircle2 className="size-4" />{t('report.noBreach', 'None of your passwords appear in known breaches.')}</p>}
        </div>
      </div>

      {pwned && <Group title={t('report.breached', 'Exposed in data breaches')} ids={[...pwned.keys()]} tone="bg-bad" note={id => t('report.seen', 'Seen {n} times in breaches', { n: pwned.get(id)!.toLocaleString(t.lang) })} />}
      {weak && <Group title={t('report.weak', 'Weak passwords')} ids={weak} tone="bg-bad" note={() => t('report.weakNote', 'Easy to guess')} />}
      <Group title={t('report.reused', 'Reused passwords')} ids={reused} tone="bg-warn" note={() => t('report.reusedNote', 'Same password used elsewhere')} />
      <Group title={t('report.old', 'Not changed in over a year')} ids={old} tone="bg-faint" note={id => new Date(logins.find(i => i.id === id)!.updatedAt).toLocaleDateString(t.lang)} />
    </Modal>
  );
}

// ---------- import / export ----------
export function ImportExportModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT();
  const { items, folders, teams, importItems, verifyPassword } = useVault();
  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [fmt, setFmt] = useState<ImportFormat>('auto');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [needPw, setNeedPw] = useState(false);
  const [filePw, setFilePw] = useState('');
  const [preview, setPreview] = useState<ItemData[] | null>(null);
  const [target, setTarget] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [exportPw, setExportPw] = useState('');
  const [exportPw2, setExportPw2] = useState('');
  const [master, setMaster] = useState('');
  const [exportKind, setExportKind] = useState<'encrypted' | 'csv'>('encrypted');

  useEffect(() => { if (!open) { setFile(null); setPreview(null); setNeedPw(false); setFilePw(''); setMaster(''); setExportPw(''); setExportPw2(''); } }, [open]);

  async function read(f: File) {
    const text = await f.text();
    setFile({ name: f.name, text }); setPreview(null); setNeedPw(false);
    await parse(text);
  }
  async function parse(text = file?.text || '', pw?: string) {
    try { setPreview(await parseImport(text, fmt, pw)); setNeedPw(false); }
    catch (e: any) { if (e.code === 'NEED_PASSWORD') setNeedPw(true); else toast.bad(e.message); }
  }
  async function doImport() {
    if (!preview?.length) return;
    setBusy(true);
    try {
      const n = await importItems(preview, { folderId: null, teamId: target || null });
      toast.ok(t('io.imported', 'Imported {n} items', { n }));
      onClose();
    } catch (e) { toast.bad((e as Error).message); } finally { setBusy(false); }
  }
  async function doExport() {
    setBusy(true);
    try {
      await verifyPassword(master);
      const mine = items.filter(i => !i.teamId);
      const stamp = new Date().toISOString().slice(0, 10);
      if (exportKind === 'encrypted') download(`openpass-export-${stamp}.json`, await exportEncrypted(mine, folders, exportPw), 'application/json');
      else download(`openpass-export-${stamp}.csv`, exportCsv(mine), 'text/csv');
      toast.ok(t('io.exported', 'Export downloaded'));
      onClose();
    } catch (e) { toast.bad((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={t('nav.import', 'Import & export')}>
      <div className="grid grid-cols-2 p-1 rounded-xl bg-surface-2 text-sm font-medium mb-5">
        {(['import', 'export'] as const).map(k => <button key={k} onClick={() => setTab(k)} className={`h-8 rounded-lg ${tab === k ? 'bg-surface shadow-sm' : 'text-muted'}`}>
          {k === 'import' ? t('io.import', 'Import') : t('io.export', 'Export')}</button>)}
      </div>

      {tab === 'import' ? <div className="space-y-4">
        <div><label className="label">{t('io.from', 'Import from')}</label>
          <select className="input" value={fmt} onChange={e => { setFmt(e.target.value as ImportFormat); setPreview(null); }}>
            {FORMATS.map(f => <option key={f.id} value={f.id}>{f.id === 'auto' ? t('io.auto', 'Detect automatically') : f.label}</option>)}
          </select></div>
        <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed border-line hover:border-accent hover:bg-accent-soft/40 transition cursor-pointer text-center"
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) read(f); }}>
          <FileUp className="size-6 text-accent" />
          <span className="text-sm font-medium">{file ? file.name : t('io.drop', 'Drop your export file here, or click to choose')}</span>
          <span className="text-xs text-muted">{t('io.local', 'The file is read and encrypted in your browser.')}</span>
          <input type="file" accept=".csv,.json" className="hidden" onChange={e => e.target.files?.[0] && read(e.target.files[0])} />
        </label>
        {needPw && <div className="flex gap-2"><div className="flex-1"><PasswordInput value={filePw} onChange={setFilePw} placeholder={t('io.filePw', 'Export password')} autoFocus /></div>
          <button className="btn-primary" onClick={() => parse(undefined, filePw)}>{t('io.decrypt', 'Decrypt')}</button></div>}
        {preview && <>
          <div className="p-4 rounded-xl bg-surface-2 text-sm">
            <div className="font-medium">{t('io.found', 'Found {n} items', { n: preview.length })}</div>
            <div className="text-muted mt-1 truncate">{preview.slice(0, 5).map(p => p.name).join(' · ')}{preview.length > 5 ? ' …' : ''}</div>
          </div>
          <div><label className="label">{t('f.owner', 'Saved in')}</label>
            <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">{t('f.personal', 'My vault (private)')}</option>
              {teams.filter(x => x.role !== 'viewer').map(x => <option key={x.id} value={x.id}>{t('f.teamOpt', 'Team: {name}', { name: x.name })}</option>)}
            </select></div>
          <div className="flex items-start gap-2 text-xs text-warn"><AlertTriangle className="size-4 shrink-0" />{t('io.deleteAfter', 'After importing, delete the export file from your computer — it contains your passwords in plain text.')}</div>
          <button className="btn-primary w-full" disabled={busy || !preview.length} onClick={doImport}>{busy ? <Spinner /> : <Upload className="size-4" />}{t('io.importN', 'Import {n} items', { n: preview.length })}</button>
        </>}
      </div> : <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-2">
          {(['encrypted', 'csv'] as const).map(k => (
            <button key={k} onClick={() => setExportKind(k)} className={`text-left p-4 rounded-xl border transition ${exportKind === k ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}>
              <div className="text-sm font-medium">{k === 'encrypted' ? t('io.encTitle', 'Encrypted backup (.json)') : t('io.csvTitle', 'Plain CSV')}</div>
              <div className="text-xs text-muted mt-1">{k === 'encrypted' ? t('io.encBody', 'Protected by a password you choose. Re-import into any OpenPass server.') : t('io.csvBody', 'Readable by other password managers. Not encrypted — handle with care.')}</div>
            </button>
          ))}
        </div>
        {exportKind === 'encrypted' && <div className="grid sm:grid-cols-2 gap-3">
          <PasswordInput value={exportPw} onChange={setExportPw} placeholder={t('io.filePw', 'Export password')} autoComplete="new-password" />
          <PasswordInput value={exportPw2} onChange={setExportPw2} placeholder={t('io.filePw2', 'Confirm export password')} autoComplete="new-password" />
        </div>}
        <div><label className="label">{t('io.confirmMaster', 'Confirm with your master password')}</label><PasswordInput value={master} onChange={setMaster} /></div>
        <p className="text-xs text-muted">{t('io.personalOnly', 'Exports your personal items ({n}). Team items stay with the team.', { n: items.filter(i => !i.teamId && !i.deletedAt).length })}</p>
        <button className="btn-primary w-full" onClick={doExport}
          disabled={busy || !master || (exportKind === 'encrypted' && (exportPw.length < 8 || exportPw !== exportPw2))}>
          {busy ? <Spinner /> : <Download className="size-4" />}{t('io.download', 'Download export')}
        </button>
      </div>}
    </Modal>
  );
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
