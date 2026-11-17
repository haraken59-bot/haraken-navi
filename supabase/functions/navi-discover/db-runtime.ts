import { createDatabaseConnection } from './db.mjs';

// Lazy driver import: neither importing this module nor constructing the adapter
// opens a connection. index.ts injects this adapter into the authenticated handler.
export function createRuntimeDatabaseConnection() {
  return createDatabaseConnection({
    readEnv: (name: string) => Deno.env.get(name),
    createClient: async (options: Record<string, unknown>) => {
      const { Client } = await import('npm:pg@8.16.3');
      return new Client(options);
    },
  });
}
