import exifr from "../vendor/exifr.mjs";
import { inspectGps } from "./gps-diagnostics.js";
import { inferPeriod, emptyClassification } from "./domain.js";
export async function resize(file, max = 1280, quality = 0.8) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "画像を開けません。JPEG・PNG・WebPに変換して再選択してください。",
    );
  }
  try {
    if (bitmap.width * bitmap.height > 100000000)
      throw new Error("画像が大きすぎます。縮小した画像を選択してください。");
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("画像縮小に失敗しました"))),
        "image/jpeg",
        quality,
      ),
    );
  } finally {
    bitmap.close();
  }
}
export async function prepare(file, row, {keepOriginal=false}={}) {
  if (file.size > 60 * 1024 * 1024)
    throw new Error("1枚60MB以下の写真を選択してください。");
  row.fingerprint = [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  let meta = null;
  try {
    meta = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "OffsetTimeOriginal", "Orientation"],
    });
  } catch {
    /* Missing EXIF is expected for screenshots. */
  }
  let date = meta?.DateTimeOriginal || meta?.CreateDate;
  const inspected = await inspectGps(file);
  row.gps = inspected.gps;
  row.gpsDiagnostic = inspected.diagnostic;
  row.date_source = date
    ? "EXIF（時差情報なしはこの端末の時刻）"
    : file.lastModified
      ? "ファイル更新日時（要確認）"
      : "不明";
  // exifr interprets EXIF's timezone-less Date as local. Apply explicit offset if present.
  if (
    date instanceof Date &&
    /^[+-]\d{2}:\d{2}$/.test(meta?.OffsetTimeOriginal || "")
  ) {
    const pad = (n) => String(n).padStart(2, "0");
    date = new Date(
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${meta.OffsetTimeOriginal}`,
    );
    row.date_source = "EXIF（時差情報あり）";
  }
  if (!date && file.lastModified) date = new Date(file.lastModified);
  row.taken_at =
    date && !isNaN(new Date(date)) ? new Date(date).toISOString() : null;
  row.meal_period = inferPeriod(row.taken_at);
  row.orientation=meta?.Orientation??null;
  row.blob = keepOriginal ? file : await resize(file);
  row.url = URL.createObjectURL(row.blob);
  return row;
}
export function createRow(file) {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    file,
    state: "queued",
    excluded: false,
    selected: false,
    saved: false,
    classification: emptyClassification(),
    analysis: {},
    taken_at: null,
    meal_period: "不明",
    date_source: "不明",
  };
}
export async function thumbnail(blob) {
  const small = await resize(blob, 256, 0.65);
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(small);
  });
}
