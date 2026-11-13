import { isAtLeastReviewDaysAfter, MIN_REVIEW_DAYS } from "./dates";
import type {
  DecisionRecord,
  DecisionValue,
  IntervalPosition,
  Verdict,
} from "./schema";

export type JudgeResult = {
  rule_verdict: Verdict | null;
  interval_position: IntervalPosition;
  target_hit: boolean | null;
  guard_ok: boolean | null;
  /** なぜその判定になったか。日本語で1行ずつ。 */
  reasons: string[];
};

const isNumber = (v: DecisionValue): v is number => typeof v === "number";

function positionOf(
  actual: number,
  low: number,
  high: number,
): Exclude<IntervalPosition, null> {
  if (actual < low) return "below";
  if (actual > high) return "above";
  return "inside";
}

/**
 * 判定の「案」を出す。決めるのは人。
 * 純粋な関数で、record を書き換えない。
 */
export function judge(record: DecisionRecord): JudgeResult {
  const o = record.outcome;

  // 規則1：まだ照合していない
  if (!o) {
    return {
      rule_verdict: null,
      interval_position: null,
      target_hit: null,
      guard_ok: null,
      reasons: ["まだ照合していません"],
    };
  }

  // 規則2：期間が足りない
  if (!isAtLeastReviewDaysAfter(record.written_on, o.reviewed_on)) {
    return {
      rule_verdict: "undetermined",
      interval_position: null,
      target_hit: null,
      guard_ok: null,
      reasons: [`期間が${MIN_REVIEW_DAYS}日に足りません`],
    };
  }

  // 規則3：定義が途中で変わった
  if (o.definition_changed) {
    return {
      rule_verdict: "undetermined",
      interval_position: null,
      target_hit: null,
      guard_ok: null,
      reasons: ["数字の定義が途中で変わりました"],
    };
  }

  const { target, guard } = record;
  const reasons: string[] = [];
  let target_hit: boolean | null = null;
  let interval_position: IntervalPosition = null;
  let guard_ok: boolean | null = null;

  // 規則5・8：上げたい数字が届いたか／幅のどこに入ったか
  const actualTarget = o.actuals.target;
  if (isNumber(actualTarget)) {
    const { low, high } = target.interval;
    interval_position = positionOf(actualTarget, low, high);
    if (target.direction === "up") {
      target_hit = actualTarget >= low;
      reasons.push(
        target_hit
          ? `上げたい数字は届きました（実績 ${actualTarget} ≥ 幅の下限 ${low}）`
          : `上げたい数字は届きませんでした（実績 ${actualTarget} < 幅の下限 ${low}）`,
      );
    } else {
      target_hit = actualTarget <= high;
      reasons.push(
        target_hit
          ? `上げたい数字は届きました（実績 ${actualTarget} ≤ 幅の上限 ${high}）`
          : `上げたい数字は届きませんでした（実績 ${actualTarget} > 幅の上限 ${high}）`,
      );
    }
    if (interval_position !== "inside") {
      const goodSide =
        (target.direction === "up" && interval_position === "above") ||
        (target.direction === "down" && interval_position === "below");
      reasons.push(
        goodSide
          ? "予測の幅の外でした（良い側）"
          : "予測の幅の外でした（悪い側）",
      );
    }
  }

  // 規則6：守る数字が守れたか
  const actualGuard = o.actuals.guard;
  if (isNumber(actualGuard)) {
    guard_ok =
      guard.comparator === ">="
        ? actualGuard >= guard.threshold
        : actualGuard <= guard.threshold;
    reasons.push(
      `守る数字は${guard_ok ? "守れました" : "守れませんでした"}（実績 ${actualGuard}、基準 ${guard.comparator} ${guard.threshold}）`,
    );
  }

  // 規則4：数字が非公開なら、規則では判定しない
  if (!isNumber(actualTarget) || !isNumber(actualGuard)) {
    return {
      rule_verdict: null,
      interval_position,
      target_hit,
      guard_ok,
      reasons: [
        "数字が非公開のため、規則では判定できません。人が判定します",
        ...reasons,
      ],
    };
  }

  // 規則7：両方そろえば期待通り、片方なら一部外れ、両方だめなら外れ
  let rule_verdict: Verdict;
  if (target_hit && guard_ok) {
    rule_verdict = "as_expected";
    reasons.push("上げたい数字も守る数字もそろったので、期待通りです");
  } else if (target_hit || guard_ok) {
    rule_verdict = "partial_miss";
    reasons.push("片方だけそろったので、一部外れです");
  } else {
    rule_verdict = "miss";
    reasons.push("どちらもそろわなかったので、外れです");
  }

  return { rule_verdict, interval_position, target_hit, guard_ok, reasons };
}
