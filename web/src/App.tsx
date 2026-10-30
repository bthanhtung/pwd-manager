import { ReactElement, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Logo, Spinner, Toaster } from './components/ui';
import { resolveLang } from './i18n';
import Landing from './pages/Landing';
import { Login, Signup, Unlock } from './pages/Auth';
import Vault from './pages/Vault';
import { applyTheme, usePrefs } from './state/prefs';
import { useVault } from './state/vault';

/** Locks the vault after inactivity or (optionally) when the page is hidden. */
function useAutoLock() {
  const { status, lock } = useVault();
  const { autoLockMinutes, lockOnHide } = usePrefs();
  useEffect(() => {
    if (status !== 'unlocked') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => { clearTimeout(timer); if (autoLockMinutes) timer = setTimeout(lock, autoLockMinutes * 60_000); };
    const onHide = () => { if (lockOnHide && document.visibilityState === 'hidden') lock(); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach(e => addEventListener(e, arm, { passive: true }));
    document.addEventListener('visibilitychange', onHide);
    arm();
    return () => { clearTimeout(timer); events.forEach(e => removeEventListener(e, arm)); document.removeEventListener('visibilitychange', onHide); };
  }, [status, autoLockMinutes, lockOnHide, lock]);
}

function Protected() {
  const status = useVault(s => s.status);
  const loc = useLocation();
  if (status === 'boot') return <div className="h-full grid place-items-center"><div className="flex flex-col items-center gap-4 text-muted"><Logo size={40} withText={false} /><Spinner /></div></div>;
  if (status === 'out') return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (status === 'locked') return <Unlock />;
  return <Vault />;
}

function GuestOnly({ children }: { children: ReactElement }) {
  const status = useVault(s => s.status);
  return status === 'unlocked' ? <Navigate to="/app" replace /> : children;
}

export default function App() {
  const boot = useVault(s => s.boot);
  const { theme, lang } = usePrefs();
  useEffect(() => { boot(); }, [boot]);
  useEffect(() => {
    applyTheme(theme);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme(theme);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);
  useEffect(() => { document.documentElement.lang = resolveLang(lang); }, [lang]);
  useAutoLock();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
        <Route path="/app" element={<Protected />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
