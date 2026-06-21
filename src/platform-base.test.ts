import { describe, expect, it } from "vitest";
import type { ReadOnlyPlatform } from "./platform-base";

interface Entity {
  id: string;
}

interface Metrics {
  value: number;
}

const platform: ReadOnlyPlatform<Entity, Metrics> = {
  async list() {
    return [{ id: "1" }];
  },
  async get(id: string) {
    return { id };
  },
  async getMetrics(_id: string) {
    return { value: 1 };
  },
};

describe("ReadOnlyPlatform", () => {
  it("supports read-only operations only", async () => {
    expect(await platform.list()).toEqual([{ id: "1" }]);
    expect(await platform.get("demo")).toEqual({ id: "demo" });
    expect(await platform.getMetrics("demo")).toEqual({ value: 1 });
  });
});
