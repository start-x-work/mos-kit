import { z } from "zod";
import { isAtLeastReviewDaysAfter, isRealDate, MIN_REVIEW_DAYS } from "./dates";

export const DECISION_RECORD_SCHEMA_ID = "decision-record/v1";

const text = (title: string) =>
  z.string().regex(/\S/, `${title}は空欄にできません`).meta({ title });

const date = (title: string) =>
  z.iso
    .date({ message: `${title}は YYYY-MM-DD の実在する日付にしてください` })
    .refine(isRealDate, {
      message: `${title}は YYYY-MM-DD の実在する日付にしてください`,
    })
    .meta({ title });

/** 数字。外に出さないときは { undisclosed: true }（非公開）。 */
const ValueSchema = z
  .union([
    z.number(),
    z.strictObject({ undisclosed: z.literal(true) }).meta({ title: "非公開" }),
  ])
  .meta({ title: "数字" });

const VerdictSchema = z
  .enum(["as_expected", "partial_miss", "miss", "undetermined"])
  .meta({
    title: "結果",
    description:
      "as_expected=期待通り, partial_miss=一部外れ, miss=外れ, undetermined=判定できない",
  });

const IntervalPositionSchema = z
  .enum(["below", "inside", "above"])
  .nullable()
  .meta({ title: "幅のどこに入ったか" });

const DefinitionSchema = z
  .strictObject({
    metric: text("指標"),
    definition: text("定義"),
    source: text("出典"),
  })
  .meta({ title: "数字の定義" });

const TargetSchema = z
  .strictObject({
    metric: text("指標"),
    direction: z
      .enum(["up", "down"])
      .meta({ title: "向き", description: "up=上げる, down=下げる" }),
    baseline: ValueSchema.meta({ title: "いまの値" }),
    interval: z
      .strictObject({
        low: z.number().meta({ title: "幅の下限" }),
        high: z.number().meta({ title: "幅の上限" }),
      })
      .meta({ title: "予測の幅" }),
    unit: text("単位"),
  })
  .meta({ title: "上げたい数字" });

const GuardSchema = z
  .strictObject({
    metric: text("指標"),
    comparator: z.enum([">=", "<="]).meta({ title: "比べ方" }),
    threshold: z.number().meta({ title: "しきい値" }),
    unit: text("単位"),
  })
  .meta({ title: "守る数字" });

const ConfidenceSchema = z
  .strictObject({
    level: z
      .enum(["high", "medium", "low"])
      .meta({ title: "確度の段階", description: "high=高, medium=中, low=低" }),
    reason: text("確度の理由"),
  })
  .meta({ title: "確度" });

const ReviewSchema = z
  .strictObject({
    due_on: date("期日"),
    compare_with: text("比べるもの"),
  })
  .meta({ title: "期日と比べるもの" });

const OutcomeSchema = z
  .strictObject({
    reviewed_on: date("照合した日"),
    actuals: z
      .strictObject({
        target: ValueSchema.meta({ title: "上げたい数字の実績" }),
        guard: ValueSchema.meta({ title: "守る数字の実績" }),
      })
      .meta({ title: "実際の数字" }),
    definition_changed: z.boolean().meta({ title: "定義が途中で変わったか" }),
    verdict: VerdictSchema,
    verdict_by: z
      .enum(["rule", "person"])
      .meta({ title: "判定した人", description: "rule=規則, person=人" }),
    rule_verdict: VerdictSchema.nullable().meta({ title: "規則の判定" }),
    override_reason: text("規則と違う判定にした理由").optional(),
    interval_position: IntervalPositionSchema,
    broken_premises: z.array(text("ずれた前提")).meta({ title: "ずれた前提" }),
    next_decision: text("次の判断"),
  })
  .meta({ title: "照合" });

export const DecisionRecordSchema = z
  .strictObject({
    schema: z.literal(DECISION_RECORD_SCHEMA_ID),
    id: text("ID"),
    written_on: date("書いた日"),
    decided_by: text("決めた人"),
    decision: text("判断"),
    rollback: text("戻し方").optional(),
    premises: z
      .array(text("状況の前提"))
      .min(1, "状況の前提を1つ以上書いてください")
      .meta({ title: "状況の前提" }),
    definitions: z
      .array(DefinitionSchema)
      .min(1, "数字の定義を1つ以上書いてください")
      .meta({ title: "数字の定義" }),
    target: TargetSchema,
    guard: GuardSchema,
    confidence: ConfidenceSchema,
    review: ReviewSchema,
    outcome: OutcomeSchema.optional(),
  })
  .superRefine((r, ctx) => {
    const metrics = new Set(r.definitions.map((d) => d.metric));
    if (!metrics.has(r.target.metric)) {
      ctx.addIssue({
        code: "custom",
        path: ["target", "metric"],
        message: "上げたい数字の指標が、数字の定義にありません",
      });
    }
    if (!metrics.has(r.guard.metric)) {
      ctx.addIssue({
        code: "custom",
        path: ["guard", "metric"],
        message: "守る数字の指標が、数字の定義にありません",
      });
    }
    if (r.target.interval.low > r.target.interval.high) {
      ctx.addIssue({
        code: "custom",
        path: ["target", "interval"],
        message: "予測の幅の下限が上限より大きくなっています",
      });
    }
    if (!isAtLeastReviewDaysAfter(r.written_on, r.review.due_on)) {
      ctx.addIssue({
        code: "custom",
        path: ["review", "due_on"],
        message: `期日は書いた日の${MIN_REVIEW_DAYS}日後以降にしてください`,
      });
    }
    const o = r.outcome;
    if (!o) return;
    if (!isAtLeastReviewDaysAfter(r.written_on, o.reviewed_on)) {
      ctx.addIssue({
        code: "custom",
        path: ["outcome", "reviewed_on"],
        message: `照合した日は書いた日の${MIN_REVIEW_DAYS}日後以降にしてください`,
      });
    }
    if (
      o.verdict_by === "person" &&
      o.rule_verdict !== null &&
      o.rule_verdict !== o.verdict &&
      o.override_reason === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["outcome", "override_reason"],
        message: "規則の判定と違う結果にするときは、理由を書いてください",
      });
    }
  })
  .meta({
    title: "判断の照合の記録",
    description:
      "decision-record/v1。判定は案で、決めるのは人。記録だけで、外部の媒体は操作しない。",
  });

export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;
export type DecisionValue = z.infer<typeof ValueSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type IntervalPosition = z.infer<typeof IntervalPositionSchema>;
export type DecisionOutcome = z.infer<typeof OutcomeSchema>;

/** JSON Schema（draft 2020-12）。schema/decision-record.v1.json はこれから生成する。 */
export function decisionRecordJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(DecisionRecordSchema, { io: "input" }) as Record<
    string,
    unknown
  >;
}
