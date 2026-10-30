import {
  ArrowLeft, Building2, Copy, CreditCard, ExternalLink, FileText, Folder as FolderIcon, FolderPlus, History, IdCard, KeyRound, LayoutGrid,
  Lock, Menu, MoreHorizontal, Pencil, Plus, RefreshCw, RotateCcw, Search, Settings as SettingsIcon, ShieldAlert, Sparkles, Star, Trash2,
  Upload, Users, WifiOff, X,
} from 'lucide-react';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Colorized, Confirm, copyText, Empty, FieldRow, Logo, Modal, Spinner, toast } from '../components/ui';
import { useT } from '../i18n';
import { totpNow } from '../lib/totp';
import { cardBrand, hostOf, Item, ItemType, itemSubtitle } from '../lib/types';
import { useVault } from '../state/vault';
import { ItemEditor } from './ItemEditor';
import { SettingsModal } from './Settings';
import { TeamModal } from './Teams';
import { GeneratorModal, ImportExportModal, SecurityReportModal } from './Tools';

type View = { kind: 'all' | 'fav' | 'trash' } | { kind: 'type'; id: ItemType } | { kind: 'folder' | 'team'; id: string };
const TYPE_ICON: Record<ItemType, ReactNode> = {
  login: <KeyRound className="size-4" />, card: <CreditCard className="size-4" />, note: <FileText className="size-4" />, identity: <IdCard className="size-4" />,
};

function parseView(v: string | null): View {
  if (!v) return { kind: 'all' };
  const [kind, id] = v.split(':');
  if (kind === 'fav' || kind === 'trash') return { kind };
  if ((kind === 'type' || kind === 'folder' || kind === 'team') && id) return { kind, id } as View;
  return { kind: 'all' };
}
const viewKey = (v: View) => ('id' in v ? `${v.kind}:${v.id}` : v.kind);

