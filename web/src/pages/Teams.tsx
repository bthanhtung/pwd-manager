import { Building2, Fingerprint, LogOut, Trash2, UserPlus } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Avatar, Confirm, Modal, Spinner, toast } from '../components/ui';
import { fingerprint } from '../crypto';
import { useT } from '../i18n';
import { ApiError, Member, Role } from '../lib/api';
import { useVault } from '../state/vault';

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export function TeamModal({ teamId, onClose, onCreated, onDeleted }: { teamId: string | null; onClose(): void; onCreated(id: string): void; onDeleted(): void }) {
  const t = useT();
  const v = useVault();
  const team = v.teams.find(x => x.id === teamId);
  const [name, setName] = useState(team?.name || '');
  const [members, setMembers] = useState<(Member & { fp: string })[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'delete' | 'leave'>(null);

  const roleLabel = (r: Role) => ({ owner: t('role.owner', 'Owner'), admin: t('role.admin', 'Admin'), editor: t('role.editor', 'Can edit'), viewer: t('role.viewer', 'Can view') })[r];
  const myRank = team ? RANK[team.role] : 3;

  async function load() {
    if (!teamId) return;
    try { const list = await v.members(teamId); setMembers(await Promise.all(list.map(async m => ({ ...m, fp: await fingerprint(m.publicKey) })))); }
    catch (e) { toast.bad((e as Error).message); }
  }
  useEffect(() => { load(); }, [teamId]);

  if (!teamId) {
    return (
      <Modal open onClose={onClose} title={t('team.new', 'New team')}>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-accent-soft text-sm mb-4">
          <Building2 className="size-5 text-accent shrink-0" />
          <p>{t('team.explain', 'A team has its own encryption key. Each member gets a copy sealed to their personal key, so the server never sees it.')}</p>
        </div>
        <form onSubmit={async e => { e.preventDefault(); setBusy(true); try { const tm = await v.createTeam(name.trim()); toast.ok(t('team.created', 'Team created')); onClose(); onCreated(tm.id); } catch (er) { toast.bad((er as Error).message); } finally { setBusy(false); } }}>
          <label className="label">{t('team.name', 'Team name')}</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Inc." maxLength={80} />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
            <button className="btn-primary" disabled={!name.trim() || busy}>{busy && <Spinner />}{t('common.create', 'Create')}</button>
          </div>
        </form>
      </Modal>
    );
  }
  if (!team) return null;

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await v.invite(team!.id, email.trim(), role); setEmail(''); toast.ok(t('team.invited', 'Added to the team')); await load(); }
    catch (er) {
      const code = er instanceof ApiError ? er.code : '';
      toast.bad(code === 'USER_NOT_FOUND' ? t('team.noUser', 'No account with that email on this server — ask them to sign up first.')
        : code === 'ALREADY_MEMBER' ? t('team.already', 'Already a member') : (er as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} wide title={<span className="flex items-center gap-2"><Building2 className="size-4 text-accent" />{team.name}</span>}>
      {myRank >= RANK.admin && (
        <form className="flex gap-2" onSubmit={async e => { e.preventDefault(); await v.renameTeam(team.id, name.trim()); toast.ok(t('item.saved', 'Saved')); }}>
          <input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
          <button className="btn-outline" disabled={!name.trim() || name === team.name}>{t('common.rename', 'Rename')}</button>
        </form>
      )}

      {myRank >= RANK.admin && (
        <form onSubmit={invite} className="mt-5 p-4 rounded-2xl bg-surface-2">
          <div className="text-sm font-medium flex items-center gap-2 mb-3"><UserPlus className="size-4" />{t('team.invite', 'Add a member')}</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input className="input flex-1" type="email" required placeholder="teammate@company.com" value={email} onChange={e => setEmail(e.target.value)} />
            <select className="input sm:w-36" value={role} onChange={e => setRole(e.target.value as Role)}>
              {(['viewer', 'editor', 'admin', 'owner'] as Role[]).filter(r => RANK[r] <= myRank).map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <button className="btn-primary" disabled={busy || !email}>{busy && <Spinner />}{t('team.add', 'Add')}</button>
          </div>
          <p className="text-xs text-muted mt-2">{t('team.inviteNote', 'They need an account on this server. The team key is sealed to their public key on your device.')}</p>
        </form>
      )}

      <div className="mt-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-faint mb-2">{t('team.members', 'Members')}{members && ` · ${members.length}`}</div>
        {!members ? <div className="py-6 grid place-items-center"><Spinner /></div> : <div className="card overflow-hidden">
          {members.map(m => {
            const me = m.id === v.profile?.id;
            const editable = !me && myRank >= RANK.admin && RANK[m.role] <= myRank;
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
                <Avatar name={m.name} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.name}{me && <span className="text-muted font-normal"> · {t('team.you', 'you')}</span>}</div>
                  <div className="text-xs text-muted truncate">{m.email}</div>
                  <div className="text-[10px] text-faint font-mono mt-0.5 flex items-center gap-1" title={t('team.fpHint', 'Compare this with what your teammate sees in Settings → Account to be sure you shared with the right person.')}>
                    <Fingerprint className="size-3" />{m.fp}</div>
                </div>
                {editable ? <select className="input h-8 w-32 text-xs" value={m.role}
                  onChange={async e => { try { await v.setRole(team.id, m.id, e.target.value as Role); await load(); } catch (er) { toast.bad((er as Error).message); } }}>
                  {(['viewer', 'editor', 'admin', 'owner'] as Role[]).filter(r => RANK[r] <= myRank).map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select> : <span className="chip">{roleLabel(m.role)}</span>}
                {editable && <button className="btn-icon" aria-label={t('team.remove', 'Remove')} onClick={async () => { try { await v.removeMember(team.id, m.id); await load(); toast.ok(t('team.removed', 'Removed')); } catch (er) { toast.bad((er as Error).message); } }}>
                  <Trash2 className="size-4" /></button>}
              </div>
            );
          })}
        </div>}
      </div>

      <div className="mt-6 pt-5 border-t border-line flex flex-wrap gap-2 justify-between">
        <button className="btn-ghost text-bad" onClick={() => setConfirm('leave')}><LogOut className="size-4" />{t('team.leave', 'Leave team')}</button>
        {team.role === 'owner' && <button className="btn-ghost text-bad" onClick={() => setConfirm('delete')}><Trash2 className="size-4" />{t('team.delete', 'Delete team')}</button>}
      </div>

      <Confirm open={confirm === 'leave'} onClose={() => setConfirm(null)} danger title={t('team.leaveTitle', 'Leave {name}?', { name: team.name })}
        body={t('team.leaveBody', 'You will lose access to this team’s items. An owner can add you back.')} confirm={t('team.leave', 'Leave team')}
        onConfirm={async () => { try { await v.leaveTeam(team.id); onClose(); onDeleted(); } catch (er) { toast.bad(er instanceof ApiError && er.code === 'LAST_OWNER' ? t('team.lastOwner', 'Make someone else an owner first.') : (er as Error).message); } }} />
      <Confirm open={confirm === 'delete'} onClose={() => setConfirm(null)} danger title={t('team.deleteTitle', 'Delete {name}?', { name: team.name })}
        body={t('team.deleteBody', 'Every item in this team is permanently deleted for all members.')} confirm={t('team.delete', 'Delete team')}
        onConfirm={async () => { await v.deleteTeam(team.id); onClose(); onDeleted(); toast.ok(t('team.deleted', 'Team deleted')); }} />
    </Modal>
  );
}
