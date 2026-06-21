import { describe, expect, it } from "vitest";
import { render } from "./render";

describe("render", () => {
  it("renders JSON output", () => {
    expect(render({ ok: true }, "json")).toBe(
      JSON.stringify({ ok: true }, null, 2),
    );
  });

  it("renders markdown output", () => {
    expect(render({ score: 90 }, "markdown")).toContain("### score");
  });
});
