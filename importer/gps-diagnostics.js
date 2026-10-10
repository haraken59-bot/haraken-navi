import exifr from '../vendor/exifr.mjs';
import { validGps } from './locations.js';
export function coordinate(value, ref, axis) {
  const direction = typeof ref === 'string' ? ref.replace(/\0/g, '').trim().toUpperCase() : '';
  if (!(axis === 'lat' ? ['N','S'] : ['E','W']).includes(direction)) return null;
  let degrees;
  if (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) {
    const [d,m,s] = value;
    if (d < 0 || m < 0 || m >= 60 || s < 0 || s >= 60) return null;
    degrees = d + m/60 + s/3600;
  } else if (typeof value === 'number' && Number.isFinite(value) && value >= 0) degrees = value;
  else return null;
  if (degrees > (axis === 'lat' ? 90 : 180)) return null;
  return degrees * (['S','W'].includes(direction) ? -1 : 1);
}
function describe(value) {
  if (value === undefined) return 'なし';
  if (value === null) return '空(null)';
  if (Array.isArray(value)) return '[' + value.map(describe).join(', ') + ']';
  return String(value).slice(0,160);
}
export async function inspectGps(file, parser = exifr) {
  const diagnostic = { version: 'GPS診断1', input: '縮小前の元File', type: file.type || '不明', size: file.size, latitudeTag: false, longitudeTag: false, status: 'missing', error: null };
  let fast = null, tags = null, fullFailed = false;
  try { fast = await parser.gps(file); } catch { diagnostic.error = 'GPS簡易解析でエラー'; }
  try {
    // Full original bytes avoid File/Blob chunk reader differences. Never parse Canvas output.
    tags = await parser.parse(await file.arrayBuffer(), { gps: true, translateKeys: true, translateValues: true, reviveValues: true, pick: ['GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'] });
    diagnostic.latitudeTag = tags?.GPSLatitude !== undefined;
    diagnostic.longitudeTag = tags?.GPSLongitude !== undefined;
  } catch { fullFailed = true; diagnostic.error = '元ファイルのGPSタグ解析でエラー'; }
  diagnostic.raw = `緯度値: ${describe(tags?.GPSLatitude)} / 南北: ${describe(tags?.GPSLatitudeRef)} / 経度値: ${describe(tags?.GPSLongitude)} / 東西: ${describe(tags?.GPSLongitudeRef)}`;
  const converted = {latitude: coordinate(tags?.GPSLatitude, tags?.GPSLatitudeRef, 'lat'), longitude: coordinate(tags?.GPSLongitude, tags?.GPSLongitudeRef, 'lon')};
  const gps = validGps(fast) ? fast : validGps(tags) ? tags : validGps(converted) ? converted : null;
  diagnostic.status = gps ? 'ok' : fullFailed ? 'error' : diagnostic.latitudeTag || diagnostic.longitudeTag ? 'invalid' : 'missing';
  return { gps: gps ? {latitude: gps.latitude, longitude: gps.longitude} : null, diagnostic };
}
export function gpsStatus(row) {
  if (row.gps) return '写真にGPSあり';
  if (row.gpsDiagnostic?.status === 'error') return 'GPS解析に失敗しました。GPSの有無は未判定です。';
  if (row.gpsDiagnostic?.status === 'invalid') return 'GPSタグはありますが座標を取得できませんでした。';
  return '受け取った写真からGPSを検出できませんでした。元写真にないのか、選択時に除去されたのかは未判定です。';
}
