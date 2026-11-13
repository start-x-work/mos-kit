import type { DecisionRecord } from "./schema";

/** テスト用の記録。自由記述の欄に数字を入れていない（mask の確認で使うため）。 */
export function baseRecord(): DecisionRecord {
  return {
    schema: "decision-record/v1",
    id: "sample-a",
    written_on: "2026-12-01",
    decided_by: "担当者",
    decision: "案内文を切り替える。対象は問い合わせページだけ。",
    rollback: "元の案内文に戻す",
    premises: ["訪問数は横ばい", "料金の変更はない"],
    definitions: [
      {
        metric: "問い合わせ数",
        definition: "送信が完了した件数",
        source: "フォームの記録",
      },
      {
        metric: "一件あたりの費用",
        definition: "広告費を問い合わせ数で割った値",
        source: "請求額とフォームの記録",
      },
    ],
    target: {
      metric: "問い合わせ数",
      direction: "up",
      baseline: 40,
      interval: { low: 44, high: 52 },
      unit: "件",
    },
    guard: {
      metric: "一件あたりの費用",
      comparator: "<=",
      threshold: 12000,
      unit: "円",
    },
    confidence: { level: "medium", reason: "似た前例がある" },
    review: { due_on: "2026-12-29", compare_with: "切り替え前の同じ数字" },
    outcome: {
      reviewed_on: "2026-12-29",
      actuals: { target: 47, guard: 11500 },
      definition_changed: false,
      verdict: "as_expected",
      verdict_by: "person",
      rule_verdict: "as_expected",
      interval_position: "inside",
      broken_premises: [],
      next_decision: "続ける",
    },
  };
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
