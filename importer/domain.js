import { buildRecord, confirmedRecord } from "./records.js";
import { locationReference } from "./locations.js";
export const MAX_IMPORT_IMAGES = 20;
export const GROUP_WINDOW_MS = 30 * 60 * 1000;
export const MASTER = {
  category: ["肉", "魚", "麺", "ご飯", "パン", "野菜", "その他", "不明"],
  genre: [
    "定食",
    "ラーメン",
    "うどん",
    "そば",
    "寿司",
    "焼き鳥",
    "中華",
    "カレー",
    "丼",
    "洋食",
    "居酒屋料理",
    "軽食",
    "その他",
    "不明",
  ],
  staple_food: ["ご飯", "麺", "パン", "なし", "不明"],
  ingredients: [
    "鶏",
    "豚",
    "牛",
    "魚",
    "貝",
    "海老・蟹",
    "卵",
    "豆腐",
    "野菜",
    "その他",
    "不明",
  ],
  cooking_methods: [
    "焼く",
    "揚げる",
    "煮る",
    "炒める",
    "生",
    "蒸す",
    "茹でる",
    "その他",
    "不明",
  ],
  volume_visual: ["軽め", "普通", "ガッツリ", "不明"],
  vegetable_level: ["少なめ", "普通", "多め", "不明"],
  drink_status: ["あり", "なし", "不明"],
  meal_period: ["朝", "昼", "夜", "間食", "不明"],
  review_status: ["AI推定", "確認済", "手動修正", "未確認"],
};
export const LABELS = {
  category: "大分類",
  genre: "料理ジャンル",
  staple_food: "主食",
  ingredients: "メイン食材",
  cooking_methods: "調理法",
  volume_visual: "ボリューム",
  vegetable_level: "野菜量（見た目）",
  drink_status: "飲み物",
  meal_period: "時間帯",
  review_status: "確認状態",
};
export function inferPeriod(value) {
  if (!value) return "不明";
  const h = new Date(value).getHours();
  return h >= 5 && h < 11
    ? "朝"
    : h >= 11 && h < 16
      ? "昼"
      : h >= 16
        ? "夜"
        : "不明";
}
export function emptyClassification() {
  return {
    category: "不明",
    genre: "不明",
    staple_food: "不明",
    ingredients: [],
    cooking_methods: [],
    volume_visual: "不明",
    vegetable_level: "不明",
    drink_status: "不明",
    drink_type: "",
    tags: [],
    review_status: "未確認",
    ai_confidence: null,
  };
}
// Compare with the first photo, avoiding chains spanning multiple meals.
export function groupCandidates(rows) {
  const dated = rows
    .filter((r) => r.taken_at)
    .sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at));
  const groups = [];
  for (const row of dated) {
    const last = groups.at(-1);
    if (
      last &&
      new Date(row.taken_at) - new Date(last[0].taken_at) <= GROUP_WINDOW_MS
    )
      last.push(row);
    else groups.push([row]);
  }
  return [...groups, ...rows.filter((r) => !r.taken_at).map((r) => [r])];
}
export function duplicateReasons(row, others) {
  const reasons = [];
  for (const other of others) {
    if (other.id === row.id) continue;
    if (row.fingerprint && row.fingerprint === other.fingerprint) {
      reasons.push("同じファイル");
      break;
    }
    if (
      row.taken_at &&
      other.taken_at &&
      Math.abs(new Date(row.taken_at) - new Date(other.taken_at)) <= 120000
    ) {
      reasons.push("撮影時刻が近い写真");
      break;
    }
  }
  return reasons;
}
export function summarize(
  meals,
  days = 0,
  now = Date.now(),
  confirmedOnly = false,
) {
  if (confirmedOnly)
    meals = meals
      .map(confirmedRecord)
      .filter((m) =>
        Object.values(m).some(
          (v) => v !== m.id && v !== null && (!Array.isArray(v) || v.length),
        ),
      );
  const filtered = meals.filter(
    (m) =>
      !days ||
      (m.eaten_at &&
        new Date(m.eaten_at).getTime() >= now - days * 86400000 &&
        new Date(m.eaten_at).getTime() <= now),
  );
  const counts = (key) => {
    const out = {};
    for (const m of filtered) {
      for (const v of Array.isArray(m[key]) ? m[key] : [m[key] || "不明"])
        out[v] = (out[v] || 0) + 1;
    }
    return Object.entries(out).sort((a, b) => b[1] - a[1]);
  };
  return {
    total: filtered.length,
    unknownDates: meals.filter((m) => !m.eaten_at).length,
    category: counts("category"),
    genre: counts("genre"),
    meal_period: counts("meal_period"),
    cooking_methods: counts("cooking_methods"),
  };
}
export function toMeals(rows) {
  const groups = new Map();
  for (const r of rows.filter(
    (r) => !r.excluded && r.state === "done" && !r.saved,
  )) {
    const key = r.group_id || r.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.entries()].map(([id, images]) => {
    const first = images[0];
    return buildRecord(
      {
        id,
        eaten_at: first.taken_at,
        meal_period: first.meal_period,
        ...first.classification,
        ingredients: [
          ...new Set(images.flatMap((r) => r.classification.ingredients)),
        ],
        cooking_methods: [
          ...new Set(images.flatMap((r) => r.classification.cooking_methods)),
        ],
        tags: [...new Set(images.flatMap((r) => r.classification.tags))],
        review_status: images.some(
          (r) => r.classification.review_status === "手動修正",
        )
          ? "手動修正"
          : images.every((r) => r.classification.review_status === "確認済")
            ? "確認済"
            : images.some((r) => r.classification.review_status === "未確認")
              ? "未確認"
              : "AI推定",
        images: images.map((r) => ({
          id: r.id,
          fingerprint: r.fingerprint,
          file_name: r.name,
          taken_at: r.taken_at,
          date_source: r.date_source,
          thumbnail: null,
        })),
        analysis: images.map((r) => ({
          image_id: r.id,
          ...r.analysis,
          store_location_reference: locationReference(r),
        })),
        created_at: new Date().toISOString(),
      },
      images,
    );
  });
}
