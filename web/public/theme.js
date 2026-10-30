// Applies the saved theme before first paint (kept external so the CSP can forbid inline scripts).
try { var p = JSON.parse(localStorage.getItem('op_prefs') || '{}'); var t = p.theme || 'system';
  if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); } catch (e) {}
