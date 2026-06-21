import { GoogleGenAI } from "@google/genai";
import { AIError } from "../errors";
import type { AIProvider, CompleteOptions } from "./provider";

function readEnv(name: string): string | undefined {
  const processEnv = (
    globalThis as { process?: { env?: Record<string, string> } }
  ).process?.env;
  return processEnv?.[name];
}

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;

  constructor(apiKey?: string) {
    const resolvedApiKey = apiKey ?? readEnv("GEMINI_API_KEY");
    if (!resolvedApiKey) {
      throw new AIError("GEMINI_API_KEY is required");
    }
    this.client = new GoogleGenAI({ apiKey: resolvedApiKey });
  }

  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    try {
      const models = this.client.models as any;
      const res = await models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: opts.temperature ?? 0.2,
          maxOutputTokens: opts.maxTokens,
          responseMimeType: opts.json ? "application/json" : undefined,
        },
      });
      return res.text ?? "";
    } catch (error) {
      throw new AIError(
        error instanceof Error ? error.message : "completion failed",
      );
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const models = this.client.models as any;
      const embeddings = await Promise.all(
        texts.map(async (text) => {
          const res = await models.embedContent({
            model: "text-embedding-004",
            contents: text,
          });
          return res.embeddings?.[0]?.values ?? [];
        }),
      );
      return embeddings;
    } catch (error) {
      throw new AIError(
        error instanceof Error ? error.message : "embedding failed",
      );
    }
  }
}
