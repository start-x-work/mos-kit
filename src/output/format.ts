export type Format = "json" | "table" | "markdown";

export function normalizeFormat(format: unknown): Format {
  if (format === "json" || format === "markdown" || format === "table") {
    return format;
  }
  return "table";
}
