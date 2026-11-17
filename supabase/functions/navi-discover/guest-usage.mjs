// The private SQL function returns aggregate booleans only, never history rows.
export function createUsageReader(database, ownerId) {
  return async (ids, candidates = []) => {
    if(!/^[0-9a-f-]{36}$/i.test(ownerId||''))return [];
    const keys=[...new Set(ids.filter(id=>/^hotpepper:[A-Za-z0-9_-]{1,80}$/.test(id)))].slice(0,100);
    if(!keys.length)return [];
    // Only server-fetched public provider identity fields; never guest-supplied store links.
    const places=candidates.filter(c=>keys.includes(c.id)&&typeof c.name==='string'&&c.name.length<=200&&Number.isFinite(c.latitude)&&Math.abs(c.latitude)<=90&&Number.isFinite(c.longitude)&&Math.abs(c.longitude)<=180).slice(0,100).map(c=>({id:c.id,name:c.name,latitude:c.latitude,longitude:c.longitude}));
    let rows;
    await database.withConnection(async client=>{
      rows=(await client.query('SELECT id, used, revisited FROM navi_internal.guest_usage($1::uuid,$2::text[],$3::jsonb)',[ownerId,keys,JSON.stringify(places)])).rows;
    });
    return rows.filter(r=>keys.includes(r.id)&&r.used===true).map(r=>({id:r.id,used:true,revisited:r.revisited===true}));
  };
}
