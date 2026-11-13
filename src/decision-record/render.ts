import type { DecisionRecord, DecisionValue, Verdict } from "./schema";

export type RenderDecisionCardOptions = {
  /** true のとき、数字をすべて「非公開」に置き換える（外に出す用）。定義と方向は残す。 */
  mask?: boolean;
};

const UNDISCLOSED = "非公開";

const VERDICT_LABEL: Record<Verdict, string> = {
  as_expected: "期待通り",
  partial_miss: "一部外れ",
  miss: "外れ",
  undetermined: "判定できない",
};

const CONFIDENCE_LABEL = { high: "高", medium: "中", low: "低" } as const;
const DIRECTION_LABEL = { up: "上げる", down: "下げる" } as const;
const COMPARATOR_LABEL = { ">=": "以上", "<=": "以下" } as const;
const POSITION_LABEL = {
  below: "幅より下",
  inside: "幅の内側",
  above: "幅より上",
} as const;

/** 1枚の判断カードを Markdown で出す。入力を書き換えない。 */
export function renderDecisionCard(
  record: DecisionRecord,
  options: RenderDecisionCardOptions = {},
): string {
  const mask = options.mask === true;
  const num = (n: number, unit: string) => (mask ? UNDISCLOSED : `${n}${unit}`);
  const val = (v: DecisionValue, unit: string) =>
    typeof v === "number" ? num(v, unit) : UNDISCLOSED;

  const { target, guard } = record;
  const lines: string[] = [];

  lines.push(`## 判断カード（${record.id}）`, "");

  lines.push("### 判断", "");
  lines.push(`- 判断：${record.decision}`);
  if (record.rollback !== undefined) lines.push(`- 戻し方：${record.rollback}`);
  lines.push(`- 決めた人：${record.decided_by}`);
  lines.push(`- 書いた日：${record.written_on}`, "");

  lines.push("### 状況の前提", "");
  for (const p of record.premises) lines.push(`- ${p}`);
  lines.push("");

  lines.push("### 期待する結果", "");
  lines.push(
    `- 上げたい数字：${target.metric}（${DIRECTION_LABEL[target.direction]}）`,
  );
  lines.push(`  - いまの値：${val(target.baseline, target.unit)}`);
  lines.push(
    `  - 予測の幅：${
      mask
        ? UNDISCLOSED
        : `${target.interval.low}〜${target.interval.high}${target.unit}`
    }`,
  );
  lines.push(
    `- 守る数字：${guard.metric}（${num(guard.threshold, guard.unit)} ${COMPARATOR_LABEL[guard.comparator]}を保つ）`,
  );
  lines.push(
    `- 確度：${CONFIDENCE_LABEL[record.confidence.level]}（${record.confidence.reason}）`,
  );
  lines.push("- 数字の定義：");
  for (const d of record.definitions) {
    lines.push(`  - ${d.metric}：${d.definition}（出典：${d.source}）`);
  }
  lines.push("");

  lines.push("### 期日と照合", "");
  lines.push(`- 期日：${record.review.due_on}`);
  lines.push(`- 比べるもの：${record.review.compare_with}`, "");

  lines.push("### 照合の結果", "");
  const o = record.outcome;
  if (!o) {
    lines.push("まだ照合していません。");
  } else {
    lines.push(`- 照合した日：${o.reviewed_on}`);
    lines.push(
      `- 実際の数字：上げたい数字 ${val(o.actuals.target, target.unit)}／守る数字 ${val(o.actuals.guard, guard.unit)}`,
    );
    lines.push(
      `- 定義が途中で変わったか：${o.definition_changed ? "はい" : "いいえ"}`,
    );
    lines.push(
      `- 結果：${VERDICT_LABEL[o.verdict]}（判定した人：${o.verdict_by === "person" ? "人" : "規則"}）`,
    );
    lines.push(
      `- 規則の判定：${o.rule_verdict === null ? "規則では判定できない" : VERDICT_LABEL[o.rule_verdict]}`,
    );
    if (o.override_reason !== undefined) {
      lines.push(`- 規則と違う判定にした理由：${o.override_reason}`);
    }
    lines.push(
      `- 幅のどこに入ったか：${o.interval_position === null ? "—" : POSITION_LABEL[o.interval_position]}`,
    );
    if (o.broken_premises.length === 0) {
      lines.push("- ずれた前提：なし");
    } else {
      lines.push("- ずれた前提：");
      for (const p of o.broken_premises) lines.push(`  - ${p}`);
    }
    lines.push(`- 次の判断：${o.next_decision}`);
  }

  return `${lines.join("\n")}\n`;
}
