// Supabase PostgREST client: no session persistence, writes, or privileged keys.
export function createDatabaseClient({ url, key }, fetcher = fetch) {
  return async function query(resource, params = {}) {
    if (!url || !key) throw new Error('SETUP_REQUIRED');
    const endpoint = new URL(`${url}/rest/v1/${resource}`);
    endpoint.search = new URLSearchParams(params);
    const headers = { apikey: key, Accept: 'application/json' };
    if (!key.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${key}`;
    const response = await fetcher(endpoint, { headers, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('DATABASE_UNAVAILABLE');
    return response.json();
  };
}
