// schema/decision-record.v1.json を src/decision-record/schema.ts（Zod）から生成する。
// 手で編集しない。`npm run schema:build` で書き出す（先に build が走る）。
import { writeFileSync } from "node:fs";
import { decisionRecordJsonSchema } from "../dist/index.js";

const out = new URL("../schema/decision-record.v1.json", import.meta.url);
writeFileSync(out, `${JSON.stringify(decisionRecordJsonSchema(), null, 2)}\n`);
console.log(`wrote ${out.pathname}`);
