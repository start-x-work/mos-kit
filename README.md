# @start-x-work/mos-kit

Shared foundation for Marketing-OS OSS toolkits.

## What it provides

- **AI abstraction** — `createProvider(model, apiKey)` for Gemini, OpenAI, and Anthropic
- **Errors** — `CliError`, `FetchError`, `AIError`
- **HTTP** — `fetchPage` with cheerio parsing and a 15s timeout
- **Output** — `render(result, format)` for json/table/markdown strings
- **Read-only platform base** — `ReadOnlyPlatform` without write methods
- **Commercial hint** — `COMMERCIAL_HINT` for optional OSS → commercial links

## Design constraints

This package intentionally does **not** expose create/update/post/publish APIs.
Ads and Social toolkits inherit `ReadOnlyPlatform` to keep automated submission
and posting structurally out of scope.

## Install

```bash
npm install @start-x-work/mos-kit
```

## License

Apache-2.0
