import { describe, expect, it } from "vitest";
import { baseRecord, deepFreeze } from "./fixtures.test-helpers";
import { judge } from "./judge";
import type { DecisionRecord } from "./schema";

function withActuals(
  target: DecisionRecord["target"]["baseline"],
  guard: DecisionRecord["target"]["baseline"],
  mutate?: (r: DecisionRecord) => void,
): DecisionRecord {
  const r = baseRecord();
  if (!r.outcome) throw new Error("fixture");
  r.outcome.actuals = { target, guard };
  mutate?.(r);
  return r;
}

describe("judge", () => {
  it("規則1：照合が無ければすべて null", () => {
    const r = baseRecord();
    delete r.outcome;
    expect(judge(r)).toEqual({
      rule_verdict: null,
      interval_position: null,
      target_hit: null,
      guard_ok: null,
      reasons: ["まだ照合していません"],
    });
  });

  it("規則2：28日に足りなければ判定できない（27日後）", () => {
    const r = withActuals(47, 11500, (x) => {
      if (x.outcome) x.outcome.reviewed_on = "2026-12-28";
    });
    const res = judge(r);
    expect(res.rule_verdict).toBe("undetermined");
    expect(res.reasons).toEqual(["期間が28日に足りません"]);
    expect(res.target_hit).toBeNull();
  });

  it("規則2の境界：ちょうど28日後なら判定する", () => {
    expect(judge(withActuals(47, 11500)).rule_verdict).toBe("as_expected");
  });

  it("規則3：定義が変わったら判定できない（規則2より後に見る）", () => {
    const r = withActuals(47, 11500, (x) => {
      if (x.outcome) x.outcome.definition_changed = true;
    });
    expect(judge(r)).toMatchObject({
      rule_verdict: "undetermined",
      reasons: ["数字の定義が途中で変わりました"],
    });
    const both = withActuals(47, 11500, (x) => {
      if (x.outcome) {
        x.outcome.definition_changed = true;
        x.outcome.reviewed_on = "2026-12-10";
      }
    });
    expect(judge(both).reasons).toEqual(["期間が28日に足りません"]);
  });

  describe("規則4：非公開の数字", () => {
    it("上げたい数字が非公開なら規則では判定しない", () => {
      const res = judge(withActuals({ undisclosed: true }, 11500));
      expect(res.rule_verdict).toBeNull();
      expect(res.reasons[0]).toBe(
        "数字が非公開のため、規則では判定できません。人が判定します",
      );
      expect(res.target_hit).toBeNull();
      expect(res.interval_position).toBeNull();
      expect(res.guard_ok).toBe(true);
    });
    it("守る数字が非公開でも同じ", () => {
      const res = judge(withActuals(47, { undisclosed: true }));
      expect(res.rule_verdict).toBeNull();
      expect(res.guard_ok).toBeNull();
      expect(res.target_hit).toBe(true);
    });
  });

  describe("規則5：上げたい数字が届いたか", () => {
    it("up：ちょうど low なら届いた", () => {
      expect(judge(withActuals(44, 11500)).target_hit).toBe(true);
    });
    it("up：low 未満なら届かない", () => {
      expect(judge(withActuals(43.9, 11500)).target_hit).toBe(false);
    });
    const down = (x: DecisionRecord) => {
      x.target.direction = "down";
    };
    it("down：ちょうど high なら届いた", () => {
      expect(judge(withActuals(52, 11500, down)).target_hit).toBe(true);
    });
    it("down：high を超えたら届かない", () => {
      expect(judge(withActuals(52.1, 11500, down)).target_hit).toBe(false);
    });
  });

  describe("規則6：守る数字が守れたか", () => {
    it("<=：ちょうど threshold なら守れた", () => {
      expect(judge(withActuals(47, 12000)).guard_ok).toBe(true);
    });
    it("<=：threshold を超えたら守れない", () => {
      expect(judge(withActuals(47, 12001)).guard_ok).toBe(false);
    });
    const ge = (x: DecisionRecord) => {
      x.guard.comparator = ">=";
    };
    it(">=：ちょうど threshold なら守れた", () => {
      expect(judge(withActuals(47, 12000, ge)).guard_ok).toBe(true);
    });
    it(">=：threshold 未満なら守れない", () => {
      expect(judge(withActuals(47, 11999, ge)).guard_ok).toBe(false);
    });
  });

  describe("規則7：結果の案", () => {
    it.each([
      [47, 11500, "as_expected"],
      [47, 13000, "partial_miss"],
      [40, 11500, "partial_miss"],
      [40, 13000, "miss"],
    ] as const)("実績 %s / %s → %s", (t, g, expected) => {
      expect(judge(withActuals(t, g)).rule_verdict).toBe(expected);
    });
  });

  describe("規則8：幅のどこに入ったか", () => {
    it.each([
      [43, "below"],
      [44, "inside"],
      [52, "inside"],
      [53, "above"],
    ] as const)("実績 %s → %s", (t, pos) => {
      expect(judge(withActuals(t, 11500)).interval_position).toBe(pos);
    });
  });

  it("幅の上を超えたら期待通りにし、理由に「良い側」と書く", () => {
    const res = judge(withActuals(60, 11500));
    expect(res.rule_verdict).toBe("as_expected");
    expect(res.interval_position).toBe("above");
    expect(res.reasons).toContain("予測の幅の外でした（良い側）");
  });

  it("down で幅の下を超えたら良い側", () => {
    const res = judge(
      withActuals(30, 11500, (x) => {
        x.target.direction = "down";
      }),
    );
    expect(res.rule_verdict).toBe("as_expected");
    expect(res.reasons).toContain("予測の幅の外でした（良い側）");
  });

  it("幅の内側なら幅の外の理由は出さない", () => {
    const res = judge(withActuals(47, 11500));
    expect(res.reasons.some((x) => x.startsWith("予測の幅の外"))).toBe(false);
  });

  it("入力を書き換えない", () => {
    const r = deepFreeze(withActuals(60, 13000));
    const before = structuredClone(r);
    expect(() => judge(r)).not.toThrow();
    expect(r).toEqual(before);
  });
});
