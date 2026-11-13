# 判断の照合の型（decision-record/v1）

- **何のための型か**：判断を「何を決め、何を期待し、いつ何と比べるか」の形で残し、期日に実際の数字と照合するための記録の型です。
- **判定は案で、決めるのは人です**：`judge` は規則に沿った判定の案を出すだけです。結果を決めるのは人で、規則の判定と違う結果にするときは理由を書かないと保存できません。
- **記録だけで、媒体を操作しません**：この型は記録の検証・判定の案・Markdown の出力だけを行います。通信もファイルへの書き込みもしません。

```ts
import {
  DecisionRecordSchema,
  judge,
  renderDecisionCard,
} from "@start-x-work/mos-kit";

const record = DecisionRecordSchema.parse(input); // 形が合わなければ失敗する
const proposal = judge(record); // 判定の案（記録は書き換えない）
const markdown = renderDecisionCard(record, { mask: true }); // 外に出す用
```

JSON Schema（draft 2020-12）は `@start-x-work/mos-kit/schema/decision-record.v1.json` にあります。Zod の型から生成していて、手では書いていません。ただし「指標が数字の定義にあるか」「28日」「理由の無い上書き」のように複数の欄にまたがる決まりは JSON Schema では表せないため、`DecisionRecordSchema` でだけ確かめます。

## 項目

日本語の名前は JSON Schema の `title` に入っています。

| キー | 日本語の名前 | 型・規則 |
|---|---|---|
| `schema` | — | `"decision-record/v1"` 固定 |
| `id` | — | 文字列（空欄不可） |
| `written_on` | 書いた日 | 実在する日付（YYYY-MM-DD） |
| `decided_by` | 決めた人 | 人の名前か役割。ツールや AI の名前は書かない |
| `decision` | 判断 | 1文。何を・どの範囲で・いつから。戻せる形で書く |
| `rollback` | 戻し方 | 任意 |
| `premises` | 状況の前提 | 文字列の配列。1つ以上 |
| `definitions` | 数字の定義 | `{ metric, definition, source }` の配列。1つ以上。`target.metric` と `guard.metric` は必ずここにある |
| `target` | 上げたい数字 | `{ metric, direction: "up"\|"down", baseline: Value, interval: { low, high }, unit }`。`low <= high` |
| `guard` | 守る数字 | `{ metric, comparator: ">="\|"<=", threshold, unit }` |
| `confidence` | 確度 | `{ level: "high"\|"medium"\|"low", reason }`（表示は 高・中・低） |
| `review` | 期日と比べるもの | `{ due_on, compare_with }`。`due_on` は `written_on` の28日後以降 |
| `outcome` | 照合 | 任意（照合の前は無い） |

`outcome` の中：

| キー | 日本語の名前 | 型・規則 |
|---|---|---|
| `reviewed_on` | 照合した日 | 実在する日付。`written_on` の28日後以降 |
| `actuals` | 実際の数字 | `{ target: Value, guard: Value }` |
| `definition_changed` | 定義が途中で変わったか | 真偽。必須（省略すると失敗する） |
| `verdict` | 結果 | `"as_expected"\|"partial_miss"\|"miss"\|"undetermined"`（表示は 期待通り・一部外れ・外れ・判定できない） |
| `verdict_by` | 判定した人 | `"rule"\|"person"` |
| `rule_verdict` | 規則の判定 | `verdict` の4つか `null`（規則で判定できないとき） |
| `override_reason` | 規則と違う判定にした理由 | `verdict_by` が `person` で、`rule_verdict` が `null` でなく `verdict` と違うときは必須 |
| `interval_position` | 幅のどこに入ったか | `"below"\|"inside"\|"above"\|null` |
| `broken_premises` | ずれた前提 | 文字列の配列。無ければ空の配列（「なし」と書かない） |
| `next_decision` | 次の判断 | 文字列。続けるなら「続ける」 |

`Value` は数か `{ "undisclosed": true }`（数字を外に出さないとき＝非公開）です。

### 入力の検証

