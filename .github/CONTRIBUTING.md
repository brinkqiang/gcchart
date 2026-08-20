# Contributing

English | [日本語](CONTRIBUTING.ja.md)

Thanks for your interest! Bug reports, feature ideas, and pull requests are all welcome.

## Bugs / feature requests

Open an issue with:
- A short description of what you saw and what you expected
- A way to reproduce it (workflow YAML snippet, CLI command, etc.)
- For visual issues: a sample SVG / PNG, and the variant query string used

## Local development

```bash
git clone https://github.com/pipipi-dev/gcchart.git
cd gcchart
npm install

# Run the CLI against your own GitHub data
GITHUB_TOKEN=ghp_xxx GITHUB_USER=your-username npm run fetch

# Regenerate the synthetic samples in sample/
npm run sample

# Type check / build
npm run lint
npm run build
```

## Pull requests

- Keep the diff focused - one concern per PR
- If you change the rendering code, run `npm run sample` and commit the
  updated `sample/` SVGs (the README hero image is sourced from there)
- Update `CHANGELOG.md` under an `## [Unreleased]` heading
- Make sure `npm run lint` and `npm run build` pass

## Project layout

| Path | Purpose |
|---|---|
| `src/cli.ts` | CLI entry - used by `npx gcchart` |
| `src/action.ts` | Action entry - used by the GitHub Action runtime |
| `src/svg/` | SVG renderers (`sketchy.ts` / `clean.ts`) and shared helpers |
| `src/share/` | Interactive "Share on X" flow (PNG conversion, clipboard, browser launcher) |
| `src/preview.ts` | Variant definitions + preview HTML generator (used by both CLI and the sample script) |
| `scripts/sample.ts` | Synthetic-data sample generator (writes to `sample/`) |
| `docs/` | Setup guides for first-time GitHub Actions users |

## Releases

Tagged releases drive both the npm package and the GitHub Marketplace listing:

```bash
git tag v1.0.0 && git push origin v1.0.0
git tag -f v1  && git push -f origin v1   # major-version alias
npm publish
```
