import { stageLogger } from './diagnostics.mjs';
const KEYS = new Set(['nominatim', 'hotpepper']);
const check = key => { if (!KEYS.has(key)) throw Error('invalid_control_key'); };
// Every operation is a short, independently closed connection. DB clock is authoritative.
export function createSearchState(database, log) {
  const stage = stageLogger(log);
  async function query(text, values) {
    let rows;
    try { await database.withConnection(async client => { rows = (await client.query(text, values)).rows; }); return rows; }
    catch { stage('db_state_failed'); throw Error('search_state_unavailable'); }
  }
  return {
    async acquire(key, executionId) {
      check(key);
      const rows = await query(`UPDATE navi_internal.control_state
        SET last_attempt_at=statement_timestamp(), execution_id=$2,
            lease_expires_at=statement_timestamp()+interval '30 seconds',
            next_allowed_at=statement_timestamp()+interval '1100 milliseconds'
        WHERE control_key=$1 AND next_allowed_at<=statement_timestamp()
          AND (lease_expires_at IS NULL OR lease_expires_at<=statement_timestamp())
        RETURNING execution_id`, [key, executionId]);
      return rows.length === 1;
    },
    async finish(key, executionId, success) {
      check(key);
      const rows = await query(`UPDATE navi_internal.control_state
        SET last_success_at=CASE WHEN $3 THEN statement_timestamp() ELSE last_success_at END,
            next_allowed_at=statement_timestamp()+CASE WHEN $3 THEN interval '1100 milliseconds' ELSE interval '5 seconds' END,
            execution_id=NULL, lease_expires_at=NULL
        WHERE control_key=$1 AND execution_id=$2 AND lease_expires_at>statement_timestamp()
        RETURNING control_key`, [key, executionId, success]);
      return rows.length === 1;
    },
    async cached(key) {
      const rows = await query('SELECT payload FROM navi_internal.discovery_cache WHERE cache_key=$1 AND expires_at>statement_timestamp()', [key]);
      return rows[0]?.payload ?? null;
    },
    async save(key, payload, ttlSeconds, provider, executionId) {
      check(provider);
      if (![1800,86400].includes(ttlSeconds)) throw Error('invalid_cache_ttl');
      const rows=await query(`WITH completed AS (
        UPDATE navi_internal.control_state SET last_success_at=statement_timestamp(),
          next_allowed_at=statement_timestamp()+interval '1100 milliseconds',
          execution_id=NULL,lease_expires_at=NULL
        WHERE control_key=$4 AND execution_id=$5 AND lease_expires_at>statement_timestamp()
        RETURNING control_key)
        INSERT INTO navi_internal.discovery_cache (cache_key,payload,fetched_at,expires_at)
        SELECT $1,$2::jsonb,statement_timestamp(),statement_timestamp()+$3*interval '1 second' FROM completed
        ON CONFLICT (cache_key) DO UPDATE SET payload=EXCLUDED.payload,
          fetched_at=EXCLUDED.fetched_at,expires_at=EXCLUDED.expires_at RETURNING cache_key`,
        [key,JSON.stringify(payload),ttlSeconds,provider,executionId]);
      return rows.length===1;
    },
  };
}
