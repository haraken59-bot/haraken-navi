// Version 2 adds field-level provenance without replacing the legacy meal data.
export const RECORD_FIELDS = [
  "eaten_at",
  "meal_period",
  "category",
  "genre",
  "staple_food",
  "ingredients",
  "cooking_methods",
  "volume_visual",
  "vegetable_level",
  "drink_status",
  "drink_type",
  "tags",
  "store_id",
  "unlinked_store_name",
  "area",
  "dish_name",
  "amount_jpy",
  "satisfaction",
  "comment",
];
export const EXTRA_FIELDS = [
  "store_id",
  "unlinked_store_name",
  "area",
  "dish_name",
  "amount_jpy",
  "satisfaction",
  "comment",
  "source_type",
  "source_reference",
];
export const hasValue = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  value !== "不明" &&
  (!Array.isArray(value) || value.length > 0);
export function emptyDetails() {
  return {
    store_id: null,
    unlinked_store_name: null,
    area: null,
    dish_name: null,
    amount_jpy: null,
    satisfaction: null,
    comment: null,
    source_type: "past_photo",
    source_reference: null,
  };
}
export function rowValues(row) {
  return {
    eaten_at: row.taken_at,
    meal_period: row.meal_period,
    ...row.classification,
    ...emptyDetails(),
    ...row.details,
  };
}
export function provenanceFor(row, key) {
  if (row.provenance?.[key]) return row.provenance[key];
  const value = rowValues(row)[key];
  if (!hasValue(value))
    return { state: "unknown", origin: "unknown", confidence: null };
  let origin = "unknown",
    confidence = null;
  if (key === "eaten_at")
    origin = row.date_source?.startsWith("EXIF")
      ? "exif"
      : row.date_source?.startsWith("ファイル")
        ? "file_time"
        : "unknown";
  else if (key === "meal_period") origin = "time_rule";
  else if (row.analysis?.model || row.analysis?.candidates) {
    origin = "ai";
    confidence = row.analysis?.candidates?.[key]?.[0]?.score ?? null;
  }
  return { state: "estimated", origin, confidence };
}
export function confirmField(row, key) {
  row.provenance ||= {};
  row.provenance[key] = {
    state: hasValue(rowValues(row)[key]) ? "confirmed" : "unknown",
    origin: "user",
    confidence: null,
  };
}
export function confirmRow(row) {
  for (const key of RECORD_FIELDS) confirmField(row, key);
  row.classification.review_status = "確認済";
}
export function unconfirmRow(row) {
  row.provenance = Object.fromEntries(
    Object.entries(row.provenance || {}).filter(([k]) =>
      EXTRA_FIELDS.includes(k),
    ),
  );
  row.classification.review_status = Object.values(row.provenance).some(
    (p) => p.state === "confirmed",
  )
    ? "手動修正"
    : "未確認";
}
export function buildRecord(meal, images) {
  const first = images[0];
  const details = { ...emptyDetails(), ...first.details };
  // A group must not silently discard different user-entered metadata.
  for (const key of EXTRA_FIELDS.filter(
    (k) => !["source_type", "source_reference"].includes(k),
  )) {
    const values = [
      ...new Set(
        images
          .map((r) => r.details?.[key])
          .filter(hasValue)
          .map((v) => JSON.stringify(v)),
      ),
    ];
    if (values.length > 1)
      throw new Error(
        "同じ食事に異なる店舗・料理・金額などが入力されています。内容を揃えるか写真を分けてください。",
      );
    if (values.length === 1) details[key] = JSON.parse(values[0]);
  }
  Object.assign(meal, details, {
    record_version: 2,
    confirmed_values: {},
    field_provenance: {},
  });
  for (const key of RECORD_FIELDS) {
    let proof = provenanceFor(first, key);
    if (EXTRA_FIELDS.includes(key) && hasValue(meal[key])) {
      const row = images.find((r) => hasValue(r.details?.[key]));
      if (row) proof = provenanceFor(row, key);
    }
    if (["ingredients", "cooking_methods", "tags"].includes(key)) {
      const contributors = images.filter((r) =>
        hasValue(r.classification[key]),
      );
      proof =
        contributors.length &&
        contributors.every((r) => provenanceFor(r, key).state === "confirmed")
          ? { state: "confirmed", origin: "user", confidence: null }
          : {
              state: hasValue(meal[key]) ? "estimated" : "unknown",
              origin: "mixed",
              confidence: null,
            };
    }
    if (!hasValue(meal[key]))
      proof = { state: "unknown", origin: proof.origin, confidence: null };
    meal.field_provenance[key] = proof;
    if (proof.state === "confirmed")
      meal.confirmed_values[key] = structuredClone(meal[key]);
  }
  const known = RECORD_FIELDS.filter((k) => hasValue(meal[k]));
  meal.review_status =
    known.length &&
    known.every((k) => meal.field_provenance[k].state === "confirmed")
      ? "確認済"
      : Object.keys(meal.confirmed_values).length
        ? "手動修正"
        : images.some((r) => r.classification.review_status === "未確認")
          ? "未確認"
          : "AI推定";
  return meal;
}
export function normalizeRecord(meal) {
  const details = Array.isArray(meal.meal_details)
    ? meal.meal_details[0]
    : meal.meal_details;
  if (details) return { ...meal, ...details, id: meal.id, record_version: 2 };
  if (meal.record_version === 2) return meal;
  // Preserve historical values; never reinterpret a legacy global status as field confirmations.
  return {
    ...meal,
    ...emptyDetails(),
    record_version: 1,
    confirmed_values: {},
    field_provenance: Object.fromEntries(
      RECORD_FIELDS.map((k) => [
        k,
        { state: "unverified", origin: "legacy", confidence: null },
      ]),
    ),
  };
}
export function confirmedRecord(meal) {
  const result = { id: meal.id };
  for (const key of RECORD_FIELDS)
    result[key] =
      meal.confirmed_values?.[key] ??
      (["ingredients", "cooking_methods", "tags"].includes(key) ? [] : null);
  return result;
}
export function normalizeStoreName(text) {
  return (text || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s\u3000・･]/g, "")
    .trim();
}
export function matchStores(stores, query) {
  const q = normalizeStoreName(query);
  return stores
    .filter(
      (s) =>
        !q ||
        normalizeStoreName(s.name).includes(q) ||
        normalizeStoreName(s.area).includes(q),
    )
    .sort(
      (a, b) =>
        (normalizeStoreName(b.name) === q) -
          (normalizeStoreName(a.name) === q) ||
        a.name.localeCompare(b.name, "ja"),
    )
    .slice(0, 30);
}
export function validateRecords(meals) {
  for (const m of meals) {
    if (
      m.amount_jpy !== null &&
      (!Number.isSafeInteger(m.amount_jpy) ||
        m.amount_jpy < 0 ||
        m.amount_jpy > 2147483647)
    )
      throw new Error("金額は0以上の整数（円）で入力してください。");
    if (
      m.satisfaction !== null &&
      (!Number.isInteger(m.satisfaction) ||
        m.satisfaction < 1 ||
        m.satisfaction > 5)
    )
      throw new Error("満足度は1〜5で入力してください。");
    for (const [key, value] of Object.entries(m.confirmed_values || {})) {
      if (
        m.field_provenance[key]?.state !== "confirmed" ||
        JSON.stringify(m[key]) !== JSON.stringify(value)
      )
        throw new Error("確定情報と確認状態が一致しません。");
    }
  }
}
