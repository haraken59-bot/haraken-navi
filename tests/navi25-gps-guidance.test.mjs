import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectGps, gpsStatus, confirmPhotoDirection, directionPendingLine } from '../importer/gps-diagnostics.js';
import { gpsJpeg } from './gps-fixture.mjs';

// gpsJpeg layout (little endian): TIFF starts at byte 12 of the JPEG.
// Latitude rationals at JPEG offsets 92..115 (numerator/denominator pairs),
// longitude rationals at 116..139. Ref characters are zeroed at 48 and 72
// (the same patch points used by photo-direction.test.mjs).
const file = bytes => new File([bytes], 'synthetic.jpg', { type: 'image/jpeg' });
function patch(bytes, { refs = false, latNum = false, lonNum = false, latDen = false, lonDen = false } = {}) {
  const b = new Uint8Array(bytes);
  const v = new DataView(b.buffer);
  if (refs) { b[48] = 0; b[72] = 0; }
  if (latNum) for (const o of [92, 100, 108]) v.setUint32(o, 0, true);
  if (lonNum) for (const o of [116, 124, 132]) v.setUint32(o, 0, true);
  if (latDen) for (const o of [96, 104, 112]) v.setUint32(o, 0, true);
  if (lonDen) for (const o of [120, 128, 136]) v.setUint32(o, 0, true);
  return b;
}

test('condition 6: normal GPS photo is unchanged', async () => {
  const r = await inspectGps(file(gpsJpeg()));
  assert.deepEqual(r.gps, { latitude: 35.5, longitude: 135.25 });
  assert.equal(r.diagnostic.status, 'ok');
  assert.equal(r.diagnostic.redactionSuspected, undefined);
  assert.equal(gpsStatus({ gps: r.gps, gpsDiagnostic: r.diagnostic }), '写真GPS取得成功');
});

test('condition 2 (spec): GPS absent stays missing with the usual label', async () => {
  const r = await inspectGps(file(new Uint8Array([255, 216, 255, 217])));
  assert.equal(r.diagnostic.status, 'missing');
  assert.equal(r.diagnostic.redactionSuspected, undefined);
  assert.equal(gpsStatus({ gps: null, gpsDiagnostic: r.diagnostic }), '写真にGPS情報がありません');
});

test('condition 0: empty refs and all-zero values are the redaction signature', async () => {
  const r = await inspectGps(file(patch(gpsJpeg(), { refs: true, latNum: true, lonNum: true })));
  assert.equal(r.gps, null);
  assert.equal(r.diagnostic.status, 'redacted_suspected');
  assert.equal(r.diagnostic.redactionSuspected, true);
  assert.equal(r.diagnostic.directionPending, undefined);
  const row = { gps: null, gpsDiagnostic: r.diagnostic };
  assert.equal(gpsStatus(row), 'GPS情報が取得できません');
  assert.throws(() => confirmPhotoDirection(row, 'N', 'E'), /方角の確認では確定できません/);
});

test('condition 0 includes zeroed denominators (numerators still inspected)', async () => {
  const r = await inspectGps(file(patch(gpsJpeg(), { refs: true, latNum: true, lonNum: true, latDen: true, lonDen: true })));
  assert.equal(r.gps, null);
  assert.equal(r.diagnostic.redactionSuspected, true);
  assert.equal(r.diagnostic.status, 'redacted_suspected');
  assert.equal(r.diagnostic.directionPending, undefined);
});

test('condition 1: empty refs with real values stay direction_missing', async () => {
  const r = await inspectGps(file(patch(gpsJpeg(), { refs: true })));
  assert.equal(r.diagnostic.status, 'direction_missing');
  assert.equal(r.diagnostic.redactionSuspected, undefined);
  assert.equal(r.diagnostic.directionPending.numericValid, true);
  const line = directionPendingLine(r.diagnostic.directionPending);
  assert.match(line, /未確定の数値：緯度の大きさ 35\.5/);
  assert.match(line, /方角を選ぶと、この数値で撮影地点が確定します。/);
});