export default function Vault() {
  const t = useT();
  const { items, folders, teams, profile, offline, syncing, sync, lock, undecryptable } = useVault();
  const [params, setParams] = useSearchParams();
  const view = parseView(params.get('v'));
  const selectedId = params.get('i');
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<null | 'new' | 'edit' | 'gen' | 'report' | 'import' | 'settings' | 'folder' | { team: string | null }>(null);
  const [newType, setNewType] = useState<ItemType>('login');
  const searchRef = useRef<HTMLInputElement>(null);

  const go = useCallback((v: View, i?: string | null) => {
    const p = new URLSearchParams();
    if (viewKey(v) !== 'all') p.set('v', viewKey(v));
    if (i) p.set('i', i);
    setParams(p);
    setMenu(false);
  }, [setParams]);
  const select = (id: string | null) => go(view, id);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter(i => (view.kind === 'trash' ? !!i.deletedAt : !i.deletedAt))
      .filter(i => {
        switch (view.kind) {
          case 'fav': return i.favorite;
          case 'type': return i.type === view.id;
          case 'folder': return i.folderId === view.id;
          case 'team': return i.teamId === view.id;
          default: return true;
        }
      })
      .filter(i => !needle || [i.name, i.login?.username, ...(i.login?.uris || []), i.notes, i.card?.holder, i.identity?.email]
        .some(s => s?.toLowerCase().includes(needle)))
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || a.name.localeCompare(b.name));
  }, [items, view.kind, 'id' in view ? view.id : '', q]);

  const selected = items.find(i => i.id === selectedId) || null;
  const counts = useMemo(() => {
    const live = items.filter(i => !i.deletedAt);
    return {
      all: live.length, fav: live.filter(i => i.favorite).length, trash: items.length - live.length,
      type: (ty: ItemType) => live.filter(i => i.type === ty).length,
      folder: (id: string) => live.filter(i => i.folderId === id).length,
      team: (id: string) => live.filter(i => i.teamId === id).length,
    };
  }, [items]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); return; }
      if (typing || modal || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'n') { e.preventDefault(); setNewType('login'); setModal('new'); }
      if (e.key === 'g') { e.preventDefault(); setModal('gen'); }
      if (e.key === 'l') lock();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = visible.findIndex(i => i.id === selectedId);
        const next = visible[Math.max(0, Math.min(visible.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (next) select(next.id);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [modal, visible, selectedId]);

  const title = view.kind === 'all' ? t('nav.all', 'All items') : view.kind === 'fav' ? t('nav.fav', 'Favorites') : view.kind === 'trash' ? t('nav.trash', 'Trash')
    : view.kind === 'type' ? typeLabel(view.id, t) : view.kind === 'folder' ? folders.find(f => f.id === view.id)?.name ?? '' : teams.find(x => x.id === ('id' in view ? view.id : ''))?.name ?? '';
  const currentTeam = view.kind === 'team' ? teams.find(x => x.id === view.id) : undefined;
  const canCreateHere = !currentTeam || currentTeam.role !== 'viewer';

  const NavItem = ({ v, icon, label, count }: { v: View; icon: ReactNode; label: string; count?: number }) => (
    <button onClick={() => go(v)} className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm transition ${viewKey(v) === viewKey(view) ? 'bg-accent-soft text-accent font-medium' : 'text-muted hover:text-fg hover:bg-surface-2'}`}>
      <span className="shrink-0">{icon}</span><span className="truncate flex-1 text-left">{label}</span>
      {!!count && <span className="text-[11px] tabular-nums text-faint">{count}</span>}
    </button>
  );

  const sidebar = (
    <aside className="h-full w-[264px] shrink-0 flex flex-col bg-surface border-r border-line">
      <div className="h-14 px-4 flex items-center justify-between">
        <Logo size={26} />
        <button className="btn-icon lg:hidden" onClick={() => setMenu(false)} aria-label="Close menu"><X className="size-4" /></button>
      </div>
      <div className="px-3 pb-2">
        <button className="btn-primary w-full" onClick={() => { setNewType('login'); setModal('new'); }}><Plus className="size-4" />{t('item.new', 'New item')}</button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        <div className="space-y-0.5">
          <NavItem v={{ kind: 'all' }} icon={<LayoutGrid className="size-4" />} label={t('nav.all', 'All items')} count={counts.all} />
          <NavItem v={{ kind: 'fav' }} icon={<Star className="size-4" />} label={t('nav.fav', 'Favorites')} count={counts.fav} />
          {(['login', 'card', 'identity', 'note'] as ItemType[]).map(ty => (
            <NavItem key={ty} v={{ kind: 'type', id: ty }} icon={TYPE_ICON[ty]} label={typeLabel(ty, t, true)} count={counts.type(ty)} />
          ))}
        </div>
        <Section title={t('nav.folders', 'Folders')} action={<button className="btn-icon size-6" onClick={() => setModal('folder')} aria-label={t('folder.new', 'New folder')}><FolderPlus className="size-3.5" /></button>}>
          {folders.length === 0 && <p className="px-2.5 text-xs text-faint">{t('folder.none', 'No folders yet')}</p>}
          {folders.map(f => <NavItem key={f.id} v={{ kind: 'folder', id: f.id }} icon={<FolderIcon className="size-4" />} label={f.name} count={counts.folder(f.id)} />)}
        </Section>
        <Section title={t('nav.teams', 'Teams')} action={<button className="btn-icon size-6" onClick={() => setModal({ team: null })} aria-label={t('team.new', 'New team')}><Plus className="size-3.5" /></button>}>
          {teams.length === 0 && <button className="px-2.5 text-xs text-faint hover:text-accent text-left" onClick={() => setModal({ team: null })}>{t('team.cta', 'Share passwords with your team →')}</button>}
          {teams.map(tm => <NavItem key={tm.id} v={{ kind: 'team', id: tm.id }} icon={<Building2 className="size-4" />} label={tm.name} count={counts.team(tm.id)} />)}
        </Section>
        <Section title={t('nav.tools', 'Tools')}>
          <ToolButton icon={<Sparkles className="size-4" />} label={t('nav.generator', 'Password generator')} onClick={() => setModal('gen')} kbd="G" />
          <ToolButton icon={<ShieldAlert className="size-4" />} label={t('nav.report', 'Security report')} onClick={() => setModal('report')} />
          <ToolButton icon={<Upload className="size-4" />} label={t('nav.import', 'Import & export')} onClick={() => setModal('import')} />
          <NavItem v={{ kind: 'trash' }} icon={<Trash2 className="size-4" />} label={t('nav.trash', 'Trash')} count={counts.trash} />
        </Section>
      </nav>
      <div className="p-3 border-t border-line flex items-center gap-2">
        <button className="flex-1 min-w-0 flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-surface-2 text-left" onClick={() => setModal('settings')}>
          <Avatar name={profile?.name || '?'} size={30} />
          <span className="min-w-0"><span className="block text-sm font-medium truncate">{profile?.name}</span><span className="block text-[11px] text-muted truncate">{profile?.email}</span></span>
        </button>
        <button className="btn-icon" onClick={() => setModal('settings')} aria-label={t('nav.settings', 'Settings')}><SettingsIcon className="size-4" /></button>
        <button className="btn-icon" onClick={lock} aria-label={t('nav.lock', 'Lock')} title={`${t('nav.lock', 'Lock')} (L)`}><Lock className="size-4" /></button>
      </div>
    </aside>
  );

  return (
    <div className="h-full flex overflow-hidden">
      <div className="hidden lg:block">{sidebar}</div>
      {menu && <div className="lg:hidden fixed inset-0 z-40 flex"><div className="animate-in">{sidebar}</div><div className="flex-1 bg-black/40" onClick={() => setMenu(false)} /></div>}

      {/* list */}
      <section className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[340px] lg:w-[360px] shrink-0 border-r border-line bg-bg`}>
        <div className="h-14 px-3 flex items-center gap-2 border-b border-line">
          <button className="btn-icon lg:hidden" onClick={() => setMenu(true)} aria-label="Menu"><Menu className="size-4" /></button>
          <h1 className="font-semibold truncate flex-1">{title}</h1>
          {offline && <span className="chip text-warn" title={t('vault.offline', 'Offline — changes are disabled')}><WifiOff className="size-3" />{t('vault.offlineShort', 'Offline')}</span>}
          {currentTeam && <button className="btn-icon" onClick={() => setModal({ team: currentTeam.id })} aria-label={t('team.manage', 'Manage team')}><Users className="size-4" /></button>}
          <button className="btn-icon" onClick={() => sync().catch(() => toast.bad(t('vault.syncFail', 'Sync failed')))} aria-label={t('vault.sync', 'Sync')}>
            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-3 text-faint" />
            <input ref={searchRef} className="input pl-9 pr-14" placeholder={t('vault.search', 'Search vault')} value={q} onChange={e => setQ(e.target.value)} />
            <span className="kbd absolute right-2.5 top-2.5 hidden sm:inline-flex">⌘K</span>
          </div>
        </div>
        {undecryptable > 0 && <p className="mx-3 mb-2 text-xs text-warn">{t('vault.undecryptable', '{n} items could not be decrypted on this device', { n: undecryptable })}</p>}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {visible.length === 0 ? (
            view.kind === 'trash' ? <Empty icon={<Trash2 className="size-6" />} title={t('trash.empty', 'Trash is empty')} />
              : q ? <Empty icon={<Search className="size-6" />} title={t('vault.noMatch', 'No matches')} body={t('vault.noMatchBody', 'Try a different search.')} />
              : <Empty icon={currentTeam ? <Building2 className="size-6" /> : <KeyRound className="size-6" />}
                  title={currentTeam ? t('team.emptyTitle', 'Nothing shared yet') : view.kind === 'all' ? t('vault.emptyTitle', 'Your vault is ready') : t('vault.emptyHere', 'Nothing here yet')}
                  body={currentTeam ? t('team.emptyBody', 'Items you add here are encrypted with the team key and visible to every member.') : t('vault.emptyBody', 'Add your first password, or bring everything over from another password manager.')}
                  action={canCreateHere && <div className="flex gap-2 justify-center">
                    <button className="btn-primary" onClick={() => { setNewType(view.kind === 'type' ? view.id : 'login'); setModal('new'); }}><Plus className="size-4" />{t('item.new', 'New item')}</button>
                    <button className="btn-outline" onClick={() => setModal('import')}><Upload className="size-4" />{t('nav.importShort', 'Import')}</button>
                  </div>} />
          ) : visible.map(i => (
            <button key={i.id} onClick={() => select(i.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${i.id === selectedId ? 'bg-surface shadow-[0_0_0_1px_var(--line)]' : 'hover:bg-surface/60'}`}>
              <Avatar name={i.name} seed={hostOf(i.login?.uris?.[0]) || i.name} icon={i.type !== 'login' ? TYPE_ICON[i.type] : undefined} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5"><span className="truncate text-sm font-medium">{i.name}</span>{i.favorite && <Star className="size-3 shrink-0 fill-warn text-warn" />}</span>
                <span className="block truncate text-xs text-muted">{itemSubtitle(i) || ' '}</span>
              </span>
              {i.teamId && view.kind !== 'team' && <span className="chip shrink-0 max-w-[90px] truncate"><Building2 className="size-3" />{teams.find(x => x.id === i.teamId)?.name}</span>}
            </button>
          ))}
        </div>
      </section>

      {/* detail */}
      <main className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col bg-bg`}>
        {selected ? <Detail item={selected} onBack={() => select(null)} onEdit={() => setModal('edit')} />
          : <Empty icon={<KeyRound className="size-6" />} title={t('vault.pick', 'Select an item')} body={t('vault.pickBody', 'Shortcuts: N new · G generator · / search · L lock')} />}
      </main>

      {(modal === 'new' || modal === 'edit') && <ItemEditor open item={modal === 'edit' ? selected : null} initialType={newType}
        defaultFolder={view.kind === 'folder' ? view.id : null} defaultTeam={view.kind === 'team' ? view.id : null}
        onClose={() => setModal(null)} onSaved={it => { setModal(null); go(view, it.id); }} />}
      <GeneratorModal open={modal === 'gen'} onClose={() => setModal(null)} />
      <SecurityReportModal open={modal === 'report'} onClose={() => setModal(null)} onOpen={id => { setModal(null); go({ kind: 'all' }, id); }} />
      <ImportExportModal open={modal === 'import'} onClose={() => setModal(null)} />
      <SettingsModal open={modal === 'settings'} onClose={() => setModal(null)} />
      <FolderModal open={modal === 'folder'} onClose={() => setModal(null)} onCreated={id => go({ kind: 'folder', id })} />
      {modal && typeof modal === 'object' && <TeamModal teamId={modal.team} onClose={() => setModal(null)} onCreated={id => go({ kind: 'team', id })} onDeleted={() => go({ kind: 'all' })} />}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between px-2.5 mb-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{title}</span>{action}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
const ToolButton = ({ icon, label, onClick, kbd }: { icon: ReactNode; label: string; onClick(): void; kbd?: string }) => (
  <button onClick={onClick} className="w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm text-muted hover:text-fg hover:bg-surface-2 transition">
    {icon}<span className="flex-1 text-left truncate">{label}</span>{kbd && <span className="kbd">{kbd}</span>}
  </button>
);

export function typeLabel(ty: ItemType, t: ReturnType<typeof useT>, plural = false) {
  const m = plural
    ? { login: t('type.logins', 'Logins'), card: t('type.cards', 'Cards'), note: t('type.notes', 'Secure notes'), identity: t('type.identities', 'Identities') }
    : { login: t('type.login', 'Login'), card: t('type.card', 'Card'), note: t('type.note', 'Secure note'), identity: t('type.identity', 'Identity') };
  return m[ty];
}

// ---------- detail pane ----------
function Detail({ item, onBack, onEdit }: { item: Item; onBack(): void; onEdit(): void }) {
  const t = useT();
  const { teams, folders, trash, restore, purge, toggleFavorite, offline } = useVault();
  const [more, setMore] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [history, setHistory] = useState(false);
  const team = teams.find(x => x.id === item.teamId);
  const readOnly = offline || team?.role === 'viewer';
  const host = hostOf(item.login?.uris?.[0]);
  const run = (f: () => Promise<void>, ok: string) => f().then(() => toast.ok(ok)).catch(e => toast.bad(e.message));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-14 px-3 md:px-6 flex items-center gap-2 border-b border-line sticky top-0 bg-bg/85 backdrop-blur z-10">
        <button className="btn-icon md:hidden" onClick={onBack} aria-label="Back"><ArrowLeft className="size-4" /></button>
        <div className="flex-1" />
        {item.deletedAt ? <>
          <button className="btn-outline h-9" disabled={readOnly} onClick={() => run(() => restore(item.id), t('item.restored', 'Restored'))}><RotateCcw className="size-4" />{t('item.restore', 'Restore')}</button>
          <button className="btn-ghost h-9 text-bad" disabled={readOnly} onClick={() => setConfirmPurge(true)}><Trash2 className="size-4" />{t('item.purge', 'Delete forever')}</button>
        </> : <>
          <button className="btn-icon" disabled={readOnly} onClick={() => toggleFavorite(item.id)} aria-label={t('item.favorite', 'Favorite')}>
            <Star className={`size-4 ${item.favorite ? 'fill-warn text-warn' : ''}`} />
          </button>
          <button className="btn-outline h-9" disabled={readOnly} onClick={onEdit}><Pencil className="size-4" />{t('common.edit', 'Edit')}</button>
          <div className="relative">
            <button className="btn-icon" onClick={() => setMore(m => !m)} aria-label="More"><MoreHorizontal className="size-4" /></button>
            {more && <div className="absolute right-0 mt-1 w-48 card shadow-pop p-1 animate-in z-20" onMouseLeave={() => setMore(false)}>
              {!!item.passwordHistory?.length && <button className="w-full flex items-center gap-2 h-9 px-2.5 rounded-lg text-sm hover:bg-surface-2" onClick={() => { setHistory(true); setMore(false); }}>
                <History className="size-4" />{t('item.history', 'Password history')}</button>}
              <button className="w-full flex items-center gap-2 h-9 px-2.5 rounded-lg text-sm text-bad hover:bg-surface-2 disabled:opacity-50" disabled={readOnly}
                onClick={() => { setMore(false); run(() => trash(item.id), t('item.trashed', 'Moved to trash')); }}>
                <Trash2 className="size-4" />{t('item.trash', 'Move to trash')}</button>
            </div>}
          </div>
        </>}
      </div>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-10 animate-up" key={item.id}>
        <div className="flex items-center gap-4 mb-6">
          <Avatar name={item.name} seed={host || item.name} size={56} icon={item.type !== 'login' ? TYPE_ICON[item.type] : undefined} />
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight truncate">{item.name}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="chip">{TYPE_ICON[item.type]}{typeLabel(item.type, t)}</span>
              {team && <span className="chip"><Building2 className="size-3" />{team.name}</span>}
              {item.folderId && <span className="chip"><FolderIcon className="size-3" />{folders.find(f => f.id === item.folderId)?.name}</span>}
              {item.type === 'card' && cardBrand(item.card?.number || '') && <span className="chip">{cardBrand(item.card!.number)}</span>}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          {item.type === 'login' && <>
            <FieldRow label={t('f.username', 'Username')} value={item.login?.username || ''} />
            <FieldRow label={t('f.password', 'Password')} value={item.login?.password || ''} secret />
            {item.login?.totp && <TotpRow secret={item.login.totp} />}
            {(item.login?.uris || []).filter(Boolean).map((u, k) => (
              <FieldRow key={k} label={k ? `${t('f.website', 'Website')} ${k + 1}` : t('f.website', 'Website')} value={u}
                href={/^[a-z]+:\/\//i.test(u) ? u : `https://${u}`} />
            ))}
          </>}
          {item.type === 'card' && <>
            <FieldRow label={t('f.holder', 'Cardholder')} value={item.card?.holder || ''} />
            <FieldRow label={t('f.number', 'Number')} value={item.card?.number || ''} secret />
            <FieldRow label={t('f.expiry', 'Expiry')} value={[item.card?.expMonth, item.card?.expYear].filter(Boolean).join(' / ')} mono />
            <FieldRow label={t('f.cvv', 'Security code')} value={item.card?.cvv || ''} secret />
          </>}
          {item.type === 'identity' && <>
            <FieldRow label={t('f.fullName', 'Full name')} value={[item.identity?.firstName, item.identity?.lastName].filter(Boolean).join(' ')} />
            <FieldRow label={t('f.email', 'Email')} value={item.identity?.email || ''} />
            <FieldRow label={t('f.phone', 'Phone')} value={item.identity?.phone || ''} />
            <FieldRow label={t('f.company', 'Company')} value={item.identity?.company || ''} />
            <FieldRow label={t('f.address', 'Address')} value={item.identity?.address || ''} />
          </>}
          {(item.fields || []).map((f, k) => <FieldRow key={`f${k}`} label={f.name || t('f.field', 'Field')} value={f.value} secret={f.hidden} />)}
          {item.type === 'note' && !item.notes && <p className="p-4 text-sm text-faint">{t('item.emptyNote', 'This note is empty.')}</p>}
        </div>

        {item.notes && <div className="mt-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted mb-2 px-1">{t('f.notes', 'Notes')}</div>
          <div className="card p-4 text-sm whitespace-pre-wrap break-words leading-relaxed">{item.notes}</div>
        </div>}

        {item.type === 'login' && host && <a href={/^[a-z]+:\/\//i.test(item.login!.uris[0]) ? item.login!.uris[0] : `https://${item.login!.uris[0]}`}
          target="_blank" rel="noreferrer noopener" className="btn-outline mt-4 w-full"><ExternalLink className="size-4" />{t('item.open', 'Open {host}', { host })}</a>}

        <p className="mt-6 text-xs text-faint text-center">
          {t('item.updated', 'Updated {d}', { d: new Date(item.updatedAt).toLocaleString(t.lang) })} · {t('item.created', 'Created {d}', { d: new Date(item.createdAt).toLocaleDateString(t.lang) })}
          {item.deletedAt && <> · {t('item.deletedOn', 'In trash since {d}', { d: new Date(item.deletedAt).toLocaleDateString(t.lang) })}</>}
        </p>
      </div>

      <Confirm open={confirmPurge} onClose={() => setConfirmPurge(false)} danger title={t('item.purgeTitle', 'Delete forever?')}
        body={t('item.purgeBody', '“{name}” will be permanently deleted. This cannot be undone.', { name: item.name })} confirm={t('item.purge', 'Delete forever')}
        onConfirm={async () => { await purge(item.id); onBack(); toast.ok(t('item.purged', 'Deleted')); }} />
      <Modal open={history} onClose={() => setHistory(false)} title={t('item.history', 'Password history')}>
        <div className="card overflow-hidden">
          {[...(item.passwordHistory || [])].reverse().map((h, k) => (
            <div key={k} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
              <div className="flex-1 min-w-0"><div className="font-mono text-sm break-all"><Colorized value={h.password} /></div>
                <div className="text-xs text-muted mt-0.5">{new Date(h.changedAt).toLocaleString(t.lang)}</div></div>
              <button className="btn-icon" onClick={() => copyText(h.password, t('f.password', 'Password'), t)} aria-label="Copy"><Copy className="size-4" /></button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function TotpRow({ secret }: { secret: string }) {
  const t = useT();
  const [now, setNow] = useState(() => totpNow(secret));
  useEffect(() => { const id = setInterval(() => setNow(totpNow(secret)), 1000); return () => clearInterval(id); }, [secret]);
  if (!now) return <FieldRow label={t('f.totp', 'One-time code')} value={t('item.badTotp', 'Invalid secret')} />;
  const pct = (now.remaining / now.period) * 100;
  return (
    <FieldRow label={t('f.totp', 'One-time code')} value={`${now.code.slice(0, 3)} ${now.code.slice(3)}`} mono
      extra={<div className="mt-2 flex items-center gap-2">
        <div className="h-1 w-24 rounded-full bg-surface-2 overflow-hidden"><div className={`h-full transition-all duration-1000 ease-linear ${now.remaining <= 5 ? 'bg-bad' : 'bg-accent'}`} style={{ width: `${pct}%` }} /></div>
        <span className="text-[11px] tabular-nums text-muted">{now.remaining}s</span>
      </div>} />
  );
}

function FolderModal({ open, onClose, onCreated }: { open: boolean; onClose(): void; onCreated(id: string): void }) {
  const t = useT();
  const createFolder = useVault(s => s.createFolder);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setName(''); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title={t('folder.new', 'New folder')}>
      <form onSubmit={async e => { e.preventDefault(); setBusy(true); try { const f = await createFolder(name.trim()); onClose(); onCreated(f.id); } catch (er) { toast.bad((er as Error).message); } finally { setBusy(false); } }}>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={t('folder.name', 'Folder name')} maxLength={80} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
          <button className="btn-primary" disabled={!name.trim() || busy}>{busy && <Spinner />}{t('common.create', 'Create')}</button>
        </div>
      </form>
    </Modal>
  );
}
