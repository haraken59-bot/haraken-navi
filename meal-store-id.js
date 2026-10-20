import {normalizeStoreName} from './importer/records.js';

// Use only a UUID that is already present in the loaded store master.
// A recommendation name or GPS position alone never creates a store link.
export function resolveMealStoreId(stores, selectedId, actualName, latestChoice) {
 const uuid=id=>typeof id==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
 const name=normalizeStoreName(actualName);if(!name)return null;
 stores=(Array.isArray(stores)?stores:[]).filter(s=>uuid(s.id));
 const selected=stores.find(s=>s.id===selectedId&&normalizeStoreName(s.name)===name);
 if(selected)return selected.id;
 const recommended=stores.find(s=>s.id===latestChoice?.store_id&&normalizeStoreName(s.name)===name);
 return recommended?.id||null;
}