- 実在しない日付（`2027-02-30` など）は失敗にします。
- 数として読めない値（`"12%"` のような文字列、`NaN`、`Infinity`）は失敗にします。
- 空欄・空の配列・欠けた欄を既定値で埋めません。必須の欄が無ければ失敗にします。
- 知らない欄があっても失敗にします（書き間違いに気づくため）。

## 判定の規則（`judge`）

`judge(record)` は次の形を返します。上から順に見ます。

```ts
type JudgeResult = {
  rule_verdict: Verdict | null;
  interval_position: "below" | "inside" | "above" | null;
  target_hit: boolean | null;
  guard_ok: boolean | null;
  reasons: string[]; // なぜその判定になったか（日本語で1行ずつ）
};
```

1. `outcome` が無い → すべて `null`。理由「まだ照合していません」
2. `reviewed_on` が `written_on` の28日後より前 → `undetermined`。理由「期間が28日に足りません」
3. `definition_changed` が `true` → `undetermined`。理由「数字の定義が途中で変わりました」
4. 実績のどちらかが非公開 → `rule_verdict: null`。理由「数字が非公開のため、規則では判定できません。人が判定します」（公開されている側の `target_hit`・`guard_ok`・`interval_position` は出します）
5. 上げたい数字が届いたか：`up` なら `実績 >= low`、`down` なら `実績 <= high`
6. 守る数字が守れたか：`comparator` のとおり `実績` と `threshold` を比べる
7. 両方そろえば `as_expected`、片方だけなら `partial_miss`、両方だめなら `miss`
8. 幅のどこに入ったか：`実績 < low` → `below`、`low <= 実績 <= high` → `inside`、`実績 > high` → `above`

**予測の当たり方と、判断の結果は分けます。** 上げたい数字が幅の良い側の外に出た（期待以上）ときも `as_expected` にし、理由に「予測の幅の外でした（良い側）」と書きます。悪い側に外れたときは「予測の幅の外でした（悪い側）」と書きます。

## 見本

[`examples/decision-record.example.json`](../examples/decision-record.example.json) を見てください。値はすべて見本です。

## 1枚を Markdown で出す（`renderDecisionCard`）

判断 → 状況の前提 → 期待する結果 → 期日と照合 → 照合の結果 の順に出します。HTML は出しません。

`{ mask: true }` を渡すと、数の欄（いまの値・予測の幅・しきい値・実際の数字）をすべて「非公開」に置き換えます。指標・定義・向き・比べ方は残します。日付と ID はそのまま出ます。**判断や前提などの自由記述の文に書いた数字は置き換えません**。外に出す前に文の中身を確かめてください。

## この型を使う道具

- [marketing-os-ads](https://github.com/start-x-work/marketing-os-ads) — 判断ログから、この型の下書きを出す（対応中）
- [forecast-manifesto](https://github.com/start-x-work/forecast-manifesto) — 予測の幅を `target.interval` に渡す例（対応中）

---

## English summary

`decision-record/v1` is a record type for checking a decision against its outcome. A record states the decision, its premises, metric definitions, a target metric with a forecast interval, a guard metric with a threshold, confidence, and a review date at least 28 days after it was written.

- `DecisionRecordSchema` (Zod v4) validates a record. It rejects non-existent dates, non-numeric values (`"12%"`, `NaN`, `Infinity`), empty or missing required fields, metrics missing from `definitions`, `low > high`, reviews earlier than 28 days, a missing `definition_changed`, and a person's verdict that differs from the rule verdict without `override_reason`. Nothing is filled with defaults.
- `judge(record)` is a pure function that returns a **proposed** verdict with Japanese reasons. People make the final call. Whether the actual value landed inside the forecast interval (`interval_position`) is kept separate from whether the decision went as expected (`verdict`).
- `renderDecisionCard(record, { mask })` returns a Markdown card. `mask: true` replaces numeric fields with 「非公開」 (undisclosed); free-text fields are not masked.
- The JSON Schema is generated from the Zod schema and shipped as `schema/decision-record.v1.json`.

The module only validates, judges, and renders. It does not perform network requests, write files, or operate any external platform.
