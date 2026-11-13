import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseRecord } from "./fixtures.test-helpers";
import { DecisionRecordSchema, decisionRecordJsonSchema } from "./schema";

const root = new URL("../../", import.meta.url);
const readJson = (path: string) =>
  JSON.parse(readFileSync(new URL(path, root), "utf8"));

/** 記録を部分的に変えて検証する。 */
function parseWith(mutate: (r: any) => void) {
  const r: any = structuredClone(baseRecord());
  mutate(r);
  return DecisionRecordSchema.safeParse(r);
}

describe("DecisionRecordSchema", () => {
  it("見本（examples/decision-record.example.json）を通す", () => {
    const example = readJson("examples/decision-record.example.json");
    expect(DecisionRecordSchema.safeParse(example).success).toBe(true);
  });

  it("テスト用の記録と、照合の前の記録を通す", () => {
    expect(DecisionRecordSchema.safeParse(baseRecord()).success).toBe(true);
    expect(
      parseWith((r) => {
        delete r.outcome;
      }).success,
    ).toBe(true);
  });

  it("値を書き換えたり既定値で埋めたりしない", () => {
    const input = baseRecord();
    delete input.rollback;
    const out = DecisionRecordSchema.parse(input);
    expect(out).toEqual(input);
    expect("rollback" in out).toBe(false);
  });

  describe("実在しない日付を弾く", () => {
    it.each([
      ["written_on", "2027-02-30"],
      ["written_on", "2026-13-01"],
      ["written_on", "2026/12/01"],
      ["written_on", "2026-12-1"],
    ])("%s = %s", (key, value) => {
      expect(parseWith((r) => (r[key] = value)).success).toBe(false);
    });

    it("期日と照合した日も検証する", () => {
      expect(parseWith((r) => (r.review.due_on = "2027-02-30")).success).toBe(
        false,
      );
      expect(
        parseWith((r) => (r.outcome.reviewed_on = "2027-02-31")).success,
      ).toBe(false);
    });

    it("うるう日は実在すれば通す", () => {
      const res = parseWith((r) => {
        r.written_on = "2028-01-31";
        r.review.due_on = "2028-02-29";
        r.outcome.reviewed_on = "2028-02-29";
      });
      expect(res.success).toBe(true);
    });
  });

  describe("数として読めない値を弾く", () => {
    it.each([
      ["文字列 12%", "12%"],
      ["数字の文字列", "12"],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["-Infinity", Number.NEGATIVE_INFINITY],
      ["null", null],
    ])("%s", (_label, bad) => {
      expect(parseWith((r) => (r.target.baseline = bad)).success).toBe(false);
      expect(parseWith((r) => (r.target.interval.low = bad)).success).toBe(
        false,
      );
      expect(parseWith((r) => (r.guard.threshold = bad)).success).toBe(false);
      expect(parseWith((r) => (r.outcome.actuals.target = bad)).success).toBe(
        false,
      );
      expect(parseWith((r) => (r.outcome.actuals.guard = bad)).success).toBe(
        false,
      );
    });

    it("非公開は { undisclosed: true } だけを認める", () => {
      expect(
        parseWith((r) => (r.target.baseline = { undisclosed: true })).success,
      ).toBe(true);
      expect(
        parseWith((r) => (r.target.baseline = { undisclosed: false })).success,
      ).toBe(false);
      expect(parseWith((r) => (r.target.baseline = "非公開")).success).toBe(
        false,
      );
    });
  });

  it("数字の定義に無い指標を弾く（上げたい数字・守る数字）", () => {
    expect(parseWith((r) => (r.target.metric = "別の指標")).success).toBe(
      false,
    );
    expect(parseWith((r) => (r.guard.metric = "別の指標")).success).toBe(false);
  });

  it("low > high を弾き、low = high は通す", () => {
    expect(
      parseWith((r) => (r.target.interval = { low: 53, high: 52 })).success,
    ).toBe(false);
    expect(
      parseWith((r) => (r.target.interval = { low: 52, high: 52 })).success,
    ).toBe(true);
  });

  describe("28日の決まり", () => {
    it("照合した日が28日未満なら弾く（27日後）", () => {
      expect(
        parseWith((r) => (r.outcome.reviewed_on = "2026-12-28")).success,
      ).toBe(false);
    });
    it("期日が28日未満なら弾く（27日後）", () => {
      expect(parseWith((r) => (r.review.due_on = "2026-12-28")).success).toBe(
        false,
      );
    });
    it("ちょうど28日後は通す（月・年をまたぐ場合も）", () => {
      expect(
        parseWith((r) => {
          r.written_on = "2026-12-20";
          r.review.due_on = "2027-01-17";
          r.outcome.reviewed_on = "2027-01-17";
        }).success,
      ).toBe(true);
    });
  });

  it("definition_changed の欠落を弾く（黙って false にしない）", () => {
    expect(
      parseWith((r) => {
        delete r.outcome.definition_changed;
      }).success,
    ).toBe(false);
  });

  describe("規則と違う判定の理由", () => {
    const override = (r: any) => {
      r.outcome.verdict_by = "person";
      r.outcome.rule_verdict = "partial_miss";
      r.outcome.verdict = "as_expected";
    };
    it("理由が無ければ弾く", () => {
      expect(parseWith(override).success).toBe(false);
    });
    it("理由があれば通す", () => {
      expect(
        parseWith((r) => {
          override(r);
          r.outcome.override_reason = "守る数字の超過は一時的な請求の重なり";
        }).success,
      ).toBe(true);
    });
    it("理由が空欄なら弾く", () => {
      expect(
        parseWith((r) => {
          override(r);
          r.outcome.override_reason = "  ";
        }).success,
      ).toBe(false);
    });
    it("規則で判定できない（null）ときは、理由が無くても通す", () => {
      expect(
        parseWith((r) => {
          r.outcome.verdict_by = "person";
          r.outcome.rule_verdict = null;
          r.outcome.verdict = "partial_miss";
        }).success,
      ).toBe(true);
    });
  });

  describe("空欄・空の配列・欠けた欄を既定値で埋めない", () => {
    it.each([
      ["id", (r: any) => (r.id = "")],
      ["decided_by", (r: any) => (r.decided_by = "   ")],
      ["decision", (r: any) => delete r.decision],
      ["premises 空", (r: any) => (r.premises = [])],
      ["premises 欠落", (r: any) => delete r.premises],
      ["premises の空欄", (r: any) => (r.premises = [""])],
      ["definitions 空", (r: any) => (r.definitions = [])],
      ["confidence 欠落", (r: any) => delete r.confidence],
      ["review 欠落", (r: any) => delete r.review],
      ["broken_premises 欠落", (r: any) => delete r.outcome.broken_premises],
      ["next_decision 空", (r: any) => (r.outcome.next_decision = "")],
      ["schema が違う", (r: any) => (r.schema = "decision-record/v2")],
      ["知らない欄", (r: any) => (r.extra = 1)],
    ])("%s", (_label, mutate) => {
      expect(parseWith(mutate).success).toBe(false);
    });

    it("broken_premises の空の配列は通す（「なし」と書かない）", () => {
      expect(parseWith((r) => (r.outcome.broken_premises = [])).success).toBe(
        true,
      );
    });
  });
});

describe("JSON Schema", () => {
  it("コミットされた schema/decision-record.v1.json が生成した物と一致する", () => {
    const committed = readJson("schema/decision-record.v1.json");
    expect(committed).toEqual(decisionRecordJsonSchema());
  });

  it("日本語の名前が title に入っている", () => {
    const s = decisionRecordJsonSchema() as any;
    expect(s.properties.written_on.title).toBe("書いた日");
    expect(s.properties.target.title).toBe("上げたい数字");
    expect(s.properties.outcome.title).toBe("照合");
    expect(s.properties.outcome.properties.verdict.title).toBe("結果");
  });
});
