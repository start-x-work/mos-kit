import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseRecord, deepFreeze } from "./fixtures.test-helpers";
import { renderDecisionCard } from "./render";

describe("renderDecisionCard", () => {
  it("判断 → 前提 → 期待する結果 → 期日と照合 → 照合の結果 の順に出す", () => {
    const md = renderDecisionCard(baseRecord());
    const order = [
      "### 判断",
      "### 状況の前提",
      "### 期待する結果",
      "### 期日と照合",
      "### 照合の結果",
    ].map((h) => md.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("数字と日本語の表示を出す", () => {
    const md = renderDecisionCard(baseRecord());
    expect(md).toContain("いまの値：40件");
    expect(md).toContain("予測の幅：44〜52件");
    expect(md).toContain("12000円 以下を保つ");
    expect(md).toContain("確度：中");
    expect(md).toContain("結果：期待通り（判定した人：人）");
    expect(md).toContain("幅のどこに入ったか：幅の内側");
    expect(md).toContain("ずれた前提：なし");
    expect(md).not.toContain("<");
  });

  it("照合の前は「まだ照合していません」", () => {
    const r = baseRecord();
    delete r.outcome;
    expect(renderDecisionCard(r)).toContain("まだ照合していません。");
  });

  it("非公開の値は mask なしでも「非公開」", () => {
    const r = baseRecord();
    r.target.baseline = { undisclosed: true };
    expect(renderDecisionCard(r)).toContain("いまの値：非公開");
  });

  it("mask: true の出力に数字が1つも残らない（日付と ID を除く）", () => {
    const r = baseRecord();
    const md = renderDecisionCard(r, { mask: true });
    const withoutDatesAndId = md
      .replaceAll(/\d{4}-\d{2}-\d{2}/g, "")
      .replaceAll(r.id, "");
    expect(withoutDatesAndId).not.toMatch(/\d/);
    for (const n of ["40", "44", "52", "12000", "47", "11500"]) {
      expect(md).not.toContain(n);
    }
    expect(md).toContain("非公開");
  });

  it("mask: true でも定義と方向は残す", () => {
    const md = renderDecisionCard(baseRecord(), { mask: true });
    expect(md).toContain("問い合わせ数（上げる）");
    expect(md).toContain("以下を保つ");
    expect(md).toContain("送信が完了した件数");
  });

  it("入力を書き換えない", () => {
    const r = deepFreeze(baseRecord());
    const before = structuredClone(r);
    expect(() => renderDecisionCard(r, { mask: true })).not.toThrow();
    expect(r).toEqual(before);
  });
});

describe("decision-record のモジュール", () => {
  it("通信・ファイルへの書き込みをしない（fetch・fs を使わない）", () => {
    const dir = new URL("./", import.meta.url);
    const sources = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.includes(".test"),
    );
    expect(sources.length).toBeGreaterThan(0);
    for (const f of sources) {
      const src = readFileSync(new URL(f, dir), "utf8");
      expect(src, f).not.toMatch(/from\s+["'](node:)?fs(\/promises)?["']/);
      expect(src, f).not.toMatch(/\bfetch\s*\(/);
      expect(src, f).not.toMatch(/from\s+["']\.\.\/http/);
    }
  });
});