test('condition 2: numeric failure without zeroed numerators is not condition 0', async () => {
  const r = await inspectGps(file(patch(gpsJpeg(), { refs: true, latDen: true })));
  assert.equal(r.gps, null);
  assert.equal(r.diagnostic.status, 'direction_missing');
  assert.equal(r.diagnostic.redactionSuspected, undefined);
  assert.ok(r.diagnostic.directionPending);
  assert.equal(r.diagnostic.directionPending.numericValid, false);
  assert.equal(r.diagnostic.directionPending.latitude, null);
  assert.equal(r.diagnostic.directionPending.longitude, 135.25);
  assert.equal(directionPendingLine(r.diagnostic.directionPending),
    'この写真には、使える数値が記録されていません。『撮影地点・方角を確認』から、方角と数値を手入力して確定できます。');
});

test('nonzero numerators in the direct scan never become condition 0, even if parsed magnitudes are zero', async () => {
  // Parser-level values are all zero, but the raw rationals in the JPEG are
  // the real (nonzero) fixture values: the direct scan wins.
  const stub = { gps: async () => null, parse: async () => ({ GPSLatitude: [0, 0, 0], GPSLongitude: [0, 0, 0], GPSLatitudeRef: '', GPSLongitudeRef: '' }) };
  const r = await inspectGps(file(patch(gpsJpeg(), { refs: true })), stub);
  assert.equal(r.diagnostic.redactionSuspected, undefined);
  assert.equal(r.diagnostic.status, 'direction_missing');
  assert.ok(r.diagnostic.directionPending);
});

test('incomplete direct scan stays undetermined instead of condition 0', async () => {
  // No GPS IFD in the bytes at all: nothing can prove the numerators are zero.
  const stub = { gps: async () => null, parse: async () => ({ GPSLatitude: [0, 0, 0], GPSLongitude: [0, 0, 0], GPSLatitudeRef: '', GPSLongitudeRef: '' }) };
  const r = await inspectGps(file(new Uint8Array([255, 216, 255, 217])), stub);
  assert.equal(r.diagnostic.redactionSuspected, undefined);
  assert.notEqual(r.diagnostic.status, 'redacted_suspected');
});

test('boundary: only one axis zeroed is not condition 0', async () => {
  const r = await inspectGps(file(patch(gpsJpeg(), { refs: true, latNum: true })));
  assert.equal(r.diagnostic.status, 'direction_missing');
  assert.equal(r.diagnostic.redactionSuspected, undefined);
  assert.ok(r.diagnostic.directionPending);
  assert.equal(r.diagnostic.directionPending.latitude, 0);
  assert.equal(r.diagnostic.directionPending.longitude, 135.25);
});

test('condition 3: invalid status line is the replacement text', () => {
  assert.equal(gpsStatus({ gpsDiagnostic: { status: 'invalid' } }),
    'この写真のGPS数値は、そのままでは使えません。地図で撮影地点を指定するか、地点を指定せずに続行できます。');
});

test('zero coordinates cannot be confirmed from a legacy pending state', () => {
  const row = { gps: null, gpsDiagnostic: { status: 'direction_missing', directionPending: { latitude: 0, longitude: 0, confirmed: false, numericValid: true, latitudeRef: '', longitudeRef: '' } } };
  assert.throws(() => confirmPhotoDirection(row, 'N', 'E'), /方角の確認では確定できません/);
  // Explicitly typed magnitudes are the case-2 manual flow and stay possible.
  const manual = confirmPhotoDirection(
    { gps: null, gpsDiagnostic: { status: 'direction_missing', directionPending: { latitude: null, longitude: null, confirmed: false, numericValid: false, latitudeRef: '', longitudeRef: '' } } },
    'N', 'E', { latitude: 35, longitude: 135 });
  assert.deepEqual(manual.gps, { latitude: 35, longitude: 135 });
});

test('directionPendingLine handles null', () => {
  assert.equal(directionPendingLine(null), null);
  assert.equal(directionPendingLine(undefined), null);
});

test('meal-ui wiring: condition 0 guidance replaces the NAVI-22 paragraph', () => {
  const src = readFileSync(new URL('../meal-ui.js', import.meta.url), 'utf8');
  assert.match(src, /directionPendingLine\(p\.gpsDiagnostic\.directionPending\)/);
  assert.match(src, /redactionSuspected\?`<p>この写真にはGPSタグがありますが、位置情報の値を読み取れませんでした。<\/p><p>Androidの写真選択時に位置情報が保護された可能性があります。<\/p><p>写真の元データをPCから読み込む方法をお試しください。<\/p>`/);
  assert.match(src, /data-photo-map/);
  assert.match(src, /data-photo-skip/);
});
