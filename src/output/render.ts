import { type Format, normalizeFormat } from "./format";

export type { Format };

export function render(result: unknown, format: unknown = "table"): string {
  const normalized = normalizeFormat(format);
  if (normalized === "json") {
    return JSON.stringify(result, null, 2);
  }
  if (normalized === "markdown") {
    return toMarkdown(result);
  }
  return toTable(result);
}

function toMarkdown(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => `- ${toMarkdown(item)}`).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, entry]) => `### ${key}\n\n${toMarkdown(entry)}`)
      .join("\n\n");
  }
  return String(value);
}

function toTable(value: unknown): string {
  if (!value || typeof value !== "object") {
    return String(value);
  }
  const lines: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (Array.isArray(entry)) {
      lines.push(key);
      for (const item of entry) {
        lines.push(`  - ${formatEntry(item)}`);
      }
    } else {
      lines.push(`${key}: ${formatEntry(entry)}`);
    }
  }
  return lines.join("\n");
}

function formatEntry(value: unknown): string {
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
