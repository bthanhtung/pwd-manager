import { CreditCard, FileText, IdCard, KeyRound, Plus, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Modal, PasswordInput, Spinner, StrengthMeter, toast } from '../components/ui';
import { useT } from '../i18n';
import { ApiError } from '../lib/api';
import { DEFAULT_GEN, generate } from '../lib/generator';
import { parseTotp } from '../lib/totp';
import { emptyItem, Item, ItemData, ItemType } from '../lib/types';
import { useVault } from '../state/vault';
import { typeLabel } from './Vault';

const ICON: Record<ItemType, ReactNode> = { login: <KeyRound className="size-4" />, card: <CreditCard className="size-4" />, note: <FileText className="size-4" />, identity: <IdCard className="size-4" /> };

export function ItemEditor({ open, item, initialType, defaultFolder, defaultTeam, onClose, onSaved }: {
  open: boolean; item: Item | null; initialType: ItemType; defaultFolder: string | null; defaultTeam: string | null; onClose(): void; onSaved(i: Item): void;
}) {
  const t = useT();
  const { folders, teams, saveItem } = useVault();
  const writableTeams = teams.filter(x => x.role !== 'viewer');
  const [d, setD] = useState<ItemData>(() => item ? structuredClone(stripMeta(item)) : emptyItem(initialType));
  const [folderId, setFolderId] = useState<string | null>(item ? item.folderId : defaultFolder);
  const [teamId, setTeamId] = useState<string | null>(item ? item.teamId : writableTeams.some(x => x.id === defaultTeam) ? defaultTeam : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setD(item ? structuredClone(stripMeta(item)) : emptyItem(initialType));
    setFolderId(item ? item.folderId : defaultFolder);
  }, [open, item?.id]);

  const set = <K extends keyof ItemData>(k: K, v: ItemData[K]) => setD(p => ({ ...p, [k]: v }));
  const setLogin = (patch: Partial<NonNullable<ItemData['login']>>) => setD(p => ({ ...p, login: { ...p.login!, ...patch } }));
  const setCard = (patch: Partial<NonNullable<ItemData['card']>>) => setD(p => ({ ...p, card: { ...p.card!, ...patch } }));
  const setId = (patch: Partial<NonNullable<ItemData['identity']>>) => setD(p => ({ ...p, identity: { ...p.identity!, ...patch } }));

  function changeType(ty: ItemType) {
    const fresh = emptyItem(ty);
    setD(p => ({ ...fresh, name: p.name, notes: p.notes, fields: p.fields, favorite: p.favorite }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const out = structuredClone(d);
    out.name = out.name.trim() || (out.login?.uris?.[0] ? out.login.uris[0] : typeLabel(out.type, t));
    if (out.login) {
      out.login.uris = out.login.uris.map(u => u.trim()).filter(Boolean);
      if (out.login.totp && !parseTotp(out.login.totp)) { toast.bad(t('item.badTotp', 'Invalid secret')); return; }
      const old = item?.login?.password;
      if (old && old !== out.login.password) out.passwordHistory = [...(item?.passwordHistory || []), { password: old, changedAt: new Date().toISOString() }].slice(-10);
    }
    out.fields = (out.fields || []).filter(f => f.name || f.value);
    setBusy(true);
    try {
      const saved = await saveItem(out, { id: item?.id, folderId: teamId ? null : folderId, teamId });
      toast.ok(item ? t('item.saved', 'Saved') : t('item.added', 'Added to your vault'));
      onSaved(saved);
    } catch (er) {
      toast.bad(er instanceof ApiError && er.code === 'STALE' ? t('item.stale', 'This item changed on another device — reloaded the latest version') : (er as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={item ? t('item.edit', 'Edit item') : t('item.new', 'New item')} footer={<>
      <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
      <button type="submit" form="item-form" className="btn-primary min-w-28" disabled={busy}>{busy && <Spinner />}{t('common.save', 'Save')}</button>
    </>}>
      <form id="item-form" onSubmit={submit} className="space-y-5">
        {!item && (
          <div className="grid grid-cols-4 gap-2">
            {(['login', 'card', 'identity', 'note'] as ItemType[]).map(ty => (
              <button type="button" key={ty} onClick={() => changeType(ty)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition ${d.type === ty ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg hover:bg-surface-2'}`}>
                {ICON[ty]}{typeLabel(ty, t)}
              </button>
            ))}
          </div>
        )}

        <F label={t('f.title', 'Name')}><input className="input" value={d.name} onChange={e => set('name', e.target.value)} placeholder={d.type === 'login' ? 'GitHub' : ''} autoFocus maxLength={200} /></F>

        {d.type === 'login' && d.login && <>
          <div className="grid sm:grid-cols-2 gap-4">
            <F label={t('f.username', 'Username')}><input className="input" value={d.login.username} onChange={e => setLogin({ username: e.target.value })} autoComplete="off" spellCheck={false} /></F>
            <F label={t('f.password', 'Password')}>
              <div className="flex gap-2">
                <div className="flex-1"><PasswordInput value={d.login.password} onChange={v => setLogin({ password: v })} autoComplete="new-password" /></div>
                <button type="button" className="btn-outline px-3" title={t('nav.generator', 'Password generator')} onClick={() => setLogin({ password: generate(DEFAULT_GEN) })}><Wand2 className="size-4" /></button>
              </div>
              {d.login.password && <StrengthMeter password={d.login.password} inputs={[d.login.username, d.name]} />}
            </F>
          </div>
          <F label={t('f.websites', 'Websites')}>
            <div className="space-y-2">
              {d.login.uris.map((u, k) => (
                <div key={k} className="flex gap-2">
                  <input className="input" value={u} placeholder="https://example.com" inputMode="url" spellCheck={false}
                    onChange={e => setLogin({ uris: d.login!.uris.map((x, j) => (j === k ? e.target.value : x)) })} />
                  {d.login!.uris.length > 1 && <button type="button" className="btn-icon h-10 w-10" onClick={() => setLogin({ uris: d.login!.uris.filter((_, j) => j !== k) })} aria-label="Remove"><Trash2 className="size-4" /></button>}
                </div>
              ))}
              <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => setLogin({ uris: [...d.login!.uris, ''] })}>+ {t('f.addWebsite', 'Add website')}</button>
            </div>
          </F>
          <F label={t('f.totpSecret', 'Authenticator key (TOTP)')} hint={t('f.totpHint', 'Paste the setup key or otpauth:// link — OpenPass shows the 6-digit codes for you.')}>
            <input className="input font-mono" value={d.login.totp || ''} onChange={e => setLogin({ totp: e.target.value })} spellCheck={false} placeholder="JBSW Y3DP EHPK 3PXP" />
          </F>
        </>}

        {d.type === 'card' && d.card && <div className="grid sm:grid-cols-2 gap-4">
          <F label={t('f.holder', 'Cardholder')}><input className="input" value={d.card.holder} onChange={e => setCard({ holder: e.target.value })} autoComplete="off" /></F>
          <F label={t('f.number', 'Number')}><input className="input font-mono" inputMode="numeric" value={d.card.number} autoComplete="off"
            onChange={e => setCard({ number: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) })} /></F>
          <div className="grid grid-cols-2 gap-2">
            <F label={t('f.month', 'Month')}><input className="input font-mono" inputMode="numeric" placeholder="MM" maxLength={2} value={d.card.expMonth} onChange={e => setCard({ expMonth: e.target.value.replace(/\D/g, '') })} /></F>
            <F label={t('f.year', 'Year')}><input className="input font-mono" inputMode="numeric" placeholder="YYYY" maxLength={4} value={d.card.expYear} onChange={e => setCard({ expYear: e.target.value.replace(/\D/g, '') })} /></F>
          </div>
          <F label={t('f.cvv', 'Security code')}><PasswordInput value={d.card.cvv} onChange={v => setCard({ cvv: v.replace(/\D/g, '').slice(0, 4) })} autoComplete="off" /></F>
        </div>}

        {d.type === 'identity' && d.identity && <div className="grid sm:grid-cols-2 gap-4">
          <F label={t('f.first', 'First name')}><input className="input" value={d.identity.firstName} onChange={e => setId({ firstName: e.target.value })} /></F>
          <F label={t('f.last', 'Last name')}><input className="input" value={d.identity.lastName} onChange={e => setId({ lastName: e.target.value })} /></F>
          <F label={t('f.email', 'Email')}><input className="input" type="email" value={d.identity.email} onChange={e => setId({ email: e.target.value })} /></F>
          <F label={t('f.phone', 'Phone')}><input className="input" type="tel" value={d.identity.phone} onChange={e => setId({ phone: e.target.value })} /></F>
          <F label={t('f.company', 'Company')}><input className="input" value={d.identity.company} onChange={e => setId({ company: e.target.value })} /></F>
          <F label={t('f.address', 'Address')}><input className="input" value={d.identity.address} onChange={e => setId({ address: e.target.value })} /></F>
        </div>}

        <F label={t('f.notes', 'Notes')}><textarea className="input h-auto min-h-24 py-2.5 resize-y" rows={d.type === 'note' ? 8 : 3} value={d.notes || ''} onChange={e => set('notes', e.target.value)} /></F>

        <F label={t('f.custom', 'Custom fields')}>
          <div className="space-y-2">
            {(d.fields || []).map((f, k) => (
              <div key={k} className="flex gap-2">
                <input className="input w-1/3" placeholder={t('f.fieldName', 'Label')} value={f.name} onChange={e => set('fields', d.fields!.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)))} />
                <div className="flex-1">{f.hidden
                  ? <PasswordInput value={f.value} onChange={v => set('fields', d.fields!.map((x, j) => (j === k ? { ...x, value: v } : x)))} autoComplete="off" />
                  : <input className="input" value={f.value} onChange={e => set('fields', d.fields!.map((x, j) => (j === k ? { ...x, value: e.target.value } : x)))} />}</div>
                <button type="button" className="btn-icon h-10 w-10" onClick={() => set('fields', d.fields!.filter((_, j) => j !== k))} aria-label="Remove"><Trash2 className="size-4" /></button>
              </div>
            ))}
            <div className="flex gap-3">
              <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => set('fields', [...(d.fields || []), { name: '', value: '', hidden: false }])}><Plus className="inline size-3" /> {t('f.addText', 'Text field')}</button>
              <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => set('fields', [...(d.fields || []), { name: '', value: '', hidden: true }])}><Plus className="inline size-3" /> {t('f.addHidden', 'Hidden field')}</button>
            </div>
          </div>
        </F>

        <div className="grid sm:grid-cols-2 gap-4 pt-1">
          <F label={t('f.owner', 'Saved in')}>
            <select className="input" value={teamId || ''} onChange={e => setTeamId(e.target.value || null)}>
              <option value="">{t('f.personal', 'My vault (private)')}</option>
              {writableTeams.map(x => <option key={x.id} value={x.id}>{t('f.teamOpt', 'Team: {name}', { name: x.name })}</option>)}
            </select>
          </F>
          {!teamId && <F label={t('f.folder', 'Folder')}>
            <select className="input" value={folderId || ''} onChange={e => setFolderId(e.target.value || null)}>
              <option value="">{t('f.noFolder', 'No folder')}</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </F>}
        </div>
        {item && item.teamId !== teamId && <p className="text-xs text-warn flex items-center gap-1.5"><RefreshCw className="size-3" />{t('item.moveNote', 'Moving re-encrypts the item with the destination key.')}</p>}

      </form>
    </Modal>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div><label className="label">{label}</label>{children}{hint && <p className="text-xs text-faint mt-1.5">{hint}</p>}</div>;
}

function stripMeta(i: Item): ItemData {
  const { id: _i, teamId: _t, folderId: _f, revision: _r, deletedAt: _d, createdAt: _c, updatedAt: _u, ...rest } = i;
  if (rest.login && !rest.login.uris.length) rest.login = { ...rest.login, uris: [''] };
  return rest;
}
