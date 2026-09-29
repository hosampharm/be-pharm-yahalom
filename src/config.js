export function validateConfig(url, key) {
  if (!url && !key) return { url: '', key: '' };
  if (!url || !key) throw new Error('Both SUPABASE_URL and SUPABASE_ANON_KEY are required.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Use the HTTPS Supabase project origin.');
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      publicKey = payload.role === 'anon';
    } catch { /* invalid credential */ }
  }
  if (!publicKey) throw new Error('Only a public anon or publishable key may be bundled.');
  return { url: parsed.origin, key };
}
