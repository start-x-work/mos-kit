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

## 関連 OSS / Marketing-OS OSS line

これらのツールキットが `mos-kit` を基盤に使っています:

- [marketing-os-seo](https://github.com/start-x-work/marketing-os-seo) — SEO (LLMO/AEO) · `npx @start-x-work/mos-seo`
- [marketing-os-ads](https://github.com/start-x-work/marketing-os-ads) — Ads · `npx @start-x-work/mos-ads`
- [marketing-os-social](https://github.com/start-x-work/marketing-os-social) — Social · `npx @start-x-work/mos-social`

同じ OSS ライン: [mos-video](https://github.com/start-x-work/mos-video)（SNS動画の内製パイプライン）・[mos-creative](https://github.com/start-x-work/mos-creative)（クリエイティブ制作支援）・[manifesto](https://github.com/start-x-work/manifesto)（思想・境界線）。

## License

Apache-2.0
