// Standalone connection lifetime only. No queries, transactions, or owner setting.
// Runtime adapter is injected by index.ts; use remains explicit and on demand.
export class DatabaseUnavailable extends Error {
  constructor() { super('database_unavailable'); this.name = 'DatabaseUnavailable'; }
}

function connectionOptions(readEnv) {
  const raw = readEnv('NAVI_DISCOVER_DATABASE_URL');
  const projectUrl = readEnv('SUPABASE_URL');
  if (!raw || !projectUrl) throw new DatabaseUnavailable();
  const url = new URL(raw);
  const project = new URL(projectUrl);
  const ref = /^([a-z0-9]+)\.supabase\.co$/.exec(project.hostname)?.[1];
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (!ref || project.protocol !== 'https:' || project.username || project.password ||
      project.port || project.pathname !== '/' || project.search || project.hash ||
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) ||
      url.port !== '6543' || url.pathname !== '/postgres' || url.hash ||
      user !== `navi_discover_runtime.${ref}` || !password ||
      [...url.searchParams].some(([key, value]) => key !== 'sslmode' ||
        !['require', 'verify-full'].includes(value))) throw new DatabaseUnavailable();
  // Explicit options prevent URL parameters from weakening TLS or changing roles.
  return {
    host: url.hostname, port: 6543, database: 'postgres', user, password,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 5000, query_timeout: 5000,
    application_name: 'navi-discover',
  };
}

export function createDatabaseConnection({ readEnv, createClient }) {
  return {
    async withConnection(operation = async () => {}) {
      let client;
      let failed = false;
      try {
        // Read only at explicit invocation; never at module import/startup.
        const options = connectionOptions(readEnv);
        client = await createClient(options);
        // Driver notices/errors may contain secrets. Do not log or retain details.
        client.on('error', () => { failed = true; });
        client.on('notice', () => {});
        await client.connect();
        if (!failed) await operation(client);
        // Callback values are intentionally discarded; credentials/client never escape.
      } catch {
        failed = true;
      } finally {
        if (client) {
          try { await client.end(); } catch { failed = true; }
        }
      }
      if (failed) throw new DatabaseUnavailable();
      return { ok: true };
    },
  };
}
