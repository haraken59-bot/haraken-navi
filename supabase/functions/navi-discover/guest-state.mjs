// Read-only database access. Provider successes/cooldowns are ephemeral, never learned.
export function createGuestState(readCache, now = () => Date.now()) {
  const cache = new Map(); let lease = null, next = 0;
  return {
    async cached(key) {
      const hit = cache.get(key);
      if (hit && hit.until > now()) return hit.value;
      cache.delete(key);
      return readCache(key);
    },
    async acquire(provider, id) {
      // Uncached Nominatim requires shared write-based pacing. Do not bypass it.
      if (provider !== 'hotpepper' || now() < next || (lease && lease.until > now())) return false;
      lease = {id,until:now()+30000}; next = now()+1100; return true;
    },
    async save(key,value,ttl,provider,id) {
      if(provider!=='hotpepper'||lease?.id!==id||lease.until<=now())return false;
      if(cache.size>=30)cache.delete(cache.keys().next().value);
      cache.set(key,{value,until:now()+ttl*1000});lease=null;next=now()+1100;return true;
    },
    async finish(provider,id) {
      if(provider!=='hotpepper'||lease?.id!==id)return false;
      lease=null;next=now()+5000;return true;
    },
  };
}
