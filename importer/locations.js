import { normalizeStoreName } from "./records.js";
export const NEARBY_METERS = 100;
export function validGps(g) {
  return (
    !!g &&
    Number.isFinite(g.latitude) &&
    Number.isFinite(g.longitude) &&
    Math.abs(g.latitude) <= 90 &&
    Math.abs(g.longitude) <= 180
  );
}
export function distanceMeters(a, b) {
  const rad = (n) => (n * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function locationReference(row) {
  if (!validGps(row.gps) || row.excluded) return null;
  const d = row.details || {},
    p = row.provenance || {};
  if (
    d.store_id &&
    p.store_id?.state === "confirmed" &&
    p.store_id?.origin === "user"
  )
    return {
      ...row.gps,
      store_id: d.store_id,
      name: null,
      origin: "photo_exif_user_store",
    };
  if (
    d.unlinked_store_name?.trim() &&
    p.unlinked_store_name?.state === "confirmed" &&
    p.unlinked_store_name?.origin === "user"
  )
    return {
      ...row.gps,
      store_id: null,
      name: d.unlinked_store_name.trim(),
      origin: "photo_exif_user_store",
    };
  return null;
}
export function nearbyStores(row, meals, rows, stores) {
  if (!validGps(row.gps)) return [];
  const refs = meals.flatMap((m) =>
    (m.analysis || []).map((a) => a.store_location_reference),
  );
  refs.push(
    ...rows.filter((r) => r.id !== row.id && !r.saved).map(locationReference),
  );
  const found = new Map();
  for (const ref of refs) {
    if (!validGps(ref) || ref.origin !== "photo_exif_user_store") continue;
    const store = stores.find((s) => s.id === ref.store_id);
    if (ref.store_id && !store) continue;
    const name = store?.name || ref.name;
    if (!name?.trim()) continue;
    const distance = distanceMeters(row.gps, ref);
    if (distance > NEARBY_METERS) continue;
    const key = ref.store_id || "name:" + normalizeStoreName(name);
    if (!found.has(key) || found.get(key).distance > distance)
      found.set(key, { name, store_id: ref.store_id || null, distance });
  }
  return [...found.values()]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);
}
